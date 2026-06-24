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

describe("rooms", () => {
  it("client creates a room and receives room-joined", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });

    alice.send("join-room", { method: "create" });
    const msg = await alice.receive("room-joined");

    expect(msg.payload.method).toBe("create");
    expect(msg.payload.members).toHaveLength(1);
    expect((msg.payload.members as Array<{ peerId: string }>)[0].peerId).toBe(alice.peerId);

    alice.close();
  });

  it("second client joins via join code", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const bob = await h.createClient({ name: "Bob", role: "receiver" });

    alice.send("join-room", { method: "create" });
    const aliceRoom = await alice.receive("room-joined");
    const joinCode = aliceRoom.payload.joinCode as string;

    bob.send("join-room", { method: "code", joinCode });
    const bobRoom = await bob.receive("room-joined");
    expect(bobRoom.payload.members).toHaveLength(2);

    alice.close();
    bob.close();
  });

  it("notifies existing members when a peer joins", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const bob = await h.createClient({ name: "Bob", role: "receiver" });

    alice.send("join-room", { method: "create" });
    const aliceRoom = await alice.receive("room-joined");
    const joinCode = aliceRoom.payload.joinCode as string;

    bob.send("join-room", { method: "code", joinCode });

    const peerJoined = await alice.receive("room-peer-joined");
    expect(peerJoined.payload.peerId).toBe(bob.peerId);

    await bob.receive("room-joined");

    alice.close();
    bob.close();
  });

  it("notifies remaining peer when someone leaves", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const bob = await h.createClient({ name: "Bob", role: "receiver" });

    alice.send("join-room", { method: "create" });
    const aliceRoom = await alice.receive("room-joined");
    const joinCode = aliceRoom.payload.joinCode as string;

    bob.send("join-room", { method: "code", joinCode });
    await alice.receive("room-peer-joined");
    await bob.receive("room-joined");

    bob.sendRaw({ type: "leave-room", from: bob.peerId, payload: null });
    const bobLeft = await bob.receive("room-left");
    expect(bobLeft.payload.peerId).toBe(bob.peerId);

    const peerLeft = await alice.receive("room-peer-left");
    expect(peerLeft.payload.peerId).toBe(bob.peerId);

    alice.close();
    bob.close();
  });

  it("returns error when room is full (2 peers max)", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const bob = await h.createClient({ name: "Bob", role: "receiver" });
    const charlie = await h.createClient({ name: "Charlie", role: "sender" });

    alice.send("join-room", { method: "create" });
    const aliceRoom = await alice.receive("room-joined");
    const joinCode = aliceRoom.payload.joinCode as string;

    bob.send("join-room", { method: "code", joinCode });
    await bob.receive("room-joined");

    charlie.send("join-room", { method: "code", joinCode });
    const error = await charlie.receive("error");
    expect(error.payload.code).toBe(SignalingErrorCode.ROOM_IS_FULL);

    alice.close();
    bob.close();
    charlie.close();
  });

  it("returns error for invalid join code", async () => {
    const client = await h.createClient({ name: "Alice", role: "sender" });

    client.send("join-room", { method: "code", joinCode: "XXXXXX" });
    const error = await client.receive("error");
    expect(error.payload.code).toBe(SignalingErrorCode.JOIN_CODE_NOT_FOUND);

    client.close();
  });

  it("returns error when leaving a room not joined", async () => {
    const client = await h.createClient({ name: "Alice", role: "sender" });

    client.sendRaw({ type: "leave-room", from: client.peerId, payload: null });
    const error = await client.receive("error");
    expect(error.payload.code).toBe(SignalingErrorCode.NOT_IN_A_ROOM);

    client.close();
  });

  it("two peers can join by room ID", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });

    alice.send("join-room", { method: "create" });
    const aliceRoom = await alice.receive("room-joined");
    const roomId = aliceRoom.payload.roomId as string;

    const bob = await h.createClient({ name: "Bob", role: "receiver" });
    bob.send("join-room", { method: "id", roomId });

    await bob.receive("room-joined");
    const peerJoined = await alice.receive("room-peer-joined");
    expect(peerJoined.payload.peerId).toBe(bob.peerId);

    alice.close();
    bob.close();
  });
});
