import { z } from "zod";

export const ManifestMessageSchema = z.object({
  type: z.literal("manifest"),
  files: z.array(
    z.object({
      fileId: z.number(),
      fileName: z.string(),
      size: z.number(),
      chunkSize: z.number(),
      totalChunks: z.number(),
    }),
  ),
});

export type ManifestMessage = z.infer<typeof ManifestMessageSchema>;
