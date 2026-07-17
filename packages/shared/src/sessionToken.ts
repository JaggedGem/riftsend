import { SESSION_TOKEN_BYTES } from "./constants.js";
import { createRandomValues, toBase64Url } from "./crypto.js";
import type { SessionToken } from "./types.js";

/**
 * Generates an opaque {@link SessionToken} for session resumption.
 *
 * The token is a base64url encoding of 20 cryptographically-secure random
 * bytes. It is issued by the signaling server after the `hello` handshake and
 * can be presented on reconnect to restore the previous session state.
 */
export const generateSessionToken = (): SessionToken => {
  const bytes = createRandomValues(SESSION_TOKEN_BYTES);
  return toBase64Url(bytes) as SessionToken;
};
