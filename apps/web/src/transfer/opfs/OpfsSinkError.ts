import type { RequestId } from "./OpfsWorkerClient";

export enum OpfsSinkErrorCode {
  // Worker errors
  WORKER_ALREADY_INITIALIZED = "opfs_sink.worker_already_initialized",
  WORKER_NOT_INITIALIZED = "opfs_sink.worker_not_initialized",
  SHORT_WRITE = "opfs_sink.short_write",
  SHORT_READ = "opfs_sink.short_read",
  INVALID_READ_RANGE = "opfs_sink.invalid_read_range",
  INITIALIZATION_FAILED = "opfs_sink.initialization_failed",
  DELETE_FAILED = "opfs_sink.delete_failed",
  WORKER_NOT_READY = "opfs_sink.worker_not_ready",
  WRITE_FAILED = "opfs_sink.write_failed",
  READ_FAILED = "opfs_sink.read_failed",

  // Client errors
  CLIENT_NOT_READY = "opfs_sink.client_not_ready",
  INVALID_WORKER_RESPONSE = "opfs_sink.invalid_worker_response",
  CLIENT_INITIALIZATION_REQUEST_MISMATCH = "opfs_sink.initialization_request_mismatch",
  CLIENT_INVALID_STATE = "opfs_sink.client_invalid_state",
  CLIENT_REQUEST_NOT_FOUND = "opfs_sink.request_not_found",
  CLIENT_REQUEST_DELETE_FAILED = "opfs_sink.request_delete_failed",
  UNKNOWN_ERROR = "opfs_sink.unknown_error",
  CLIENT_DISPOSED = "opfs_sink.client_disposed",
}

export class OpfsSinkError extends Error {
  /** The request ID associated with the error, if applicable. */
  public readonly requestId?: RequestId;

  /**
   * Creates a new `OpfsSinkError`.
   *
   * @param code The machine-readable error code.
   * @param message A human-readable description of the error.
   * @param options Optional additional context.
   * @param options.requestId The ID of the request involved in the error.
   * @param options.cause The original error that caused this error, if any.
   */
  public constructor(
    public readonly code: OpfsSinkErrorCode,
    message: string,
    options?: {
      requestId?: RequestId;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });

    this.name = "OpfsSinkError";
    this.requestId = options?.requestId;
  }
}
