import { z } from "zod";
import {
  // Raw message schemas
  BatchOfferSchema,
  BatchResponseSchema,
  BatchTransferMappingsSchema,

  // Reliable message schemas
  BatchOfferMessageSchema,
  BatchResponseMessageSchema,
  BatchTransferMappingsMessageSchema,
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

  // Reliable message schemas
  TransferStartMessageSchema,
  TransferPauseMessageSchema,
  TransferPausedMessageSchema,
  TransferCancelMessageSchema,
  TransferResumeMessageSchema,
  TransferResumedMessageSchema,
  TransferCompleteMessageSchema,
  TransferVerifiedMessageSchema,
  TransferFailedMessageSchema,
} from "./transferMessages.js";
import {
  RecoveryRequestSchema,
  RecoveryAcceptSchema,
  RecoveryDenySchema,
  RecoveryResponseSchema,
} from "./recoveryMessages.js";

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
]);
export type ControlMessage = z.infer<typeof ControlMessageSchema>;

export const ReliableControlMessageSchema = z.discriminatedUnion("type", [
  // Negotiation messages
  BatchOfferMessageSchema,
  BatchResponseMessageSchema,
  BatchTransferMappingsMessageSchema,

  // Transfer lifecycle messages
  TransferStartMessageSchema,
  TransferPauseMessageSchema,
  TransferPausedMessageSchema,
  TransferCancelMessageSchema,
  TransferResumeMessageSchema,
  TransferResumedMessageSchema,
  TransferCompleteMessageSchema,
  TransferVerifiedMessageSchema,
  TransferFailedMessageSchema,
]);
export type ReliableControlMessage = z.infer<typeof ReliableControlMessageSchema>;
