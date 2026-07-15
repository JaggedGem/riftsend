import { z } from "zod";
import { FileId, BatchId, CONTROL_MESSAGE_TYPES } from "@riftsend/shared";

const FileIdSchema = z.uuidv4().transform((val): FileId => val as FileId);

const BatchIdSchema = z.uuidv4().transform((val): BatchId => val as BatchId);

export const BatchOfferSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.batchOffer),
    protocolVersion: z.number(),
    batchId: BatchIdSchema,
    files: z.array(
      z.object({
        fileId: FileIdSchema,
        fileName: z.string(),
        size: z.number(),
        mimeType: z.string(),
        chunkSize: z.number(),
        totalChunks: z.number(),
        relativePath: z.string().optional(),
      }),
    ),
  })
  .strict();

export type BatchOffer = z.infer<typeof BatchOfferSchema>;

export const BatchResponseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.batchResponse),
    protocolVersion: z.number(),
    batchId: BatchIdSchema,
    accepted: z.array(FileIdSchema),
  })
  .strict();

export type BatchResponse = z.infer<typeof BatchResponseSchema>;

export const FileStartSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileStart),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
  })
  .strict();

export type FileStart = z.infer<typeof FileStartSchema>;

export const FilePauseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.filePause),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
  })
  .strict();

export type FilePause = z.infer<typeof FilePauseSchema>;

export const FileCancelSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileCancel),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
  })
  .strict();

export type FileCancel = z.infer<typeof FileCancelSchema>;

export const FileCompleteSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileComplete),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
  })
  .strict();

export type FileComplete = z.infer<typeof FileCompleteSchema>;

export const FileVerifiedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileVerified),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
  })
  .strict();

export type FileVerified = z.infer<typeof FileVerifiedSchema>;

export const FileFailedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.fileFailed),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
    reason: z.string(),
  })
  .strict();

export type FileFailed = z.infer<typeof FileFailedSchema>;

export const ResumeRequestSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeRequest),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
  })
  .strict();

export type ResumeRequest = z.infer<typeof ResumeRequestSchema>;

export const ResumeAcceptSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeAccept),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
  })
  .strict();

export type ResumeAccept = z.infer<typeof ResumeAcceptSchema>;

export const ResumeDenySchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeDeny),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
  })
  .strict();

export type ResumeDeny = z.infer<typeof ResumeDenySchema>;

export const ResumeResponseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.resumeResponse),
    protocolVersion: z.number(),
    fileId: FileIdSchema,
    missingRanges: z.array(
      z.object({
        start: z.number(),
        end: z.number(),
      }),
    ),
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
