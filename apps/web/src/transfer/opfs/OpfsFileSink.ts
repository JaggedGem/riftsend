import { CHUNK_SIZE } from "@riftsend/protocol";
import type { FileSink } from "../FileSink";
import { OpfsSinkWorkerClient, type WriteResult } from "./OpfsSinkWorkerClient";
import { OpfsFileSinkErrorCode, type FileId } from "@riftsend/shared";
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
        OpfsFileSinkErrorCode.INVALID_FILE_SIZE,
        `Invalid file size: ${fileSize}`,
      );
    }

    const sink = new OpfsFileSink();

    try {
      await sink.sinkClient.initialize(fileId, fileSize, isResume);
    } catch (error) {
      sink.sinkClient.dispose();

      throw new OpfsSinkError(
        OpfsFileSinkErrorCode.INITIALIZATION_FAILED,
        "Failed to initialize the OPFS sink worker client",
        { cause: error },
      );
    }

    sink.sinkState = "ready";

    return sink;
  }

  private constructor() {}

  /**
   * Asserts that the client is ready to send operations to the worker.
   *
   * @returns The current ready-state snapshot.
   * @throws {OpfsSinkError} When lifecycle state does not permit requests.
   */
  private assertReady(operation: string) {
    if (this.sinkState !== "ready") {
      throw new OpfsSinkError(
        OpfsFileSinkErrorCode.NOT_READY,
        `OPFS sink is not ready to ${operation}`,
        {
          cause: `current state: ${this.sinkState}`,
        },
      );
    }
  }

  public async writeChunk(index: number, data: ArrayBuffer): WriteResult {
    this.assertReady("write a chunk");

    return await this.sinkClient.write(index * CHUNK_SIZE, data);
  }

  public async complete(): Promise<Blob> {
    this.assertReady("complete");

    this.sinkState = "completing";

    // todo: DONT DO THIS, this loads the whole file in memory (use streams instead)
    return new Blob([await this.sinkClient.read()], { type: "application/octet-stream" });
  }

  public async abort(): Promise<void> {
    this.assertReady("abort");

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
