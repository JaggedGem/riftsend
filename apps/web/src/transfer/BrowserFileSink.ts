import type { FileSink } from "./FileSink.js";

export class BrowserFileSink implements FileSink<File> {
  public async writeChunk(
    _index: number,
    _data: ArrayBuffer,
  ): Promise<{ buffered: Promise<void>; flushed: Promise<void> }> {
    return { buffered: Promise.resolve(), flushed: Promise.resolve() };
  }
  public async complete(): Promise<File> {
    // todo: implement actual logic
    const file: unknown = "";
    return file as File;
  }
  public async abort(): Promise<void> {}
  public dispose(): void {}
}
