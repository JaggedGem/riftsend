import { getRandomUUID } from "./crypto.js";
import type { FileId } from "./types.js";

export const getFileId = (): FileId => {
  return getRandomUUID() as FileId;
};
