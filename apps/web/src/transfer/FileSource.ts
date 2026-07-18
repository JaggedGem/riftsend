import type { FileId } from "@riftsend/shared";

export interface FileSource {
  readonly id: FileId;
  readonly name: string;
  readonly size: number;

  readChunks(startChunk?: number): AsyncGenerator<Uint8Array>;
}
