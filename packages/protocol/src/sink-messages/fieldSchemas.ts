import { z } from "zod";
import type { RequestId } from "@riftsend/shared";

/**
 * Schema that defines the request id used in messages (integer >= 0)
 */
export const RequestIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((val): RequestId => val as RequestId);

export const SuccessResponseResultSchema = z.union([
  z.void(),
  z.number(),
  z.instanceof(ArrayBuffer),
]);
