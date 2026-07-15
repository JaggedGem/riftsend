import { SIGNALING_MESSAGE_TYPES } from "./constants.js";

/**
 * Branded string representing a unique peer identifier.
 *
 * Format: `peer_` + base64url (12 random bytes).
 * Created via {@link generatePeerId} and validated server-side via {@link PeerIdZod}.
 */
export type PeerId = string & { readonly __brand: unique symbol };

/**
 * Branded string representing an opaque session token issued after a `hello` handshake.
 *
 * Used to resume a previous session when reconnecting.
 */
export type SessionToken = string & { readonly __brand: unique symbol };

/**
 * Branded string representing a room identifier.
 *
 * Format: `room_` + base64url (12 random bytes).
 */
export type RoomId = string & { readonly __brand: unique symbol };

/**
 * Branded string representing a short human-readable room join code.
 *
 * Generated from a 24-character unambiguous alphabet (no 0/O/1/I/L).
 * Format: 6 uppercase alphanumeric characters (e.g. `AB12-CD` is not valid;
 * join codes have no separator — that is a UI concern).
 */
export type JoinCode = string & { readonly __brand: unique symbol };

/**
 * Branded string representing a file id internally.
 *
 * It is a simple UUID v4
 */
export type FileId = string & { readonly __brand: unique symbol };

/**
 * Branded string representing a batch id internally.
 *
 * It is a simple UUID v4
 */
export type BatchId = string & { readonly __brand: unique symbol };

/**
 * Credentials needed to locate a room on the signaling server.
 */
export interface RoomCredentials {
  roomId: RoomId;
  joinCode: JoinCode;
}

/**
 * Union of all valid signaling message type strings.
 *
 * Derived from the {@link SIGNALING_MESSAGE_TYPES} constant object.
 */
export type SignalingMessageTypes =
  (typeof SIGNALING_MESSAGE_TYPES)[keyof typeof SIGNALING_MESSAGE_TYPES];

/**
 * Metadata about a single peer within a room.
 */
export interface RoomMember {
  peerId: PeerId;
  name?: string;
  joinedAt: number;
}

/**
 * Full room state as known to a connected client.
 *
 * This is reconstructed on the client side from the `room-joined` signaling
 * message and kept up-to-date via `room-peer-joined` / `room-peer-left` events.
 */
export interface Room {
  roomCredentials: RoomCredentials;
  hostPeerId: PeerId;
  members: Record<PeerId, RoomMember>;
  createdAt: number;
  expiresAt: number;
  metadata: {
    name?: string;
    maxPeers: number;
  };
}
