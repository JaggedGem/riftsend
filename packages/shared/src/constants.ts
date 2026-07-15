/**
 * Riftsend shared constants.
 *
 * Defines all configurable sizes, prefixes, error codes, and message-type
 * strings used across the signaling server and web client.
 *
 * ## Conventions
 *
 * - Error codes use UPPER_SNAKE_CASE so they round-trip cleanly through JSON.
 * - Every error code in {@link SignalingErrorCode} maps to a human-readable
 *   string in {@link SignalingErrorMessages} and (optionally) a WebSocket
 *   close code in {@link SignalingCloseCodes}.
 * - {@link WebRTCPeerErrorCode} mirrors the same pattern for peer-to-peer
 *   errors that flow through the signaling relay.
 */

/** Number of random bytes generated for IDs (peer, room, etc.). */
export const NR_RANDOM_BYTES = 12;

/** String prepended to every encoded peer ID. */
export const PEER_ID_PREFIX = "peer_";

/** Number of random bytes used for a session token. */
export const SESSION_TOKEN_BYTES = 20;

/**
 * Length of a base64url-encoded peer ID after the prefix.
 *
 * Computed as `ceil(nrRandomBytes * 4 / 3)`.
 */
export const PEER_ID_ENCODED_LENGTH = Math.ceil((NR_RANDOM_BYTES * 4) / 3);

/**
 * Length of a base64url-encoded session token.
 */
export const SESSION_TOKEN_ENCODED_LENGTH = Math.ceil(
  (SESSION_TOKEN_BYTES * 4) / 3,
);

/**
 * Length of a base64url-encoded room ID after the prefix.
 */
export const ROOM_ID_ENCODED_LENGTH = Math.ceil((NR_RANDOM_BYTES * 4) / 3);

/**
 * Length of a human-readable room join code (characters).
 *
 * Join codes use a subset of alphanumeric chars (no 0/O, 1/I/L) for easy
 * verbal dictation.
 */
export const ROOM_JOIN_CODE_LENGTH = 6;

/** String prepended to every encoded room ID. */
export const ROOM_ID_PREFIX = "room_";

/**
 * Room lifetime before automatic expiration (milliseconds).
 *
 * Rooms that reach this age are cleaned up regardless of activity to avoid
 * unbounded server-side state.
 */
export const ROOM_EXPIRE_TIME = 1000 * 60 * 60; // 1 hour

/**
 * Canonical message type strings understood by the signaling protocol.
 *
 * Every value here appears as the `type` field in a JSON wire message.
 * New message types must be added here AND to the discriminated union schema
 * in `@riftsend/protocol`.
 */
export const SIGNALING_MESSAGE_TYPES = {
  error: "error",
  peerId: "peer-id",
  hello: "hello",
  offer: "offer",
  answer: "answer",
  iceCandidate: "ice-candidate",
  peerError: "peer-error",

  joinRoom: "join-room",
  roomJoined: "room-joined",
  roomLeft: "room-left",
  leaveRoom: "leave-room",
  roomPeerJoined: "room-peer-joined",
  roomPeerLeft: "room-peer-left",
  roomExpired: "room-expired",
} as const;

/**
 * Error codes returned by the signaling server in `error` messages.
 *
 * These represent **protocol-level** failures (room full, rate limited, etc.)
 * as opposed to WebRTC-level failures, which use {@link WebRTCPeerErrorCode}.
 */
export const SignalingErrorCode = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_IS_FULL: "ROOM_IS_FULL",
  PEER_ALREADY_IN_ROOM: "PEER_ALREADY_IN_ROOM",
  JOIN_CODE_NOT_FOUND: "JOIN_CODE_NOT_FOUND",
  NO_ROOM_ID_OR_JOIN_CODE: "NO_ROOM_ID_OR_JOIN_CODE",
  ROOM_ID_COLLISION: "ROOM_ID_COLLISION",
  UNKNOWN_JOIN_ROOM_METHOD: "UNKNOWN_JOIN_ROOM_METHOD",
  NOT_IN_A_ROOM: "NOT_IN_A_ROOM",
  FAILED_TO_REMOVE_PEER_FROM_ROOM: "FAILED_TO_REMOVE_PEER_FROM_ROOM",

  TOO_MANY_CONNECTIONS: "TOO_MANY_CONNECTIONS",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INVALID_JSON: "INVALID_JSON",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  RECONNECTED_ELSEWHERE: "RECONNECTED_ELSEWHERE",
} as const;

export type SignalingErrorCode =
  (typeof SignalingErrorCode)[keyof typeof SignalingErrorCode];

/**
 * Human-readable descriptions for every {@link SignalingErrorCode}.
 */
