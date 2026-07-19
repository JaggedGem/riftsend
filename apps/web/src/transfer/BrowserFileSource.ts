import type { FileId } from "@riftsend/shared";
import type { FileChunk, FileSource } from "./FileSource.js";
import { CHUNK_SIZE } from "@riftsend/protocol";

export class BrowserFileSource implements FileSource {
  public readonly name;
  public readonly size;

  constructor(
    private readonly file: File,
    public readonly id: FileId,
  ) {
    this.name = file.name;
    this.size = file.size;
  }

  async *readChunks(startChunk = 0): AsyncGenerator<FileChunk> {
    let byteOffset = startChunk * CHUNK_SIZE;
    let index = startChunk;

    if (byteOffset >= this.file.size) {
      return;
    }

    while (byteOffset < this.file.size) {
      const binaryChunk = this.file.slice(byteOffset, byteOffset + CHUNK_SIZE);

      yield { index, data: await binaryChunk.arrayBuffer() };

      byteOffset += CHUNK_SIZE;
      index++;
    }
  }
}
