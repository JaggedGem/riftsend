export enum WebRTCConnectionErrorCode {
  UNKNOWN_ERROR = "webrtc_connection.unknown_error",
  UNSTABLE_SIGNALING = "webrtc_connection.unstable_signaling",
  NEGOTIATION_ALREADY_STARTED = "webrtc_connection.negotiation_already_started",
  CHANNEL_ALREADY_OPEN = "webrtc_connection.channel_already_open",
  PEER_CONNECTION_CLOSED = "webrtc_connection.peer_connection_closed",
  NEGOTIATION_ERROR = "webrtc_connection.negotiation_error",
  ICE_CANDIDATE_FAILED = "webrtc_connection.ice_candidate_failed",
  INVALID_OFFER = "webrtc_connection.invalid_offer",
  CONTROL_CHANNEL_ERROR = "webrtc_connection.control_channel_error",
  DATA_CHANNEL_ERROR = "webrtc_connection.data_channel_error",
}

export class WebRTCConnectionError extends Error {
  public constructor(
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
