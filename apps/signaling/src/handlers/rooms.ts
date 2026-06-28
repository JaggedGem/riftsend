import {
  generateJoinCode,
  generateRoomId,
  JoinCode,
  PeerId,
  RoomCredentials,
  RoomId,
  SignalingErrorCode,
  formatSignalingError,
} from "@riftsend/shared";
import { AuthedWebSocket } from "../types.js";
import { ROOM_EXPIRE_TIME, type Room } from "@riftsend/shared";
import { logger } from "../logger.js";
import { peerMap } from "../peer.js";
import { safeSend } from "../utils.js";
import {
  RoomExpiredMessage,
  RoomJoinedMessage,
  RoomLeftMessage,
  RoomPeerEventMessage,
  ErrorMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
} from "@riftsend/protocol";

const rooms = new Map<RoomId, Room>();
const joinCodeToRoomId = new Map<JoinCode, RoomId>();
const roomTimers = new Map<RoomId, ReturnType<typeof setTimeout>>();

const scheduleRoomExpiration = (roomId: RoomId): void => {
  const existing = roomTimers.get(roomId);
  if (existing) {
    clearTimeout(existing);
  }
  roomTimers.set(
    roomId,
    setTimeout(() => {
      handleRoomExpiration(roomId);
    }, ROOM_EXPIRE_TIME),
  );
  roomTimers.get(roomId)!.unref();
};

const clearRoomTimer = (roomId: RoomId): void => {
  const existing = roomTimers.get(roomId);
  if (existing) {
    clearTimeout(existing);
    roomTimers.delete(roomId);
  }
};

export const createRoom = (hostPeerId: PeerId, roomCredentials?: RoomCredentials): Room | null => {
  const roomId = roomCredentials?.roomId ?? generateRoomId();

  if (rooms.has(roomId)) {
    logger.warn({ roomId }, "Room ID collision, refusing to create");
    return null;
  }

  const roomJoinCode = roomCredentials?.joinCode ?? generateJoinCode();
  const now = Date.now();

  const room: Room = {
    roomCredentials: roomCredentials ?? { roomId, joinCode: roomJoinCode },
    hostPeerId,
    members: Object.create(null),
    createdAt: now,
    expiresAt: now + ROOM_EXPIRE_TIME,
    metadata: {
      maxPeers: 2,
    },
  };

  rooms.set(roomId, room);
  joinCodeToRoomId.set(roomJoinCode, roomId);
  scheduleRoomExpiration(roomId);

  return room;
};

export const getRoom = (roomId: RoomId): Room | undefined => {
  return rooms.get(roomId);
};

export const deleteRoom = (roomId: RoomId): boolean => {
  const room = rooms.get(roomId);
  if (room) {
    joinCodeToRoomId.delete(room.roomCredentials.joinCode);
  }
  clearRoomTimer(roomId);
  return rooms.delete(roomId);
};

type AddPeerToRoomResult =
  | {
      success: true;
      joinedAt: number;
    }
  | {
      success: false;
      code: SignalingErrorCode;
    };

export const addPeerToRoom = (roomId: RoomId, ws: AuthedWebSocket): AddPeerToRoomResult => {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, code: SignalingErrorCode.ROOM_NOT_FOUND };
  }

  if (Object.keys(room.members).length >= room.metadata.maxPeers) {
    logger.warn({ roomId, maxPeers: room.metadata.maxPeers }, "Room is full");
    return { success: false, code: SignalingErrorCode.ROOM_IS_FULL };
  }

  if (ws.peerId in room.members) {
    logger.warn({ roomId, peerId: ws.peerId }, "Peer already in room");
    return { success: false, code: SignalingErrorCode.PEER_ALREADY_IN_ROOM };
  }

  const joinedAt = Date.now();
  room.members[ws.peerId] = { peerId: ws.peerId, joinedAt };
  ws.roomId = roomId;

  notifyRoomMembersPeerEvent(room, ws.peerId, "joined", joinedAt);

  return { success: true, joinedAt };
};

