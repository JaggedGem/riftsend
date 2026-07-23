import type { TransferState } from "./FileTransfer.js";

export enum FileTransferManagerErrorCode {
  UNKNOWN_ERROR = "TR_MGR_UNKNOWN_ERROR",
  FATAL_ERROR = "TR_MGR_FATAL_ERROR",
  UNKNOWN_BATCH = "TR_MGR_UNKNOWN_BATCH",
  UNKNOWN_FILE_ID = "TR_MGR_UNKNOWN_FILE_ID",
  UNSUPPORTED_MESSAGE = "TR_MGR_UNSUPPORTED_MESSAGE",
  EMPTY_FILE_SEND_QUEUE = "TR_MGR_EMPTY_FILE_SEND_QUEUE",
}

export class FileTransferManagerError extends Error {
  constructor(
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
  WRONG_STATE = "XFER_WRONG_STATE",
  CHANNEL_CLOSED = "XFER_CHANNEL_CLOSED",
}

export class TransferStateError extends Error {
  readonly code: TransferErrorCode.WRONG_STATE;
  readonly expectedState: TransferState | TransferState[];
  readonly actualState: TransferState;
  constructor(expected: TransferState | TransferState[], actual: TransferState, operation: string) {
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
  constructor(chunkIndex: number) {
    super(`Cannot send chunk ${chunkIndex}: data channel is not open`);
    this.code = TransferErrorCode.CHANNEL_CLOSED;
    this.chunkIndex = chunkIndex;
    this.name = "TransferSendError";
  }
}
