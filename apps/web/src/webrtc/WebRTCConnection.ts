import { type PeerId } from "@riftsend/shared";
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
    if (this.pc.signalingState !== "stable") {
      console.warn(
        "Received offer while signaling state is not stable. Current state:",
        this.pc.signalingState,
      );
    }

    await this.pc.setRemoteDescription(offer);

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.signaling.sendAnswer(this.remotePeer, answer);
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
  }

  async handleIceCandidate(
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
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

  private onIceCandidate(
    event: RTCPeerConnectionIceEvent,
  ): void {
    if (!event.candidate) {
      return;
    }

    this.signaling.sendIceCandidate(this.remotePeer, event.candidate.toJSON());
  }

  private onConnectionStateChange(): void {}

  private onIceConnectionStateChange(): void {}

  private onDataChannel(event: RTCDataChannelEvent): void {}
}