const notifyRoomMembersPeerEvent = (
  room: Room,
  newPeerId: PeerId,
  event: "joined" | "left",
  timestamp: number,
): void => {
  const roomPeerEventMsg: RoomPeerEventMessage =
    event === "joined"
      ? {
          type: "room-peer-joined",
          from: "server",
          payload: {
            roomId: room.roomCredentials.roomId,
            peerId: newPeerId,
            joinedAt: timestamp,
          },
        }
      : {
          type: "room-peer-left",
          from: "server",
          payload: {
            roomId: room.roomCredentials.roomId,
            peerId: newPeerId,
            leftAt: timestamp,
          },
        };

  const serialized = JSON.stringify(roomPeerEventMsg);

  let notifiedCount = 0;
  for (const member of Object.values(room.members)) {
    if (member.peerId === newPeerId) {
      continue;
    }

    const ws = peerMap.get(member.peerId);
    if (ws) {
      safeSend(ws, serialized);
      notifiedCount++;
    }
  }

  logger.info(
    { roomId: room.roomCredentials.roomId, peerId: newPeerId, notifiedCount },
    `Notified ${notifiedCount} peer(s) of member ${event}`,
  );
};

export const removePeerFromRoom = (roomId: RoomId, ws: AuthedWebSocket): boolean => {
  const room = rooms.get(roomId);
  if (!room) {
    return false;
  }

  if (!(ws.peerId in room.members)) {
    return false;
  }
  ws.roomId = null;
  delete room.members[ws.peerId];

  notifyRoomMembersPeerEvent(room, ws.peerId, "left", Date.now());

  if (Object.keys(room.members).length === 0) {
    logger.info({ roomId }, "Room is empty, cleaning up");
    cleanupRoom(roomId);
  }

  return true;
};

const handleRoomExpiration = (roomId: RoomId): void => {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  const roomExpiredMsg: RoomExpiredMessage = {
    type: "room-expired",
    from: "server",
    payload: { roomId },
  };

  const serialized = JSON.stringify(roomExpiredMsg);

  let notifiedCount = 0;
  for (const member of Object.values(room.members)) {
    const ws = peerMap.get(member.peerId);
    if (ws) {
      ws.roomId = null;
      safeSend(ws, serialized);
      notifiedCount++;
    }

    logger.info({ roomId, peerId: member.peerId }, "Notified peer of room expiration");
  }

  logger.info({ roomId, notifiedCount }, "Room expired, cleaning up");
  cleanupRoom(roomId);
};

const cleanupRoom = (roomId: RoomId): void => {
  const room = rooms.get(roomId);
  if (room) {
    joinCodeToRoomId.delete(room.roomCredentials.joinCode);
  }
  clearRoomTimer(roomId);
  rooms.delete(roomId);
};

export const resetRoomState = (): void => {
  stopCleanupTimers();
  rooms.clear();
  joinCodeToRoomId.clear();
};

export const stopCleanupTimers = (): void => {
  for (const [roomId, timer] of roomTimers) {
    clearTimeout(timer);
    logger.info({ roomId }, "Cleared room expiration timer during shutdown");
  }
  roomTimers.clear();
};

