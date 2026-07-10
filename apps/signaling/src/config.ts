import { logger } from "./logger.js";

/**
 * Parses an environment variable as a positive integer, falling back to a default.
 *
 * Logs a warning and returns the fallback if the value is missing, non-numeric,
 * zero, negative, or not an integer.
 *
 * @param value - Raw env var string (may be undefined).
 * @param fallback - Value to return when parsing fails.
 * @param name - Env var name for warning messages.
 */
const toPositiveInt = (value: string | undefined, fallback: number, name: string): number => {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    logger.warn({ envVar: name, value }, `Invalid ${name}, falling back to ${fallback}`);
    return fallback;
  }
  return parsed;
};

/** Port for the WebSocket server. Default: 8080. */
export const WS_PORT = toPositiveInt(process.env.WS_PORT, 8080, "WS_PORT");
/** Port for the HTTP health-check server. Default: 3000. */
export const HTTP_PORT = toPositiveInt(process.env.HTTP_PORT, 3000, "HTTP_PORT");
/** Network host to bind both servers to. Default: 0.0.0.0. */
export const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
/** Maximum size (bytes) for a single WebSocket message payload. */
export const MAX_PAYLOAD = 1024 * 128;
/** Maximum concurrent WebSocket connections allowed. Default: 1000. */
export const MAX_CONNECTIONS = toPositiveInt(process.env.MAX_CONNECTIONS, 1000, "MAX_CONNECTIONS");
/** Maximum signaling messages a single connection may send per second. Default: 60. */
export const MAX_MESSAGES_PER_SEC = toPositiveInt(
  process.env.MAX_MESSAGES_PER_SEC,
  60,
  "MAX_MESSAGES_PER_SEC",
);
/** Seconds before an unauthenticated WebSocket is closed. Default: 10 000 ms. */
export const CONNECTION_TIMEOUT_MS = toPositiveInt(
  process.env.CONNECTION_TIMEOUT_MS,
  10_000,
  "CONNECTION_TIMEOUT_MS",
);
/** Interval between WebSocket pings for keep-alive. Default: 30 000 ms. */
export const HEARTBEAT_INTERVAL_MS = toPositiveInt(
  process.env.HEARTBEAT_INTERVAL_MS,
  30_000,
  "HEARTBEAT_INTERVAL_MS",
);