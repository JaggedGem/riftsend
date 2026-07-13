import { NR_RANDOM_BYTES, PEER_ID_PREFIX } from "./constants.js";
import { createRandomValues, toBase64Url } from "./crypto.js";
import type { PeerId } from "./types.js";

/**
 * Generates a unique, unpredictable {@link PeerId}.
 *
 * The ID is composed of a constant prefix followed by a base64url encoding of
 * 12 cryptographically-secure random bytes.
 */
export const generatePeerId = (): PeerId => {
  const bytes = createRandomValues(NR_RANDOM_BYTES);
  const encoded = toBase64Url(bytes);
  return (PEER_ID_PREFIX + encoded) as PeerId;
};