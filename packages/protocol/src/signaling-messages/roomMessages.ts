import { SIGNALING_MESSAGE_TYPES } from "@riftsend/shared";
import { z } from "zod";
import { JoinCodeZod, PeerIdZod, PeerRoleSchema, RoomIdZod } from "./fieldSchemas.js";

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
      role: PeerRoleSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal("code"),
      joinCode: JoinCodeZod,
      role: PeerRoleSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal("create"),
      role: PeerRoleSchema,
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

/**
 * Schema for a room member entry.
 */
export const RoomMemberSchema = z
  .object({
    peerId: PeerIdZod,
    name: z.string().max(256).optional(),
    joinedAt: z.number(),
  })
  .strict();
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
 * Server notification that a new peer has joined the room.
 */
export const RoomPeerJoinedMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.roomPeerJoined),
    from: z.literal("server"),
    payload: z
      .object({
        roomId: RoomIdZod,
        peerId: PeerIdZod,
        joinedAt: z.number(),
      })
      .strict(),
  })
  .strict();
export type RoomPeerJoinedMessage = z.infer<typeof RoomPeerJoinedMessageSchema>;

/**
 * Client request to leave the current room.
 */
export const LeaveRoomMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.leaveRoom),
    from: PeerIdZod,
    payload: z.null(),
  })
  .strict();
export type LeaveRoomMessage = z.infer<typeof LeaveRoomMessageSchema>;

/**
 * Server notification that a peer has left (or was removed from) the room.
 */
export const RoomLeftMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.roomLeft),
    from: z.literal("server"),
    payload: z
      .object({
        roomId: RoomIdZod,
        peerId: PeerIdZod,
      })
      .strict(),
  })
  .strict();
export type RoomLeftMessage = z.infer<typeof RoomLeftMessageSchema>;

/**
 * Server notification that a peer has left the room.
 */
export const RoomPeerLeftMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.roomPeerLeft),
    from: z.literal("server"),
    payload: z
      .object({
        roomId: RoomIdZod,
        peerId: PeerIdZod,
        leftAt: z.number(),
      })
      .strict(),
  })
  .strict();
export type RoomPeerLeftMessage = z.infer<typeof RoomPeerLeftMessageSchema>;

/**
 * Server notification that a room has expired and been cleaned up.
 */
export const RoomExpiredMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.roomExpired),
    from: z.literal("server"),
    payload: z
      .object({
        roomId: RoomIdZod,
      })
      .strict(),
  })
  .strict();
export type RoomExpiredMessage = z.infer<typeof RoomExpiredMessageSchema>;
