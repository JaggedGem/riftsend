import { type MessageId } from "./types.js";

export const createMessageId = (value: number): MessageId => {
  return value as MessageId;
};
