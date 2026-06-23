import {
  generateJoinCode,
  generateRoomId,
  PeerId,
  RoomCredentials,
  RoomId,
} from "@riftsend/shared";
import { AuthedWebSocket, Room, RoomExpiredMessage } from "../types.js";
import { ROOM_EXPIRE_TIME } from "@riftsend/shared";
import { logger } from "../logger.js";
import { peerMap } from "../peer.js";

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

const cleanupExpiredRooms = () => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (room.expiresAt <= now) {
      logger.info({ roomId }, "Cleaning up expired room");
      handleRoomExpiration(roomId);
    }
  }
};

// Run cleanup every 15 minutes
setInterval(cleanupExpiredRooms, 15 * 60 * 1000);

const handleRoomExpiration = (roomId: RoomId) => {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  for (const peerId of room.members) {
    const ws = peerMap.get(peerId);
    if (ws) {
      ws.roomId = null;

      const roomExpiredMsg: RoomExpiredMessage = {
        type: "room-expired",
        from: "server",
        payload: { roomId },
      };

      ws.send(JSON.stringify(roomExpiredMsg));
    }

    logger.info({ roomId, peerId }, "Notified peer of room expiration");
  }

  rooms.delete(roomId);
};
