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

describe("relay messages (offer/answer/ice-candidate)", () => {
  it("relays an offer from one peer to another", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const bob = await h.createClient({ name: "Bob", role: "receiver" });

    alice.send("join-room", { method: "create", role: "sender" });
    const aliceRoom = await alice.receive("room-joined");
    const joinCode = aliceRoom.payload.joinCode as string;

    bob.send("join-room", { method: "code", joinCode, role: "receiver" });
    await alice.receive("room-peer-joined");
    await bob.receive("room-joined");

    const bobJoined = bob.peerId!;
    alice.sendTo("offer", bobJoined, { sdp: "v=0\no=alice\ns=test\nt=0 0" });

    const offerAtBob = await bob.receive("offer");
    expect(offerAtBob.from).toBe(alice.peerId);
    expect(offerAtBob.payload.sdp).toContain("alice");

    alice.close();
    bob.close();
  });

  it("relays an answer", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const bob = await h.createClient({ name: "Bob", role: "receiver" });

    alice.send("join-room", { method: "create", role: "sender" });
    const aliceRoom = await alice.receive("room-joined");
    const joinCode = aliceRoom.payload.joinCode as string;

    bob.send("join-room", { method: "code", joinCode, role: "receiver" });
    await alice.receive("room-peer-joined");
    await bob.receive("room-joined");

    bob.sendTo("answer", alice.peerId, { sdp: "v=0\no=bob\ns=answer\nt=0 0" });

    const answerAtAlice = await alice.receive("answer");
    expect(answerAtAlice.from).toBe(bob.peerId);
    expect(answerAtAlice.payload.sdp).toContain("bob");

    alice.close();
    bob.close();
  });

  it("relays ice-candidates", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const bob = await h.createClient({ name: "Bob", role: "receiver" });

    alice.send("join-room", { method: "create", role: "sender" });
    const aliceRoom = await alice.receive("room-joined");
    const joinCode = aliceRoom.payload.joinCode as string;

    bob.send("join-room", { method: "code", joinCode, role: "receiver" });
    await alice.receive("room-peer-joined");
    await bob.receive("room-joined");

    alice.sendTo("ice-candidate", bob.peerId, {
      candidate: "candidate:1 1 UDP 2122252543 192.168.1.1 12345 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    });

    const iceAtBob = await bob.receive("ice-candidate");
    expect(iceAtBob.from).toBe(alice.peerId);
    expect(iceAtBob.payload.candidate).toContain("192.168.1.1");

    alice.close();
    bob.close();
  });

  it("closes connection on spoofed from field", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });
    const bob = await h.createClient({ name: "Bob", role: "receiver" });

    alice.sendRaw({
      type: "offer",
      from: "peer_AAAAAAAAAAAAAAAA",
      to: bob.peerId,
      payload: { sdp: "fake" },
    });

    const closeResult = await alice.expectClose();
    expect(closeResult.reason).toBe(SignalingErrorCode.NOT_AUTHENTICATED);

    bob.close();
  });

  it("silently drops relay to non-existent peer", async () => {
    const alice = await h.createClient({ name: "Alice", role: "sender" });

    alice.sendRaw({
      type: "offer",
      from: alice.peerId,
      to: "peer_BBBBBBBBBBBBBBBB",
      payload: { sdp: "test" },
    });

    await expect(alice.receive("error", 500)).rejects.toThrow("Timeout");

    alice.close();
  });
});
