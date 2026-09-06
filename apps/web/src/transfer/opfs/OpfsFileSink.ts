import { CHUNK_SIZE, type FileMetadata } from "@riftsend/protocol";
import type { FileSink, SinkState } from "../FileSink";
import { OpfsSinkWorkerClient, type WriteResult } from "./OpfsSinkWorkerClient";
import { OpfsFileSinkErrorCode } from "@riftsend/shared";
import { OpfsSinkError } from "./OpfsSinkError";
import { FileDatabase } from "../FileDatabase";

export class OpfsFileSink implements FileSink<Blob> {
  private readonly fileDb: FileDatabase;
  private readonly sinkClient = new OpfsSinkWorkerClient();
  private sinkState: SinkState<OpfsSinkError> = { state: "uninitialized" };

  public static async create(metadata: FileMetadata, isResume: boolean): Promise<OpfsFileSink> {
    if (!Number.isFinite(metadata.fileSize) || metadata.fileSize < 0) {
      throw new OpfsSinkError(
        OpfsFileSinkErrorCode.INVALID_FILE_SIZE,
        `Invalid file size: ${metadata.fileSize}`,
      );
    }

    let sink: OpfsFileSink | undefined;
    let fileDb: FileDatabase | undefined;
    try {
      fileDb = await FileDatabase.create(metadata, { includeChunksStore: false });

      sink = new OpfsFileSink(fileDb);

      await sink.sinkClient.initialize(metadata.fileId, metadata.fileSize, isResume);

      sink.sinkState = { state: "ready" };

      return sink;
    } catch (error) {
      if (fileDb) {
        fileDb.dispose();
      }

      if (sink) {
        sink.dispose();
      }

      throw new OpfsSinkError(
        OpfsFileSinkErrorCode.INITIALIZATION_FAILED,
        "Failed to initialize the OPFS sink worker client",
        { cause: error },
      );
    }
  }

  private constructor(fileDb: FileDatabase) {
    this.fileDb = fileDb;
  }

  /**
   * Asserts that the client is ready to send operations to the worker.
   *
   * @returns The current ready-state snapshot.
   * @throws {OpfsSinkError} When lifecycle state does not permit requests.
   */
  private assertReady(operation: string) {
    if (this.sinkState.state !== "ready") {
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

    if (index < 0 || data.byteLength < 0) {
      throw new OpfsSinkError(
        OpfsFileSinkErrorCode.WRITE_FAILED,
        "Write offset and data length must be nonnegative",
      );
    }

    try {
      return await this.sinkClient.write(index * CHUNK_SIZE, data);
    } catch (error) {
      throw new OpfsSinkError(
        OpfsFileSinkErrorCode.WRITE_FAILED,
        "Failed to write data to the OPFS file",
        { cause: error },
      );
    }
  }

  public async complete(): Promise<Blob> {
    this.assertReady("complete");

    this.sinkState = { state: "completing" };

    try {
      const file = await this.sinkClient.getFile();

      return new Blob([file], { type: "application/octet-stream" });
    } finally {
      if (this.sinkState.state === "completing") {
        this.sinkState = { state: "completed" };
      }
    }
  }

  public async abort(): Promise<void> {
    this.assertReady("abort");

    this.sinkState = { state: "aborting" };

    try {
      await this.sinkClient.delete();
    } catch (error) {
      throw new OpfsSinkError(
        OpfsFileSinkErrorCode.ABORT_FAILED,
        "Failed to delete the OPFS file",
        { cause: error },
      );
    } finally {
      this.dispose();
    }
  }

  public dispose() {
    if (this.sinkState.state === "disposed") {
      return;
    }

    this.sinkState = { state: "disposing" };

    this.sinkClient.dispose();
    this.fileDb.dispose();

    this.sinkState = { state: "disposed" };
  }
}
