export enum FileTransferManagerErrorCode {
  UNKNOWN_ERROR = "TR_MGR_UNKNOWN_ERROR",
  FATAL_ERROR = "TR_MGR_FATAL_ERROR",
  UNKNOWN_BATCH = "TR_MGR_UNKNOWN_BATCH",
  UNKNOWN_FILE_ID = "TR_MGR_UNKNOWN_FILE_ID",
  UNSUPPORTED_MESSAGE = "TR_MGR_UNSUPPORTED_MESSAGE",
}

export class FileTransferManagerError extends Error {
  constructor(
    public readonly code: FileTransferManagerErrorCode,
    message: string,
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });

    this.name = "FileTransferManagerError";
  }
}
