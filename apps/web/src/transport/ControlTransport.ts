import {
  getProtocolConfig,
  getReliableTransportConfig,
  type ReliableTransportConfig,
} from "@/config/config.js";
import {
  ReliableControlMessageSchema,
  type AckMessage,
  type ControlMessage,
  type ReliableControlMessage,
  type AnyControlMessage,
  type ReliableTypeName,
  reliableTypeNames,
  MessageIdSchema,
  type ProtocolVersion,
} from "@riftsend/protocol";
import { createMessageId, type MessageId } from "@riftsend/shared";
import { ControlTransportError, ControlTransportErrorCode } from "./ControlTransportErrors.js";

/**
 * Represents a reliable control message that is awaiting acknowledgment.
 *
 * Stores the message along with metadata needed for retry tracking and
 * promise resolution. The timestamp fields (`firstSentAt`, `lastSentAt`,
 * `nextRetryAt`) start as `undefined` and are populated asynchronously
 * once the underlying `sendRaw` promise resolves.
 */
type PendingMessage = {
  /** The reliable control message that was sent and is awaiting an ACK. */
  message: ReliableControlMessage;

  // todo: implement statistics
  /** The high-resolution timestamp (from `performance.now()`) when the message was first sent, or `undefined` until `sendRaw` resolves. */
  firstSentAt: DOMHighResTimeStamp | undefined;
  /** The high-resolution timestamp (from `performance.now()`) when the message was last sent (including retries), or `undefined` until `sendRaw` resolves. */
  lastSentAt: DOMHighResTimeStamp | undefined;
  /** The number of times this message has been retried so far. */
  retryCount: number;
  /** The timestamp at which the next retry attempt is allowed, or `undefined` until `sendRaw` resolves. */
  nextRetryAt: number | undefined;
  /** Resolves the promise associated with sending this message, called when the ACK is received. */
  resolve: () => void;
  /** Rejects the promise associated with sending this message, called when the message fails or is discarded. */
  reject: (error: Error) => void;
};

/**
 * Type guard that checks whether a control message carries a valid `messageId`.
 *
 * @param message The message to check.
 * @returns `true` if the message has a `messageId` property that passes `MessageIdSchema` validation.
 */
const hasMessageId = (message: AnyControlMessage): message is ReliableControlMessage => {
  return "messageId" in message && MessageIdSchema.safeParse(message.messageId).success;
};

/**
 * Strips the `messageId` field from a reliable control message, returning
 * a plain `ControlMessage`.
 *
 * @param message The reliable control message to strip.
 * @returns The same message without the `messageId` field.
 */
const stripMessageId = (message: ReliableControlMessage): ControlMessage => {
  const { messageId, ...rest } = message;

  return rest;
};

/**
 * Type guard that checks whether a control message is a reliable message
 * (i.e., its `type` is in the set of reliable type names).
 *
 * @param message The message to check.
 * @returns `true` if the message type is a reliable type.
 */
const isReliableMessage = (
  message: ControlMessage,
): message is Extract<ControlMessage, { type: ReliableTypeName }> => {
  return reliableTypeNames.has(message.type);
};

/**
 * Transport layer for sending and receiving control messages over a data channel.
 *
 * Handles both reliable and unreliable control messages. Reliable messages are
 * sent with retry logic and ACK-based confirmation. Unreliable messages are
 * sent once and fire-and-forget.
 *
 * The transport runs a periodic retry check timer that re-sends unacknowledged
 * reliable messages until they succeed, exceed the maximum retry count, or the
 * transport is disposed.
 */
export class ControlTransport {
  /** Monotonically increasing message ID generator for reliable messages. */
  private nextMessageId = createMessageId(0);
  /** Map of pending reliable messages keyed by their `messageId`, awaiting ACK acknowledgment. */
  private readonly pendingMessages = new Map<MessageId, PendingMessage>();
  /** Timer ID for the periodic retry check interval. */
  private retryTimer: number | undefined = undefined;
  /** Flag indicating whether the transport has been disposed. */
  private isDisposed = false;

  // todo: prune the set
  /** Set of message IDs that have already been seen (to deduplicate incoming reliable messages). */
  private readonly seenMessageIds = new Set<MessageId>();

  private readonly config: ReliableTransportConfig;

  private readonly protocolVersion: ProtocolVersion;

