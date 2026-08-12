import { describe, expect, it, vi } from "vitest";
import { CHUNK_SIZE } from "@riftsend/protocol";
import type { FileId, TransferId } from "@riftsend/shared";
import type { WebRTCConnection } from "@/webrtc/WebRTCConnection";
import type { FileSource } from "./FileSource";
import type { FileSink } from "./FileSink";
import { BrowserFileSink } from "./BrowserFileSink.js";
import { IncomingFileTransfer, OutgoingFileTransfer } from "./FileTransfer.js";

const fileId = "123e4567-e89b-42d3-a456-426614174000" as FileId;
const transferId = 42 as TransferId;

describe("OutgoingFileTransfer", () => {
  it("starts a transfer and enters the running state", () => {
    const connection = {
      sendData: vi.fn().mockResolvedValue(undefined),
    } as unknown as WebRTCConnection;
    const fileSource: FileSource = {
      id: fileId,
      name: "demo.bin",
      size: CHUNK_SIZE * 2 + 7,
      readChunks: vi.fn(async function* () {
        yield { index: 0, data: new Uint8Array(CHUNK_SIZE).buffer };
        yield { index: 1, data: new Uint8Array(7).buffer };
      }),
    };

    const transfer = new OutgoingFileTransfer(connection, 1, fileSource, transferId);

    transfer.start();

    expect(transfer.getState()).toBe("running");
    expect(fileSource.readChunks).toHaveBeenCalled();
  });

  it("allows cancellation from the running state and rejects invalid state transitions", async () => {
    const connection = {
      sendData: vi.fn().mockResolvedValue(undefined),
    } as unknown as WebRTCConnection;
    const fileSource: FileSource = {
      id: fileId,
      name: "cancel.bin",
      size: CHUNK_SIZE + 1,
      readChunks: vi.fn(async function* () {
        yield { index: 0, data: new Uint8Array(CHUNK_SIZE).buffer };
        yield { index: 1, data: new Uint8Array(1).buffer };
      }),
    };
    const transfer = new OutgoingFileTransfer(connection, 1, fileSource, transferId);

    expect(() => transfer.cancel()).toThrow();
    expect(() => transfer.pause()).toThrow();

    transfer.start();
    expect(transfer.getState()).toBe("running");

    transfer.cancel();

    expect(transfer.getState()).toBe("cancelled");
    expect(() => transfer.resume()).toThrow();
  });
});

describe("IncomingFileTransfer", () => {
  it("stores the metadata and sink passed to it", () => {
    const sink: FileSink<string> = {
      writeChunk: vi.fn(),
      complete: vi.fn(),
      abort: vi.fn(),
      getWrittenExtent: vi.fn(() => 0),
    };

    const metadata = {
      fileId,
      fileName: "incoming.txt",
      size: 32,
      mimeType: "text/plain",
      chunkSize: CHUNK_SIZE,
      totalChunks: 1,
    };

    const transfer = new IncomingFileTransfer(
      {} as unknown as WebRTCConnection,
      1,
      transferId,
      metadata,
      sink,
    );

    expect(transfer.id).toBe(transferId);
  });
});

describe("BrowserFileSink", () => {
  it("accepts writes and resolves the completion placeholder", async () => {
    const sink = new BrowserFileSink();

    await sink.writeChunk(0, new Uint8Array([1, 2, 3]).buffer);

    const result = await sink.complete();

    expect(result).toBe("");
  });
});
