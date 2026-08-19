import { z } from "zod";
import { RequestIdSchema } from "./fieldSchemas.js";
import { FileIdSchema } from "../control-messages/fieldSchemas.js";

export const InitializeRequestSchema = z.strictObject({
  type: z.literal("initialize"),
  requestId: RequestIdSchema,
  fileId: FileIdSchema,
  fileSize: z.number().int().nonnegative(),
  isResume: z.boolean(),
  flushByteThreshold: z.number().int().nonnegative(),
});
export type InitializeRequest = z.infer<typeof InitializeRequestSchema>;

export const WriteRequestSchema = z.strictObject({
  type: z.literal("write"),
  requestId: RequestIdSchema,
  offset: z.number().int().nonnegative(),
  data: z.instanceof(ArrayBuffer),
});
export type WriteRequest = z.infer<typeof WriteRequestSchema>;

export const GetSizeRequestSchema = z.strictObject({
  type: z.literal("getSize"),
  requestId: RequestIdSchema,
});
export type GetSizeRequest = z.infer<typeof GetSizeRequestSchema>;

export const ReadRequestSchema = z.strictObject({
  type: z.literal("read"),
  requestId: RequestIdSchema,
  offset: z.number().int().nonnegative().optional(),
  length: z.number().int().nonnegative().optional(),
});
export type ReadRequest = z.infer<typeof ReadRequestSchema>;

export const GetFileRequestSchema = z.strictObject({
  type: z.literal("getFile"),
  requestId: RequestIdSchema,
});
export type GetFileRequest = z.infer<typeof GetFileRequestSchema>;

export const DeleteRequestSchema = z.strictObject({
  type: z.literal("delete"),
  requestId: RequestIdSchema,
});
export type DeleteRequest = z.infer<typeof DeleteRequestSchema>;

export const CloseRequestSchema = z.strictObject({
  type: z.literal("close"),
  requestId: RequestIdSchema,
});
export type CloseRequest = z.infer<typeof CloseRequestSchema>;
