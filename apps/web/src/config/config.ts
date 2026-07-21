import { ProtocolVersionSchema, type ProtocolVersion } from "@riftsend/protocol";

/**
 * Reads a required `import.meta.env` variable.
 *
 * @param key - Env var name (without `VITE_` prefix — that is handled by Vite).
 * @throws If the variable is missing or empty.
 */
const requireEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
};

/**
 * Reads a required boolean `import.meta.env` variable.
 *
 * Accepts `"true"` as `true`; anything else (including missing) is `false`.
 *
 * @throws If the variable is undefined or null (but NOT for `"false"`).
 */
const requireBooleanEnv = (key: string): boolean => {
  const value = import.meta.env[key];
  if (value === undefined || value === null) {
    throw new Error(`Missing ${key}`);
  }
  return value === "true";
};

let _config: {
  signalingUrl: string;
  protocolVersion: ProtocolVersion;
  clientVersion: string;
  clientName: string;
  clientPlatform: string;
  supportResume: boolean;
  supportChunkAck: boolean;
  ackTimeout: number;
  retryCheckInterval: number;
  maxRetries: number;
  maxRetryDelay: number;
  maxPendingMessages: number;
} | null = null;

/**
 * Returns the singleton app configuration, populated from Vite environment variables.
 *
 * Reads `VITE_*` vars on first call and caches the result for subsequent calls.
 */
export const getConfig = () => {
  if (!_config) {
    _config = {
      signalingUrl: requireEnv("SIGNALING_SERVER_URL"),
      protocolVersion: ProtocolVersionSchema.parse(parseInt(requireEnv("PROTOCOL_VERSION"), 10)),
      clientVersion: requireEnv("SIGNALING_CLIENT_VERSION"),
      clientName: requireEnv("SIGNALING_CLIENT_NAME"),
      clientPlatform: requireEnv("SIGNALING_CLIENT_PLATFORM"),
      supportResume: requireBooleanEnv("SIGNALING_CLIENT_SUPPORT_RESUME"),
      supportChunkAck: requireBooleanEnv("SIGNALING_CLIENT_SUPPORT_CHUNK_ACK"),
      ackTimeout: parseInt(requireEnv("ACK_TIMEOUT")),
      retryCheckInterval: parseInt(requireEnv("RETRY_CHECK_INTERVAL")),
      maxRetries: parseInt(requireEnv("MAX_RETRIES")),
      maxRetryDelay: parseInt(requireEnv("MAX_RETRY_DELAY")),
      maxPendingMessages: parseInt(requireEnv("MAX_PENDING_MESSAGES")),
    };
  }
  return _config;
};
