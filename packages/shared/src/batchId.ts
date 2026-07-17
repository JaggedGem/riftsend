import { getRandomUUID } from "./crypto.js";
import type { BatchId } from "./types.js";

export const getBatchId = (): BatchId => {
  return getRandomUUID() as BatchId;
};
