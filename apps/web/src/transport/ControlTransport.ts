import { type Config } from "@/config/config.js";
import {
  ReliableControlMessageSchema,
  type AckMessage,
  type ControlMessage,
  type ReliableControlMessage,
  type AnyControlMessage,
  type ReliableTypeName,
  reliableTypeNames,
  MessageIdSchema,
} from "@riftsend/protocol";
import { createMessageId, type MessageId } from "@riftsend/shared";
import { ControlTransportError, ControlTransportErrorCode } from "./errors.js";

type PendingMessage = {
  message: ReliableControlMessage;
  sentAt: DOMHighResTimeStamp;
  retryCount: number;
  nextRetryAt: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

const hasMessageId = (message: AnyControlMessage): message is ReliableControlMessage => {
  return "messageId" in message && MessageIdSchema.safeParse(message.messageId).success;
};

const stripMessageId = (message: ReliableControlMessage): ControlMessage => {
  const { messageId, ...rest } = message;

  return rest;
};

const isReliableMessage = (
  message: ControlMessage,
): message is Extract<ControlMessage, { type: ReliableTypeName }> => {
  return reliableTypeNames.has(message.type);
};

export class ControlTransport {
  private nextMessageId = createMessageId(0);
  private readonly pendingMessages = new Map<MessageId, PendingMessage>();
  private retryTimer: number | undefined = undefined;
  private isDisposed = false;
  private readonly seenMessageIds = new Set<MessageId>();

  constructor(
    private readonly config: Config,
    private readonly sendRaw: (message: unknown) => boolean,
    private readonly onMessage: (message: ControlMessage) => void,
  ) {
    this.scheduleCheck();
  }

  private scheduleCheck = () => {
    this.retryTimer = setTimeout(() => {
      this.checkPendingMessages();
      this.scheduleCheck();
    }, this.config.retryCheckInterval);
  };

  public send(message: ControlMessage) {
    if (isReliableMessage(message)) {
      return this.sendReliable(message);
    }

    if (!this.sendRaw(message)) {
      return Promise.reject(
        new ControlTransportError(
          ControlTransportErrorCode.SEND_FAILED,
          "An error occurred while sending a message through the channel",
        ),
      );
    }

    return Promise.resolve();
  }

  private sendReliable(
    message: Extract<ControlMessage, { type: ReliableTypeName }>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isDisposed) {
        reject(
          new ControlTransportError(
            ControlTransportErrorCode.TRANSPORT_DISPOSED,
            "Object is already disposed",
          ),
        );

        return;
      }

      if (this.pendingMessages.size >= this.config.maxPendingMessages) {
        reject(
          new ControlTransportError(
            ControlTransportErrorCode.QUEUE_LIMIT_REACHED,
            `Cannot send message: ${this.pendingMessages.size} messages already pending (max ${this.config.maxPendingMessages}). Retry shortly`,
          ),
        );

        return;
      }

      const messageId = this.nextMessageId;

      let reliableMessage: ReliableControlMessage;
      try {
        reliableMessage = ReliableControlMessageSchema.parse({
          ...message,
          messageId,
        });
      } catch (error) {
        reject(
          new ControlTransportError(
            ControlTransportErrorCode.INVALID_RELIABLE_MESSAGE,
            "The provided message is not a valid reliable control message",
            {
              cause:
                error instanceof Error
                  ? error
                  : new ControlTransportError(
                      ControlTransportErrorCode.UNKNOWN_ERROR,
                      "An unknown error occurred",
                    ),
            },
          ),
        );

        return;
      }

      this.nextMessageId = createMessageId(messageId + 1);

      const sentAt = performance.now();

      const pendingMessage: PendingMessage = {
        message: reliableMessage,
        sentAt,
        retryCount: 0,
        nextRetryAt: sentAt + this.config.ackTimeout,
        resolve,
        reject,
      };

      this.pendingMessages.set(messageId, pendingMessage);

      if (!this.sendRaw(reliableMessage)) {
        this.pendingMessages.delete(messageId);

        reject(
          new ControlTransportError(
            ControlTransportErrorCode.SEND_FAILED,
            "An error occurred while sending a reliable message through the channel",
            { messageId },
          ),
        );

        return;
      }
    });
  }

  private handleAckMessage(message: AckMessage) {
    const acknowledgedMessage = this.pendingMessages.get(message.acknowledgedMessageId);

    if (!acknowledgedMessage) {
      console.warn("Couldn't find the pending message the ACK message was acknowledging");
      return;
    }

    acknowledgedMessage.resolve();

    if (!this.pendingMessages.delete(message.acknowledgedMessageId)) {
      console.warn("The message id provided was not found as a pending message");
      return;
    }
  }

  private checkPendingMessages() {
    const now = performance.now();

    this.pendingMessages.forEach((pendingMessage, messageId) => {
      if (now >= pendingMessage.nextRetryAt) {
        if (pendingMessage.retryCount + 1 > this.config.maxRetries) {
          this.pendingMessages.delete(messageId);

          const error = new ControlTransportError(
            ControlTransportErrorCode.MAX_RETRIES_EXCEEDED,
            `Sending the message ${messageId} failed after ${this.config.maxRetries}`,
            { messageId },
          );

          pendingMessage.reject(error);

          return;
        }

        try {
          this.retrySend(messageId);
        } catch (error) {
          pendingMessage.reject(
            error instanceof ControlTransportError
              ? error
              : new ControlTransportError(
                  ControlTransportErrorCode.UNKNOWN_ERROR,
                  "An unknown error occurred",
                ),
          );

          return;
        }
      }
    });
  }

  private retrySend(messageId: MessageId) {
    const pendingMessage = this.pendingMessages.get(messageId);

    if (!pendingMessage) {
      throw new ControlTransportError(
        ControlTransportErrorCode.PENDING_DISAPPEARED,
        "The pending message disappeared while trying to resend it",
        { messageId },
      );
    }

    const nextRetryDelay = this.config.ackTimeout * 2 ** (pendingMessage.retryCount + 1);

    this.pendingMessages.set(messageId, {
      ...pendingMessage,
      retryCount: pendingMessage.retryCount + 1,
      nextRetryAt: performance.now() + Math.min(nextRetryDelay, this.config.maxRetryDelay),
    });

    if (!this.sendRaw(pendingMessage.message)) {
      this.pendingMessages.delete(messageId);

      throw new ControlTransportError(
        ControlTransportErrorCode.SEND_FAILED_ON_RESEND,
        "An error occurred while resending a reliable message through the control data channel",
        { messageId },
      );
    }
  }

  public handleMessage = (message: AnyControlMessage) => {
    if (this.isDisposed) {
      throw new ControlTransportError(
        ControlTransportErrorCode.TRANSPORT_DISPOSED,
        "Object is already disposed",
      );
    }

    if (message.type === "ack") {
      this.handleAckMessage(message);
      return;
    }

    if (hasMessageId(message)) {
      this.handleReliableMessage(message);
    } else {
      this.onMessage(message);
    }
  };

  private handleReliableMessage(message: ReliableControlMessage) {
    if (this.seenMessageIds.has(message.messageId)) {
      return;
    }

    this.sendAckMessage(message.messageId);

    this.seenMessageIds.add(message.messageId);

    this.onMessage(stripMessageId(message));
  }

  private sendAckMessage(acknowledgedMessageId: MessageId) {
    const ackMessage: AckMessage = {
      type: "ack",
      protocolVersion: this.config.protocolVersion,
      acknowledgedMessageId,
    };

    if (!this.sendRaw(ackMessage)) {
      throw new ControlTransportError(
        ControlTransportErrorCode.ACK_SEND_FAILED,
        `Could not send ACK message for ${acknowledgedMessageId}`,
        { messageId: acknowledgedMessageId },
      );
    }
  }

  public dispose() {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    clearTimeout(this.retryTimer);

    this.pendingMessages.forEach((pendingMessage) => {
      pendingMessage.reject(
        new ControlTransportError(
          ControlTransportErrorCode.TRANSPORT_DISPOSED,
          "Transport disposed before the ACK was received",
        ),
      );
    });

    this.pendingMessages.clear();
  }
}