export const SignalingErrorMessages: Record<SignalingErrorCode, string> = {
  [SignalingErrorCode.ROOM_NOT_FOUND]: "Room not found",
  [SignalingErrorCode.ROOM_IS_FULL]: "Room is full",
  [SignalingErrorCode.PEER_ALREADY_IN_ROOM]: "Peer already in room",
  [SignalingErrorCode.JOIN_CODE_NOT_FOUND]: "Join code not found",
  [SignalingErrorCode.NO_ROOM_ID_OR_JOIN_CODE]:
    "No room ID or join code provided",
  [SignalingErrorCode.TOO_MANY_CONNECTIONS]: "Too many connections",
  [SignalingErrorCode.RATE_LIMIT_EXCEEDED]: "Rate limit exceeded",
  [SignalingErrorCode.INVALID_JSON]: "Invalid JSON",
  [SignalingErrorCode.INTERNAL_SERVER_ERROR]: "Internal server error",
  [SignalingErrorCode.NOT_AUTHENTICATED]: "Not authenticated",
  [SignalingErrorCode.RECONNECTED_ELSEWHERE]: "Reconnected elsewhere",
  [SignalingErrorCode.ROOM_ID_COLLISION]: "Room ID collision",
  [SignalingErrorCode.UNKNOWN_JOIN_ROOM_METHOD]: "Unknown join-room method",
  [SignalingErrorCode.NOT_IN_A_ROOM]: "Peer not in any room",
  [SignalingErrorCode.FAILED_TO_REMOVE_PEER_FROM_ROOM]:
    "Failed to remove peer from room",
};

/**
 * WebSocket close codes mapped from {@link SignalingErrorCode}.
 *
 * Only errors that should cause a WebSocket close are included.
 * Per the spec only codes in the 1000–1015 range and 3000–4999 are valid.
 */
export const SignalingCloseCodes: Partial<Record<SignalingErrorCode, number>> =
  {
    [SignalingErrorCode.TOO_MANY_CONNECTIONS]: 1013,
    [SignalingErrorCode.RATE_LIMIT_EXCEEDED]: 1008,
    [SignalingErrorCode.INVALID_JSON]: 1008,
    [SignalingErrorCode.INTERNAL_SERVER_ERROR]: 1011,
    [SignalingErrorCode.NOT_AUTHENTICATED]: 1008,
    [SignalingErrorCode.RECONNECTED_ELSEWHERE]: 1000,
    [SignalingErrorCode.ROOM_ID_COLLISION]: 1008,
    [SignalingErrorCode.UNKNOWN_JOIN_ROOM_METHOD]: 1008,
  };

/**
 * Formats a {@link SignalingErrorCode} into a human-readable string.
 */
export const formatSignalingError = (code: SignalingErrorCode): string => {
  return SignalingErrorMessages[code];
};

/**
 * Error codes sent between peers over the signaling relay.
 *
 * These represent **WebRTC-level** failures (ICE failed, glare, etc.)
 * as opposed to protocol-level failures, which use {@link SignalingErrorCode}.
 */
export const WebRTCPeerErrorCode = {
  INVALID_OFFER: "INVALID_OFFER",
  GLARE_CONFLICT: "GLARE_CONFLICT",
  SIGNALING_STATE_CONFLICT: "SIGNALING_STATE_CONFLICT",
  NEGOTIATION_FAILED: "NEGOTIATION_FAILED",
  ICE_CANDIDATE_FAILED: "ICE_CANDIDATE_FAILED",
  CONNECTION_FAILED: "CONNECTION_FAILED",
  ICE_CONNECTION_FAILED: "ICE_CONNECTION_FAILED",
  TIMEOUT: "TIMEOUT",
} as const;

export type WebRTCPeerErrorCode =
  (typeof WebRTCPeerErrorCode)[keyof typeof WebRTCPeerErrorCode];

/**
 * Human-readable descriptions for every {@link WebRTCPeerErrorCode}.
 */
export const WebRTCPeerErrorMessages: Record<WebRTCPeerErrorCode, string> = {
  [WebRTCPeerErrorCode.INVALID_OFFER]:
    "Invalid offer: missing or malformed SDP",
  [WebRTCPeerErrorCode.GLARE_CONFLICT]: "Glare: simultaneous offer detected",
  [WebRTCPeerErrorCode.SIGNALING_STATE_CONFLICT]:
    "Cannot accept offer: signaling state conflict",
  [WebRTCPeerErrorCode.NEGOTIATION_FAILED]: "Failed to create or send answer",
  [WebRTCPeerErrorCode.ICE_CANDIDATE_FAILED]: "Failed to process ICE candidate",
  [WebRTCPeerErrorCode.CONNECTION_FAILED]: "Peer connection failed",
  [WebRTCPeerErrorCode.ICE_CONNECTION_FAILED]: "ICE connection failed",
  [WebRTCPeerErrorCode.TIMEOUT]: "Peer connection timed out",
};

/**
 * Formats a {@link WebRTCPeerErrorCode} into a human-readable string.
 */
export const formatWebRTCPeerError = (code: WebRTCPeerErrorCode): string => {
  return WebRTCPeerErrorMessages[code];
};

/**
 * Canonical message type strings understood by the signaling protocol.
 *
 * Every value here appears as the `type` field in a JSON wire message.
 * New message types must be added here AND to the discriminated union schema
 * in `@riftsend/protocol`.
 */
export const CONTROL_MESSAGE_TYPES = {
  batchOffer: "batch-offer",
  batchResponse: "batch-response",
  fileStart: "file-start",
  filePause: "file-pause",
  fileCancel: "file-cancel",
  fileComplete: "file-complete",
  fileVerified: "file-verified",
  fileFailed: "file-failed",
  resumeRequest: "resume-request",
  resumeAccept: "resume-accept",
  resumeDeny: "resume-deny",
  resumeResponse: "resume-response",
} as const;
