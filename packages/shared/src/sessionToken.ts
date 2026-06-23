import { randomBytes } from "crypto";
import { SESSION_TOKEN_BYTES } from "./constants.js";
import type { SessionToken } from "./types.js";

export function generateSessionToken(): SessionToken {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url") as SessionToken;
}
