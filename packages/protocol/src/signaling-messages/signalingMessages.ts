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

import { z } from "zod";
import { PeerIdMessageSchema, HelloMessageSchema, PeerErrorMessageSchema } from "./peerMessages.js";
import {
  OfferMessageSchema,
  AnswerMessageSchema,
  IceCandidateMessageSchema,
} from "./connectionMessages.js";
import {
  JoinRoomMessageSchema,
  RoomJoinedMessageSchema,
  RoomPeerJoinedMessageSchema,
  LeaveRoomMessageSchema,
  RoomLeftMessageSchema,
  RoomPeerLeftMessageSchema,
  RoomExpiredMessageSchema,
} from "./roomMessages.js";
import { ErrorMessageSchema } from "./serverMessages.js";

/**
 * Discriminated union of all valid signaling messages.
 *
 * Use this as the single entry point for parsing incoming WebSocket messages.
 * Every message type listed in {@link @riftsend/shared!SIGNALING_MESSAGE_TYPES}
 * must be represented here.
 */
export const SignalingMessageSchema = z.discriminatedUnion("type", [
  // Peer messages
  HelloMessageSchema,
  PeerIdMessageSchema,
  PeerErrorMessageSchema,
  OfferMessageSchema,
  AnswerMessageSchema,
  IceCandidateMessageSchema,

  // Room messages
  JoinRoomMessageSchema,
  RoomJoinedMessageSchema,
  RoomPeerJoinedMessageSchema,
  LeaveRoomMessageSchema,
  RoomLeftMessageSchema,
  RoomPeerLeftMessageSchema,
  RoomExpiredMessageSchema,

  // Server messages
  ErrorMessageSchema,
]);
export type SignalingMessage = z.infer<typeof SignalingMessageSchema>;
