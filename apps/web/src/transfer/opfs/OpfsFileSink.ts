import type { FileSink } from "../FileSink";
import { OpfsSinkWorkerClient } from "./OpfsSinkWorkerClient";
import type { FileId } from "@riftsend/shared";

export class OpfsFileSink implements FileSink<Blob> {
  static originRootDir = navigator.storage.getDirectory();

  private readonly sinkClient = new OpfsSinkWorkerClient();

  constructor(fileId: FileId, fileSize: number, isResume: boolean) {
    this.sinkClient.initialize(fileId, fileSize, isResume);
  }

  async writeChunk(_index: number, _data: ArrayBuffer): Promise<void> {
    throw new Error("Method not implemented.");
  }

  complete(): Promise<Blob> {
    throw new Error("Method not implemented.");
  }
  abort(): void {
    throw new Error("Method not implemented.");
  }
  getWrittenExtent(): number {
    throw new Error("Method not implemented.");
  }
}