  private readonly capacityWaiters: Array<{
    resolve: () => void;
    reject: (reason: unknown) => void;
  }> = [];

  /**
   * Creates a new `ControlTransport` instance.
   *
   * Starts the internal retry check timer immediately upon construction.
   *
   * @param config Application configuration containing retry/timeout tuning values.
   * @param sendRaw Function that sends a raw message over the underlying channel.
   *   Returns a promise that resolves if the message was sent successfully (after waiting for the buffer to drain),
   *   or rejects if an error has occurred.
   * @param onMessage Callback invoked when a non-reliable control message is received,
   *   or when a reliable message's ACK has been processed and the original message is
   *   forwarded for application handling.
   */
  public constructor(
    private readonly sendRaw: (message: unknown) => Promise<void>,
    private readonly onMessage: (message: ControlMessage) => void,
  ) {
    this.config = getReliableTransportConfig();
    this.protocolVersion = getProtocolConfig().protocolVersion;

    this.scheduleCheck();
  }

  /**
   * Schedules the next periodic check of pending messages for retry.
   *
   * Uses `retryCheckInterval` from the configuration to determine the delay
   * between checks. This method is called recursively via `setTimeout` to
   * create a repeating check loop.
   */
  private scheduleCheck = () => {
    this.retryTimer = setTimeout(() => {
      this.checkPendingMessages();
      this.scheduleCheck();
    }, this.config.retryCheckInterval);
  };

  /**
   * Sends a control message over the underlying channel.
   *
   * Reliable messages go through `sendReliable` which adds retry and ACK
   * tracking. Unreliable messages are sent directly via `sendRaw`.
   *
   * @param message The control message to send.
   * @returns A promise that resolves when the message has been sent, or rejects
   *   if the send fails.
   * @throws {ControlTransportError} With code `SEND_FAILED` if the underlying
   *   `sendRaw` call throws or rejects.
   */
  public async send(message: ControlMessage) {
    try {
      if (isReliableMessage(message)) {
        await this.sendReliable(message);

        return;
      }

      await this.sendRaw(message);
    } catch (error) {
      throw new ControlTransportError(
        ControlTransportErrorCode.SEND_FAILED,
        "An error occurred while sending a message through the channel",
        { cause: error },
      );
    }
  }

  /**
   * Sends a reliable control message and tracks it for ACK-based confirmation.
   *
   * The message is assigned a unique `messageId`, validated against
   * `ReliableControlMessageSchema`, and added to the pending messages map.
   * The message is then sent via `sendRaw`. Once `sendRaw` resolves, the
   * timestamps (`firstSentAt`, `lastSentAt`, `nextRetryAt`) are populated
   * and the retry deadline is set to `sentAt + ackTimeout`.
   *
   * A retry timer is scheduled automatically by the periodic `checkPendingMessages`
   * loop. If the ACK is received, the returned promise resolves. If the message
   * exceeds `maxRetries` or the transport is disposed, the promise rejects.
   *
   * @param message The reliable control message to send (type must be in
   *   `ReliableTypeName`).
   * @returns A promise that resolves when the message is acknowledged, or rejects
   *   if sending fails, the message is discarded, or the transport is disposed.
   * @throws {ControlTransportError} With code `TRANSPORT_DISPOSED` if the transport
   *   has already been disposed.
   * @throws {ControlTransportError} With code `INVALID_RELIABLE_MESSAGE` if the
   *   message fails `ReliableControlMessageSchema` validation.
   * @throws {ControlTransportError} With code `SEND_FAILED` (asynchronously, via
   *   promise rejection) if `sendRaw` rejects when sending the reliable message.
   */
  private async sendReliable(
    message: Extract<ControlMessage, { type: ReliableTypeName }>,
  ): Promise<void> {
    if (this.isDisposed) {
      throw new ControlTransportError(
        ControlTransportErrorCode.TRANSPORT_DISPOSED,
        "Object is already disposed",
      );
    }

    await this.waitForCapacity();

    // The transport could have been disposed while waiting.
    if (this.isDisposed) {
      throw new ControlTransportError(
        ControlTransportErrorCode.TRANSPORT_DISPOSED,
        "Object was disposed while waiting for capacity",
      );
    }

    const messageId = this.nextMessageId;

    let reliableMessage: ReliableControlMessage;

    try {
      reliableMessage = ReliableControlMessageSchema.parse({
        ...message,
        messageId,
      });
    } catch (error) {
      throw new ControlTransportError(
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
      );
    }

    this.nextMessageId = createMessageId(messageId + 1);

    return new Promise<void>((resolve, reject) => {
      const pendingMessage: PendingMessage = {
        message: reliableMessage,
        firstSentAt: undefined,
        lastSentAt: undefined,
        retryCount: 0,
        nextRetryAt: undefined,
        resolve,
        reject,
      };

      this.pendingMessages.set(messageId, pendingMessage);

      this.sendRaw(reliableMessage)
        .then(() => {
          const sentAt = performance.now();

          pendingMessage.firstSentAt = sentAt;
          pendingMessage.lastSentAt = sentAt;
          pendingMessage.nextRetryAt = sentAt + this.config.ackTimeout;
        })
        .catch((error) => {
          this.pendingMessages.delete(messageId);

          reject(
            new ControlTransportError(
              ControlTransportErrorCode.SEND_FAILED,
              "An error occurred while sending a reliable message through the channel",
              { messageId, cause: error },
            ),
          );

          // A slot has become available.
          this.notifyCapacityAvailable();
        });
    });
  }

