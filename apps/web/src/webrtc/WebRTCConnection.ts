import { type PeerId, WebRTCPeerErrorCode } from "@riftsend/shared";
import { SignalingClient } from "../signaling/SignalingClient.js";

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

type EventMap = {
  dataChannelOpen: RTCDataChannel;
  dataChannelMessage: unknown;
  dataChannelClose: void;
  controlChannelOpen: RTCDataChannel;
  controlChannelMessage: unknown;
  controlChannelClose: void;
  connectionStateChange: RTCIceConnectionState;
  iceConnectionStateChange: RTCIceConnectionState;
};

type EventHandler<T> = (payload: T) => void;

export class WebRTCConnection {
  private readonly pc: RTCPeerConnection;
  private readonly signaling: SignalingClient;
  private readonly remotePeer: PeerId;
  private readonly cleanupFns: (() => void)[] = [];

  private controlChannel?: RTCDataChannel;
  private dataChannel?: RTCDataChannel;

  private dataReady = false;
  private controlReady = false;

  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  constructor(signaling: SignalingClient, remotePeer: PeerId) {
    this.pc = new RTCPeerConnection({
      iceServers,
    });

    this.signaling = signaling;
    this.remotePeer = remotePeer;

    this.setupPeerConnection();
    this.setupSignalingListeners();
  }

  // Public API

  async initiateConnection(): Promise<void> {
    this.dataChannel = this.pc.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: false,
    });
    this.setupDataChannel(this.dataChannel, "data");

    this.controlChannel = this.pc.createDataChannel(CONTROL_CHANNEL_LABEL, {
      ordered: true,
    });
    this.setupDataChannel(this.controlChannel, "control");

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.signaling.sendOffer(this.remotePeer, offer);
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
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
      this.flushPendingIceCandidates();
    } catch (error) {
      this.signaling.sendError(this.remotePeer, {
        message: "Failed to accept remote offer",
        code: WebRTCPeerErrorCode.INVALID_OFFER,
      });
      console.error("Error setting remote description:", error);
      return;
    }

    try {
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      this.signaling.sendAnswer(this.remotePeer, answer);
    } catch (error) {
      this.signaling.sendError(this.remotePeer, {
        message: "Failed to create or send answer",
        code: WebRTCPeerErrorCode.NEGOTIATION_FAILED,
      });
      console.error("Error creating or sending answer:", error);
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
    this.remoteDescriptionSet = true;
    this.flushPendingIceCandidates();
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.remoteDescriptionSet) {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      this.signaling.sendError(this.remotePeer, {
        message: "Failed to process ICE candidate",
        code: WebRTCPeerErrorCode.ICE_CANDIDATE_FAILED,
      });
      console.error("Error adding ICE candidate:", error);
    }
  }

  sendData(data: ArrayBuffer): void {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      console.warn("Data channel not open, cannot send data");
      return;
    }
    this.dataChannel.send(data);
  }

  sendControl(data: string): void {
    if (!this.controlChannel || this.controlChannel.readyState !== "open") {
      console.warn("Control channel not open, cannot send control message");
      return;
    }
    this.controlChannel.send(data);
  }

  isReady(): boolean {
    return this.dataReady && this.controlReady;
  }

  close(): void {
    this.dataReady = false;
    this.controlReady = false;

    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns.length = 0;

    this.pc.close();
  }

  // Setup

  private setupPeerConnection(): void {
    this.pc.onicecandidate = (event) => this.onIceCandidate(event);
    this.pc.onconnectionstatechange = () => this.onConnectionStateChange();
    this.pc.oniceconnectionstatechange = () =>
      this.onIceConnectionStateChange();
    this.pc.ondatachannel = (event) => {
      if (event.channel.label === CONTROL_CHANNEL_LABEL) {
        this.controlChannel = event.channel;
        this.setupDataChannel(this.controlChannel, "control");
      } else if (event.channel.label === DATA_CHANNEL_LABEL) {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel, "data");
      } else {
        console.warn(
          `Received unexpected data channel with label: ${event.channel.label}`,
        );

        this.signaling.sendError(this.remotePeer, {
          message: `Unexpected data channel label: ${event.channel.label}`,
          code: WebRTCPeerErrorCode.CONNECTION_FAILED,
        });
      }
    };
  }

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

  private onIceCandidate(event: RTCPeerConnectionIceEvent): void {
    if (!event.candidate) {
      return;
    }

    this.signaling.sendIceCandidate(this.remotePeer, event.candidate.toJSON());
  }

  private onConnectionStateChange(): void {
    if (this.pc.connectionState === "failed") {
      this.signaling.sendError(this.remotePeer, {
        message: "Peer connection failed",
        code: WebRTCPeerErrorCode.CONNECTION_FAILED,
      });
    }

    if (this.pc.connectionState === "disconnected") {
      this.dataReady = false;
      this.controlReady = false;
    }
  }

  private onIceConnectionStateChange(): void {
    if (this.pc.iceConnectionState === "failed") {
      this.signaling.sendError(this.remotePeer, {
        message: "ICE connection failed",
        code: WebRTCPeerErrorCode.ICE_CONNECTION_FAILED,
      });
    }
  }

  private setupDataChannel(
    channel: RTCDataChannel,
    type: "data" | "control",
  ): void {
    if (type === "data") {
      channel.binaryType = "arraybuffer";
    }

    channel.onerror = (error) => {
      console.error(
        `${type === "control" ? "Control" : "Data"} channel error:`,
        error,
      );

      this.signaling.sendError(this.remotePeer, {
        message: `${type === "control" ? "Control" : "Data"} channel error`,
        code: WebRTCPeerErrorCode.CONNECTION_FAILED,
      });
    };

    channel.onclose = () => {
      if (type === "data") {
        this.dataReady = false;
      } else {
        this.controlReady = false;
      }

      this.emit(`${type}ChannelClose`, undefined);
    };

    channel.onmessage = (event) => {
      if (type === "control") {
        this.handleControlChannelMessage(event.data);
      } else {
        this.handleDataChannelMessage(event.data);
      }

      this.emit(`${type}ChannelMessage`, event.data);
    };

    channel.onopen = () => {
      if (type === "data") {
        this.dataReady = true;
      } else {
        this.controlReady = true;
      }

      this.emit(`${type}ChannelOpen`, channel);
    };
  }

  private flushPendingIceCandidates(): void {
    const candidates = this.pendingIceCandidates;
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      this.pc.addIceCandidate(candidate).catch((error) => {
        console.error("Error adding queued ICE candidate:", error);
      });
    }
  }

  private handleDataChannelMessage(data: ArrayBuffer): void {
    console.log("Received data channel message:", data.byteLength, "bytes");
  }

  private handleControlChannelMessage(data: string): void {
    console.log("Received control channel message:", data);
  }

  getDataChannel(): RTCDataChannel | undefined {
    return this.dataChannel;
  }

  getControlChannel(): RTCDataChannel | undefined {
    return this.controlChannel;
  }

  on<K extends keyof EventMap>(
    type: K,
    handler: EventHandler<EventMap[K]>,
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler as (payload: unknown) => void);
    return () => this.off(type, handler);
  }

  off<K extends keyof EventMap>(
    type: K,
    handler: EventHandler<EventMap[K]>,
  ): void {
    this.listeners.get(type)?.delete(handler as (payload: unknown) => void);
  }

  private emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    this.listeners.get(type)?.forEach((handler) => {
      (handler as EventHandler<EventMap[K]>)(payload);
    });
  }
}
