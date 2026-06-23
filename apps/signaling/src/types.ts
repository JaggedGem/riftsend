import {
  PEER_ID_PREFIX,
  SIGNALING_MESSAGE_TYPES,
  PEER_ID_ENCODED_LENGTH,
  SESSION_TOKEN_ENCODED_LENGTH,
} from "@riftsend/shared";
import type { PeerId, SessionToken } from "@riftsend/shared";
import { WebSocket } from "ws";
import { z } from "zod";

export interface PeerInfo {
  id: PeerId;
  name: string;
}

export type SignalingMessageType = (typeof SIGNALING_MESSAGE_TYPES)[number];

const PEER_ID_REGEX = new RegExp(
  `^${PEER_ID_PREFIX}[A-Za-z0-9_-]{${PEER_ID_ENCODED_LENGTH}}$`,
);
const SESSION_TOKEN_REGEX = new RegExp(
  `^[A-Za-z0-9_-]{${SESSION_TOKEN_ENCODED_LENGTH}}$`,
);

export const PeerIdZod = z
  .string()
  .regex(PEER_ID_REGEX, "Invalid PeerId")
  .transform((v) => v as PeerId);

export const SessionTokenZod = z
  .string()
  .regex(SESSION_TOKEN_REGEX, "Invalid SessionToken")
  .transform((v) => v as SessionToken);

export const PeerIdMessageSchema = z.object({
  type: z.literal("peer-id"),
  from: z.literal("server"),
  payload: z.object({
    peerId: PeerIdZod,
    sessionToken: SessionTokenZod,
  }),
});

export type PeerIdMessage = z.infer<typeof PeerIdMessageSchema>;

export const OfferMessageSchema = z.object({
  type: z.literal("offer"),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    sdp: z.string().max(65536),
  }),
});

export type OfferMessage = z.infer<typeof OfferMessageSchema>;

export const AnswerMessageSchema = z.object({
  type: z.literal("answer"),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    sdp: z.string().max(65536),
  }),
});

export type AnswerMessage = z.infer<typeof AnswerMessageSchema>;

export const IceCandidateMessageSchema = z.object({
  type: z.literal("ice-candidate"),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    candidate: z.string().max(4096),
    sdpMid: z.string().max(256).nullable(),
    sdpMLineIndex: z.number().nullable(),
  }),
});

export type IceCandidateMessage = z.infer<typeof IceCandidateMessageSchema>;

export interface AuthedWebSocket extends WebSocket {
  peerId: PeerId;
  name: string;
  protocolVersion: number;
  clientVersion: string;
  sessionToken: SessionToken | null;
  role: "sender" | "receiver";
  platform: string;
  supportResume: boolean;
  supportChunkAck: boolean;
}

export const HelloMessageSchema = z.object({
  type: z.literal("hello"),
  from: z.union([PeerIdZod, z.null()]),
  protocolVersion: z.number(),
  clientVersion: z.string().max(64),
  sessionToken: z.union([z.string().max(64), z.null()]),
  payload: z.object({
    role: z.union([z.literal("sender"), z.literal("receiver")]),
    name: z.string().max(256),
    platform: z.string().max(64),
    supportResume: z.boolean(),
    supportChunkAck: z.boolean(),
  }),
});

export type HelloMessage = z.infer<typeof HelloMessageSchema>;

export const SignalingMessageSchema = z.discriminatedUnion("type", [
  PeerIdMessageSchema,
  HelloMessageSchema,
  OfferMessageSchema,
  AnswerMessageSchema,
  IceCandidateMessageSchema,
]);

export type SignalingMessage = z.infer<typeof SignalingMessageSchema>;
