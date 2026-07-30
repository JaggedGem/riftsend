import { type PeerId, WebRTCPeerErrorCode } from "@riftsend/shared";
import { SignalingClient } from "@/signaling/SignalingClient.js";
import { AnyControlMessageSchema, type AnyControlMessage } from "@riftsend/protocol";
import { TypedEventEmitter } from "@/events/TypedEventEmitter.js";
import { WebRTCConnectionError, WebRTCConnectionErrorCode } from "./errors";
import { getConfig } from "@/config/config";

/**
 * Default STUN servers used for NAT traversal.
 *
 * Multiple Google STUN servers are listed for redundancy, plus Cloudflare
 * and Nextcloud as fallbacks. No TURN servers are configured here — those
 * would be fetched from the signaling server at connection time.
 */
const iceServers: RTCIceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
    ],
  },
  {
    urls: ["stun:stun.cloudflare.com:3478"],
  },
  {
    urls: ["stun:stun.nextcloud.com:443"],
  },
];

const DATA_CHANNEL_LABEL = "riftsend-data";
const CONTROL_CHANNEL_LABEL = "riftsend-control";

type WebRTCConnectionEvents = {
  dataChannelOpen: RTCDataChannel;
  dataChannelMessage: ArrayBuffer;
  dataChannelClose: void;
  controlChannelOpen: RTCDataChannel;
  controlChannelMessage: AnyControlMessage;
  controlChannelClose: void;
  connectionStateChange: RTCIceConnectionState;
  iceConnectionStateChange: RTCIceConnectionState;
};

/**
 * Manages a single WebRTC peer connection to a remote peer.
 *
 * Creates two data channels:
 * - **Data channel** (`riftsend-data`): unordered binary transport for file bytes.
 * - **Control channel** (`riftsend-control`): ordered reliable transport for JSON metadata.
 *
 * ICE candidates received before the remote description is set are queued and
 * flushed once the remote description is available.
 *
 * ## Lifecycle
 *
 * 1. Construct with an active {@link SignalingClient} and the target peer ID.
 * 2. Call {@link initiateConnection} (sender side) OR receive {@link handleOffer} (receiver side).
 * 3. Exchange ICE candidates automatically via signaling.
 * 4. Use {@link sendData} / {@link sendControl} once `isReady()` returns `true`.
 * 5. Call {@link close} to tear down.
 */
export class WebRTCConnection extends TypedEventEmitter<WebRTCConnectionEvents> {
  private readonly pc: RTCPeerConnection;
  private readonly signaling: SignalingClient;
  private readonly remotePeer: PeerId;
  private readonly cleanupFns: (() => void)[] = [];
  private readonly config = getConfig();

  private controlChannel?: RTCDataChannel;
  private dataChannel?: RTCDataChannel;

  private dataReady = false;
  private controlReady = false;

  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

  private negotiationInProgress = false;

  public constructor(signaling: SignalingClient, remotePeer: PeerId) {
    super();

    this.pc = new RTCPeerConnection({
      iceServers,
    });

    this.signaling = signaling;
    this.remotePeer = remotePeer;

    this.setupPeerConnection();
    this.setupSignalingListeners();
  }

  // Public API

  /**
   * Creates data channels, generates an SDP offer, and sends it via signaling.
   *
   * Call this on the **sender** side after the peer is known.
   * The receiver side will receive the offer via {@link handleOffer}.
   *
   * @throws the error that occurred when setting everything up (rethrows)
   */
  public async initiateConnection(): Promise<void> {
    if (this.pc.signalingState !== "stable") {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.UNSTABLE_SIGNALING,
        "Cannot initiate negotiation while signaling state is not stable",
      );
    }

