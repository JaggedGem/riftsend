import { IndexedDbSinkErrorCode, type FileId } from "@riftsend/shared";
import type { FileSink, SinkState } from "../FileSink";
import { IndexedDbSinkError } from "./IndexedDbSinkError";
import { FileDatabase } from "../FileDatabase";

export class IndexedDbSink implements FileSink<Blob> {
  private readonly fileDb: FileDatabase;
  private sinkState: SinkState<IndexedDbSinkError> = { state: "uninitialized" };
  private readonly fileId: FileId;

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

  private assertState(operation: string, allowed: SinkState<IndexedDbSinkError>["state"][]) {
    if (!allowed.includes(this.sinkState.state)) {
      throw new IndexedDbSinkError(
        IndexedDbSinkErrorCode.NOT_READY,
        `IndexedDB sink cannot ${operation} from state: ${this.sinkState.state}`,
      );
    }
  }

  public writeChunk(
    index: number,
    data: ArrayBuffer,
  ): Promise<{ buffered: Promise<void>; flushed: Promise<void> }> {
    this.assertState("write the chunk", ["ready"]);

    const buffered = Promise.resolve();

    const flushed = (async () => {
      try {
        await this.fileDb.writeChunk(index, new Blob([data]));
      } catch (error) {
        const fatalError = new IndexedDbSinkError(
          IndexedDbSinkErrorCode.CHUNK_WRITE_FAILED,
          "An error occurred while trying to write the chunk",
          { cause: error },
        );

        this.sinkState = { state: "errored", cause: fatalError };

        throw fatalError;
      }
    })();

    return Promise.resolve({ buffered, flushed });
  }

  public async complete(): Promise<Blob> {
    this.assertState("complete the file blob", ["ready"]);

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
    this.assertState("abort the file transfer", ["ready", "errored"]);

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
    if (this.sinkState.state === "disposed" || this.sinkState.state === "aborted") {
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
