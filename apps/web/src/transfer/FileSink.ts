export interface FileSink<TResult> {
  writeChunk(index: number, data: ArrayBuffer): Promise<void>;
  complete(): Promise<TResult>;
  abort(): void;
  getWrittenExtent(): number;
}
