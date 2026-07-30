import type { FileId } from "@riftsend/shared";
import type { FileChunk, FileSource } from "./FileSource.js";
import { CHUNK_SIZE } from "@riftsend/protocol";

export class BrowserFileSource implements FileSource {
  public readonly name;
  public readonly size;

  public constructor(
    private readonly file: File,
    public readonly id: FileId,
  ) {
    this.name = file.name;
    this.size = file.size;
  }

  public async *readChunks(startChunk = 0, abortSignal?: AbortSignal): AsyncGenerator<FileChunk> {
    let byteOffset = startChunk * CHUNK_SIZE;
    let index = startChunk;

    while (byteOffset < this.file.size) {
      const binaryChunk = this.file.slice(byteOffset, byteOffset + CHUNK_SIZE);

      const data = await binaryChunk.arrayBuffer();

      abortSignal?.throwIfAborted();

      yield { index, data };

      byteOffset += CHUNK_SIZE;
      index++;
    }
  }
}
