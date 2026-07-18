import { z } from "zod";
import { type FileId, type BatchId, CONTROL_MESSAGE_TYPES } from "@riftsend/shared";
import { MAX_CHUNK_SIZE, MAX_FILES_PER_BATCH, MAX_TOTAL_CHUNKS } from "./constants.js";

const FileIdSchema = z.uuidv4().transform((val): FileId => val as FileId);

const BatchIdSchema = z.uuidv4().transform((val): BatchId => val as BatchId);

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

export const FileStartSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileStart),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
  })
  .strict();

export type FileStart = z.infer<typeof FileStartSchema>;

export const FilePauseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.filePause),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
  })
  .strict();

export type FilePause = z.infer<typeof FilePauseSchema>;

export const FileCancelSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileCancel),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
  })
  .strict();

export type FileCancel = z.infer<typeof FileCancelSchema>;

export const FileCompleteSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileComplete),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
  })
  .strict();

export type FileComplete = z.infer<typeof FileCompleteSchema>;

export const FileVerifiedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileVerified),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
  })
  .strict();

export type FileVerified = z.infer<typeof FileVerifiedSchema>;

export const FileFailedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileFailed),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
    reason: z.string(),
  })
  .strict();

export type FileFailed = z.infer<typeof FileFailedSchema>;

export const ResumeRequestSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeRequest),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
  })
  .strict();

export type ResumeRequest = z.infer<typeof ResumeRequestSchema>;

export const ResumeAcceptSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeAccept),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
  })
  .strict();

export type ResumeAccept = z.infer<typeof ResumeAcceptSchema>;

export const ResumeDenySchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeDeny),
    protocolVersion: ProtocolVersionSchema,
    fileId: FileIdSchema,
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
    fileId: FileIdSchema,
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
  FileStartSchema,
  FilePauseSchema,
  FileCancelSchema,
  FileCompleteSchema,
  FileVerifiedSchema,
  FileFailedSchema,
  ResumeRequestSchema,
  ResumeAcceptSchema,
  ResumeDenySchema,
  ResumeResponseSchema,
]);

export type ControlMessage = z.infer<typeof ControlMessageSchema>;
