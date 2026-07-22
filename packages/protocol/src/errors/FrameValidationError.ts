export enum FrameValidationErrorCode {
  CHUNK_TOO_LARGE = "FRAME_CHUNK_TOO_LARGE",
  PROTOCOL_VERSION_INVALID = "FRAME_PROTOCOL_VERSION_INVALID",
  FILE_ID_INVALID = "FRAME_FILE_ID_INVALID",
  CHUNK_INDEX_INVALID = "FRAME_CHUNK_INDEX_INVALID",
}

export class FrameValidationError extends Error {
  constructor(
    public readonly code: FrameValidationErrorCode,
    message: string,
  ) {
    super(message);

    this.name = "FrameValidationError";
  }
}
