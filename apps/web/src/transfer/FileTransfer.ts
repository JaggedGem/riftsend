import { TypedEventEmitter } from "@/events/TypedEventEmitter";
import type { WebRTCConnection } from "@/webrtc/WebRTCConnection";
import type { FileSource } from "./FileSource";
import { buildChunk } from "@riftsend/protocol";
import type { TransferId } from "@riftsend/shared";

type OutgoingFileTransferEvents = {
  started: void;
  progress: { bytesSent: number; totalBytes: number };
  completed: void;
  failed: { error: Error };
  cancelled: void;
};

type IncomingFileTransferEvents = {
  started: void;
  progress: { bytesSent: number; totalBytes: number };
  completed: void;
  failed: { error: Error };
  cancelled: void;
};

type TransferState = "idle" | "running" | "completed" | "failed" | "cancelled";

const PROGRESS_EVENTS_DELAY = 250 as const;

export class OutgoingFileTransfer extends TypedEventEmitter<OutgoingFileTransferEvents> {
  private state: TransferState = "idle";
  private bytesSent: number = 0;
  private lastProgressEmit = 0;
  private abortController = new AbortController();

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

    if (!this.connection.sendData(chunk)) {
      return false;
    }

    return true;
  }

  private isCancelled(): boolean {
    return this.state === "cancelled";
  }

  private emitProgress() {
    const now = Date.now();

    if (now - this.lastProgressEmit < PROGRESS_EVENTS_DELAY) {
      return;
    }

    this.lastProgressEmit = now;

    this.emit("progress", { bytesSent: this.bytesSent, totalBytes: this.fileSource.size });
  }

  public cancel() {
    if (this.state !== "running") {
      return;
    }

    this.state = "cancelled";

    this.abortController.abort();

    this.emit("cancelled", undefined);
  }

  public async start() {
    if (this.state !== "idle") {
      throw new Error("Cannot start transfer if not currently idling");
    }

    this.state = "running";

    this.emit("started", undefined);

    try {
      for await (const rawChunk of this.fileSource.readChunks(0, this.abortController.signal)) {
        if (this.isCancelled()) {
          return;
        }

        if (!this.sendChunk(rawChunk.index, rawChunk.data)) {
          throw new Error(
            `Cannot send chunk ${rawChunk.index} over the data channel. Check if the data channel is open`,
          );
        }

        this.bytesSent += rawChunk.data.byteLength;

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
