import type { MessageId } from "@riftsend/shared";

export enum ControlTransportErrorCode {
  TRANSPORT_DISPOSED = "control_transport.disposed",
  SEND_FAILED = "control_transport.send_failed",
  QUEUE_LIMIT_REACHED = "control_transport.queue_limit",
  SEND_FAILED_ON_RESEND = "control_transport.resend_failed",
  ACK_SEND_FAILED = "control_transport.ack_send_failed",
  PENDING_DISAPPEARED = "control_transport.pending_disappeared",
  MAX_RETRIES_EXCEEDED = "control_transport.max_retries",
  UNKNOWN_ERROR = "control_transport.unknown_error",
  INVALID_RELIABLE_MESSAGE = "control_transport.invalid_reliable_message",
}

export class ControlTransportError extends Error {
  public readonly messageId?: MessageId;

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
