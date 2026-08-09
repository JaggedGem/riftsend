import type { FileOffer } from "@riftsend/protocol";
import type { FileSink } from "./FileSink";

export class OpfsFileSink implements FileSink<Blob> {
  static originRootDir = navigator.storage.getDirectory();

  constructor(fileMetadata: FileOffer) {
    this.worker.postMessage("initiate");
  }

  async writeChunk(index: number, data: ArrayBuffer): Promise<void> {}

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
