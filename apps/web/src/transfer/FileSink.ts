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

/**
 * Stateful lifecycle model for a sink implementation.
 */
export type SinkState =
  "uninitialized" | "ready" | "completing" | "aborting" | "disposing" | "disposed";
