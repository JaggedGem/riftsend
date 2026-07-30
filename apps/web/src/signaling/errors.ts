export enum SignalingClientErrorCode {
  NOT_CONNECTED = "signaling_client.not_connected",
  NOT_JOINED = "signaling_client.not_joined",
  INVALID_SDP = "signaling_client.invalid_sdp",
  INVALID_ROOM_ID = "signaling_client.invalid_room_id",
  INVALID_JOIN_CODE = "signaling_client.invalid_join_code",
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
