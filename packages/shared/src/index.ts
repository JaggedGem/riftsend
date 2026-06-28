export { generatePeerId } from "./peerId.js";
export { generateSessionToken } from "./sessionToken.js";
export {
  NR_RANDOM_BYTES,
  PEER_ID_PREFIX,
  SESSION_TOKEN_BYTES,
  PEER_ID_ENCODED_LENGTH,
  SESSION_TOKEN_ENCODED_LENGTH,
  ROOM_EXPIRE_TIME,
  ROOM_ID_ENCODED_LENGTH,
  ROOM_JOIN_CODE_LENGTH,
  ROOM_ID_PREFIX,
  SIGNALING_MESSAGE_TYPES,
  SignalingErrorMessages,
  SignalingCloseCodes,
  formatSignalingError,
} from "./constants.js";
export type {
  PeerId,
  SessionToken,
  RoomId,
  JoinCode,
  RoomCredentials,
  SignalingMessageTypes,
  RoomMember,
  Room,
} from "./types.js";
export { generateRoomId, generateJoinCode } from "./room.js";

import { SignalingErrorCode as _SEC } from "./constants.js";
export const SignalingErrorCode = _SEC;
export type SignalingErrorCode = (typeof _SEC)[keyof typeof _SEC];
