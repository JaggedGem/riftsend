export type PeerId = string & { readonly __brand: unique symbol };
export type SessionToken = string & { readonly __brand: unique symbol };
export type RoomId = string & { readonly __brand: unique symbol };
export type JoinCode = string & { readonly __brand: unique symbol };

export interface RoomCredentials {
  roomId: RoomId;
  joinCode: JoinCode;
}

export const SignalingErrorCode = {
  // Room errors
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_IS_FULL: "ROOM_IS_FULL",
  PEER_ALREADY_IN_ROOM: "PEER_ALREADY_IN_ROOM",
  JOIN_CODE_NOT_FOUND: "JOIN_CODE_NOT_FOUND",
  NO_ROOM_ID_OR_JOIN_CODE: "NO_ROOM_ID_OR_JOIN_CODE",
  ROOM_ID_COLLISION: "ROOM_ID_COLLISION",
  UNKNOWN_JOIN_ROOM_METHOD: "UNKNOWN_JOIN_ROOM_METHOD",

  // Connection errors
  TOO_MANY_CONNECTIONS: "TOO_MANY_CONNECTIONS",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INVALID_JSON: "INVALID_JSON",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  RECONNECTED_ELSEWHERE: "RECONNECTED_ELSEWHERE",
} as const;

export type SignalingErrorCode =
  (typeof SignalingErrorCode)[keyof typeof SignalingErrorCode];

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
};

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

export const formatSignalingError = (code: SignalingErrorCode): string => {
  return SignalingErrorMessages[code];
};
