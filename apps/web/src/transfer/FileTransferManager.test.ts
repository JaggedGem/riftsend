import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchId, FileId } from "@riftsend/shared";
import type { WebRTCConnection } from "@/webrtc/WebRTCConnection";
import { FileTransferManager } from "./FileTransferManager.js";

type EventHandler = (payload?: unknown) => void;

const createMockConnection = () => {
  const listeners = new Map<string, Set<EventHandler>>();

  const emit = (event: string, payload?: unknown) => {
    listeners.get(event)?.forEach((handler) => handler(payload));
  };

  return {
    sendControl: vi.fn(async (message: unknown) => {
      if (!message || typeof message !== "object" || !("messageId" in message)) {
        return;
      }

      queueMicrotask(() => {
        emit("controlChannelMessage", {
          type: "ack",
          protocolVersion: 1,
          acknowledgedMessageId: message.messageId,
        });
      });
    }),
    on: vi.fn((event: string, handler: EventHandler) => {
      const bucket = listeners.get(event) ?? new Set();
      bucket.add(handler);
      listeners.set(event, bucket);
      return handler;
    }),
    off: vi.fn((event: string, handler: EventHandler) => {
      listeners.get(event)?.delete(handler);
    }),
    emit,
  };
};

describe("FileTransferManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(import.meta.env, {
      SIGNALING_CLIENT_SUPPORT_RESUME: "true",
      SIGNALING_CLIENT_SUPPORT_CHUNK_ACK: "false",
      PROTOCOL_VERSION: "1",
      ACK_TIMEOUT: "1000",
      RETRY_CHECK_INTERVAL: "250",
      MAX_RETRIES: "3",
      MAX_RETRY_DELAY: "4000",
      MAX_PENDING_MESSAGES: "8",
      SEND_RETRY_DELAY: "200",
      SEND_BUFFER_DRAIN_TIMEOUT_MS: "300",
      CONTROL_CHANNEL_HIGH_WATERMARK: "1024",
      DATA_CHANNEL_HIGH_WATERMARK: "2097152",
      SIGNALING_SERVER_URL: "ws://localhost:8080",
      SIGNALING_CLIENT_VERSION: "1.2.3",
      SIGNALING_CLIENT_NAME: "test-client",
      SIGNALING_CLIENT_PLATFORM: "linux",
    });
  });

  it("sends a batch offer for the provided files", async () => {
    const connection = createMockConnection();
    const manager = new FileTransferManager(connection as unknown as WebRTCConnection);
    const file = new File(["hello world"], "hello.txt", { type: "text/plain" });

    await manager.offerFiles([file]);

    expect(connection.sendControl).toHaveBeenCalledTimes(1);
    const payload = connection.sendControl.mock.calls[0][0];
    expect(payload.type).toBe("batch-offer");
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0].fileName).toBe("hello.txt");
    expect(manager.pendingOutgoingOffers.size).toBe(1);

    manager.dispose();
  });

  it("tracks incoming batch offers and transfer mappings", () => {
    const connection = createMockConnection();
    const manager = new FileTransferManager(connection as unknown as WebRTCConnection);
    const batchId = "123e4567-e89b-42d3-a456-426614174000" as BatchId;
    const fileId = "123e4567-e89b-42d3-a456-426614174001" as FileId;

    connection.emit("controlChannelMessage", {
      type: "batch-offer",
      protocolVersion: 1,
      batchId,
      files: [
        {
          fileId,
          fileName: "incoming.txt",
          size: 64,
          mimeType: "text/plain",
          chunkSize: 16384,
          totalChunks: 1,
        },
      ],
    });

    connection.emit("controlChannelMessage", {
      type: "batch-transfer-mappings",
      protocolVersion: 1,
      batchId,
      mappings: [{ fileId, transferId: 17 }],
    });

    expect(manager.pendingIncomingOffers.has(batchId)).toBe(false);
    expect(manager.pendingIncomingFiles).toHaveLength(0);
    expect(manager.activeTransfers.has(17)).toBe(true);

    manager.dispose();
  });
});