  /**
   * Handles an incoming ACK message by resolving the promise for the
   * corresponding pending reliable message.
   *
   * If the acknowledged message is not found in the pending map, a warning
   * is logged and the method returns silently.
   *
   * @param message The ACK message received from the remote peer.
   */
  private handleAckMessage(message: AckMessage) {
    const acknowledgedMessage = this.pendingMessages.get(message.acknowledgedMessageId);

    if (!acknowledgedMessage) {
      console.warn("Couldn't find the pending message the ACK message was acknowledging");
      return;
    }

    acknowledgedMessage.resolve();

    this.pendingMessages.delete(message.acknowledgedMessageId);

    this.notifyCapacityAvailable();
  }

  /**
   * Iterates over all pending reliable messages and retries any that have
   * exceeded their `nextRetryAt` deadline.
   *
   * Messages with undefined timestamps (`firstSentAt`, `lastSentAt`, or
   * `nextRetryAt`) are skipped — these are messages whose initial `sendRaw`
   * call has not yet resolved.
   *
   * Messages that exceed `maxRetries` are removed from the pending map and
   * their associated promise is rejected with `MAX_RETRIES_EXCEEDED`.
   * Messages that are still within the retry limit are resent via `retrySend`.
   */
  private checkPendingMessages() {
    const now = performance.now();

    this.pendingMessages.forEach((pendingMessage, messageId) => {
      if (
        !pendingMessage.firstSentAt ||
        !pendingMessage.lastSentAt ||
        !pendingMessage.nextRetryAt
      ) {
        return;
      }

      if (now >= pendingMessage.nextRetryAt) {
        if (pendingMessage.retryCount + 1 > this.config.maxRetries) {
          this.pendingMessages.delete(messageId);

          const error = new ControlTransportError(
            ControlTransportErrorCode.MAX_RETRIES_EXCEEDED,
            `Sending the message ${messageId} failed after ${this.config.maxRetries} tries`,
            { messageId },
          );

          pendingMessage.reject(error);

          this.notifyCapacityAvailable();

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

  /**
   * Retries sending a pending reliable message.
   *
   * Resets the retry deadline to `undefined` (so the message is skipped by
   * `checkPendingMessages` until the resend completes), then calls `sendRaw`
   * to re-send the message. Once `sendRaw` resolves successfully, the retry
   * count is incremented and the next retry deadline is set with exponential
   * backoff.
   *
   * The retry delay is calculated as `ackTimeout * 2^(retryCount + 1)`, capped
   * at `maxRetryDelay`.
   *
   * @param messageId The ID of the pending message to retry.
   * @throws {ControlTransportError} With code `PENDING_DISAPPEARED` if the
   *   message is no longer found in the pending map (likely already resolved
   *   or rejected).
   * @throws {ControlTransportError} With code `SEND_FAILED_ON_RESEND` (asynchronously,
   *   via promise rejection) if `sendRaw` rejects when attempting to resend the message.
   */
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

    pendingMessage.nextRetryAt = undefined;
    pendingMessage.lastSentAt = undefined;

    this.sendRaw(pendingMessage.message)
      .then(() => {
        if (!this.pendingMessages.has(messageId)) {
          return;
        }

        const sentAt = performance.now();

        pendingMessage.retryCount++;
        pendingMessage.nextRetryAt = sentAt + Math.min(nextRetryDelay, this.config.maxRetryDelay);
        pendingMessage.lastSentAt = sentAt;
      })
      .catch((error) => {
        this.pendingMessages.delete(messageId);

        pendingMessage.reject(
          new ControlTransportError(
            ControlTransportErrorCode.SEND_FAILED_ON_RESEND,
            "An error occurred while resending a reliable message through the control data channel",
            { messageId, cause: error },
          ),
        );

        this.notifyCapacityAvailable();
      });
  }

  /**
   * Entry point for receiving a control message from the underlying channel.
   *
   * Routes the message based on its type:
   * - ACK messages are handled by `handleAckMessage`.
   * - Reliable messages (those with a valid `messageId`) are handled by
   *   `handleReliableMessage`, which deduplicates and ACKs them before
   *   forwarding to `onMessage`.
   * - All other messages are forwarded directly to `onMessage`.
   *
   * @param message The incoming control message of any type.
   * @returns A promise that resolves once the message has been fully processed.
   * @throws {ControlTransportError} With code `TRANSPORT_DISPOSED` if the
   *   transport has already been disposed.
   */
  public handleMessage = async (message: AnyControlMessage) => {
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
      await this.handleReliableMessage(message);
    } else {
      this.onMessage(message);
    }
  };

  /**
   * Handles an incoming reliable control message.
   *
   * If the message ID has already been seen, it is silently dropped
   * (duplicate suppression). Otherwise, an ACK is sent back to the sender,
   * the message ID is recorded as seen, and the message (with `messageId`
   * stripped) is forwarded to `onMessage`.
   *
   * @param message The reliable control message received from the remote peer.
   * @returns A promise that resolves once the ACK has been sent and the message
   *   has been forwarded to `onMessage`.
   */
  private async handleReliableMessage(message: ReliableControlMessage) {
    if (this.seenMessageIds.has(message.messageId)) {
      return;
    }

    await this.sendAckMessage(message.messageId);

    this.seenMessageIds.add(message.messageId);

    this.onMessage(stripMessageId(message));
  }

  /**
   * Sends an ACK message back to the remote peer to acknowledge receipt of
   * a reliable control message.
   *
   * @param acknowledgedMessageId The ID of the message being acknowledged.
   * @returns A promise that resolves when the ACK has been sent successfully.
   * @throws {ControlTransportError} With code `ACK_SEND_FAILED` if `sendRaw`
   *   rejects when sending the ACK.
   */
  private async sendAckMessage(acknowledgedMessageId: MessageId): Promise<void> {
    const ackMessage: AckMessage = {
      type: "ack",
      protocolVersion: this.protocolVersion,
      acknowledgedMessageId,
    };

    try {
      await this.sendRaw(ackMessage);
    } catch (error) {
      throw new ControlTransportError(
        ControlTransportErrorCode.ACK_SEND_FAILED,
        `Could not send ACK message for ${acknowledgedMessageId}`,
        { messageId: acknowledgedMessageId, cause: error },
      );
    }
  }

  /**
   * Disposes the transport, cancelling all pending operations.
   *
   * Clears the retry timer, rejects all pending message promises with a
   * `TRANSPORT_DISPOSED` error, and clears the pending messages map.
   *
   * Subsequent calls to `dispose` are no-ops.
   */
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

    let waiter:
      | {
          resolve: () => void;
          reject: (reason: unknown) => void;
        }
      | undefined;

    while ((waiter = this.capacityWaiters.shift()) !== undefined) {
      waiter.reject(
        new ControlTransportError(
          ControlTransportErrorCode.TRANSPORT_DISPOSED,
          "Transport disposed before a free space appeared",
        ),
      );
    }
  }

  private async waitForCapacity(): Promise<void> {
    if (this.pendingMessages.size < this.config.maxPendingMessages) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.capacityWaiters.push({ resolve, reject });
    });
  }

  private notifyCapacityAvailable(): void {
    const waiter = this.capacityWaiters.shift();

    waiter?.resolve();
  }
}
