import type { MessageId } from "@riftsend/shared";

/**
 * Error codes for `ControlTransport`-related failures.
 *
 * Each code corresponds to a specific failure mode in the reliable
 * message delivery pipeline.
 */
export enum ControlTransportErrorCode {
  /** The transport has been disposed and can no longer send or receive messages. */
  TRANSPORT_DISPOSED = "control_transport.disposed",
  /** A message could not be sent because the underlying channel send failed. */
  SEND_FAILED = "control_transport.send_failed",
  /** A resend attempt for a reliable message failed at the channel level. */
  SEND_FAILED_ON_RESEND = "control_transport.resend_failed",
  /** An ACK message could not be sent to acknowledge receipt of a reliable message. */
  ACK_SEND_FAILED = "control_transport.ack_send_failed",
  /** A pending message disappeared from the map while a retry was in progress. */
  PENDING_DISAPPEARED = "control_transport.pending_disappeared",
  /** A reliable message exceeded the maximum number of retry attempts. */
  MAX_RETRIES_EXCEEDED = "control_transport.max_retries",
  /** An unexpected error occurred that does not map to a specific error code. */
  UNKNOWN_ERROR = "control_transport.unknown_error",
  /** A reliable message failed schema validation. */
  INVALID_RELIABLE_MESSAGE = "control_transport.invalid_reliable_message",
}

/**
 * Error thrown by `ControlTransport` for any transport-layer failure.
 *
 * Wraps the original cause (if any) and includes a machine-readable
 * `code` for programmatic error handling.
 */
export class ControlTransportError extends Error {
  /** The message ID associated with the error, if applicable. */
  public readonly messageId?: MessageId;

  /**
   * Creates a new `ControlTransportError`.
   *
   * @param code The machine-readable error code.
   * @param message A human-readable description of the error.
   * @param options Optional additional context.
   * @param options.messageId The ID of the message involved in the error.
   * @param options.cause The original error that caused this error, if any.
   */
  public constructor(
    public readonly code: ControlTransportErrorCode,
    message: string,
    options?: {
      messageId?: MessageId;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });

    this.name = "ControlTransportError";
    this.messageId = options?.messageId;
  }
}
