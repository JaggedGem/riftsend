import { SIGNALING_MESSAGE_TYPES } from "./constants.js";

export type PeerId = string & { readonly __brand: unique symbol };
export type SessionToken = string & { readonly __brand: unique symbol };
export type RoomId = string & { readonly __brand: unique symbol };
export type JoinCode = string & { readonly __brand: unique symbol };

export interface RoomCredentials {
  roomId: RoomId;
  joinCode: JoinCode;
}

export type SignalingMessageTypes =
  (typeof SIGNALING_MESSAGE_TYPES)[keyof typeof SIGNALING_MESSAGE_TYPES];

export interface RoomMember {
  peerId: PeerId;
  name?: string;
  joinedAt: number;
}

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
