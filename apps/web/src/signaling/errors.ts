export enum SignalingClientErrorCode {
  NOT_CONNECTED = "signaling_client.not_connected",
  NOT_JOINED = "signaling_client.not_joined",
  INVALID_SDP = "signaling_client.invalid_sdp",
  INVALID_ROOM_ID = "signaling_client.invalid_room_id",
  INVALID_JOIN_CODE = "signaling_client.invalid_join_code",
  INVALID_CANDIDATE = "signaling_client.invalid_candidate",
}

export class SignalingClientError extends Error {
  public constructor(
    public readonly code: SignalingClientErrorCode,
    public readonly operation: string,
    message: string,
  ) {
    super(message);

    this.name = "SignalingClientError";
  }
}
