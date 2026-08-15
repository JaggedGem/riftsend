import { z } from "zod";

/**
 * Schema that defines the supported serialized bitmap versions
 */
export const SerializedBitmapVersionSchema = z.union([z.literal(1)]);
export type SerializedBitmapVersion = z.infer<typeof SerializedBitmapVersionSchema>;

export const SerializedBitmapSchema = z.strictObject({
  version: SerializedBitmapVersionSchema,
  totalChunks: z.number().int().nonnegative(),
  chunkSize: z.number().int().nonnegative(),
  lastChunkSize: z.number().int().nonnegative(),
  receivedCount: z.number().int().nonnegative(),
  bits: z.instanceof(Uint32Array),
});
export type SerializedBitmap = z.infer<typeof SerializedBitmapSchema>;
