import { z } from "zod";
import { MessageIdSchema } from "./fieldSchemas.js";

/**
 * Helper function that adds a messageId prop to any schema provided
 */
export const withMessageId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({
    messageId: MessageIdSchema,
  });

/**
 * Helper function that adds a requestId prop to any schema provided
 */
export const withRequestId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({
    requestId: MessageIdSchema,
  });
