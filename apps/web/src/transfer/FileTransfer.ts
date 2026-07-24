import { TypedEventEmitter } from "@/events/TypedEventEmitter.js";
import type { WebRTCConnection } from "@/webrtc/WebRTCConnection.js";
import type { FileSource } from "./FileSource.js";
import { buildChunk, type FileOffer } from "@riftsend/protocol";
import type { TransferId } from "@riftsend/shared";
import { TransferSendError, TransferStateError } from "./errors.js";
import type { FileSink } from "./FileSink.js";

type FileTransferEvents = {
  started: void;
  progress: { bytesSent: number; totalBytes: number; bytesPerSecond: number };
  completed: void;
  failed: { error: unknown };
  cancelled: void;
  paused: void;
  resumed: void;
};

type OutgoingFileTransferEvents = FileTransferEvents & {};

type IncomingFileTransferEvents = FileTransferEvents & {};

export type TransferState = "idle" | "running" | "completed" | "failed" | "cancelled" | "paused";

const PROGRESS_EVENTS_DELAY = 250 as const;

export class OutgoingFileTransfer extends TypedEventEmitter<OutgoingFileTransferEvents> {
  private state: TransferState = "idle";
  private bytesSent: number = 0;
  private lastProgressEmit = 0;
  private cancelController = new AbortController();
  private startedAt?: number;
  private activeTimeMs = 0;
  private nextChunkIndex = 0;

  constructor(
    private readonly connection: WebRTCConnection,
    private readonly protocolVersion: number,
    private readonly fileSource: FileSource,
    public readonly id: TransferId,
  ) {
    super();
  }

  private sendChunk(chunkIndex: number, payload: ArrayBuffer): boolean {
    const chunk = buildChunk(this.protocolVersion, this.id, chunkIndex, payload);

    return this.connection.sendData(chunk);
  }

  private isCancelled(): boolean {
    return this.state === "cancelled";
  }

  private isPaused(): boolean {
    return this.state === "paused";
  }

  private emitProgress() {
    const now = Date.now();

    if (now - this.lastProgressEmit < PROGRESS_EVENTS_DELAY) {
      return;
    }

    this.lastProgressEmit = now;

    const elapsed = this.activeTimeMs + (this.startedAt !== undefined ? now - this.startedAt : 0);

    const bytesPerSecond = elapsed === 0 ? 0 : this.bytesSent / (elapsed / 1000);

    this.emit("progress", {
      bytesSent: this.bytesSent,
      totalBytes: this.fileSource.size,
      bytesPerSecond,
    });
  }

  public cancel() {
    if (this.state !== "running" && this.state !== "paused") {
      throw new TransferStateError(["running", "paused"], this.state, "cancel");
    }

    this.state = "cancelled";

    this.cancelController.abort();

    this.emit("cancelled", undefined);
  }

  public pause() {
    if (this.state !== "running") {
      throw new TransferStateError("running", this.state, "pause");
    }
    if (this.startedAt) {
      this.activeTimeMs += Date.now() - this.startedAt;

      this.startedAt = undefined;
    }

    this.state = "paused";

    this.emit("paused", undefined);
  }

  public resume() {
    if (this.state !== "paused") {
      throw new TransferStateError("paused", this.state, "resume");
    }

    void this.run(false);
  }

  public start() {
    if (this.state !== "idle") {
      throw new TransferStateError("idle", this.state, "start");
    }

    void this.run(true);
  }

  private async run(firstRun: boolean) {
    this.state = "running";

    if (firstRun) {
      this.emit("started", undefined);
    } else {
      this.emit("resumed", undefined);
    }

    this.startedAt = Date.now();

    try {
      for await (const rawChunk of this.fileSource.readChunks(
        this.nextChunkIndex,
        this.cancelController.signal,
      )) {
        if (this.isCancelled() || this.isPaused()) {
          return;
        }

        if (!this.sendChunk(rawChunk.index, rawChunk.data)) {
          throw new TransferSendError(rawChunk.index);
        }

        this.bytesSent += rawChunk.data.byteLength;

        this.nextChunkIndex = rawChunk.index + 1;

        this.emitProgress();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      this.state = "failed";

      this.emit("failed", { error });

      return;
    }

    this.state = "completed";

    this.emit("completed", undefined);
  }

  public getState(): TransferState {
    return this.state;
  }

  public get fileId() {
    return this.fileSource.id;
  }

  public fail(error: unknown) {
    this.state = "failed";

    this.emit("failed", { error });
  }
}

export class IncomingFileTransfer extends TypedEventEmitter<IncomingFileTransferEvents> {
  constructor(
    // todo: remove all of the ignores when actually implemented but damn it's ugly

    // @ts-expect-error not implemented yet
    private readonly connection: WebRTCConnection,
    // @ts-expect-error not implemented yet
    private readonly protocolVersion: number,
    public readonly id: TransferId,
    // @ts-expect-error not implemented yet
    private readonly metadata: FileOffer,
    // @ts-expect-error not implemented yet
    private readonly sink: FileSink,
  ) {
    super();
  }
}