const handleJoinRoom = (
  ws: AuthedWebSocket,
  method: "id" | "code" | "create",
  role: "sender" | "receiver",
  roomId?: RoomId,
  joinCode?: JoinCode,
): void => {
  if (method === "code" && joinCode && !roomId) {
    const foundRoomId = joinCodeToRoomId.get(joinCode);
    if (!foundRoomId) {
      logger.warn({ joinCode, peerId: ws.peerId }, "Join code not found, cannot join room");

      const errorMsg: ErrorMessage = {
        type: "error",
        from: "server",
        payload: { code: SignalingErrorCode.JOIN_CODE_NOT_FOUND },
      };

      safeSend(ws, JSON.stringify(errorMsg));
      return;
    }
    roomId = foundRoomId;
  }

  if (!roomId) {
    logger.warn({ peerId: ws.peerId }, "No room ID or join code provided, cannot join room");

    const errorMsg: ErrorMessage = {
      type: "error",
      from: "server",
      payload: { code: SignalingErrorCode.NO_ROOM_ID_OR_JOIN_CODE },
    };

    safeSend(ws, JSON.stringify(errorMsg));
    return;
  }

  const result = addPeerToRoom(roomId, ws);
  if (!result.success) {
    logger.warn(
      { roomId, peerId: ws.peerId },
      `Failed to add peer to room: ${formatSignalingError(result.code)}`,
    );

    const errorMsg: ErrorMessage = {
      type: "error",
      from: "server",
      payload: { code: result.code },
    };

    safeSend(ws, JSON.stringify(errorMsg));
    return;
  }

  ws.role = role;

  const room = getRoom(roomId);
  if (!room) {
    logger.error({ roomId }, "Room disappeared between peer add and response");
    return;
  }

  const roomJoinedPayload = {
    roomId: room.roomCredentials.roomId,
    joinCode: room.roomCredentials.joinCode,
    joinedAt: result.joinedAt,
    hostPeerId: room.hostPeerId,
    maxPeers: room.metadata.maxPeers,
    roomName: room.metadata.name,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    members: room.members,
  } satisfies RoomJoinedMessage["payload"];

  const roomJoinedMsg: RoomJoinedMessage = {
    type: "room-joined",
    from: "server",
    payload: roomJoinedPayload,
  };

  safeSend(ws, JSON.stringify(roomJoinedMsg));
  logger.info({ roomId, peerId: ws.peerId }, "Peer joined room");
};

export const handleJoinRoomMessage = (ws: AuthedWebSocket, msg: JoinRoomMessage): void => {
  const { method, role } = msg.payload;

  switch (method) {
    case "id": {
      const { roomId } = msg.payload;
      handleJoinRoom(ws, "id", role, roomId);
      break;
    }
    case "code": {
      const { joinCode } = msg.payload;
      handleJoinRoom(ws, "code", role, undefined, joinCode);
      break;
    }
    case "create": {
      const room = createRoom(ws.peerId);
      if (!room) {
        logger.error({ peerId: ws.peerId }, "Failed to create room due to ID collision");

        const errorMsg: ErrorMessage = {
          type: "error",
          from: "server",
          payload: { code: SignalingErrorCode.ROOM_ID_COLLISION },
        };

        safeSend(ws, JSON.stringify(errorMsg));
        return;
      }

      handleJoinRoom(ws, "create", role, room.roomCredentials.roomId);
      break;
    }
    default: {
      logger.warn({ method, peerId: ws.peerId }, "Unknown join-room method");

      const errorMsg: ErrorMessage = {
        type: "error",
        from: "server",
        payload: { code: SignalingErrorCode.UNKNOWN_JOIN_ROOM_METHOD },
      };

      safeSend(ws, JSON.stringify(errorMsg));
      break;
    }
  }
};

export const handleLeaveRoomMessage = (ws: AuthedWebSocket, msg: LeaveRoomMessage) => {
  if (!ws.roomId) {
    const errorMsg: ErrorMessage = {
      type: "error",
      from: "server",
      payload: {
        code: SignalingErrorCode.NOT_IN_A_ROOM,
      },
    };

    safeSend(ws, JSON.stringify(errorMsg));

    return;
  }

  const currentRoomId = ws.roomId;

  if (!removePeerFromRoom(currentRoomId, ws)) {
    logger.error({ roomId: currentRoomId, peerId: ws.peerId }, "Failed to remove peer from room");

    const errorMsg: ErrorMessage = {
      type: "error",
      from: "server",
      payload: {
        code: SignalingErrorCode.FAILED_TO_REMOVE_PEER_FROM_ROOM,
      },
    };

    safeSend(ws, JSON.stringify(errorMsg));
    return;
  }

  const roomLeftMsg: RoomLeftMessage = {
    type: "room-left",
    from: "server",
    payload: {
      roomId: currentRoomId,
      peerId: ws.peerId,
    },
  };

  safeSend(ws, JSON.stringify(roomLeftMsg));
};
