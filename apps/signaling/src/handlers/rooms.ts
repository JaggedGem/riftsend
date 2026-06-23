import {
  generateJoinCode,
  generateRoomId,
  PeerId,
  RoomCredentials,
  RoomId,
} from "@riftsend/shared";
import { AuthedWebSocket, Room } from "../types.js";
import { ROOM_EXPIRE_TIME } from "@riftsend/shared";
import { logger } from "../logger.js";

const rooms = new Map<RoomId, Room>();

export const createRoom = (
  hostPeerId: PeerId,
  roomCredentials?: RoomCredentials,
): Room => {
  const roomId = roomCredentials?.roomId ?? generateRoomId();
  const roomJoinCode = roomCredentials?.joinCode ?? generateJoinCode();

  const now = Date.now();

  const room: Room = {
    roomCredentials: roomCredentials ?? { roomId, joinCode: roomJoinCode },
    hostPeerId,
    members: new Set<PeerId>([hostPeerId]),
    createdAt: now,
    expiresAt: now + ROOM_EXPIRE_TIME,
    metadata: {
      maxPeers: 2,
    },
  };

  rooms.set(roomId, room);

  return room;
};

export const getRoom = (roomId: RoomId): Room | undefined => {
  return rooms.get(roomId);
};

export const deleteRoom = (roomId: RoomId): boolean => {
  return rooms.delete(roomId);
};

export const addPeerToRoom = (roomId: RoomId, ws: AuthedWebSocket): boolean => {
  const room = rooms.get(roomId);
  if (!room) {
    return false;
  }

  try {
    room.members.add(ws.peerId);
    ws.roomId = roomId;
    return true;
  } catch (error) {
    logger.error({ roomId, peerId: ws.peerId }, "Failed to add peer to room");
    return false;
  }
};

export const removePeerFromRoom = (
  roomId: RoomId,
  ws: AuthedWebSocket,
): boolean => {
  const room = rooms.get(roomId);
  if (!room) {
    return false;
  }

  try {
    room.members.delete(ws.peerId);
    ws.roomId = null;
    return true;
  } catch (error) {
    logger.error(
      { roomId, peerId: ws.peerId },
      "Failed to remove peer from room",
    );
    return false;
  }
};
