export enum SignalingClientErrorCode {
  NOT_CONNECTED = "SIG_NOT_CONNECTED",
  NOT_JOINED = "SIG_NOT_JOINED",
  INVALID_SDP = "SIG_INVALID_SDP",
  INVALID_ROOM_ID = "SIG_INVALID_ROOM_ID",
  INVALID_JOIN_CODE = "SIG_INVALID_JOIN_CODE",
}

export class SignalingClientError extends Error {
  constructor(
    public readonly code: SignalingClientErrorCode,
    public readonly method: string,
    message: string,
  ) {
    super(message);

    this.name = "SignalingClientError";
  }
}
