import { beforeEach, describe, expect, it, vi } from "vitest";

describe("app configuration getters", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
    Object.assign(import.meta.env, originalEnv);
  });

  it("reads and caches required config values from import.meta.env", async () => {
    Object.assign(import.meta.env, {
      SIGNALING_SERVER_URL: "ws://localhost:8080",
      SIGNALING_CLIENT_VERSION: "1.2.3",
      SIGNALING_CLIENT_NAME: "test-client",
      SIGNALING_CLIENT_PLATFORM: "linux",
      PROTOCOL_VERSION: "1",
      SIGNALING_CLIENT_SUPPORT_RESUME: "true",
      SIGNALING_CLIENT_SUPPORT_CHUNK_ACK: "false",
      ACK_TIMEOUT: "1000",
      RETRY_CHECK_INTERVAL: "250",
      MAX_RETRIES: "3",
      MAX_RETRY_DELAY: "4000",
      MAX_PENDING_MESSAGES: "8",
      SEND_RETRY_DELAY: "200",
      SEND_BUFFER_DRAIN_TIMEOUT_MS: "300",
      CONTROL_CHANNEL_HIGH_WATERMARK: "1024",
      DATA_CHANNEL_HIGH_WATERMARK: "2097152",
      BUFFER_THRESHOLD_MIN_BYTES: "1024",
      BUFFER_THRESHOLD_MAX_BYTES: "1048576",
      BUFFER_THRESHOLD_MIN_TIME_MS: "50",
      BUFFER_THRESHOLD_MAX_TIME_MS: "1000",
      ASSUMED_MIN_THROUGHPUT: "500000",
      FLUSH_THRESHOLD_PERCENTAGE_OF_FILE_SIZE: "10",
      FLUSH_CYCLES_OF_BACKLOG: "2",
    });

    const configModule = await import("./config.js");
    const {
      getSignalingConfig,
      getClientInfoConfig,
      getProtocolConfig,
      getReliableTransportConfig,
      getWebRTCTransportConfig,
      getOpfsSinkConfig,
    } = configModule;

    expect(getSignalingConfig()).toEqual({ signalingUrl: "ws://localhost:8080" });
    expect(getClientInfoConfig()).toEqual({
      clientVersion: "1.2.3",
      clientName: "test-client",
      clientPlatform: "linux",
    });
    expect(getProtocolConfig()).toEqual({
      protocolVersion: 1,
      supportResume: true,
      supportChunkAck: false,
    });
    expect(getReliableTransportConfig()).toEqual({
      ackTimeout: 1000,
      retryCheckInterval: 250,
      maxRetries: 3,
      maxRetryDelay: 4000,
      maxPendingMessages: 8,
      sendRetryDelay: 200,
    });
    expect(getWebRTCTransportConfig()).toEqual({
      sendBufferDrainTimeoutMs: 300,
      controlChannelHighWatermark: 1024,
      dataChannelHighWatermark: 2097152,
    });
    expect(getOpfsSinkConfig()).toEqual({
      bufferThresholdMinBytes: 1024,
      bufferThresholdMaxBytes: 1048576,
      bufferThresholdMinTimeMs: 50,
      bufferThresholdMaxTimeMs: 1000,
      assumedMinThroughput: 500000,
      flushThresholdPercentageOfFileSize: 10,
      flushCyclesOfBacklog: 2,
    });
  });

  it("throws typed errors when env values are missing or malformed", async () => {
    Object.assign(import.meta.env, {
      SIGNALING_SERVER_URL: "",
    });

    const missingModule = await import("./config.js");
    const { MissingEnvError } = await import("./envError.js");
    expect(() => missingModule.getSignalingConfig()).toThrow(MissingEnvError);

    Object.assign(import.meta.env, {
      SIGNALING_SERVER_URL: "ws://localhost:8080",
      SIGNALING_CLIENT_VERSION: "1.2.3",
      SIGNALING_CLIENT_NAME: "test-client",
      SIGNALING_CLIENT_PLATFORM: "linux",
      PROTOCOL_VERSION: "not-a-number",
      SIGNALING_CLIENT_SUPPORT_RESUME: "maybe",
      SIGNALING_CLIENT_SUPPORT_CHUNK_ACK: "false",
      ACK_TIMEOUT: "1000",
      RETRY_CHECK_INTERVAL: "250",
      MAX_RETRIES: "3",
      MAX_RETRY_DELAY: "4000",
      MAX_PENDING_MESSAGES: "8",
      SEND_RETRY_DELAY: "200",
      SEND_BUFFER_DRAIN_TIMEOUT_MS: "300",
      CONTROL_CHANNEL_HIGH_WATERMARK: "1024",
      DATA_CHANNEL_HIGH_WATERMARK: "2097152",
      BUFFER_THRESHOLD_MIN_BYTES: "1024",
      BUFFER_THRESHOLD_MAX_BYTES: "1048576",
      BUFFER_THRESHOLD_MIN_TIME_MS: "50",
      BUFFER_THRESHOLD_MAX_TIME_MS: "1000",
      ASSUMED_MIN_THROUGHPUT: "500000",
      FLUSH_THRESHOLD_PERCENTAGE_OF_FILE_SIZE: "10",
      FLUSH_CYCLES_OF_BACKLOG: "2",
    });

    vi.resetModules();
    const invalidModule = await import("./config.js");
    const { BadEnvTypeError } = await import("./envError.js");
    expect(() => invalidModule.getProtocolConfig()).toThrow(BadEnvTypeError);
  });
});
