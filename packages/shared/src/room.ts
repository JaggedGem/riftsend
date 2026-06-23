import { randomBytes } from "crypto";
import {
  NR_RANDOM_BYTES,
  ROOM_ID_PREFIX,
  ROOM_JOIN_CODE_LENGTH,
} from "./constants.js";
import type { RoomId, JoinCode } from "./types.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALPHABET_LEN = ALPHABET.length; // 24
// 256 / 24 = 10.66, so reject values >= 240 to avoid modulo bias
const MAX_SAFE_BYTE = 256 - (256 % ALPHABET_LEN);

export const generateRoomId = (): RoomId => {
  return `${ROOM_ID_PREFIX}${randomBytes(NR_RANDOM_BYTES).toString("base64url")}` as RoomId;
};

export const generateJoinCode = (length = ROOM_JOIN_CODE_LENGTH): JoinCode => {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError("Join code length must be a positive integer");
  }

  const bytes = randomBytes(length);
  const chars: string[] = new Array(length);
  for (let i = 0; i < length; i++) {
    let byte: number;
    do {
      byte = randomBytes(1)[0];
    } while (byte >= MAX_SAFE_BYTE);
    chars[i] = ALPHABET[byte % ALPHABET_LEN];
  }
  return chars.join("") as JoinCode;
};
