import { CONTROL_MESSAGE_TYPES } from "@riftsend/shared";
import { z } from "zod";
import {
  ProtocolVersionSchema,
  TransferFailReasonSchema,
  TransferIdSchema,
} from "./fieldSchemas.js";

/**
 * Message sent by the sender to the receiver to mark that the sender is ready to start sending the bytes
 */
export const TransferStartSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferStart),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type TransferStart = z.infer<typeof TransferStartSchema>;

/**
 * Message sent by the sender to the receiver to mark that the sender is ready to start sending the bytes
 */
export const TransferStartedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferStarted),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type TransferStarted = z.infer<typeof TransferStartedSchema>;

/**
 * Message sent by either side to request the sender to pause sending or the receiver to stop receiving the bytes temporarily
 */
export const TransferPauseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferPause),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type TransferPause = z.infer<typeof TransferPauseSchema>;

/**
 * Response from the other side than the one who sent the request ({@link TransferPauseSchema}) to mark that the pausing on the "sending" (reffering to the side which sent this message) side was completed
 */
export const TransferPausedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferPaused),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type TransferPaused = z.infer<typeof TransferPausedSchema>;

/**
 * Message sent by either side to request the sender to continue sending or the receiver to continue receiving the bytes
 */
export const TransferResumeSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferResume),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type TransferResume = z.infer<typeof TransferResumeSchema>;

/**
 * Response from the other side than the one who sent the request ({@link TransferResumeSchema}) to mark that the resuming on the "sending" (reffering to the side which sent this message) side was completed
 */
export const TransferResumedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferResumed),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type TransferResumed = z.infer<typeof TransferResumedSchema>;

/**
 * Message sent by the receiver to tell the sender that they have cancelled the transfer
 *
 * @param reason optional reason for the cancellation
 */
export const TransferCancelSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferCancel),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
    reason: z.string().optional(),
  })
  .strict();
export type TransferCancel = z.infer<typeof TransferCancelSchema>;

/**
 * Message sent by the sender to tell the receiver that they have finished sending all of the chunks
 */
export const TransferCompleteSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferComplete),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type TransferComplete = z.infer<typeof TransferCompleteSchema>;

/**
 * Message sent by the receiver to tell the sender that they have finished verifing all of the chunks
 */
export const TransferVerifiedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferVerified),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type TransferVerified = z.infer<typeof TransferVerifiedSchema>;

/**
 * Message sent any side to tell the other side that an error has encountered on their side and the transfer has to be cancelled
 */
export const TransferFailedSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.transferFailed),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
    reason: TransferFailReasonSchema,
  })
  .strict();
export type TransferFailed = z.infer<typeof TransferFailedSchema>;