    if (this.negotiationInProgress) {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.NEGOTIATION_ALREADY_STARTED,
        "Cannot initiate negotiation while already negotiating",
      );
    }

    if (this.dataChannel || this.controlChannel) {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.CHANNEL_ALREADY_OPEN,
        "Cannot initiate the data/control channel if it is already open",
      );
    }

    if (this.pc.connectionState === "closed") {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.PEER_CONNECTION_CLOSED,
        "Cannot initiate negotiation if the peer connection is closed",
      );
    }

    this.negotiationInProgress = true;

    try {
      this.dataChannel = this.pc.createDataChannel(DATA_CHANNEL_LABEL, {
        ordered: false,
        maxRetransmits: 0,
      });
      this.setupDataChannel(this.dataChannel, "data");

      this.controlChannel = this.pc.createDataChannel(CONTROL_CHANNEL_LABEL, {
        ordered: true,
      });
      this.setupDataChannel(this.controlChannel, "control");

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.signaling.sendOffer(this.remotePeer, offer);
    } catch (error) {
      this.dataChannel?.close();
      this.controlChannel?.close();

      this.dataChannel = undefined;
      this.controlChannel = undefined;

      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.NEGOTIATION_ERROR,
        "An error occurred while negotiating",
        { cause: error },
      );
    } finally {
      this.negotiationInProgress = false;
    }
  }

  /**
   * Processes an incoming SDP offer from the remote peer.
   *
   * Handles glare (simultaneous offers), rolls back non-stable states, and
   * responds with an SDP answer.
   */
  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (offer.type !== "offer" || !offer.sdp) {
      this.signaling.sendError(this.remotePeer, {
        message: "Invalid offer: missing or malformed SDP",
        code: WebRTCPeerErrorCode.INVALID_OFFER,
      });
      return;
    }

    const currentState = this.pc.signalingState;

    if (currentState === "have-local-offer") {
      this.signaling.sendError(this.remotePeer, {
        message: "Glare: simultaneous offer detected",
        code: WebRTCPeerErrorCode.GLARE_CONFLICT,
      });
      return;
    }

    if (currentState !== "stable") {
      try {
        await this.pc.setLocalDescription({ type: "rollback" });
      } catch {
        this.signaling.sendError(this.remotePeer, {
          message: "Cannot accept offer: signaling state conflict",
          code: WebRTCPeerErrorCode.SIGNALING_STATE_CONFLICT,
        });
        return;
      }
    }

    try {
      await this.pc.setRemoteDescription(offer);
      this.remoteDescriptionSet = true;
      await this.flushPendingIceCandidates();
    } catch (error) {
      const wrappedError = new WebRTCConnectionError(
        WebRTCConnectionErrorCode.INVALID_OFFER,
        "Failed to accept remote offer",
        { cause: error },
      );

      this.signaling.sendError(this.remotePeer, {
        message: wrappedError.message,
        code: WebRTCPeerErrorCode.INVALID_OFFER,
      });

      this.emit("error", wrappedError);
      return;
    }

    try {
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      this.signaling.sendAnswer(this.remotePeer, answer);
    } catch (error) {
      const wrappedError = new WebRTCConnectionError(
        WebRTCConnectionErrorCode.NEGOTIATION_ERROR,
        "Failed to create or send answer",
        { cause: error },
      );

      this.signaling.sendError(this.remotePeer, {
        message: wrappedError.message,
        code: WebRTCPeerErrorCode.NEGOTIATION_FAILED,
      });

      this.emit("error", wrappedError);
    }
  }

  /**
   * Sets the remote SDP description from the peer's answer and flushes any
   * ICE candidates that arrived before the description was set.
   */
  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
    this.remoteDescriptionSet = true;
    await this.flushPendingIceCandidates();
  }

  private async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      const wrappedError = new WebRTCConnectionError(
        WebRTCConnectionErrorCode.ICE_CANDIDATE_FAILED,
        "Failed to process ICE candidate",
        { cause: error },
      );

      this.emit("error", wrappedError);

      void this.signaling.sendError(this.remotePeer, {
        message: wrappedError.message,
        code: WebRTCPeerErrorCode.ICE_CANDIDATE_FAILED,
      });
    }
  }

  /**
   * Queues or forwards an ICE candidate from the remote peer.
   *
   * If the remote description is not yet set, the candidate is queued and will
   * be flushed once the description arrives.
   */
  public async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.remoteDescriptionSet) {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    await this.addIceCandidate(candidate);
  }

  /**
   * Sends binary data over the unordered data channel.
   *
   * @returns true if the message was sent, or false if the channel was not open
   */
  public async sendData(data: ArrayBuffer): Promise<void> {
    const channel = this.dataChannel;

    if (!channel || channel.readyState !== "open") {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.DATA_CHANNEL_ERROR,
        "Cannot send data message if the channel is not setup or open",
      );
    }

    await this.waitForBufferDrain(channel);

    if (channel.readyState !== "open") {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.DATA_CHANNEL_ERROR,
        "Cannot send data message if the channel is not open",
      );
    }

    try {
      channel.send(JSON.stringify(data));
    } catch (error) {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.DATA_CHANNEL_ERROR,
        "An error occurred while trying to send the data message",
        { cause: error },
      );
    }
  }

  private async waitForBufferDrain(channel: RTCDataChannel): Promise<void> {
    if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();

        reject(
          new WebRTCConnectionError(
            WebRTCConnectionErrorCode.BUFFER_DRAIN_TIMEOUT,
            `Timed out waiting for the channel buffer to drain below the low threshold after ${this.config.sendBufferDrainTimeoutMs} ms`,
          ),
        );
      }, this.config.sendBufferDrainTimeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);

        channel.removeEventListener("bufferedamountlow", onBufferedAmountLow);
        channel.removeEventListener("close", onClose);
        channel.removeEventListener("error", onError);
      };

      const onBufferedAmountLow = () => {
        cleanup();
        resolve();
      };

      const onClose = () => {
        cleanup();
        reject(
          new WebRTCConnectionError(
            WebRTCConnectionErrorCode.CONTROL_CHANNEL_ERROR,
            "The channel closed unexpectedly while waiting for the buffer to drain",
          ),
        );
      };

      const onError = (event: Event) => {
        cleanup();
        reject(
          new WebRTCConnectionError(
            WebRTCConnectionErrorCode.CONTROL_CHANNEL_ERROR,
            "An unexpected error occurred while waiting for the buffer to drain",
            {
              cause: event instanceof RTCErrorEvent ? event.error : event,
            },
          ),
        );
      };

      channel.addEventListener("bufferedamountlow", onBufferedAmountLow);
      channel.addEventListener("close", onClose);
      channel.addEventListener("error", onError);
    });
  }

  /**
   * Sends a JSON message over the ordered control channel.
   *
   * Waits for channel backpressure to clear before sending.
   *
   * @throws WebRTCConnectionError if the channel is unavailable or sending fails.
   */
  public sendControl = async (data: unknown): Promise<void> => {
    const channel = this.controlChannel;

    if (!channel || channel.readyState !== "open") {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.CONTROL_CHANNEL_ERROR,
        "Cannot send control message if the channel is not setup or open",
      );
    }

    await this.waitForBufferDrain(channel);

    if (channel.readyState !== "open") {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.CONTROL_CHANNEL_ERROR,
        "Cannot send control message if the channel is not open",
      );
    }

    try {
      channel.send(JSON.stringify(data));
    } catch (error) {
      throw new WebRTCConnectionError(
        WebRTCConnectionErrorCode.CONTROL_CHANNEL_ERROR,
        "An error occurred while trying to send the control message",
        { cause: error },
      );
    }
  };

  /** Returns `true` when both data and control channels are open and ready. */
  public isReady(): boolean {
    return (
      this.dataReady &&
      this.dataChannel?.readyState === "open" &&
      this.controlReady &&
      this.controlChannel?.readyState === "open"
    );
  }

  /**
   * Tears down the peer connection and unsubscribes from signaling events.
   */
  public close(): void {
    this.dataReady = false;
    this.controlReady = false;

    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns.length = 0;

    this.pc.close();
  }

  // Setup

  /** Wires up event handlers on the RTCPeerConnection. */
  private setupPeerConnection(): void {
    this.pc.onicecandidate = (event) => this.onIceCandidate(event);
    this.pc.onconnectionstatechange = () => this.onConnectionStateChange();
    this.pc.oniceconnectionstatechange = () => this.onIceConnectionStateChange();
    this.pc.ondatachannel = (event) => {
      if (event.channel.label === CONTROL_CHANNEL_LABEL) {
        this.controlChannel = event.channel;
        this.setupDataChannel(this.controlChannel, "control");
      } else if (event.channel.label === DATA_CHANNEL_LABEL) {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel, "data");
      } else {
        console.warn(`Received unexpected data channel with label: ${event.channel.label}`);

        this.signaling.sendError(this.remotePeer, {
          message: `Unexpected data channel label: ${event.channel.label}`,
          code: WebRTCPeerErrorCode.CONNECTION_FAILED,
        });
      }
    };
  }

  /** Subscribes to signaling events (offer, answer, ICE) and registers cleanup. */
  private setupSignalingListeners(): void {
    this.cleanupFns.push(
      this.signaling.on("offer", (payload) => {
        this.handleOffer(payload.description);
      }),
    );

    this.cleanupFns.push(
      this.signaling.on("answer", (payload) => {
        this.handleAnswer(payload.description);
      }),
    );

    this.cleanupFns.push(
      this.signaling.on("iceCandidate", (payload) => {
        this.handleIceCandidate(payload.candidate);
      }),
    );
  }

  // Event handlers

  /** Forwards local ICE candidates to the remote peer via signaling. */
  private onIceCandidate(event: RTCPeerConnectionIceEvent): void {
    if (!event.candidate) {
      return;
    }

    this.signaling.sendIceCandidate(this.remotePeer, event.candidate.toJSON());
  }

  /** Tracks connection state and sends a peer error on failure. */
  private onConnectionStateChange(): void {
    if (this.pc.connectionState === "failed") {
      this.signaling.sendError(this.remotePeer, {
        message: "Peer connection failed",
        code: WebRTCPeerErrorCode.CONNECTION_FAILED,
      });
    }

    if (this.pc.connectionState === "disconnected" || this.pc.connectionState === "closed") {
      this.dataReady = false;
      this.controlReady = false;
    }
  }

  /** Sends a peer error when the ICE connection fails. */
  private onIceConnectionStateChange(): void {
    if (this.pc.iceConnectionState === "failed") {
      this.signaling.sendError(this.remotePeer, {
        message: "ICE connection failed",
        code: WebRTCPeerErrorCode.ICE_CONNECTION_FAILED,
      });
    }
  }

  private updateChannelState(channel: RTCDataChannel, type: "data" | "control"): void {
    const isOpen = channel.readyState === "open";
    const isClosed = channel.readyState === "closing" || channel.readyState === "closed";

    const isReady = type === "data" ? this.dataReady : this.controlReady;

    if (isOpen && !isReady) {
      if (type === "data") {
        this.dataReady = true;
        this.emit("dataChannelOpen", channel);
      } else {
        this.controlReady = true;
        this.emit("controlChannelOpen", channel);
      }

      return;
    }

    if (isClosed && isReady) {
      if (type === "data") {
        this.dataReady = false;
        this.emit("dataChannelClose");
      } else {
        this.controlReady = false;
        this.emit("controlChannelClose");
      }
    }
  }

  /**
   * Wires up data channel event handlers (open, close, message, error).
   *
   * The data channel uses `arraybuffer` binary type; the control channel
   * uses the default string type.
   */
  private setupDataChannel(channel: RTCDataChannel, type: "data" | "control"): void {
    if (type === "data") {
      channel.binaryType = "arraybuffer";
    }

    channel.onerror = (error) => {
      const wrappedError = new WebRTCConnectionError(
        type === "control"
          ? WebRTCConnectionErrorCode.CONTROL_CHANNEL_ERROR
          : WebRTCConnectionErrorCode.DATA_CHANNEL_ERROR,
        `${type === "control" ? "Control" : "Data"} channel error`,
        { cause: error },
      );

      this.signaling.sendError(this.remotePeer, {
        message: wrappedError.message,
        code: WebRTCPeerErrorCode.CONNECTION_FAILED,
      });

      this.emit("error", wrappedError);
    };

    channel.onclose = () => {
      this.updateChannelState(channel, type);

      if (type === "data") {
        if (this.dataChannel === channel) {
          this.dataChannel = undefined;
        }
      } else {
        if (this.controlChannel === channel) {
          this.controlChannel = undefined;
        }
      }
    };

    channel.onmessage = (event) => {
      if (type === "control") {
        this.handleControlChannelMessage(event.data);
      } else {
        this.handleDataChannelMessage(event.data);
      }
    };

    channel.onopen = () => this.updateChannelState(channel, type);

    this.updateChannelState(channel, type);
  }

  /**
   * Adds all queued ICE candidates to the peer connection.
   * Called once the remote description is set.
   */
  private async flushPendingIceCandidates(): Promise<void> {
    const candidates = this.pendingIceCandidates;
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      await this.addIceCandidate(candidate);
    }
  }

  private handleDataChannelMessage(data: ArrayBuffer): void {
    console.log("Received data channel message:", data.byteLength, "bytes");

    this.emit("dataChannelMessage", data);
  }

  private handleControlChannelMessage(data: string): void {
    const message = AnyControlMessageSchema.safeParse(JSON.parse(data));

    if (!message.success) {
      // todo: implement actual errors
      console.warn("Received unknown control channel message");
      return;
    }

    this.emit("controlChannelMessage", message.data);
  }

  public getDataChannel(): RTCDataChannel | undefined {
    return this.dataChannel;
  }

  public getControlChannel(): RTCDataChannel | undefined {
    return this.controlChannel;
  }
}
