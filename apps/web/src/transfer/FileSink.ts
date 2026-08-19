export interface FileSink<TResult> {
  writeChunk(
    index: number,
    data: ArrayBuffer,
  ): Promise<{
    buffered: Promise<void>;
    flushed: Promise<void>;
  }>;
  complete(): Promise<TResult>;
  abort(): Promise<void>;
  dispose(): void;
}
