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
  requestId: RequestIdSchema.optional(),
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

export const FlushCompleteSchema = z.strictObject({
  type: z.literal("flush-complete"),
});
export type FlushComplete = z.infer<typeof FlushCompleteSchema>;

export const FlushFailedSchema = z.strictObject({
  type: z.literal("flush-failed"),
  error: z.strictObject({
    code: z.enum(OpfsSinkErrorCode),
    message: z.string(),
    cause: z.unknown().optional(),
  }),
});
export type FlushFailed = z.infer<typeof FlushFailedSchema>;
