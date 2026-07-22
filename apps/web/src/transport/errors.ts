import type { MessageId } from "@riftsend/shared";

export enum ControlTransportErrorCode {
  TRANSPORT_DISPOSED = "CTRL_DISPOSED",
  SEND_FAILED = "CTRL_SEND_FAILED",
  QUEUE_LIMIT_REACHED = "CTRL_QUEUE_LIMIT",
  SEND_FAILED_ON_RESEND = "CTRL_RESEND_FAILED",
  ACK_SEND_FAILED = "CTRL_ACK_SEND_FAILED",
  PENDING_DISAPPEARED = "CTRL_PENDING_DISAPPEARED",
  MAX_RETRIES_EXCEEDED = "CTRL_MAX_RETRIES",
  UNKNOWN_ERROR = "CTRL_UNKNOWN_ERROR",
  INVALID_RELIABLE_MESSAGE = "CTRL_INVALID_RELIABLE_MESSAGE",
}

export class ControlTransportError extends Error {
  public readonly messageId?: MessageId;

  constructor(
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
