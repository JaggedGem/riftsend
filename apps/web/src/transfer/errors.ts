import type { TransferState } from "./FileTransfer.js";

export enum FileTransferManagerErrorCode {
  UNKNOWN_ERROR = "file_transfer_manager.unknown_error",
  UNKNOWN_BATCH = "file_transfer_manager.unknown_batch",
  UNKNOWN_FILE_ID = "file_transfer_manager.unknown_file_id",
  UNSUPPORTED_MESSAGE = "file_transfer_manager.unsupported_message",
  EMPTY_FILE_SEND_QUEUE = "file_transfer_manager.empty_file_send_queue",
}

export class FileTransferManagerError extends Error {
  public constructor(
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

export enum TransferErrorCode {
  WRONG_STATE = "transfer.wrong_state",
  CHANNEL_CLOSED = "transfer.channel_closed",
  BUFFER_MISMATCH = "transfer.buffer_mismatch",
}

export class TransferStateError extends Error {
  readonly code: TransferErrorCode.WRONG_STATE;
  readonly expectedState: TransferState | TransferState[];
  readonly actualState: TransferState;

  public constructor(
    expected: TransferState | TransferState[],
    actual: TransferState,
    operation: string,
  ) {
    super(
      `Cannot ${operation} the transfer if it is not ${Array.isArray(expected) ? TransferStateError.formatStates(expected) : expected}`,
    );

    this.code = TransferErrorCode.WRONG_STATE;
    this.expectedState = expected;
    this.actualState = actual;
    this.name = "TransferStateError";
  }

  private static formatStates(states: TransferState[]): string {
    if (states.length === 1) return states[0];
    if (states.length === 2) return `${states[0]} or ${states[1]}`;

    return `${states.slice(0, -1).join(", ")}, or ${states.at(-1)}`;
  }
}

export class TransferSendError extends Error {
  readonly code: TransferErrorCode.CHANNEL_CLOSED;
  readonly chunkIndex: number;

  public constructor(
    chunkIndex: number,
    options?: {
      cause?: unknown;
    },
  ) {
    super(`Cannot send chunk ${chunkIndex}: data channel is not open`, { cause: options?.cause });

    this.code = TransferErrorCode.CHANNEL_CLOSED;
    this.chunkIndex = chunkIndex;
    this.name = "TransferSendError";
  }
}

export class TransferBufferMismatchError extends Error {
  readonly code = TransferErrorCode.BUFFER_MISMATCH;
  readonly chunkIndex: number;

  public constructor(chunkIndex: number) {
    super(`Buffered chunk index does not match the expected chunk index.`);

    this.chunkIndex = chunkIndex;
    this.name = "TransferBufferMismatchError";
  }
}
