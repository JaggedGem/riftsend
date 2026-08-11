import { type RequestId, OpfsSinkErrorCode } from "@riftsend/shared";

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
