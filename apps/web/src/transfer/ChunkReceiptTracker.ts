import { SerializedBitmapSchema, type SerializedBitmap } from "@riftsend/protocol";
import { ChunkReceiptTrackerError, ChunkReceiptTrackerErrorCode } from "./ChunkReceiptTrackerError";

export class ChunkReceiptTracker {
  private readonly bitmap: Uint32Array;
  private nrOfReceivedChunks = 0;

  private constructor(
    private readonly totalChunks: number,
    private readonly lastChunkSize: number,
    private readonly chunkSize: number,
    initialBitmap: Uint32Array,
    initialCount: number,
  ) {
    this.bitmap = initialBitmap;
    this.nrOfReceivedChunks = initialCount;
  }

  public static create(
    totalChunks: number,
    lastChunkSize: number,
    chunkSize: number,
  ): ChunkReceiptTracker {
    return new ChunkReceiptTracker(
      totalChunks,
      lastChunkSize,
      chunkSize,
      new Uint32Array(Math.ceil(totalChunks / 32)),
      0,
    );
  }

  public static fromSerialized(data: SerializedBitmap): ChunkReceiptTracker {
    const parsed = SerializedBitmapSchema.safeParse(data);

    if (!parsed.success) {
      throw new ChunkReceiptTrackerError(
        ChunkReceiptTrackerErrorCode.INVALID_SERIALIZED_STATE,
        "Cannot restore ChunkReceiptTracker: serialized state is invalid",
        { cause: parsed.error },
      );
    }

    return new ChunkReceiptTracker(
      parsed.data.totalChunks,
      parsed.data.lastChunkSize,
      parsed.data.chunkSize,
      new Uint32Array(parsed.data.bits),
      parsed.data.receivedCount,
    );
  }

  public markReceived(chunkIndex: number): void {
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= this.totalChunks) {
      throw new ChunkReceiptTrackerError(
        ChunkReceiptTrackerErrorCode.INVALID_CHUNK_INDEX,
        `Invalid chunk index: ${chunkIndex}`,
      );
    }

    const arrayIndex = Math.floor(chunkIndex / 32);
    const bitPosition = chunkIndex % 32;

    if (!this.hasChunk(chunkIndex)) {
      this.nrOfReceivedChunks++;
    }

    this.bitmap[arrayIndex] |= 1 << bitPosition;
  }

  public hasChunk(index: number): boolean {
    const arrayIndex = Math.floor(index / 32);
    const bitPosition = index % 32;

    return (this.bitmap[arrayIndex] & (1 << bitPosition)) !== 0;
  }

  public isComplete(): boolean {
    return this.nrOfReceivedChunks === this.totalChunks;
  }

  public serialize(): SerializedBitmap {
    return {
      version: 1,
      totalChunks: this.totalChunks,
      chunkSize: this.chunkSize,
      lastChunkSize: this.lastChunkSize,
      receivedCount: this.nrOfReceivedChunks,
      bits: new Uint32Array(this.bitmap),
    };
  }

  public get missingRanges(): Array<{ start: number; end: number }> {
    const missingRanges = new Array<{ start: number; end: number }>();

    let missingRange: { start: number | undefined; end: number | undefined } = {
      start: undefined,
      end: undefined,
    };
    for (let i = 0; i < this.bitmap.length; i++) {
      const word = this.bitmap[i];

      if (word === 0xffffffff) {
        if (typeof missingRange.start !== "undefined" && typeof missingRange.end === "undefined") {
          missingRange.end = i * 32;

          missingRanges.push({ start: missingRange.start, end: missingRange.end });

          missingRange = { start: undefined, end: undefined };
        }

        continue;
      }

      if (word === 0x00000000) {
        if (typeof missingRange.start === "undefined") {
          missingRange.start = i * 32;
        }

        continue;
      }

      for (let j = 0; j < 32; j++) {
        const chunkIndex = i * 32 + j;

        if (chunkIndex >= this.totalChunks) {
          break;
        }

        const bit = word & (1 << j) ? 1 : 0;

        if (bit === 0) {
          if (typeof missingRange.start === "undefined") {
            missingRange.start = chunkIndex;
          }
        } else {
          if (
            typeof missingRange.end === "undefined" &&
            typeof missingRange.start !== "undefined"
          ) {
            missingRange.end = chunkIndex;

            missingRanges.push({ start: missingRange.start, end: missingRange.end });

            missingRange = { start: undefined, end: undefined };
          }
        }
      }
    }

    if (typeof missingRange.start !== "undefined" && typeof missingRange.end === "undefined") {
      missingRange.end = this.totalChunks;

      missingRanges.push({ start: missingRange.start, end: missingRange.end });
    }

    return missingRanges;
  }

  public get receivedChunkCount(): number {
    return this.nrOfReceivedChunks;
  }

  public get bytesReceived(): number {
    if (this.hasChunk(this.totalChunks - 1)) {
      return (this.nrOfReceivedChunks - 1) * this.chunkSize + this.lastChunkSize;
    }

    return this.nrOfReceivedChunks * this.chunkSize;
  }

  public get missingChunkCount(): number {
    return this.totalChunks - this.nrOfReceivedChunks;
  }
}
