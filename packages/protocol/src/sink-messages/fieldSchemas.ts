import { z } from "zod";
import {
  OpfsFileSinkErrorCode,
  OpfsSinkClientErrorCode,
  OpfsSinkWorkerErrorCode,
  type RequestId,
} from "@riftsend/shared";
import type { WorkerRequest } from "./sinkMessages.js";

/**
 * Schema that defines the request id used in messages (integer >= 0)
 */
export const RequestIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((val): RequestId => val as RequestId);

export type OpfsMessageTypes = WorkerRequest["type"];

export const OpfsResultSchemas = {
  initialize: z.undefined(),
  write: z.undefined(),
  getSize: z.number().int().nonnegative(),
  read: z.instanceof(ArrayBuffer),
  getFile: z.unknown(),
  delete: z.undefined(),
  close: z.undefined(),
} satisfies Record<OpfsMessageTypes, z.ZodType>;

export type OpfsResult<T extends OpfsMessageTypes> = z.infer<(typeof OpfsResultSchemas)[T]>;

export const OpfsSinkErrorCodeSchema = z.union([
  z.enum(OpfsSinkWorkerErrorCode),
  z.enum(OpfsSinkClientErrorCode),
  z.enum(OpfsFileSinkErrorCode),
]);
