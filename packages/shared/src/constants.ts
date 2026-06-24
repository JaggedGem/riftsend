export const NR_RANDOM_BYTES = 12;
export const PEER_ID_PREFIX = "peer_";
export const SESSION_TOKEN_BYTES = 20;

export const PEER_ID_ENCODED_LENGTH = Math.ceil((NR_RANDOM_BYTES * 4) / 3);
export const SESSION_TOKEN_ENCODED_LENGTH = Math.ceil(
  (SESSION_TOKEN_BYTES * 4) / 3,
);

export const ROOM_ID_ENCODED_LENGTH = Math.ceil((NR_RANDOM_BYTES * 4) / 3);

export const ROOM_JOIN_CODE_LENGTH = 6;

export const ROOM_ID_PREFIX = "room_";

export const ROOM_EXPIRE_TIME = 1000 * 60 * 60; // 1 hour

export const SIGNALING_MESSAGE_TYPES = {
  error: "error",
  peerId: "peer-id",
  hello: "hello",
  offer: "offer",
  answer: "answer",
  iceCandidate: "ice-candidate",

  // Room signaling messages
  joinRoom: "join-room",
  roomJoined: "room-joined",
  roomLeft: "room-left",
  leaveRoom: "leave-room",
  roomPeerJoined: "room-peer-joined",
  roomPeerLeft: "room-peer-left",
  roomExpired: "room-expired",
} as const;
