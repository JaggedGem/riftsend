import { NR_RANDOM_BYTES, PEER_ID_PREFIX } from "./constants.js";
import { randomBytes } from "crypto";
import type { PeerId } from "./types.js";

export function generatePeerId(): PeerId {
  const bytes = randomBytes(NR_RANDOM_BYTES);
  const encoded = bytes.toString("base64url");
  return (PEER_ID_PREFIX + encoded) as PeerId;
}
