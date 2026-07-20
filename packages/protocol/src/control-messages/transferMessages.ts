import { CONTROL_MESSAGE_TYPES } from "@riftsend/shared";
import { z } from "zod";
import {
  ProtocolVersionSchema,
  TransferFailReasonSchema,
  TransferIdSchema,
} from "./fieldSchemas.js";
import { withMessageId, withRequestId } from "./messageHelpers.js";

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
 * Reliable version of the transfer start message ({@link TransferStartSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 */
export const TransferStartMessageSchema = withMessageId(TransferStartSchema);
export type TransferStartMessage = z.infer<typeof TransferStartMessageSchema>;

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
 * Reliable version of the transfer started message ({@link TransferStartedSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages and a request id ({@link MessageIdSchema}) which represents a connection between the sender's transfer start message ({@link TransferStartMessageSchema}) and the receiver's response ({@link TransferStartedMessageSchema})
 */
export const TransferStartedMessageSchema = withRequestId(withMessageId(TransferStartedSchema));
export type TransferStartedMessage = z.infer<typeof TransferStartedMessageSchema>;

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
 * Reliable version of the transfer pause request ({@link TransferPauseSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 */
export const TransferPauseMessageSchema = withMessageId(TransferPauseSchema);
export type TransferPauseMessage = z.infer<typeof TransferPauseMessageSchema>;

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
 * Reliable version of the transfer paused message ({@link TransferPausedSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 * and a request id ({@link MessageIdSchema}) which represents a connection between the 2 messages
 */
export const TransferPausedMessageSchema = withRequestId(withMessageId(TransferPausedSchema));
export type TransferPausedMessage = z.infer<typeof TransferPausedMessageSchema>;

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
 * Reliable version of the transfer resume message ({@link TransferResumeSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 */
export const TransferResumeMessageSchema = withMessageId(TransferResumeSchema);
export type TransferResumeMessage = z.infer<typeof TransferResumeMessageSchema>;

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
 * Reliable version of the transfer resumed message ({@link TransferResumedSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 * and a request id ({@link MessageIdSchema}) which represents a connection between the 2 messages
 */
export const TransferResumedMessageSchema = withRequestId(withMessageId(TransferResumedSchema));
export type TransferResumedMessage = z.infer<typeof TransferResumedMessageSchema>;

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
 * Reliable version of the transfer resumed message ({@link TransferCancelSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 */
export const TransferCancelMessageSchema = withMessageId(TransferCancelSchema);
export type TransferCancelMessage = z.infer<typeof TransferCancelMessageSchema>;

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
 * Reliable version of the transfer complete message ({@link TransferCompleteSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 */
export const TransferCompleteMessageSchema = withMessageId(TransferCompleteSchema);
export type TransferCompleteMessage = z.infer<typeof TransferCompleteMessageSchema>;

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
 * Reliable version of the transfer verified message ({@link TransferVerifiedSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 * and a request id ({@link MessageIdSchema}) which represents a connection between the 2 messages
 */
export const TransferVerifiedMessageSchema = withRequestId(withMessageId(TransferVerifiedSchema));
export type TransferVerifiedMessage = z.infer<typeof TransferVerifiedMessageSchema>;

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

/**
 * Reliable version of the transfer failed message ({@link TransferFailedSchema})
 *
 * Contains a connection-dependent message id ({@link MessageIdSchema}) which identifies the message for ACK messages
 */
export const TransferFailedMessageSchema = withMessageId(TransferFailedSchema);
export type TransferFailedMessage = z.infer<typeof TransferFailedMessageSchema>;
