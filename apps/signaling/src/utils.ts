import type { AuthedWebSocket } from "./types.js";
import { MAX_MESSAGES_PER_SEC } from "./config.js";
import { logger } from "./logger.js";

/**
 * Safely sends data over a WebSocket connection.
 * If the socket is not open, logs a warning and does not attempt to send.
 * @param ws The authenticated WebSocket to send data through.
 * @param data The data to send, either as a string or an object (which will be JSON-stringified).
 */
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

/**
 * A WeakMap to track the rate limit state for each WebSocket connection.
 * Each entry contains the count of messages sent and the timestamp when the count resets.
 */
const rateLimitMap = new WeakMap<AuthedWebSocket, RateLimitEntry>();

/**
 * Checks if a WebSocket connection has exceeded the rate limit for messages.
 * Each connection is allowed a maximum of `MAX_MESSAGES_PER_SEC` messages per second.
 * @param ws The authenticated WebSocket to check.
 * @returns `true` if the connection is within the rate limit, `false` if it has exceeded the limit.
 */
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
