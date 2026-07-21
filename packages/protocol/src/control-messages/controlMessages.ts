import { z } from "zod";
import {
  // Raw message schemas
  BatchOfferSchema,
  BatchResponseSchema,
  BatchTransferMappingsSchema,
} from "./negotiationMessages.js";
import {
  // Raw message schemas
  TransferStartSchema,
  TransferPauseSchema,
  TransferPausedSchema,
  TransferCancelSchema,
  TransferResumeSchema,
  TransferResumedSchema,
  TransferCompleteSchema,
  TransferVerifiedSchema,
  TransferFailedSchema,
} from "./transferMessages.js";
import {
  RecoveryRequestSchema,
  RecoveryAcceptSchema,
  RecoveryDenySchema,
  RecoveryResponseSchema,
} from "./recoveryMessages.js";
import { withMessageId } from "./messageHelpers.js";
import { AckMessageSchema } from "./reliabilityMessages.js";

/**
 * Discriminated union of all valid control channel messages.
 *
 * Use this as the single entry point for parsing incoming control channel messages.
 * Every message type listed in {@link CONTROL_MESSAGE_TYPES}
 * must be represented here.
 */
export const ControlMessageSchema = z.discriminatedUnion("type", [
  // Negotiation messages
  BatchOfferSchema,
  BatchResponseSchema,
  BatchTransferMappingsSchema,

  // Transfer lifecycle messages
  TransferStartSchema,
  TransferPauseSchema,
  TransferPausedSchema,
  TransferCancelSchema,
  TransferResumeSchema,
  TransferResumedSchema,
  TransferCompleteSchema,
  TransferVerifiedSchema,
  TransferFailedSchema,

  // Recovery lifecycle messages
  RecoveryRequestSchema,
  RecoveryAcceptSchema,
  RecoveryDenySchema,
  RecoveryResponseSchema,

  // Reliability messages
  AckMessageSchema,
]);
export type ControlMessage = z.infer<typeof ControlMessageSchema>;

export const ReliableControlMessageSchema = z.discriminatedUnion("type", [
  // Negotiation messages
  withMessageId(BatchOfferSchema),
  withMessageId(BatchResponseSchema),
  withMessageId(BatchTransferMappingsSchema),

  // Transfer lifecycle messages
  withMessageId(TransferStartSchema),
  withMessageId(TransferPauseSchema),
  withMessageId(TransferPausedSchema),
  withMessageId(TransferCancelSchema),
  withMessageId(TransferResumeSchema),
  withMessageId(TransferResumedSchema),
  withMessageId(TransferCompleteSchema),
  withMessageId(TransferVerifiedSchema),
  withMessageId(TransferFailedSchema),
]);
export type ReliableControlMessage = z.infer<typeof ReliableControlMessageSchema>;

export const AnyControlMessageSchema = z.union([
  ReliableControlMessageSchema,
  ControlMessageSchema,
]);
export type AnyControlMessage = z.infer<typeof AnyControlMessageSchema>;

export const reliableTypeNames = new Set<string>(
  ReliableControlMessageSchema.options.map((reliableMessage) => reliableMessage.shape.type.value),
);

export type ReliableTypeName = ReliableControlMessage["type"];
