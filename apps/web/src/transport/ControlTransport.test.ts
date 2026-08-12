import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ControlTransport", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    Object.assign(import.meta.env, originalEnv);
    Object.assign(import.meta.env, {
      SIGNALING_CLIENT_SUPPORT_RESUME: "true",
      SIGNALING_CLIENT_SUPPORT_CHUNK_ACK: "false",
      ACK_TIMEOUT: "200",
      RETRY_CHECK_INTERVAL: "50",
      MAX_RETRIES: "2",
      MAX_RETRY_DELAY: "1000",
      MAX_PENDING_MESSAGES: "8",
      SEND_RETRY_DELAY: "100",
      PROTOCOL_VERSION: "1",
    });
  });

  it("forwards unreliable messages without message IDs", async () => {
    const sendRaw = vi.fn().mockResolvedValue(undefined);
    const onMessage = vi.fn();
    const { ControlTransport } = await import("./ControlTransport.js");
    const transport = new ControlTransport(sendRaw, onMessage);

    await transport.send({ type: "ack", protocolVersion: 1, acknowledgedMessageId: 0 });

    expect(sendRaw).toHaveBeenCalledTimes(1);
    expect(sendRaw).toHaveBeenCalledWith({
      type: "ack",
      protocolVersion: 1,
      acknowledgedMessageId: 0,
    });

    transport.dispose();
  });

  it("adds a message ID to reliable messages and resolves on ACK", async () => {
    const sendRaw = vi.fn().mockResolvedValue(undefined);
    const onMessage = vi.fn();
    const { ControlTransport } = await import("./ControlTransport.js");
    const transport = new ControlTransport(sendRaw, onMessage);

    const promise = transport.send({
      type: "batch-offer",
      protocolVersion: 1,
      batchId: "123e4567-e89b-42d3-a456-426614174000",
      files: [
        {
          fileId: "123e4567-e89b-42d3-a456-426614174001",
          fileName: "demo.txt",
          size: 16,
          mimeType: "text/plain",
          chunkSize: 16,
          totalChunks: 1,
        },
      ],
    });

    await vi.waitFor(() => expect(sendRaw).toHaveBeenCalledTimes(1));
    const outgoing = sendRaw.mock.calls[0][0];
    expect(outgoing.type).toBe("batch-offer");
    expect(outgoing).toHaveProperty("messageId");

    await transport.handleMessage({
      type: "ack",
      protocolVersion: 1,
      acknowledgedMessageId: outgoing.messageId,
    });

    await expect(promise).resolves.toBeUndefined();
    transport.dispose();
  });

  it("rejects once retry limit is exceeded for a reliable message", async () => {
    const sendRaw = vi.fn().mockResolvedValue(undefined);
    const { ControlTransport } = await import("./ControlTransport.js");
    const transport = new ControlTransport(sendRaw, vi.fn());

    const sendPromise = transport.send({
      type: "batch-response",
      protocolVersion: 1,
      batchId: "123e4567-e89b-42d3-a456-426614174000",
      accepted: ["123e4567-e89b-42d3-a456-426614174001"],
    });

    await vi.waitFor(() => expect(sendRaw).toHaveBeenCalledTimes(1));

    const messageId = sendRaw.mock.calls[0][0].messageId;

    await expect(sendPromise).rejects.toMatchObject({
      code: "control_transport.send_failed",
      cause: expect.objectContaining({
        code: "control_transport.max_retries",
        messageId,
      }),
    });

    transport.dispose();
  }, 10000);

  it("rejects when disposed before ACK arrives", async () => {
    const sendRaw = vi.fn().mockResolvedValue(undefined);
    const { ControlTransport } = await import("./ControlTransport.js");
    const transport = new ControlTransport(sendRaw, vi.fn());

    const sendPromise = transport.send({
      type: "transfer-cancel",
      protocolVersion: 1,
      transferId: 11,
    });

    await vi.waitFor(() => expect(sendRaw).toHaveBeenCalledTimes(1));
    transport.dispose();

    await expect(sendPromise).rejects.toBeDefined();
  });
});
