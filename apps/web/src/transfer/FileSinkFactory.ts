import { IndexedDbSink } from "./indexedDb/IndexedDbSink";
import { OpfsFileSink } from "./opfs/OpfsFileSink";
import type { FileSink } from "./FileSink";
import type { FileMetadata } from "@riftsend/protocol";

export class FileSinkFactory {
  public static async create(metadata: FileMetadata, isResume?: boolean): Promise<FileSink<Blob>> {
    if (typeof navigator.storage?.getDirectory === "function") {
      if (isResume === undefined) {
        throw new Error("isResume is required when using OPFS");
      }

      return OpfsFileSink.create(metadata, isResume);
    }

    return IndexedDbSink.create(metadata);
  }
}
