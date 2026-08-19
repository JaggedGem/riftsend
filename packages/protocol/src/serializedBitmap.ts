import { z } from "zod";

/**
 * Schema that defines the supported serialized bitmap versions
 */
export const SerializedBitmapVersionSchema = z.union([z.literal(1)]);
export type SerializedBitmapVersion = z.infer<typeof SerializedBitmapVersionSchema>;

export const SerializedBitmapSchema = z
  .strictObject({
    version: SerializedBitmapVersionSchema,
    totalChunks: z.number().int().nonnegative(),
    chunkSize: z.number().int().nonnegative(),
    lastChunkSize: z.number().int().nonnegative(),
    receivedCount: z.number().int().nonnegative(),
    bits: z.instanceof(Uint32Array),
  })
  .superRefine((data, ctx) => {
    if (data.receivedCount > data.totalChunks) {
      ctx.addIssue({
        code: "custom",
        message: "receivedCount must not exceed totalChunks",
        path: ["receivedCount"],
      });
    }

    if (data.bits.length !== Math.ceil(data.totalChunks / 32)) {
      ctx.addIssue({
        code: "custom",
        message: "bits length does not match totalChunks",
        path: ["bits"],
      });
    }
  });
export type SerializedBitmap = z.infer<typeof SerializedBitmapSchema>;
