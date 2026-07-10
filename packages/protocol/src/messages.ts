/**
 * Signaling message schemas and inferred types.
 *
 * ## Message flow
 *
 * 1. Client sends `hello` → server responds with `peer-id`.
 * 2. Client sends `join-room` → server responds with `room-joined`.
 * 3. While in a room, the server forwards `offer`, `answer`, `ice-candidate`,
 *    and `peer-error` messages between peers.
 * 4. Server sends `room-peer-joined`, `room-peer-left`, `room-expired`, and
 *    `room-left` asynchronously in response to room lifecycle events.
 * 5. Client sends `leave-room` to leave the room explicitly.
 */

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
  WebRTCPeerErrorCode,
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

/**
 * Server response to a successful `hello` handshake.
 *
 * Contains the assigned {@link PeerId} and {@link SessionToken} for the
 * connection. The session token may be used to resume the session on reconnect.
 */
export const PeerIdMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.peerId),
  from: z.literal("server"),
  payload: z.object({
    peerId: PeerIdZod,
    sessionToken: SessionTokenZod,
  }),
});

export type PeerIdMessage = z.infer<typeof PeerIdMessageSchema>;

/**
 * WebRTC SDP offer forwarded from one peer to another through the signaling server.
 *
 * The `sdp` field is limited to 64 KiB to prevent abuse.
 */
export const OfferMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.offer),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    description: z.object({
      type: z.literal("offer"),
      sdp: z.string().max(65536),
    }),
  }),
});

export type OfferMessage = z.infer<typeof OfferMessageSchema>;

/**
 * WebRTC SDP answer forwarded from one peer to another through the signaling server.
 */
export const AnswerMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.answer),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    description: z.object({
      type: z.literal("answer"),
      sdp: z.string().max(65536),
    }),
  }),
});

export type AnswerMessage = z.infer<typeof AnswerMessageSchema>;

/**
 * WebRTC ICE candidate forwarded from one peer to another through the signaling server.
 *
 * The `candidate` string is limited to 4 KiB. The `sdpMid` and `sdpMLineIndex`
 * identify which media stream the candidate belongs to.
 */
export const IceCandidateMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.iceCandidate),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    candidate: z.object({
      candidate: z.string().max(4096),
      sdpMid: z.string().max(256).nullable(),
      sdpMLineIndex: z.number().int().nonnegative().nullable(),
      usernameFragment: z.string().max(256).optional(),
    }),
  }),
});

export type IceCandidateMessage = z.infer<typeof IceCandidateMessageSchema>;

/**
 * Initial handshake message sent by the client on WebSocket open.
 *
 * If `from` and `sessionToken` are both non-null, the client is attempting to
 * resume a previous session.
 */
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

/**
 * Server notification that a room has expired and been cleaned up.
 */
export const RoomExpiredMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.roomExpired),
  from: z.literal("server"),
  payload: z.object({
    roomId: RoomIdZod,
  }),
});

export type RoomExpiredMessage = z.infer<typeof RoomExpiredMessageSchema>;

/**
 * Server notification that a new peer has joined the room.
 */
export const RoomPeerJoinedMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.roomPeerJoined),
  from: z.literal("server"),
  payload: z.object({
    roomId: RoomIdZod,
    peerId: PeerIdZod,
    joinedAt: z.number(),
  }),
});

export type RoomPeerJoinedMessage = z.infer<typeof RoomPeerJoinedMessageSchema>;

/**
 * Server notification that a peer has left the room.
 */
export const RoomPeerLeftMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.roomPeerLeft),
  from: z.literal("server"),
  payload: z.object({
    roomId: RoomIdZod,
    peerId: PeerIdZod,
    leftAt: z.number(),
  }),
});

export type RoomPeerLeftMessage = z.infer<typeof RoomPeerLeftMessageSchema>;

export type RoomPeerEventMessage = RoomPeerJoinedMessage | RoomPeerLeftMessage;

/**
 * Union of the three ways to join a room:
 *
 * - `id`: Join an existing room by its ID.
 * - `code`: Join an existing room by its human-readable join code.
 * - `create`: Create a new room (the client becomes the host).
 */
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

/**
 * Client request to join or create a room.
 */
export const JoinRoomMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.joinRoom),
    from: PeerIdZod,
    payload: JoinRoomPayloadSchema,
  })
  .strict();

export type JoinRoomMessage = z.infer<typeof JoinRoomMessageSchema>;

export const SignalingErrorCodeSchema = z.enum(SignalingErrorCode);

/**
 * Server error message with a machine-readable error code.
 */
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

/**
 * Schema for a room member entry.
 */
export const RoomMemberSchema = z.object({
  peerId: PeerIdZod,
  name: z.string().max(256).optional(),
  joinedAt: z.number(),
});

export type RoomMember = z.infer<typeof RoomMemberSchema>;

/**
 * Server response to a successful `join-room` request.
 *
 * Contains the full room state including the join code, member list, and
 * expiration timestamps.
 */
export const RoomJoinedMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.roomJoined),
    from: z.literal("server"),
    payload: z
      .object({
        roomId: RoomIdZod,
        joinCode: JoinCodeZod,
        members: z.record(PeerIdZod, RoomMemberSchema),
        hostPeerId: PeerIdZod,
        maxPeers: z.number(),
        roomName: z.string().max(256).optional(),
        joinedAt: z.number(),
        createdAt: z.number(),
        expiresAt: z.number(),
      })
      .strict(),
  })
  .strict();

export type RoomJoinedMessage = z.infer<typeof RoomJoinedMessageSchema>;

/**
 * Client request to leave the current room.
 */
export const LeaveRoomMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.leaveRoom),
  from: PeerIdZod,
  payload: z.null(),
});

export type LeaveRoomMessage = z.infer<typeof LeaveRoomMessageSchema>;

/**
 * Server notification that a peer has left (or was removed from) the room.
 */
export const RoomLeftMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.roomLeft),
  from: z.literal("server"),
  payload: z.object({
    roomId: RoomIdZod,
    peerId: PeerIdZod,
  }),
});

export type RoomLeftMessage = z.infer<typeof RoomLeftMessageSchema>;

export const PeerErrorCodeSchema = z.enum(WebRTCPeerErrorCode);

/**
 * Error message sent from one peer to another through the signaling relay.
 *
 * Carries an optional {@link WebRTCPeerErrorCode} for machine-readable error
 * handling and a human-readable message limited to 1 KiB.
 */
export const PeerErrorMessageSchema = z.object({
  type: z.literal(SIGNALING_MESSAGE_TYPES.peerError),
  from: PeerIdZod,
  to: PeerIdZod,
  payload: z.object({
    message: z.string().max(1024),
    code: PeerErrorCodeSchema.optional(),
  }),
});

export type PeerErrorMessage = z.infer<typeof PeerErrorMessageSchema>;

/**
 * Discriminated union of all valid signaling messages.
 *
 * Use this as the single entry point for parsing incoming WebSocket messages.
 * Every message type listed in {@link @riftsend/shared!SIGNALING_MESSAGE_TYPES}
 * must be represented here.
 */
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
  PeerErrorMessageSchema,
]);

export type SignalingMessage = z.infer<typeof SignalingMessageSchema>;