import { TypedEventEmitter } from "@/events/TypedEventEmitter";
import type { WebRTCConnection } from "@/webrtc/WebRTCConnection";
import type { FileSource } from "./FileSource";
import { buildChunk } from "@riftsend/protocol";
import type { TransferId } from "@riftsend/shared";

type FileTransferEvents = {
  started: void;
  progress: { bytesSent: number; totalBytes: number; bytesPerSecond: number };
  completed: void;
  failed: { error: Error };
  cancelled: void;
  paused: void;
};

type OutgoingFileTransferEvents = FileTransferEvents & {};

type IncomingFileTransferEvents = FileTransferEvents & {};

type TransferState = "idle" | "running" | "completed" | "failed" | "cancelled" | "paused";

const PROGRESS_EVENTS_DELAY = 250 as const;

export class OutgoingFileTransfer extends TypedEventEmitter<OutgoingFileTransferEvents> {
  private state: TransferState = "idle";
  private bytesSent: number = 0;
  private lastProgressEmit = 0;
  private abortController = new AbortController();
  private startedAt: number | undefined;
  private nextChunkIndex = 0;

  constructor(
    private readonly connection: WebRTCConnection,
    private readonly protocolVersion: number,
    private readonly fileSource: FileSource,
    public readonly transferId: TransferId,
  ) {
    super();
  }

  private sendChunk(chunkIndex: number, payload: ArrayBuffer): boolean {
    const chunk = buildChunk(this.protocolVersion, this.transferId, chunkIndex, payload);

    return this.connection.sendData(chunk);
  }

  private isCancelled(): boolean {
    return this.state === "cancelled";
  }

  private isPaused(): boolean {
    return this.state === "paused";
  }

  private emitProgress() {
    if (this.state !== "running" || !this.startedAt) {
      console.warn("Cannot emit progress if transfer hasn't started already");
      return;
    }

    const now = Date.now();

    if (now - this.lastProgressEmit < PROGRESS_EVENTS_DELAY) {
      return;
    }

    this.lastProgressEmit = now;

    const elapsed = (now - this.startedAt) / 1000;
    const bytesPerSecond = this.bytesSent / elapsed;

    this.emit("progress", {
      bytesSent: this.bytesSent,
      totalBytes: this.fileSource.size,
      bytesPerSecond,
    });
  }

  public cancel() {
    if (this.state !== "running") {
      return;
    }

    this.state = "cancelled";

    this.abortController.abort();

    this.emit("cancelled", undefined);
  }

  public pause() {
    if (this.state !== "running") {
      return;
    }

    this.state = "paused";

    this.emit("paused", undefined);
  }

  public resume() {
    if (this.state !== "paused") {
      return;
    }

    void this.run();
  }

  public start() {
    if (this.state !== "idle") {
      return;
    }

    void this.run();
  }

  private async run() {
    this.state = "running";

    this.emit("started", undefined);

    this.startedAt = Date.now();

    try {
      for await (const rawChunk of this.fileSource.readChunks(
        this.nextChunkIndex,
        this.abortController.signal,
      )) {
        if (this.isCancelled() || this.isPaused()) {
          return;
        }

        if (!this.sendChunk(rawChunk.index, rawChunk.data)) {
          throw new Error(
            `Cannot send chunk ${rawChunk.index} over the data channel. Check if the data channel is open`,
          );
        }

        this.bytesSent += rawChunk.data.byteLength;

        this.nextChunkIndex++;

        this.emitProgress();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      this.state = "failed";

      this.emit("failed", { error: error instanceof Error ? error : new Error(String(error)) });

      return;
    }

    this.state = "completed";

    this.emit("completed", undefined);
  }
}

export class IncomingFileTransfer extends TypedEventEmitter<IncomingFileTransferEvents> {
  constructor(
    private readonly connection: WebRTCConnection,
    private readonly protocolVersion: number,
    public readonly transferId: TransferId,
  ) {
    super();
  }
}
