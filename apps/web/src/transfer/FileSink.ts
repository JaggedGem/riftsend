export interface FileSink {
  writeChunk(index: number, data: Uint8Array): Promise<void>;
  complete(): Promise<File>;
}
