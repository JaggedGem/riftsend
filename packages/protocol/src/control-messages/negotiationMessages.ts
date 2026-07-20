import { z } from "zod";
import { MAX_CHUNK_SIZE, MAX_FILES_PER_BATCH, MAX_TOTAL_CHUNKS } from "../constants.js";
import {
  BatchIdSchema,
  FileIdSchema,
  ProtocolVersionSchema,
  TransferIdSchema,
} from "./fieldSchemas.js";
import { CONTROL_MESSAGE_TYPES } from "@riftsend/shared";

/**
 * Schema that defines a file offer used in messages (metadata)
 */
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

/**
 * Initial negotiation message sent by the sender
 *
 * Contains an array of file offers ({@link FileOfferSchema}) identified by an unique batch id ({@link BatchIdSchema})
 */
export const BatchOfferSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.batchOffer),
    protocolVersion: ProtocolVersionSchema,
    batchId: BatchIdSchema,
    files: z.array(FileOfferSchema).max(MAX_FILES_PER_BATCH),
  })
  .strict();
export type BatchOffer = z.infer<typeof BatchOfferSchema>;

/**
 * Negotiation response sent by the receiver
 *
 * Contains an array of the accepted file ids ({@link FileIdSchema}) identified by the same batch id ({@link BatchIdSchema}) as in the batch offer
 */
export const BatchResponseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.batchResponse),
    protocolVersion: ProtocolVersionSchema,
    batchId: BatchIdSchema,
    accepted: z.array(FileIdSchema),
  })
  .strict();
export type BatchResponse = z.infer<typeof BatchResponseSchema>;

/**
 * Mapping message sent by the sender
 *
 * Contains an array of mappings each made from an accepted file id ({@link FileIdSchema}) and an assigned transfer id ({@link TransferIdSchema})
 */
export const BatchTransferMappingsSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.batchTransferMappings),
    protocolVersion: ProtocolVersionSchema,
    batchId: BatchIdSchema,
    mappings: z.array(z.object({ fileId: FileIdSchema, transferId: TransferIdSchema }).strict()),
  })
  .strict();
export type BatchTransferMappings = z.infer<typeof BatchTransferMappingsSchema>;
