/**
 * `@riftsend/shared`
 *
 * Shared runtime utilities, constants, error codes, and type definitions used
 * across the signaling server and web client.
 *
 * ## What lives here
 *
 * - **Identifiers**: Peer ID, session token, room ID, join code generation.
 * - **Error codes**: Protocol-level and WebRTC-level error codes with
 *   human-readable messages and WebSocket close code mappings.
 * - **Crypto primitives**: CSPRNG wrapper, base64url encoding.
 * - **Types**: Branded string types for IDs, room/member interfaces.
 */

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
  WebRTCPeerErrorMessages,
  formatWebRTCPeerError,
  CONTROL_MESSAGE_TYPES,
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
  FileId,
  BatchId,
  TransferId,
  MessageId,
} from "./types.js";
export { generateRoomId, generateJoinCode } from "./room.js";

import { SignalingErrorCode as _SEC } from "./constants.js";
export const SignalingErrorCode = _SEC;
export type SignalingErrorCode = (typeof _SEC)[keyof typeof _SEC];

import { WebRTCPeerErrorCode as _WPEC } from "./constants.js";
export const WebRTCPeerErrorCode = _WPEC;
export type WebRTCPeerErrorCode = (typeof _WPEC)[keyof typeof _WPEC];
export { getFileId } from "./fileId.js";
export { getBatchId } from "./batchId.js";
export { createTransferId } from "./transferId.js";
