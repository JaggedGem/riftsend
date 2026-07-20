import { getConfig } from "@/config/config";
import {
  ReliableControlMessageSchema,
  type AckMessage,
  type ControlMessage,
  type ReliableControlMessage,
  type AnyControlMessage,
  type ProtocolVersion,
} from "@riftsend/protocol";
import { createMessageId, type MessageId } from "@riftsend/shared";

type PendingMessage = {
  message: ReliableControlMessage;
  sentAt: DOMHighResTimeStamp;
  retryCount: number;
  nextRetryAt: number;
  resolve?: (value: MessageId) => void;
  reject?: (error: Error) => void;
};

const hasMessageId = (message: AnyControlMessage): message is ReliableControlMessage => {
  return "messageId" in message;
};

const stripMessageId = (message: ReliableControlMessage): ControlMessage => {
  const { messageId, ...rest } = message;
  return rest as ControlMessage;
};

export class ControlTransport {
  private readonly config;
  private nextMessageId = createMessageId(0);
  private readonly pendingMessages = new Map<MessageId, PendingMessage>();
  private retryTimer: number | undefined = undefined;

  constructor(
    private readonly protocolVersion: ProtocolVersion,
    private readonly sendRaw: (message: unknown) => boolean,
    private readonly onMessage: (message: ControlMessage) => void,
  ) {
    this.config = getConfig();
  }

  public async sendReliable<T extends ControlMessage>(message: T) {
    const messageId = this.nextMessageId;

    const reliableMessage = ReliableControlMessageSchema.parse({
      ...message,
      messageId,
    });

    this.nextMessageId = createMessageId(messageId + 1);

    const sentAt = performance.now();

    const wasEmpty = this.pendingMessages.size === 0;

    const pendingMessage: PendingMessage = {
      message: reliableMessage,
      sentAt,
      retryCount: 0,
      nextRetryAt: sentAt + this.config.ackTimeout,
    };

    this.pendingMessages.set(messageId, pendingMessage);

    if (!this.sendRaw(reliableMessage)) {
      this.pendingMessages.delete(messageId);

      throw new Error("Error occured while sending reliable message through the channel");
    }

    return new Promise<MessageId>((resolve, reject) => {
      this.pendingMessages.set(messageId, {
        ...pendingMessage,
        resolve,
        reject,
      });

      if (wasEmpty) {
        this.retryTimer = setInterval(this.checkPendingMessages, this.config.retryCheckInterval);
      }
    });
  }

  public handleAckMessage(message: AckMessage) {
    if (!this.pendingMessages.delete(message.acknowledgedMessageId)) {
      console.warn("The message id provided was not found as a pending message");
      return;
    }

    if (this.pendingMessages.size === 0) {
      clearInterval(this.retryTimer);
    }
  }

  private checkPendingMessages() {
    const now = Date.now();

    this.pendingMessages.forEach((pendingMessage, messageId) => {
      if (now >= pendingMessage.nextRetryAt) {
        if (pendingMessage.retryCount + 1 > this.config.maxRetries) {
          this.pendingMessages.delete(messageId);

          throw new Error(
            `Sending the message ${messageId} failed after ${this.config.maxRetries}`,
          );
        }

        this.retrySend(messageId);
      }
    });
  }

  private retrySend(messageId: MessageId) {
    const pendingMessage = this.pendingMessages.get(messageId);

    if (!pendingMessage) {
      throw new Error("Pending message dissapeared while trying to resend it");
    }

    const nextRetryDelay = this.config.ackTimeout * 2 ** (pendingMessage.retryCount + 1);

    this.pendingMessages.set(messageId, {
      ...pendingMessage,
      retryCount: pendingMessage.retryCount + 1,
      nextRetryAt: performance.now() + Math.min(nextRetryDelay, this.config.maxRetryDelay),
    });

    if (!this.sendRaw(pendingMessage.message)) {
      this.pendingMessages.delete(messageId);

      throw new Error("Error occured while resending reliable message through the channel");
    }
  }

  public handleMessage(message: AnyControlMessage) {
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
    this.sendAckMessage(message.messageId);

    this.onMessage(stripMessageId(message));
  }

  private sendAckMessage(acknowledgedMessageId: MessageId) {
    const ackMessage: AckMessage = {
      type: "ack",
      protocolVersion: this.protocolVersion,
      acknowledgedMessageId,
    };

    if (!this.sendRaw(ackMessage)) {
      throw new Error("Could not send ACK message for " + acknowledgedMessageId);
    }
  }
}
