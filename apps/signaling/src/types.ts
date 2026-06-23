import {
  PEER_ID_PREFIX,
  SIGNALING_MESSAGE_TYPES,
} from "../../../packages/shared/src/constants";
import { WebSocket } from "ws";
import { z } from "zod";

export type PeerId = string & { readonly __brand: unique symbol };

export interface PeerInfo {
  id: PeerId;
  name: string;
}

export type SignalingMessageType = (typeof SIGNALING_MESSAGE_TYPES)[number];

const PEER_ID_REGEX = /^peer_[A-Za-z0-9_-]{16}$/;

export const PeerIdZod = z
  .string()
  .regex(PEER_ID_REGEX, "Invalid PeerId")
  .transform((v) => v as PeerId);

export const PeerIdMessageSchema = z.object({
  type: z.literal("peer-id"),
  from: z.literal("server"),
  payload: PeerIdZod,
});

export type PeerIdMessage = z.infer<typeof PeerIdMessageSchema>;

export const OfferMessageSchema = z.object({
  type: z.literal("offer"),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    sdp: z.string(),
  }),
});

export type OfferMessage = z.infer<typeof OfferMessageSchema>;

export const AnswerMessageSchema = z.object({
  type: z.literal("answer"),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    sdp: z.string(),
  }),
});

export type AnswerMessage = z.infer<typeof AnswerMessageSchema>;

export const IceCandidateMessageSchema = z.object({
  type: z.literal("ice-candidate"),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    candidate: z.string(),
    sdpMid: z.string().nullable(),
    sdpMLineIndex: z.number().nullable(),
  }),
});

export type IceCandidateMessage = z.infer<typeof IceCandidateMessageSchema>;

export interface AuthedWebSocket extends WebSocket {
  peerId: PeerId;
  name: string;
  protocolVersion: number;
  clientVersion: string;
  sessionToken: string;
  role: "sender" | "receiver";
  platform: string;
  supportResume: boolean;
  supportChunkAck: boolean;
}

export const HelloMessageSchema = z.object({
  type: z.literal("hello"),
  from: z.null(),
  protocolVersion: z.number(),
  clientVersion: z.string(),
  sessionToken: z.string(),
  payload: z.object({
    role: z.union([z.literal("sender"), z.literal("receiver")]),
    name: z.string(),
    platform: z.string(),
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
