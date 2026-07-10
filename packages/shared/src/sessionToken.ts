import { SESSION_TOKEN_BYTES } from "./constants.js";
import { createRandomValues, toBase64Url } from "./crypto.js";
import type { SessionToken } from "./types.js";

export const generateSessionToken = (): SessionToken => {
  const bytes = createRandomValues(SESSION_TOKEN_BYTES);
  return toBase64Url(bytes) as SessionToken;
};
