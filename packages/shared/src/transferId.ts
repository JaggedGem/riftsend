import type { TransferId } from "./types.js";

export const createTransferId = (value: number): TransferId => {
  return value as TransferId;
};
