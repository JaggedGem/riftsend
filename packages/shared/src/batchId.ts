import { getRandomUUID } from "./crypto.js";
import { BatchId } from "./types.js";

export const getBatchId = (): BatchId => {
  return getRandomUUID() as BatchId;
};
