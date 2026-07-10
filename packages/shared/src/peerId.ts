import { NR_RANDOM_BYTES, PEER_ID_PREFIX } from "./constants.js";
import { createRandomValues, toBase64Url } from "./crypto.js";
import type { PeerId } from "./types.js";

export const generatePeerId = (): PeerId => {
  const bytes = createRandomValues(NR_RANDOM_BYTES);
  const encoded = toBase64Url(bytes);
  return (PEER_ID_PREFIX + encoded) as PeerId;
};
