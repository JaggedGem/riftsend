import { IndexedDbSinkErrorCode, type FileId } from "@riftsend/shared";
import type { FileSink, SinkState } from "../FileSink";
import { IndexedDbSinkError } from "./IndexedDbSinkError";
import { FileDatabase } from "../FileDatabase";

export class IndexedDbSink implements FileSink<Blob> {
  private fileDb: FileDatabase;
  private sinkState: SinkState = "uninitialized";
  private fileId: FileId;

  public static async create(fileId: FileId) {
    try {
      const fileDatabase = await FileDatabase.create(fileId, { includeChunksStore: true });

      const sink = new IndexedDbSink(fileDatabase, fileId);

      sink.sinkState = "ready";

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

  public async writeChunk(
    index: number,
    data: ArrayBuffer,
  ): Promise<{ buffered: Promise<void>; flushed: Promise<void> }> {
    if (this.sinkState !== "ready") {
      throw new IndexedDbSinkError(
        IndexedDbSinkErrorCode.NOT_READY,
        `IndexedDB sink is not ready to write the chunk`,
        {
          cause: `current state: ${this.sinkState}`,
        },
      );
    }

    const buffered = Promise.resolve();

    const flushed = (async () => {
      await this.fileDb.writeChunk(index, new Blob([data]));
    })();

    return { buffered, flushed };
  }

  complete(): Promise<Blob> {
    throw new Error("Method not implemented.");
  }
  abort(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  dispose(): void {
    throw new Error("Method not implemented.");
  }
}
