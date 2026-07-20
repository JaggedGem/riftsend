import { z } from "zod";
import type { FileId, BatchId, TransferId, MessageId } from "@riftsend/shared";

/**
 * Schema that defines the unique file id used in messages (UUID v4)
 */
export const FileIdSchema = z.uuidv4().transform((val): FileId => val as FileId);

/**
 * Schema that defines the unique batch id used in messages (UUID v4)
 */
export const BatchIdSchema = z.uuidv4().transform((val): BatchId => val as BatchId);

/**
 * Schema that defines the transfer id used in messages (integer >= 0)
 */
export const TransferIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((val): TransferId => val as TransferId);

/**
 * Schema that defines the message id used in messages (integer >= 0)
 */
export const MessageIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((val): MessageId => val as MessageId);

/**
 * Schema that defines the supported protocol versions
 */
export const ProtocolVersionSchema = z.union([z.literal(1)]);
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;

export const TransferFailReasonSchema = z.enum([
  "checksum-mismatch",
  "disk-full",
  "permission-denied",
  "protocol-error",
]);
