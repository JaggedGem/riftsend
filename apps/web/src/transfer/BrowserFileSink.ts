// todo: remove below rule
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { FileSink } from "./FileSink.js";

export class BrowserFileSink implements FileSink {
  async writeChunk(_index: number, _data: Uint8Array): Promise<void> {}
  async complete(): Promise<File> {
    // todo: implement actual logic
    const file: unknown = "";
    return file as File;
  }
}
