import { z } from "zod";
import { RequestIdSchema } from "./fieldSchemas.js";
import { OpfsSinkErrorCode } from "@riftsend/shared";

export const SuccessResponseSchema = z.strictObject({
  type: z.literal("success"),
  requestId: RequestIdSchema,
  result: z.unknown(),
});
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

export const ErrorResponseSchema = z.strictObject({
  type: z.literal("error"),
  requestId: RequestIdSchema,
  error: z.strictObject({
    code: z.enum(OpfsSinkErrorCode),
    message: z.string(),
    cause: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const FatalNoticeSchema = z.strictObject({
  type: z.literal("fatal-notice"),
  error: z.strictObject({
    code: z.enum(OpfsSinkErrorCode),
    message: z.string(),
    cause: z.unknown().optional(),
  }),
});
export type FatalNotice = z.infer<typeof FatalNoticeSchema>;

export const WithRequestIdSchema = z.object({
  requestId: RequestIdSchema,
});
