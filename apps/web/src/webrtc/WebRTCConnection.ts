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

export class WebRTCConnection {
  private readonly pc: RTCPeerConnection;
  private readonly signaling: SignalingClient;
  private readonly remotePeer: PeerId;
  private readonly cleanupFns: (() => void)[] = [];

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

  async createOffer(): Promise<void> {
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
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
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

  close(): void {
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
    this.pc.ondatachannel = (event) => this.onDataChannel(event);
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
  }

  private onIceConnectionStateChange(): void {
    if (this.pc.iceConnectionState === "failed") {
      this.signaling.sendError(this.remotePeer, {
        message: "ICE connection failed",
        code: WebRTCPeerErrorCode.ICE_CONNECTION_FAILED,
      });
    }
  }

  private onDataChannel(event: RTCDataChannelEvent): void {
    const channel = event.channel;

    channel.onerror = () => {
      this.signaling.sendError(this.remotePeer, {
        message: "Data channel error",
        code: WebRTCPeerErrorCode.CONNECTION_FAILED,
      });
    };
  }
}
