import { IndexedDbSinkErrorCode, type FileId } from "@riftsend/shared";
import type { FileSink, SinkState } from "../FileSink";
import { IndexedDbSinkError } from "./IndexedDbSinkError";
import { FileDatabase } from "../FileDatabase";

export class IndexedDbSink implements FileSink<Blob> {
  private fileDb: FileDatabase;
  private sinkState: SinkState = "uninitialized";

  public static async create(fileId: FileId) {
    try {
      const fileDatabase = await FileDatabase.create(fileId, { includeChunksStore: true });

      const sink = new IndexedDbSink(fileDatabase);

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

  private constructor(fileDb: FileDatabase) {
    this.fileDb = fileDb;
  }

  writeChunk(
    _index: number,
    _data: ArrayBuffer,
  ): Promise<{ buffered: Promise<void>; flushed: Promise<void> }> {
    throw new Error("Method not implemented.");
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
