import { ProtocolVersionSchema, type ProtocolVersion } from "@riftsend/protocol";
import { BadEnvTypeError, MissingEnvError } from "./envError.js";

/**
 * Reads a required `import.meta.env` variable.
 *
 * @param key - Env var name (without `VITE_` prefix — that is handled by Vite).
 * @throws If the variable is missing or empty.
 */
const requireEnv = (key: string): string => {
  const value = import.meta.env[`VITE_${key}`];

  if (!value) {
    throw new MissingEnvError(key);
  }

  return value;
};

/**
 * Reads a required boolean `import.meta.env` variable.
 *
 * Accepts `"true"` as `true` and `"false"` as `false`.
 *
 * @throws If the variable is anything else.
 */
const requireBooleanEnv = (key: string): boolean => {
  const value = import.meta.env[key];

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new BadEnvTypeError(key);
};

/**
 * Reads a required integer `import.meta.env` variable.
 *
 * @throws If the variable is missing or not an integer.
 */
const requireIntEnv = (key: string): number => {
  const parsedInt = Number(requireEnv(key));

  if (!Number.isInteger(parsedInt)) {
    throw new BadEnvTypeError(key);
  }

  return parsedInt;
};

/**
 * Reads a required float `import.meta.env` variable.
 *
 * @throws If the variable is missing or not a float.
 */
const requireFloatEnv = (key: string): number => {
  const parsedFloat = Number(requireEnv(key));

  if (!Number.isFinite(parsedFloat)) {
    throw new BadEnvTypeError(key);
  }

  return parsedFloat;
};

export type SignalingConfig = {
  readonly signalingUrl: string;
};

export type ClientInfoConfig = {
  readonly clientVersion: string;
  readonly clientName: string;
  readonly clientPlatform: string;
};

export type ProtocolConfig = {
  readonly protocolVersion: ProtocolVersion;
  readonly supportResume: boolean;
  readonly supportChunkAck: boolean;
};

export type ReliableTransportConfig = {
  readonly ackTimeout: number;
  readonly retryCheckInterval: number;
  readonly maxRetries: number;
  readonly maxRetryDelay: number;
  readonly maxPendingMessages: number;
  readonly sendRetryDelay: number;
};

export type WebRTCTransportConfig = {
  readonly sendBufferDrainTimeoutMs: number;
  readonly controlChannelHighWatermark: number;
  readonly dataChannelHighWatermark: number;
};

export type OpfsSinkConfig = {
  readonly bufferThresholdMinBytes: number;
  readonly bufferThresholdMaxBytes: number;
  readonly bufferThresholdMinTimeMs: number;
  readonly bufferThresholdMaxTimeMs: number;
  readonly assumedMinThroughput: number;
  readonly flushThresholdPercentageOfFileSize: number;
  readonly flushCyclesOfBacklog: number;
};

let _signalingConfig: SignalingConfig | null = null;
let _clientInfoConfig: ClientInfoConfig | null = null;
let _protocolConfig: ProtocolConfig | null = null;
let _reliableTransportConfig: ReliableTransportConfig | null = null;
let _webRTCTransportConfig: WebRTCTransportConfig | null = null;
let _opfsSinkConfig: OpfsSinkConfig | null = null;

/**
 * Returns the signaling configuration, populated from Vite environment variables.
 *
 * Reads `VITE_*` vars on first call and caches the result for subsequent calls.
 */
export const getSignalingConfig = (): SignalingConfig => {
  if (!_signalingConfig) {
    _signalingConfig = Object.freeze({
      signalingUrl: requireEnv("SIGNALING_SERVER_URL"),
    });
  }

  return _signalingConfig;
};

/**
 * Returns client identity configuration, populated from Vite environment variables.
 *
 * Reads `VITE_*` vars on first call and caches the result for subsequent calls.
 */
