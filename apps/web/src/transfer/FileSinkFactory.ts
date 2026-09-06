import type { FileId } from "@riftsend/shared";
import { IndexedDbSink } from "./indexedDb/IndexedDbSink";
import { OpfsFileSink } from "./opfs/OpfsFileSink";
import type { FileSink } from "./FileSink";

export interface CreateFileSinkOptions {
  fileId: FileId;
  fileSize?: number;
  isResume?: boolean;
}

export class FileSinkFactory {
  public static async create({
    fileId,
    fileSize,
    isResume,
  }: CreateFileSinkOptions): Promise<FileSink<Blob>> {
    if (typeof navigator.storage?.getDirectory === "function") {
      if (fileSize === undefined || isResume === undefined) {
        throw new Error("fileSize and isResume are required when using OPFS");
      }

      return OpfsFileSink.create(fileId, fileSize, isResume);
    }

    return IndexedDbSink.create(fileId);
  }
}
