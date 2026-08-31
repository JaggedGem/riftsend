import { IndexedDbSinkErrorCode, type FileId } from "@riftsend/shared";
import type { FileSink, SinkState } from "../FileSink";
import { IndexedDbSinkError } from "./IndexedDbSinkError";
import { FileDatabase } from "../FileDatabase";

export class IndexedDbSink implements FileSink<Blob> {
  private fileDb: FileDatabase;
  private sinkState: SinkState<IndexedDbSinkError> = { state: "uninitialized" };
  private fileId: FileId;

  public static async create(fileId: FileId) {
    try {
      const fileDatabase = await FileDatabase.create(fileId, { includeChunksStore: true });

      const sink = new IndexedDbSink(fileDatabase, fileId);

      sink.sinkState = { state: "ready" };

      return sink;
    } catch (error) {
      throw new IndexedDbSinkError(
        IndexedDbSinkErrorCode.INITIALIZATION_FAILED,
        "An error occurred while trying to create a new sink",
        { cause: error },
      );
    }
  }

  private constructor(fileDb: FileDatabase, fileId: FileId) {
    this.fileDb = fileDb;
    this.fileId = fileId;
  }

  private assertReady(operation: string) {
    if (this.sinkState.state !== "ready") {
      throw new IndexedDbSinkError(
        IndexedDbSinkErrorCode.NOT_READY,
        `IndexedDB sink is not ready to ${operation}`,
        {
          cause: `current state: ${this.sinkState}`,
        },
      );
    }
  }

  public async writeChunk(
    index: number,
    data: ArrayBuffer,
  ): Promise<{ buffered: Promise<void>; flushed: Promise<void> }> {
    this.assertReady("write the chunk");

    const buffered = Promise.resolve();

    const flushed = (async () => {
      await this.fileDb.writeChunk(index, new Blob([data]));
    })();

    return { buffered, flushed };
  }

  public async complete(): Promise<Blob> {
    this.assertReady("complete the file blob");

    this.sinkState = { state: "completing" };

    try {
      const fileBlob = await this.fileDb.readAllChunksOrdered();

      this.sinkState = { state: "completed" };

      return fileBlob;
    } catch (error) {
      const fatalError = new IndexedDbSinkError(
        IndexedDbSinkErrorCode.COMPLETION_FAILED,
        "An error occurred while trying to complete the file",
        { cause: error },
      );

      this.sinkState = {
        state: "errored",
        cause: fatalError,
      };

      throw fatalError;
    }
  }

  public async abort(): Promise<void> {
    this.assertReady("abort the file transfer");

    this.sinkState = { state: "aborting" };

    this.fileDb.dispose();

    try {
      await FileDatabase.deleteForFile(this.fileId);

      this.sinkState = { state: "aborted" };
    } catch (error) {
      const fatalError = new IndexedDbSinkError(
        IndexedDbSinkErrorCode.ABORT_FAILED,
        "An error occurred while trying to abort a transfer",
        { cause: error },
      );

      this.sinkState = {
        state: "errored",
        cause: fatalError,
      };

      throw fatalError;
    }
  }

  public dispose(): void {
    if (
      this.sinkState.state === "disposed" ||
      this.sinkState.state === "aborted" ||
      this.sinkState.state === "completed"
    ) {
      return;
    }

    this.sinkState = { state: "disposing" };

    this.fileDb.dispose();

    this.sinkState = { state: "disposed" };
  }

  public get lastError(): IndexedDbSinkError | undefined {
    if (this.sinkState.state !== "errored") {
      return undefined;
    }

    return this.sinkState.cause;
  }
}
