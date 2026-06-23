import type { AuthedWebSocket } from "./types.js";
import { MAX_MESSAGES_PER_SEC } from "./config.js";
import { logger } from "./logger.js";

export const safeSend = (ws: AuthedWebSocket, data: unknown): void => {
  if (ws.readyState !== ws.OPEN) {
    logger.warn({ peerId: ws.peerId }, "Attempted send on non-open socket");
    return;
  }
  try {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    ws.send(payload);
  } catch (err) {
    logger.error({ err, peerId: ws.peerId }, "Send failed");
  }
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitMap = new WeakMap<AuthedWebSocket, RateLimitEntry>();

export const checkRateLimit = (ws: AuthedWebSocket): boolean => {
  const now = Date.now();
  let entry = rateLimitMap.get(ws);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 1000 };
    rateLimitMap.set(ws, entry);
  }
  entry.count++;
  return entry.count <= MAX_MESSAGES_PER_SEC;
};
