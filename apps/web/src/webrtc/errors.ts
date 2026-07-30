export enum WebRTCConnectionErrorCode {
  UNKNOWN_ERROR = "WRTC_CONN_UNKNOWN_ERROR",
  UNSTABLE_SIGNALING = "WRTC_CONN_UNSTABLE_SIGNALING",
  NEGOTIATION_ALREADY_STARTED = "WRTC_CONN_NEGOTIATION_ALREADY_STARTED",
  CHANNEL_ALREADY_OPEN = "WRTC_CONN_CHANNEL_ALREADY_OPEN",
  PEER_CONNECTION_CLOSED = "WRTC_CONN_PEER_CONNECTION_CLOSED",
  NEGOTIATION_ERROR = "WRTC_CONN_NEGOTIATION_ERROR",
}

export class WebRTCConnectionError extends Error {
  constructor(
    public readonly code: WebRTCConnectionErrorCode,
    message: string,
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });

    this.name = "WebRTCConnectionError";
  }
}
