export enum FileTransferManagerErrorCode {
  UNKNOWN_ERROR = "TR_MGR_UNKNOWN_ERROR",
  FATAL_ERROR = "TR_MGR_FATAL_ERROR",
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
