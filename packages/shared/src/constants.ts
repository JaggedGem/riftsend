export const NR_RANDOM_BYTES = 12; // 96 bits
export const PEER_ID_PREFIX = "peer_";
export const SIGNALING_MESSAGE_TYPES = [
  "peer-id",
  "hello",
  "offer",
  "answer",
  "ice-candidate",
] as const;
