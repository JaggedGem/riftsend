import { z } from "zod";
import { FileIdSchema } from "./control-messages/fieldSchemas.js";

/**
 * Schema that defines the file metadata used in the file's "meta" IndexedDb's store
 */
export const FileMetadataSchema = z.strictObject({
  fileId: FileIdSchema,
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER, {
    message: "File size exceeds protocol maximum",
  }),
  mimeType: z.string().max(255),
  relativePath: z.string().optional(),
});
export type FileMetadata = z.infer<typeof FileMetadataSchema>;
