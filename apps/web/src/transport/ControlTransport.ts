import { type Config } from "@/config/config";
import {
  ReliableControlMessageSchema,
  type AckMessage,
  type ControlMessage,
  type ReliableControlMessage,
  type AnyControlMessage,
  type ReliableTypeName,
  reliableTypeNames,
} from "@riftsend/protocol";
import { createMessageId, type MessageId } from "@riftsend/shared";

type PendingMessage = {
  message: ReliableControlMessage;
  sentAt: DOMHighResTimeStamp;
  retryCount: number;
  nextRetryAt: number;
  resolve: (value: MessageId) => void;
  reject: (error: Error) => void;
};

const hasMessageId = (message: AnyControlMessage): message is ReliableControlMessage => {
  return "messageId" in message;
};

const stripMessageId = (message: ReliableControlMessage): ControlMessage => {
  const { messageId, ...rest } = message;
  return rest as ControlMessage;
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

  public send(message: Extract<ControlMessage, { type: ReliableTypeName }>): Promise<MessageId>;
  public send(message: Exclude<ControlMessage, { type: ReliableTypeName }>): boolean;
  public send(message: ControlMessage): Promise<MessageId> | boolean {
    if (isReliableMessage(message)) {
      return this.sendReliable(message);
    }
    return this.sendRaw(message);
  }

  private sendReliable(
    message: Extract<ControlMessage, { type: ReliableTypeName }>,
  ): Promise<MessageId> {
    if (this.isDisposed) {
      return new Promise<MessageId>((_resolve, reject) =>
        reject(new Error("Object is already disposed")),
      );
    }

    if (this.pendingMessages.size >= this.config.maxPendingMessages) {
      return new Promise<MessageId>((_resolve, reject) =>
        reject(
          new Error(
            `Cannot send message: ${this.pendingMessages.size} messages already pending (max ${this.config.maxPendingMessages}). Retry shortly`,
          ),
        ),
      );
    }

    const messageId = this.nextMessageId;
    let resolve!: (value: MessageId) => void;
    let reject!: (error: Error) => void;

    const reliableMessage = ReliableControlMessageSchema.parse({
      ...message,
      messageId,
    });

    this.nextMessageId = createMessageId(messageId + 1);

    const sentAt = performance.now();

    const promise = new Promise<MessageId>((res, rej) => {
      resolve = res;
      reject = rej;
    });

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

      throw new Error("Error occurred while sending reliable message through the channel");
    }

    return promise;
  }

  private handleAckMessage(message: AckMessage) {
    const acknowledgedMessage = this.pendingMessages.get(message.acknowledgedMessageId);

    if (!acknowledgedMessage) {
      console.warn("Couldn't find the pending message the ACK message was acknowledging");
      return;
    }

    acknowledgedMessage.resolve(message.acknowledgedMessageId);

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

          const error = new Error(
            `Sending the message ${messageId} failed after ${this.config.maxRetries}`,
          );

          pendingMessage.reject(error);
        }

        try {
          this.retrySend(messageId);
        } catch (error) {
          if (error instanceof Error) {
            pendingMessage.reject(error);
          } else {
            pendingMessage.reject(new Error("An unknown error occurred"));
          }
        }
      }
    });
  }

  private retrySend(messageId: MessageId) {
    const pendingMessage = this.pendingMessages.get(messageId);

    if (!pendingMessage) {
      throw new Error("Pending message disappeared while trying to resend it");
    }

    const nextRetryDelay = this.config.ackTimeout * 2 ** (pendingMessage.retryCount + 1);

    this.pendingMessages.set(messageId, {
      ...pendingMessage,
      retryCount: pendingMessage.retryCount + 1,
      nextRetryAt: performance.now() + Math.min(nextRetryDelay, this.config.maxRetryDelay),
    });

    if (!this.sendRaw(pendingMessage.message)) {
      this.pendingMessages.delete(messageId);

      throw new Error("Error occurred while resending reliable message through the channel");
    }
  }

  public handleMessage(message: AnyControlMessage) {
    if (this.isDisposed) {
      throw new Error("Object is already disposed");
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
  }

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
      throw new Error("Could not send ACK message for " + acknowledgedMessageId);
    }
  }

  public dispose() {
    if (this.isDisposed) {
      return;
    }

    clearTimeout(this.retryTimer);

    this.pendingMessages.forEach((pendingMessage) => {
      pendingMessage.reject(new Error("Transport disposed before the ACK was received"));
    });

    this.pendingMessages.clear();
  }
}
