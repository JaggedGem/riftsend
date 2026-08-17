import { CHUNK_SIZE } from "@riftsend/protocol";
import type { FileSink } from "../FileSink";
import { OpfsSinkWorkerClient } from "./OpfsSinkWorkerClient";
import { OpfsSinkErrorCode, type FileId } from "@riftsend/shared";
import { OpfsSinkError } from "./OpfsSinkError";

/**
 * Stateful lifecycle model for the OPFS sink.
 */
type SinkState = "uninitialized" | "ready" | "completing" | "aborting" | "disposing" | "disposed";

export class OpfsFileSink implements FileSink<Blob> {
  private readonly sinkClient = new OpfsSinkWorkerClient();
  private sinkState: SinkState = "uninitialized";

  public static async create(
    fileId: FileId,
    fileSize: number,
    isResume: boolean,
  ): Promise<OpfsFileSink> {
    if (!Number.isFinite(fileSize) || fileSize < 0) {
      throw new OpfsSinkError(
        OpfsSinkErrorCode.INVALID_FILE_SIZE,
        `Invalid file size: ${fileSize}`,
      );
    }

    const sink = new OpfsFileSink();

    try {
      await sink.sinkClient.initialize(fileId, fileSize, isResume);
    } catch (error) {
      sink.sinkClient.dispose();

      throw new OpfsSinkError(
        OpfsSinkErrorCode.SINK_INITIALIZATION_FAILED,
        "Failed to initialize the OPFS sink worker client",
        { cause: error },
      );
    }

    sink.sinkState = "ready";

    return sink;
  }

  private constructor() {}

  public async writeChunk(
    index: number,
    data: ArrayBuffer,
  ): Promise<{
    buffered: Promise<void>;
    flushed: Promise<void>;
  }> {
    if (this.sinkState !== "ready") {
      throw new OpfsSinkError(OpfsSinkErrorCode.SINK_NOT_READY, "OPFS sink is not ready", {
        cause: `current state: ${this.sinkState}`,
      });
    }

    return await this.sinkClient.write(index * CHUNK_SIZE, data);
  }

  public async complete(): Promise<Blob> {
    if (this.sinkState !== "ready") {
      throw new OpfsSinkError(OpfsSinkErrorCode.SINK_NOT_READY, "OPFS sink is not ready", {
        cause: `current state: ${this.sinkState}`,
      });
    }

    this.sinkState = "completing";

    // todo: DONT DO THIS, this loads the whole file in memory (use streams instead)
    return new Blob([await this.sinkClient.read()], { type: "application/octet-stream" });
  }

  public async abort(): Promise<void> {
    if (this.sinkState !== "ready") {
      throw new OpfsSinkError(OpfsSinkErrorCode.SINK_NOT_READY, "OPFS sink is not ready", {
        cause: `current state: ${this.sinkState}`,
      });
    }

    this.sinkState = "aborting";

    try {
      await this.sinkClient.delete();
    } finally {
      this.dispose();
    }
  }

  public dispose() {
    if (this.sinkState === "disposed") {
      return;
    }

    this.sinkState = "disposing";

    this.sinkClient.dispose();

    this.sinkState = "disposed";
  }
}
