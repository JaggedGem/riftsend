import { CONTROL_MESSAGE_TYPES } from "@riftsend/shared";
import { z } from "zod";
import { ProtocolVersionSchema, TransferIdSchema } from "./fieldSchemas.js";

export const RecoveryRequestSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.recoveryRequest),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type RecoveryRequest = z.infer<typeof RecoveryRequestSchema>;

export const RecoveryAcceptSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.recoveryAccept),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type RecoveryAccept = z.infer<typeof RecoveryAcceptSchema>;

export const RecoveryDenySchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.recoveryDeny),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
  })
  .strict();
export type RecoveryDeny = z.infer<typeof RecoveryDenySchema>;

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

export const RecoveryResponseSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.recoveryResponse),
    protocolVersion: ProtocolVersionSchema,
    transferId: TransferIdSchema,
    missingRanges: z.array(MissingRangeSchema),
  })
  .strict();
export type RecoveryResponse = z.infer<typeof RecoveryResponseSchema>;
