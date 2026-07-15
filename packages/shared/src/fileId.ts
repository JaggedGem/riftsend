import { getRandomUUID } from "./crypto.js";
import { FileId } from "./types.js";

export const getFileId = (): FileId => {
  return getRandomUUID() as FileId;
};
