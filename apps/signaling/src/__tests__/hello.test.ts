import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TestHarness } from "../test-utils/harness.js";
import { SignalingErrorCode } from "@riftsend/shared";

let h: TestHarness;

beforeAll(async () => {
  h = await TestHarness.create();
});

afterAll(async () => {
  await h.shutdown();
});

describe("hello / authentication", () => {
  it("assigns a peerId and sessionToken on hello", async () => {
    const client = await h.createClient({ name: "Alice", role: "sender" });

    expect(client.peerId).toMatch(/^peer_/);
    expect(client.sessionToken).toBeTruthy();
    client.close();
  });

  it("accepts metadata from the client", async () => {
    const client = await h.createClient({
      name: "Bob",
      role: "receiver",
      platform: "linux",
      protocolVersion: 2,
      clientVersion: "2.1.0",
      supportResume: true,
      supportChunkAck: true,
    });

    expect(client.peerId).toBeTruthy();
    client.close();
  });

  it("rejects duplicate hello on the same connection", async () => {
    const client = await h.rawClient();
    await client.authenticate();
    const firstPeerId = client.peerId;

    await client.authenticate();
    expect(client.peerId).toBe(firstPeerId);
    client.close();
  });

  it("reconnects with valid session and closes old connection", async () => {
    const alice1 = await h.createClient({ name: "Alice", role: "sender" });
    const { peerId, sessionToken } = alice1;

    const closePromise = alice1.expectClose();

    const alice2 = await h.rawClient();
    alice2.sendRaw({
      type: "hello",
      from: peerId,
      protocolVersion: 1,
      clientVersion: "1.0.0",
      sessionToken,
      payload: {
        role: "sender",
        name: "Alice",
        platform: "test",
        supportResume: false,
        supportChunkAck: false,
      },
    });

    const peerIdMsg = await alice2.receive("peer-id");
    expect(peerIdMsg.payload.peerId).toBe(peerId);

    const closeResult = await closePromise;
    expect(closeResult.reason).toBe(SignalingErrorCode.RECONNECTED_ELSEWHERE);

    alice2.peerId = peerIdMsg.payload.peerId as typeof peerId;
    alice2.sessionToken = peerIdMsg.payload.sessionToken as typeof sessionToken;
    alice2.close();
  });

  it("closes connection on auth timeout", async () => {
    const h2 = await TestHarness.create({ connectionTimeoutMs: 500 });
    const client = await h2.rawClient();

    const closeResult = await client.expectClose(2000);
    expect(closeResult.reason).toBe(SignalingErrorCode.NOT_AUTHENTICATED);

    await h2.shutdown();
  });

  it("closes connection on invalid JSON", async () => {
    const client = await h.rawClient();

    client.ws.send("not valid json");
    const closeResult = await client.expectClose();
    expect(closeResult.reason).toBe(SignalingErrorCode.INVALID_JSON);
  });

  it("closes connection when sending join-room before hello", async () => {
    const client = await h.rawClient();

    client.sendRaw({
      type: "join-room",
      from: "peer_CCCCCCCCCCCCCCCC",
      payload: { method: "create" },
    });
    const closeResult = await client.expectClose();
    expect(closeResult.reason).toBe(SignalingErrorCode.NOT_AUTHENTICATED);
  });

  it("room-joined response includes roomId and joinCode for create method", async () => {
    const client = await h.createClient({ name: "Alice", role: "sender" });

    client.send("join-room", { method: "create", role: "sender" });
    const msg = await client.receive("room-joined");

    expect(msg.payload.roomId).toBeTruthy();
    expect(msg.payload.joinCode).toBeTruthy();

    client.close();
  });
});
