export const NR_RANDOM_BYTES = 12;
export const PEER_ID_PREFIX = "peer_";
export const SESSION_TOKEN_BYTES = 20;

export const PEER_ID_ENCODED_LENGTH = Math.ceil((NR_RANDOM_BYTES * 4) / 3);
export const SESSION_TOKEN_ENCODED_LENGTH = Math.ceil((SESSION_TOKEN_BYTES * 4) / 3);

export const SIGNALING_MESSAGE_TYPES = [
  "peer-id",
  "hello",
  "offer",
  "answer",
  "ice-candidate",
] as const;
