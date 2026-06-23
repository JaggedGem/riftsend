import { randomBytes } from "crypto";
import {
  NR_RANDOM_BYTES,
  ROOM_ID_PREFIX,
  ROOM_JOIN_CODE_LENGTH,
} from "./constants.js";
import type { RoomId, JoinCode } from "./types.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateRoomId = (): RoomId => {
  return `${ROOM_ID_PREFIX}${randomBytes(NR_RANDOM_BYTES).toString("base64url")}` as RoomId;
};

export const generateJoinCode = (length = ROOM_JOIN_CODE_LENGTH): JoinCode => {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError("Join code length must be a positive integer");
  }

  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("") as JoinCode;
};
