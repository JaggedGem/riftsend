import { describe, expect, it } from "vitest";
import type { FileId } from "@riftsend/shared";
import { BrowserFileSource } from "./BrowserFileSource.js";

describe("BrowserFileSource", () => {
  it("reads file slices in chunk-sized batches starting from the requested offset", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer], "demo.bin");
    const source = new BrowserFileSource(file, "123e4567-e89b-42d3-a456-426614174000" as FileId);

    const chunks: Array<{ index: number; data: ArrayBuffer }> = [];

    for await (const chunk of source.readChunks(0)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(new Uint8Array(chunks[0].data)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it("respects the start chunk when continuing a transfer", async () => {
    const bytes = new Uint8Array(20 * 1024 + 17);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i % 251;
    }
    const file = new File([bytes.buffer], "big.bin");
    const source = new BrowserFileSource(file, "123e4567-e89b-42d3-a456-426614174001" as FileId);

    const chunks: number[] = [];
    for await (const chunk of source.readChunks(1)) {
      chunks.push(chunk.index);
    }

    expect(chunks).toEqual([1]);
    const firstChunk = await source.readChunks(1).next();
    expect(firstChunk.value.index).toBe(1);
    expect(firstChunk.value.data.byteLength).toBe(4113);
  });
});
