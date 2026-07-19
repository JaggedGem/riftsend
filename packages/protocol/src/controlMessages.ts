import { z } from "zod";
import {
  type FileId,
  type BatchId,
  CONTROL_MESSAGE_TYPES,
  type TransferId,
} from "@riftsend/shared";
import { MAX_CHUNK_SIZE, MAX_FILES_PER_BATCH, MAX_TOTAL_CHUNKS } from "./constants.js";

const FileIdSchema = z.uuidv4().transform((val): FileId => val as FileId);

const BatchIdSchema = z.uuidv4().transform((val): BatchId => val as BatchId);

const TransferIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((val): TransferId => val as TransferId);

export const ProtocolVersionSchema = z.union([z.literal(1)]);

export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;

const FileOfferSchema = z
  .object({
    fileId: FileIdSchema,
    fileName: z.string().min(1).max(255),
    size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER, {
      message: "File size exceeds protocol maximum",
    }),
    mimeType: z.string().max(255),
    chunkSize: z.number().int().positive().max(MAX_CHUNK_SIZE),
    totalChunks: z.number().int().nonnegative().max(MAX_TOTAL_CHUNKS),
    relativePath: z.string().optional(),
  })
  .refine((file) => Math.ceil(file.size / file.chunkSize) === file.totalChunks, {
    path: ["totalChunks"],
    message: "Chunk count does not match file size and chunk size",
  })
  .strict();

export type FileOffer = z.infer<typeof FileOfferSchema>;

export const BatchOfferSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.batchOffer),
    protocolVersion: ProtocolVersionSchema,
    batchId: BatchIdSchema,
    files: z.array(FileOfferSchema).max(MAX_FILES_PER_BATCH),
  })
  .strict();

export type BatchOffer = z.infer<typeof BatchOfferSchema>;

export const BatchResponseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.batchResponse),
    protocolVersion: ProtocolVersionSchema,
    batchId: BatchIdSchema,
    accepted: z.array(FileIdSchema),
  })
  .strict();

export type BatchResponse = z.infer<typeof BatchResponseSchema>;

export const BatchTransferMappingsSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.batchTransferMappings),
    protocolVersion: ProtocolVersionSchema,
    batchId: BatchIdSchema,
    mappings: z.array(z.object({ fileId: FileIdSchema, transferId: TransferIdSchema }).strict()),
  })
  .strict();

export type BatchTransferMappings = z.infer<typeof BatchTransferMappingsSchema>;

export const TransferStartSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferStart),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();

export type TransferStart = z.infer<typeof TransferStartSchema>;

export const TransferPauseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferPause),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();

export type TransferPause = z.infer<typeof TransferPauseSchema>;

export const TransferCancelSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferCancel),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();

export type TransferCancel = z.infer<typeof TransferCancelSchema>;

export const TransferCompleteSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferComplete),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();

export type TransferComplete = z.infer<typeof TransferCompleteSchema>;

export const TransferVerifiedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferVerified),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();

export type TransferVerified = z.infer<typeof TransferVerifiedSchema>;

export const TransferFailedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferFailed),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
    reason: z.string(),
  })
  .strict();

export type TransferFailed = z.infer<typeof TransferFailedSchema>;

export const ResumeRequestSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeRequest),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();

export type ResumeRequest = z.infer<typeof ResumeRequestSchema>;

export const ResumeAcceptSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeAccept),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();

export type ResumeAccept = z.infer<typeof ResumeAcceptSchema>;

export const ResumeDenySchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeDeny),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();

export type ResumeDeny = z.infer<typeof ResumeDenySchema>;

const MissingRangeSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .refine((range) => range.start <= range.end, {
    path: ["start"],
    message: "The start of the missing range cannot be bigger than the end",
  })
  .strict();

export const ResumeResponseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeResponse),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
    missingRanges: z.array(MissingRangeSchema),
  })
  .strict();

export type ResumeResponse = z.infer<typeof ResumeResponseSchema>;

/**
 * Discriminated union of all valid control channel messages.
 *
 * Use this as the single entry point for parsing incoming control channel messages.
 * Every message type listed in {@link CONTROL_MESSAGE_TYPES}
 * must be represented here.
 */
export const ControlMessageSchema = z.discriminatedUnion("type", [
  BatchOfferSchema,
  BatchResponseSchema,
  BatchTransferMappingsSchema,
  TransferStartSchema,
  TransferPauseSchema,
  TransferCancelSchema,
  TransferCompleteSchema,
  TransferVerifiedSchema,
  TransferFailedSchema,
  ResumeRequestSchema,
  ResumeAcceptSchema,
  ResumeDenySchema,
  ResumeResponseSchema,
]);

export type ControlMessage = z.infer<typeof ControlMessageSchema>;
