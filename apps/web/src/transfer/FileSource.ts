import type { FileId } from "@riftsend/shared";

export interface FileChunk {
  index: number;
  data: ArrayBuffer;
}

export interface FileSource {
  readonly id: FileId;
  readonly name: string;
  readonly size: number;

  readChunks(startChunk?: number, abortSignal?: AbortSignal): AsyncGenerator<FileChunk>;
}
