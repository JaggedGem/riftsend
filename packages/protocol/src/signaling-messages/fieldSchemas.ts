import { z } from "zod";
import {
  PEER_ID_PREFIX,
  ROOM_ID_PREFIX,
  PEER_ID_ENCODED_LENGTH,
  ROOM_ID_ENCODED_LENGTH,
  SESSION_TOKEN_ENCODED_LENGTH,
  ROOM_JOIN_CODE_LENGTH,
  type RoomId,
  type SessionToken,
  type PeerId,
  type JoinCode,
  WebRTCPeerErrorCode,
  SignalingErrorCode,
} from "@riftsend/shared";
import type { RoomPeerJoinedMessage, RoomPeerLeftMessage } from "./roomMessages.js";

const PEER_ID_REGEX = new RegExp(`^${PEER_ID_PREFIX}[A-Za-z0-9_-]{${PEER_ID_ENCODED_LENGTH}}$`);

const ROOM_ID_REGEX = new RegExp(`^${ROOM_ID_PREFIX}[A-Za-z0-9_-]{${ROOM_ID_ENCODED_LENGTH}}$`);

const SESSION_TOKEN_REGEX = new RegExp(`^[A-Za-z0-9_-]{${SESSION_TOKEN_ENCODED_LENGTH}}$`);

const JOIN_CODE_REGEX = new RegExp(`^[A-HJ-NP-Z2-9]{${ROOM_JOIN_CODE_LENGTH}}$`);

export const PeerIdZod = z
  .string()
  .regex(PEER_ID_REGEX, "Invalid PeerId")
  .transform((v) => v as PeerId);

export const SessionTokenZod = z
  .string()
  .regex(SESSION_TOKEN_REGEX, "Invalid SessionToken")
  .transform((v) => v as SessionToken);

export const RoomIdZod = z
  .string()
  .regex(ROOM_ID_REGEX, "Invalid RoomId")
  .transform((v) => v as RoomId);

export const JoinCodeZod = z
  .string()
  .regex(JOIN_CODE_REGEX, "Invalid JoinCode")
  .transform((v) => v as JoinCode);

export const PeerErrorCodeSchema = z.enum(WebRTCPeerErrorCode);

export type RoomPeerEventMessage = RoomPeerJoinedMessage | RoomPeerLeftMessage;

export const PeerRoleSchema = z.union([z.literal("sender"), z.literal("receiver")]);

export const SignalingErrorCodeSchema = z.enum(SignalingErrorCode);
