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
import {
  AuthedWebSocket,
  ErrorMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
  Room,
  RoomExpiredMessage,
  RoomJoinedMessage,
  RoomLeftMessage,
  RoomMember,
  RoomPeerEventMessage,
} from "../types.js";
import { ROOM_EXPIRE_TIME } from "@riftsend/shared";
import { logger } from "../logger.js";
import { peerMap } from "../peer.js";
import { safeSend } from "../utils.js";

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
    members: new Map(),
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

  if (room.members.size >= room.metadata.maxPeers) {
    logger.warn({ roomId, maxPeers: room.metadata.maxPeers }, "Room is full");
    return { success: false, code: SignalingErrorCode.ROOM_IS_FULL };
  }

  if (room.members.has(ws.peerId)) {
    logger.warn({ roomId, peerId: ws.peerId }, "Peer already in room");
    return { success: false, code: SignalingErrorCode.PEER_ALREADY_IN_ROOM };
  }

  room.members.set(ws.peerId, { peerId: ws.peerId, joinedAt: Date.now() });
  ws.roomId = roomId;

  notifyRoomMembersPeerEvent(room, ws.peerId, "joined");

  return { success: true };
};

const notifyRoomMembersPeerEvent = (
  room: Room,
  newPeerId: PeerId,
  event: "joined" | "left",
): void => {
  const messageType = event === "joined" ? "room-peer-joined" : "room-peer-left";

  const roomPeerEventMsg: RoomPeerEventMessage = {
    type: messageType,
    from: "server",
    payload: {
      roomId: room.roomCredentials.roomId,
      peerId: newPeerId,
    },
  };

  const serialized = JSON.stringify(roomPeerEventMsg);

  let notifiedCount = 0;
  for (const member of room.members.values()) {
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

  if (!room.members.delete(ws.peerId)) {
    return false;
  }
  ws.roomId = null;

  notifyRoomMembersPeerEvent(room, ws.peerId, "left");

  if (room.members.size === 0) {
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
  for (const member of room.members.values()) {
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

  const room = getRoom(roomId);
  if (!room) {
    logger.error({ roomId }, "Room disappeared between peer add and response");
    return;
  }

  const members = Array.from(room.members.values());

  const roomJoinedPayload = {
    method,
    roomId: method !== "code" ? room.roomCredentials.roomId : undefined,
    joinCode: method !== "id" ? room.roomCredentials.joinCode : undefined,
    members,
  };

  const roomJoinedMsg: RoomJoinedMessage = {
    type: "room-joined",
    from: "server",
    payload: roomJoinedPayload as RoomJoinedMessage["payload"],
  };

  safeSend(ws, JSON.stringify(roomJoinedMsg));
  logger.info({ roomId, peerId: ws.peerId }, "Peer joined room");
};

export const handleJoinRoomMessage = (ws: AuthedWebSocket, msg: JoinRoomMessage): void => {
  const { method } = msg.payload;

  switch (method) {
    case "id": {
      const { roomId } = msg.payload;
      handleJoinRoom(ws, "id", roomId);
      break;
    }
    case "code": {
      const { joinCode } = msg.payload;
      handleJoinRoom(ws, "code", undefined, joinCode);
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

      handleJoinRoom(ws, "create", room.roomCredentials.roomId);
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

  if (!removePeerFromRoom(ws.roomId, ws)) {
    logger.error({ roomId: ws.roomId, peerId: ws.peerId }, "Failed to remove peer from room");

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
      roomId: ws.roomId,
      peerId: ws.peerId,
    },
  };

  safeSend(ws, JSON.stringify(roomLeftMsg));
};
