import { logger } from "./logger.js";

const toPositiveInt = (value: string | undefined, fallback: number, name: string): number => {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    logger.warn({ envVar: name, value }, `Invalid ${name}, falling back to ${fallback}`);
    return fallback;
  }
  return parsed;
};

export const WS_PORT = toPositiveInt(process.env.WS_PORT, 8080, "WS_PORT");
export const HTTP_PORT = toPositiveInt(process.env.HTTP_PORT, 3000, "HTTP_PORT");
export const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
export const MAX_PAYLOAD = 1024 * 128;
export const MAX_CONNECTIONS = toPositiveInt(process.env.MAX_CONNECTIONS, 1000, "MAX_CONNECTIONS");
export const MAX_MESSAGES_PER_SEC = toPositiveInt(
  process.env.MAX_MESSAGES_PER_SEC,
  60,
  "MAX_MESSAGES_PER_SEC",
);
export const CONNECTION_TIMEOUT_MS = toPositiveInt(
  process.env.CONNECTION_TIMEOUT_MS,
  10_000,
  "CONNECTION_TIMEOUT_MS",
);
export const HEARTBEAT_INTERVAL_MS = toPositiveInt(
  process.env.HEARTBEAT_INTERVAL_MS,
  30_000,
  "HEARTBEAT_INTERVAL_MS",
);