export const getClientInfoConfig = (): ClientInfoConfig => {
  if (!_clientInfoConfig) {
    _clientInfoConfig = Object.freeze({
      clientVersion: requireEnv("SIGNALING_CLIENT_VERSION"),
      clientName: requireEnv("SIGNALING_CLIENT_NAME"),
      clientPlatform: requireEnv("SIGNALING_CLIENT_PLATFORM"),
    });
  }

  return _clientInfoConfig;
};

/**
 * Returns protocol configuration, populated from Vite environment variables.
 *
 * Reads `VITE_*` vars on first call and caches the result for subsequent calls.
 */
export const getProtocolConfig = (): ProtocolConfig => {
  if (!_protocolConfig) {
    _protocolConfig = Object.freeze({
      protocolVersion: ProtocolVersionSchema.parse(requireIntEnv("PROTOCOL_VERSION")),
      supportResume: requireBooleanEnv("SIGNALING_CLIENT_SUPPORT_RESUME"),
      supportChunkAck: requireBooleanEnv("SIGNALING_CLIENT_SUPPORT_CHUNK_ACK"),
    });
  }

  return _protocolConfig;
};

/**
 * Returns reliable transport configuration, populated from Vite environment variables.
 *
 * Reads `VITE_*` vars on first call and caches the result for subsequent calls.
 */
export const getReliableTransportConfig = (): ReliableTransportConfig => {
  if (!_reliableTransportConfig) {
    _reliableTransportConfig = Object.freeze({
      ackTimeout: requireIntEnv("ACK_TIMEOUT"),
      retryCheckInterval: requireIntEnv("RETRY_CHECK_INTERVAL"),
      maxRetries: requireIntEnv("MAX_RETRIES"),
      maxRetryDelay: requireIntEnv("MAX_RETRY_DELAY"),
      maxPendingMessages: requireIntEnv("MAX_PENDING_MESSAGES"),
      sendRetryDelay: requireIntEnv("SEND_RETRY_DELAY"),
    });
  }

  return _reliableTransportConfig;
};

/**
 * Returns WebRTC transport configuration, populated from Vite environment variables.
 *
 * Reads `VITE_*` vars on first call and caches the result for subsequent calls.
 */
export const getWebRTCTransportConfig = (): WebRTCTransportConfig => {
  if (!_webRTCTransportConfig) {
    _webRTCTransportConfig = Object.freeze({
      sendBufferDrainTimeoutMs: requireIntEnv("SEND_BUFFER_DRAIN_TIMEOUT_MS"),
      controlChannelHighWatermark: requireIntEnv("CONTROL_CHANNEL_HIGH_WATERMARK"),
      dataChannelHighWatermark: requireIntEnv("DATA_CHANNEL_HIGH_WATERMARK"),
    });
  }

  return _webRTCTransportConfig;
};

/**
 * Returns OPFS sink configuration, populated from Vite environment variables.
 *
 * Reads `VITE_*` vars on first call and caches the result for subsequent calls.
 */
export const getOpfsSinkConfig = (): OpfsSinkConfig => {
  if (!_opfsSinkConfig) {
    _opfsSinkConfig = Object.freeze({
      bufferThresholdMinBytes: requireIntEnv("BUFFER_THRESHOLD_MIN_BYTES"),
      bufferThresholdMaxBytes: requireIntEnv("BUFFER_THRESHOLD_MAX_BYTES"),
      bufferThresholdMinTimeMs: requireIntEnv("BUFFER_THRESHOLD_MIN_TIME_MS"),
      bufferThresholdMaxTimeMs: requireIntEnv("BUFFER_THRESHOLD_MAX_TIME_MS"),
      assumedMinThroughput: requireIntEnv("ASSUMED_MIN_THROUGHPUT"),
      flushThresholdPercentageOfFileSize: requireFloatEnv(
        "FLUSH_THRESHOLD_PERCENTAGE_OF_FILE_SIZE",
      ),
      flushCyclesOfBacklog: requireIntEnv("FLUSH_CYCLES_OF_BACKLOG"),
    });
  }

  return _opfsSinkConfig;
};
