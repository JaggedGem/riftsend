import { z } from "zod";
import {
  CloseRequestSchema,
  DeleteRequestSchema,
  GetSizeRequestSchema,
  InitializeRequestSchema,
  ReadRequestSchema,
  WriteRequestSchema,
} from "./workerRequests.js";
import { ErrorResponseSchema, SuccessResponseSchema } from "./workerResponses.js";

export const WorkerRequestSchema = z.discriminatedUnion("type", [
  InitializeRequestSchema,
  WriteRequestSchema,
  GetSizeRequestSchema,
  ReadRequestSchema,
  DeleteRequestSchema,
  CloseRequestSchema,
]);
export type WorkerRequest = z.infer<typeof WorkerRequestSchema>;

export const WorkerResponseSchema = z.discriminatedUnion("type", [
  SuccessResponseSchema,
  ErrorResponseSchema,
]);
export type WorkerResponse = z.infer<typeof WorkerResponseSchema>;
