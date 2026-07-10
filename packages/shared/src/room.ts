import { createRandomValues, getRandomValues, toBase64Url } from "./crypto.js";
import {
  NR_RANDOM_BYTES,
  ROOM_ID_PREFIX,
  ROOM_JOIN_CODE_LENGTH,
} from "./constants.js";
import type { RoomId, JoinCode } from "./types.js";

/**
 * Unambiguous alphabet for human-readable join codes.
 *
 * Excludes visually confusable characters:
 * - `0`, `O` (zero vs oh)
 * - `1`, `I`, `L` (one vs eye vs ell)
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALPHABET_LEN = ALPHABET.length; // 24
// 256 / 24 = 10.66, so reject values >= 240 to avoid modulo bias
const MAX_SAFE_BYTE = 256 - (256 % ALPHABET_LEN);

/**
 * Generates a unique {@link RoomId}.
 *
 * Format: `room_` + base64url (12 random bytes).
 */
export const generateRoomId = (): RoomId => {
  const bytes = createRandomValues(NR_RANDOM_BYTES);
  return `${ROOM_ID_PREFIX}${toBase64Url(bytes)}` as RoomId;
};

/**
 * Generates a human-readable {@link JoinCode} using an unambiguous alphabet.
 *
 * Uses rejection sampling against a random byte pool to avoid modulo bias.
 * The pool is batched (at least 4× the code length) for efficiency.
 *
 * @param length - Number of characters in the code (default: {@link ROOM_JOIN_CODE_LENGTH}).
 * @throws {RangeError} If length is not a positive integer.
 */
export const generateJoinCode = (length = ROOM_JOIN_CODE_LENGTH): JoinCode => {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError("Join code length must be a positive integer");
  }

  const poolSize = Math.max(length * 4, 64);
  const pool = new Uint8Array(poolSize);
  let poolIndex = poolSize;

  const chars: string[] = new Array(length);
  for (let i = 0; i < length; i++) {
    let byte: number;
    do {
      if (poolIndex >= poolSize) {
        getRandomValues(pool);
        poolIndex = 0;
      }
      byte = pool[poolIndex++];
    } while (byte >= MAX_SAFE_BYTE);
    chars[i] = ALPHABET[byte % ALPHABET_LEN];
  }
  return chars.join("") as JoinCode;
};