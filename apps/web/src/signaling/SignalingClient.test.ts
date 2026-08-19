import { beforeEach, describe, expect, it, vi } from "vitest";

describe("SignalingClient", () => {
  const originalWebSocket = globalThis.WebSocket;

  type MockSocket = {
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onopen: ((event: Event) => void) | undefined;
    onmessage: ((event: MessageEvent) => void) | undefined;
    onclose: ((event: CloseEvent) => void) | undefined;
    onerror: ((event: Event) => void) | undefined;
  };

  const mockWebSocket = () => {
    const socket: MockSocket = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      onopen: undefined,
      onmessage: undefined as ((event?: MessageEvent) => void) | undefined,
      onclose: undefined as ((event?: CloseEvent) => void) | undefined,
      onerror: undefined,
    };

    function MockWebSocket(this: unknown) {
      return socket;
    }

    Object.defineProperty(MockWebSocket, "OPEN", { value: 1, configurable: true });
    Object.assign(globalThis, { WebSocket: MockWebSocket as unknown as typeof WebSocket });

    return {
      socket,
      restore: () => {
        Object.assign(globalThis, { WebSocket: originalWebSocket });
      },
    };
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    Object.assign(import.meta.env, {
      SIGNALING_SERVER_URL: "ws://localhost:8080",
      SIGNALING_CLIENT_VERSION: "1.2.3",
      SIGNALING_CLIENT_NAME: "test-client",
      SIGNALING_CLIENT_PLATFORM: "linux",
      PROTOCOL_VERSION: "1",
      SIGNALING_CLIENT_SUPPORT_RESUME: "true",
      SIGNALING_CLIENT_SUPPORT_CHUNK_ACK: "false",
    });
    vi.resetModules();
  });

  const validPeerId = "peer_" + "a".repeat(16);
  const validSessionToken = "a".repeat(27);
  const peerIdMessage = {
    type: "peer-id",
    from: "server",
    payload: {
      peerId: validPeerId,
      sessionToken: validSessionToken,
    },
  };

  it("sends a hello handshake on connect and emits connection events for peer-id", async () => {
    const { socket, restore } = mockWebSocket();
    const { SignalingClient } = await import("./SignalingClient.js");
    const client = new SignalingClient();
    const connected = vi.fn();

    client.on("connected", connected);
    client.connect();
    socket.onopen?.(new Event("open"));

    expect(socket.send).toHaveBeenCalledTimes(1);
    const message = JSON.parse(socket.send.mock.calls[0][0]);
    expect(message.type).toBe("hello");

    socket.onmessage?.({ data: JSON.stringify(peerIdMessage) } as MessageEvent);

    expect(connected).toHaveBeenCalledWith({
      peerId: validPeerId,
      sessionToken: validSessionToken,
    });

    restore();
  });

  it("validates room join payloads and throws for invalid join code", async () => {
    const { socket, restore } = mockWebSocket();
    const { SignalingClient } = await import("./SignalingClient.js");
    const { SignalingClientError: ClientError } = await import("./SignalingErrors.js");
    const client = new SignalingClient();

    client.connect();
    socket.onopen?.(new Event("open"));
    socket.onmessage?.({ data: JSON.stringify(peerIdMessage) } as MessageEvent);

    expect(() => client.sendJoinRoom("sender")).not.toThrow();
    expect(() => client.sendJoinRoom("sender", undefined, "BAD")).toThrow(ClientError);
    expect(() => client.sendJoinRoom("sender", undefined, "BAD")).toThrowError(
      /Invalid join code/i,
    );

    restore();
  });

  it("throws when sending signaling messages without an active connection", async () => {
    const { restore } = mockWebSocket();
    const { SignalingClient } = await import("./SignalingClient.js");
    const { SignalingClientError } = await import("./SignalingErrors.js");
    const client = new SignalingClient();

    expect(() =>
      client.sendOffer("peer_aaaaaaaaaaaaaaaaaaaaaaaa", { type: "offer", sdp: "sdp" }),
    ).toThrow(SignalingClientError);
    expect(() =>
      client.sendOffer("peer_aaaaaaaaaaaaaaaaaaaaaaaa", { type: "offer", sdp: "sdp" }),
    ).toThrowError(/WebSocket is not open/i);

    restore();
  });

  it("creates the correct signaling payload for ICE candidates and errors", async () => {
    const { socket, restore } = mockWebSocket();
    const { SignalingClient } = await import("./SignalingClient.js");
    const { SignalingClientError } = await import("./SignalingErrors.js");
    const client = new SignalingClient();

    client.connect();
    socket.onopen?.(new Event("open"));
    socket.onmessage?.({ data: JSON.stringify(peerIdMessage) } as MessageEvent);

    expect(() =>
      client.sendIceCandidate("peer_" + "b".repeat(16), {
        candidate: "candidate:1 1 udp 1 127.0.0.1 3478 typ host",
      }),
    ).not.toThrow();
    expect(socket.send).toHaveBeenLastCalledWith(expect.stringContaining('"type":"ice-candidate"'));

    expect(() => client.sendIceCandidate("peer_" + "b".repeat(16), { candidate: "" })).toThrow(
      SignalingClientError,
    );
    expect(() => client.sendIceCandidate("peer_" + "b".repeat(16), { candidate: "" })).toThrowError(
      /candidate string is missing/i,
    );

    restore();
  });
});
