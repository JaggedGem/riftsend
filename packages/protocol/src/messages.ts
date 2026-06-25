import {
  PEER_ID_PREFIX,
  ROOM_ID_PREFIX,
  PEER_ID_ENCODED_LENGTH,
  ROOM_ID_ENCODED_LENGTH,
  SESSION_TOKEN_ENCODED_LENGTH,
  ROOM_JOIN_CODE_LENGTH,
  type RoomId,
  type SessionToken,
  SignalingErrorCode,
  SIGNALING_MESSAGE_TYPES,
} from "@riftsend/shared";
import type { PeerId, JoinCode } from "@riftsend/shared";
import { z } from "zod";

const PEER_ID_REGEX = new RegExp(
  `^${PEER_ID_PREFIX}[A-Za-z0-9_-]{${PEER_ID_ENCODED_LENGTH}}$`,
);

const ROOM_ID_REGEX = new RegExp(
  `^${ROOM_ID_PREFIX}[A-Za-z0-9_-]{${ROOM_ID_ENCODED_LENGTH}}$`,
);

const SESSION_TOKEN_REGEX = new RegExp(
  `^[A-Za-z0-9_-]{${SESSION_TOKEN_ENCODED_LENGTH}}$`,
);

const JOIN_CODE_REGEX = new RegExp(
  `^[A-HJ-NP-Z2-9]{${ROOM_JOIN_CODE_LENGTH}}$`,
);

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

export const PeerIdMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.peerId),
  from: z.literal("server"),
  payload: z.object({
    peerId: PeerIdZod,
    sessionToken: SessionTokenZod,
  }),
});

export type PeerIdMessage = z.infer<typeof PeerIdMessageSchema>;

export const OfferMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.offer),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    sdp: z.string().max(65536),
  }),
});

export type OfferMessage = z.infer<typeof OfferMessageSchema>;

export const AnswerMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.answer),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    sdp: z.string().max(65536),
  }),
});

export type AnswerMessage = z.infer<typeof AnswerMessageSchema>;

export const IceCandidateMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.iceCandidate),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    candidate: z.string().max(4096),
    sdpMid: z.string().max(256).nullable(),
    sdpMLineIndex: z.number().nullable(),
  }),
});

export type IceCandidateMessage = z.infer<typeof IceCandidateMessageSchema>;

export const HelloMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.hello),
  from: z.union([PeerIdZod, z.null()]),
  protocolVersion: z.number(),
  clientVersion: z.string().max(64),
  sessionToken: z.union([SessionTokenZod, z.null()]),
  payload: z.object({
    name: z.string().max(256),
    platform: z.string().max(64),
    supportResume: z.boolean(),
    supportChunkAck: z.boolean(),
  }),
});

export type HelloMessage = z.infer<typeof HelloMessageSchema>;

export const RoomExpiredMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.roomExpired),
  from: z.literal("server"),
  payload: z.object({
    roomId: RoomIdZod,
  }),
});

export type RoomExpiredMessage = z.infer<typeof RoomExpiredMessageSchema>;

export const RoomPeerJoinedMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.roomPeerJoined),
  from: z.literal("server"),
  payload: z.object({
    roomId: RoomIdZod,
    peerId: PeerIdZod,
  }),
});

export type RoomPeerJoinedMessage = z.infer<typeof RoomPeerJoinedMessageSchema>;

export const RoomPeerLeftMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.roomPeerLeft),
  from: z.literal("server"),
  payload: z.object({
    roomId: RoomIdZod,
    peerId: PeerIdZod,
  }),
});

export type RoomPeerLeftMessage = z.infer<typeof RoomPeerLeftMessageSchema>;

export type RoomPeerEventMessage = RoomPeerJoinedMessage | RoomPeerLeftMessage;

export const JoinRoomPayloadSchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("id"),
      roomId: RoomIdZod,
      role: z.union([z.literal("sender"), z.literal("receiver")]),
    })
    .strict(),
  z
    .object({
      method: z.literal("code"),
      joinCode: JoinCodeZod,
      role: z.union([z.literal("sender"), z.literal("receiver")]),
    })
    .strict(),
  z
    .object({
      method: z.literal("create"),
      role: z.union([z.literal("sender"), z.literal("receiver")]),
    })
    .strict(),
]);

export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

export const JoinRoomMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.joinRoom),
    from: PeerIdZod,
    payload: JoinRoomPayloadSchema,
  })
  .strict();

export type JoinRoomMessage = z.infer<typeof JoinRoomMessageSchema>;

export const SignalingErrorCodeSchema = z.enum(SignalingErrorCode);

export const ErrorMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.error),
    from: z.literal("server"),
    payload: z.object({
      code: SignalingErrorCodeSchema,
    }),
  })
  .strict();

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

export const RoomMemberSchema = z.object({
  peerId: PeerIdZod,
  name: z.string().max(256).optional(),
  joinedAt: z.number(),
});

export type RoomMember = z.infer<typeof RoomMemberSchema>;

export const RoomJoinedMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.roomJoined),
    from: z.literal("server"),
    payload: z
      .object({
        method: z.union([
          z.literal("id"),
          z.literal("code"),
          z.literal("create"),
        ]),
        roomId: RoomIdZod,
        joinCode: JoinCodeZod,
        members: z.array(RoomMemberSchema),
      })
      .strict(),
  })
  .strict();

export type RoomJoinedMessage = z.infer<typeof RoomJoinedMessageSchema>;

export const LeaveRoomMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.leaveRoom),
  from: PeerIdZod,
  payload: z.null(),
});

export type LeaveRoomMessage = z.infer<typeof LeaveRoomMessageSchema>;

export const RoomLeftMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.roomLeft),
  from: z.literal("server"),
  payload: z.object({
    roomId: RoomIdZod,
    peerId: PeerIdZod,
  }),
});

export type RoomLeftMessage = z.infer<typeof RoomLeftMessageSchema>;

export const SignalingMessageSchema = z.discriminatedUnion("type", [
  PeerIdMessageSchema,
  HelloMessageSchema,
  OfferMessageSchema,
  AnswerMessageSchema,
  IceCandidateMessageSchema,
  RoomExpiredMessageSchema,
  RoomPeerJoinedMessageSchema,
  RoomPeerLeftMessageSchema,
  JoinRoomMessageSchema,
  ErrorMessageSchema,
  RoomJoinedMessageSchema,
  LeaveRoomMessageSchema,
  RoomLeftMessageSchema,
]);

export type SignalingMessage = z.infer<typeof SignalingMessageSchema>;
