import { SIGNALING_MESSAGE_TYPES } from "@riftsend/shared";
import { z } from "zod";
import { SignalingErrorCodeSchema } from "./fieldSchemas.js";

/**
 * Server error message with a machine-readable error code.
 */
export const ErrorMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.error),
    from: z.literal("server"),
    payload: z
      .object({
        code: SignalingErrorCodeSchema,
      })
      .strict(),
  })
  .strict();
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
