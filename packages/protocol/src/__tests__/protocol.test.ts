import { describe, expect, it } from "vitest";
import {
  BatchOfferSchema,
  ControlMessageSchema,
  buildChunk,
  CHUNK_FORMAT,
  FileStart,
} from "../index.js";

describe("protocol schemas", () => {
  it("parses a valid batch offer and rejects inconsistent chunk counts", () => {
    const validOffer = {
      type: "batch-offer",
      protocolVersion: 1,
      batchId: "123e4567-e89b-42d3-a456-426614174000",
      files: [
        {
          fileId: "123e4567-e89b-42d3-a456-426614174001",
          fileName: "demo.txt",
          size: 1024,
          mimeType: "text/plain",
          chunkSize: 256,
          totalChunks: 4,
          relativePath: "demo.txt",
        },
      ],
    };

    const parsed = BatchOfferSchema.parse(validOffer);
    expect(parsed.files[0].fileName).toBe("demo.txt");
    expect(parsed.files[0].totalChunks).toBe(4);

    expect(() =>
      BatchOfferSchema.parse({
        ...validOffer,
        files: [{ ...validOffer.files[0], totalChunks: 3 }],
      }),
    ).toThrow();
  });

  it("parses control messages through the discriminated union", () => {
    const parsed = ControlMessageSchema.parse({
      type: "file-start",
      protocolVersion: 1,
      fileId: "123e4567-e89b-42d3-a456-426614174002",
    });

    expect(parsed.type).toBe("file-start");
    expect((parsed as FileStart).fileId).toBe("123e4567-e89b-42d3-a456-426614174002");
  });
});

describe("chunk framing", () => {
  it("builds a chunk with the expected header and payload bytes", () => {
    const payload = new Uint8Array([1, 2, 3, 4]).buffer;
    const chunk = buildChunk(1, 42, 7, payload);
    const view = new DataView(chunk);

    expect(view.getUint8(CHUNK_FORMAT.PROTOCOL_VERSION.offset)).toBe(1);
    expect(view.getUint16(CHUNK_FORMAT.FILE_ID.offset)).toBe(42);
    expect(view.getUint32(CHUNK_FORMAT.CHUNK_INDEX.offset)).toBe(7);
    expect(view.getUint32(CHUNK_FORMAT.LENGTH.offset)).toBe(4);
    expect(Array.from(new Uint8Array(chunk, CHUNK_FORMAT.PAYLOAD.offset))).toEqual([1, 2, 3, 4]);
  });
});
