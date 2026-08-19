import type { RequestId } from "./types.js";

export const createRequestId = (requestId: number): RequestId => {
  return requestId as RequestId;
};
