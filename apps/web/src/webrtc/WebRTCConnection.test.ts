import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PeerId } from "@riftsend/shared";
import type { SignalingClient } from "@/signaling/SignalingClient";
import { WebRTCConnection } from "./WebRTCConnection.js";

const createMockDataChannel = () => ({
  label: "test",
  readyState: "open",
  bufferedAmount: 0,
  bufferedAmountLowThreshold: 0,
  binaryType: "arraybuffer",
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onopen: null as (() => void) | null,
  onclose: null as (() => void) | null,
  onerror: null as ((event?: Event) => void) | null,
  onmessage: null as ((event?: MessageEvent) => void) | null,
});

const createMockSignaling = () => ({
  sendOffer: vi.fn(),
  sendAnswer: vi.fn(),
  sendError: vi.fn(),
  on: vi.fn(() => () => {}),
});

const peerId = "peer_aaaaaaaaaaaaaaaa" as PeerId;

describe("WebRTCConnection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(import.meta.env, {
      SIGNALING_CLIENT_SUPPORT_RESUME: "true",
      SIGNALING_CLIENT_SUPPORT_CHUNK_ACK: "false",
      PROTOCOL_VERSION: "1",
      SEND_BUFFER_DRAIN_TIMEOUT_MS: "300",
      CONTROL_CHANNEL_HIGH_WATERMARK: "1024",
      DATA_CHANNEL_HIGH_WATERMARK: "2097152",
    });

    class MockRTCPeerConnection {
      public signalingState = "stable";
      public connectionState = "new";
      public iceConnectionState = "new";
      public onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
      public onconnectionstatechange: (() => void) | null = null;
      public oniceconnectionstatechange: (() => void) | null = null;
      public ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;
      public createDataChannel = vi.fn((label: string) => {
        const channel = createMockDataChannel();
        channel.label = label;
        return channel;
      });
      public createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" });
      public setLocalDescription = vi.fn().mockResolvedValue(undefined);
      public setRemoteDescription = vi.fn().mockResolvedValue(undefined);
      public addIceCandidate = vi.fn().mockResolvedValue(undefined);
      public close = vi.fn();
    }

    vi.stubGlobal(
      "RTCPeerConnection",
      MockRTCPeerConnection as unknown as typeof RTCPeerConnection,
    );
  });

  it("creates negotiation channels and sends the offer through signaling", async () => {
    const signaling = createMockSignaling();
    const connection = new WebRTCConnection(signaling as unknown as SignalingClient, peerId);

    await connection.initiateConnection();

    expect(connection["dataChannel"]).toBeDefined();
    expect(connection["controlChannel"]).toBeDefined();
    expect(signaling.sendOffer).toHaveBeenCalledTimes(1);
    expect(signaling.sendOffer.mock.calls[0][0]).toBe(peerId);
    expect(signaling.sendOffer.mock.calls[0][1]).toEqual(
      expect.objectContaining({ type: "offer", sdp: "offer-sdp" }),
    );

    connection.close();
  });

  it("buffers ICE candidates until a remote description is available", async () => {
    const signaling = createMockSignaling();
    const connection = new WebRTCConnection(signaling as unknown as SignalingClient, peerId);
    const candidate = { candidate: "candidate:1 1 udp 1 127.0.0.1 3478 typ host", sdpMid: "0" };

    await connection.handleIceCandidate(candidate);
    expect(connection["pendingIceCandidates"]).toHaveLength(1);

    await connection.handleAnswer({ type: "answer", sdp: "answer-sdp" });

    expect(connection["pendingIceCandidates"]).toHaveLength(0);
    expect(connection["pc"].addIceCandidate).toHaveBeenCalledWith(candidate);

    connection.close();
  });

  it("rejects sending data when the data channel is not open", async () => {
    const signaling = createMockSignaling();
    const connection = new WebRTCConnection(signaling as unknown as SignalingClient, peerId);

    await expect(connection.sendData(new ArrayBuffer(8))).rejects.toThrow(/channel.*open/i);

    connection.close();
  });
});
