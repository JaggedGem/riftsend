import { CONTROL_MESSAGE_TYPES } from "@riftsend/shared";
import { z } from "zod";
import { MessageIdSchema, ProtocolVersionSchema } from "./fieldSchemas.js";

/**
 * Message sent by the sender to the receiver to mark that the sender is ready to start sending the bytes
 */
export const AckMessageSchema = z
  .object({
    type: z.literal(CONTROL_MESSAGE_TYPES.acknowledgement),
    protocolVersion: ProtocolVersionSchema,
    acknowledgedMessageId: MessageIdSchema,
  })
  .strict();
export type AckMessage = z.infer<typeof AckMessageSchema>;
