import {
  type CloseRequest,
  type DeleteRequest,
  type GetSizeRequest,
  type InitializeRequest,
  type ReadRequest,
  type WriteRequest,
  type WorkerResponse,
  WorkerRequestSchema,
  WithRequestIdSchema,
} from "@riftsend/protocol";
import { OpfsSinkErrorCode } from "@riftsend/shared";
import { getOpfsSinkConfig } from "@/config/config";
import type { RequestId } from "@riftsend/shared";

type WorkerSinkState =
  | { state: "uninitialized" }
  | { state: "initializing" }
  | {
      state: "ready";
      root: FileSystemDirectoryHandle;
      fileHandle: FileSystemFileHandle;
      accessHandle: FileSystemSyncAccessHandle;
      writtenBytesSinceLastFlush: number;
      flushTimeout: number | undefined;
      flushByteThreshold: number;
      flushEpoch: number;
    }
  | { state: "closing" }
  | { state: "closed" };

/**
 * Global worker state machine for the single OPFS file managed by this worker.
 */
let workerState: WorkerSinkState = { state: "uninitialized" };

/**
 * Runtime configuration used when deciding flush timing and request throughput.
 */
const config = getOpfsSinkConfig();

/**
 * Posts a successful operation payload back to the client.
 *
 * @param requestId - Request that was completed successfully.
 * @param result - Structured payload to return to the caller.
 * @param transfer - Optional transfer list for large binary results.
 */
const postSuccess = (requestId: RequestId, result: unknown, transfer?: Transferable[]) => {
  const response: WorkerResponse = {
    type: "success",
    requestId,
    result,
  };

  if (transfer) {
    self.postMessage(response, transfer);
  } else {
    self.postMessage(response);
  }
};

/**
 * Posts a typed worker error back to the client for a recoverable operation.
 *
 * @param requestId - Request that failed.
 * @param code - Error category from the shared OPFS error enum.
 * @param message - Human-readable summary for debugging.
 * @param cause - Optional underlying error or diagnostic value.
 */
const postError = (
  requestId: RequestId,
  code: OpfsSinkErrorCode,
  message: string,
  cause?: unknown,
) => {
  const response: WorkerResponse = {
    type: "error",
    requestId,
    error: {
      code,
      message,
      cause,
    },
  };

  self.postMessage(response);
};

/**
 * Posts a fatal worker notice that forces the client to tear down.
 *
 * Fatal notices represent protocol mismatches or unrecoverable worker state
 * corruption that must not be ignored by the caller.
 */
const postFatalNotice = (code: OpfsSinkErrorCode, message: string, cause?: unknown) => {
  const response: WorkerResponse = {
    type: "fatal-notice",
    error: {
      code,
      message,
      cause,
    },
  };

  self.postMessage(response);
};

/**
 * Posts a flush complete message to signal that the epoch was flushed on disk
 */
const postFlushComplete = () => {
  const response: WorkerResponse = {
    type: "flush-complete",
  };

  self.postMessage(response);
};

/**
 * Posts a flush failed message to signal that the epoch was not flushed on disk
 */
const postFlushFailed = (error: { code: OpfsSinkErrorCode; message: string; cause?: unknown }) => {
  const response: WorkerResponse = {
    type: "flush-failed",
    error,
  };

  self.postMessage(response);
};

/**
 * Validates the current worker state before accepting an operation.
 *
 * @param requestId - Request being processed.
 * @param operation - Human-readable operation name for the error message.
 * @returns The ready worker state when valid, otherwise `undefined` after posting
 * an error to the client.
 */
const assertReady = (
  requestId: RequestId,
  operation: string,
): Extract<WorkerSinkState, { state: "ready" }> | undefined => {
  if (workerState.state !== "ready") {
    postError(
      requestId,
      OpfsSinkErrorCode.WORKER_NOT_READY,
      `Cannot ${operation}: worker is not ready`,
      `current state: ${workerState.state}`,
    );

    return undefined;
  }

  return workerState;
};

/**
 * Initializes the OPFS file backing store and transitions the worker to ready.
 *
 * This is the only place that creates the root directory handle and file access
 * handle for the managed file.
 */
const initializeFile = async (message: InitializeRequest) => {
  if (workerState.state !== "uninitialized") {
    postError(
      message.requestId,
      OpfsSinkErrorCode.WORKER_ALREADY_INITIALIZED,
      "Cannot initialize file: worker has already been initialized",
      `current state: ${workerState.state}`,
    );

    return;
  }

  workerState = { state: "initializing" };

  let accessHandle: FileSystemSyncAccessHandle | undefined;
  let fileHandle: FileSystemFileHandle | undefined;
  let root: FileSystemDirectoryHandle | undefined;

  try {
    root = await navigator.storage.getDirectory();

    fileHandle = await root.getFileHandle(message.fileId, { create: true });

    accessHandle = await fileHandle.createSyncAccessHandle();

    if (!message.isResume) {
      accessHandle.truncate(message.fileSize);

      accessHandle.flush();
    }

    workerState = {
      state: "ready",
      root,
      fileHandle,
      accessHandle,
      writtenBytesSinceLastFlush: 0,
      flushTimeout: undefined,
      flushByteThreshold: message.flushByteThreshold,
      flushEpoch: 0,
    };
  } catch (error) {
    accessHandle?.close();

    if (root && fileHandle && !message.isResume) {
      root.removeEntry(fileHandle.name);
    }

    workerState = { state: "uninitialized" };

    postError(
      message.requestId,
      OpfsSinkErrorCode.INITIALIZATION_FAILED,
      "Failed to initialize file",
      error,
    );

    return;
  }

  postSuccess(message.requestId, undefined);
};

/**
 * TODO: persist written byte ranges so flush scheduling can be resumed more
 * accurately after an interrupted upload.
 */
const writeFile = (message: WriteRequest) => {
  const state = assertReady(message.requestId, "write to file");

  if (!state) {
    return;
  }

  try {
    const written = state.accessHandle.write(message.data, { at: message.offset });

    if (written !== message.data.byteLength) {
      postError(
        message.requestId,
        OpfsSinkErrorCode.SHORT_WRITE,
        `Failed to write all bytes: expected ${message.data.byteLength}, wrote ${written}`,
      );

      return;
    }

    state.writtenBytesSinceLastFlush += written;

    if (state.writtenBytesSinceLastFlush >= state.flushByteThreshold) {
      try {
        state.accessHandle.flush();

        postFlushComplete();

        clearTimeout(state.flushTimeout);

        state.flushTimeout = undefined;
        state.writtenBytesSinceLastFlush = 0;

        state.flushEpoch++;
      } catch (error) {
        postFlushFailed({
          code: OpfsSinkErrorCode.FLUSH_FAILED,
          message: "Failed to flush the file after the byte threshold was hit",
          cause: error,
        });

        return;
      }
    } else if (!state.flushTimeout) {
      const timeThreshold = Math.min(
        Math.max(
          state.flushByteThreshold / config.assumedMinThroughput,
          config.bufferThresholdMinTimeMs,
        ),
        config.bufferThresholdMaxTimeMs,
      );

      state.flushTimeout = setTimeout(() => {
        state.flushTimeout = undefined;

        try {
          state.accessHandle.flush();

          postFlushComplete();

          state.writtenBytesSinceLastFlush = 0;

          state.flushEpoch++;
        } catch (error) {
          postFlushFailed({
            code: OpfsSinkErrorCode.TIMED_FLUSH_FAILED,
            message: "Failed to flush the file after the timeout was hit",
            cause: error,
          });

          return;
        }
      }, timeThreshold);
    }
  } catch (error) {
    postError(message.requestId, OpfsSinkErrorCode.WRITE_FAILED, "Failed to write to file", error);

    return;
  }

  postSuccess(message.requestId, state.flushEpoch);
};

/**
 * Returns the current file size for the managed OPFS file.
 */
const getFileSize = (message: GetSizeRequest) => {
  const state = assertReady(message.requestId, "get file size");

  if (!state) {
    return;
  }

  postSuccess(message.requestId, state.accessHandle.getSize());
};

/**
 * Reads the requested range from the worker-owned file and returns the raw bytes.
 */
const readFile = (message: ReadRequest) => {
  const state = assertReady(message.requestId, "read file");

  if (!state) {
    return;
  }

  const fileSize = state.accessHandle.getSize();

  const fileOffset = message.offset ?? 0;

  const bufferLength = message.length ?? fileSize - fileOffset;

  if (
    fileOffset < 0 ||
    bufferLength < 0 ||
    fileOffset > fileSize ||
    fileOffset + bufferLength > fileSize
  ) {
    postError(
      message.requestId,
      OpfsSinkErrorCode.INVALID_READ_RANGE,
      `Invalid read range: offset ${fileOffset} exceeds file size ${fileSize}`,
    );

    return;
  }

  const buffer = new ArrayBuffer(bufferLength);
  try {
    const read = state.accessHandle.read(buffer, { at: fileOffset });

    if (read !== bufferLength) {
      postError(
        message.requestId,
        OpfsSinkErrorCode.SHORT_READ,
        `Failed to read all requested bytes: expected ${bufferLength}, read ${read}`,
      );

      return;
    }
  } catch (error) {
    postError(message.requestId, OpfsSinkErrorCode.READ_FAILED, "Failed to read file", error);

    return;
  }

  postSuccess(message.requestId, buffer, [buffer]);
};

/**
 * Removes the OPFS file and closes its access handle at the end of the transfer.
 */
const deleteFile = async (message: DeleteRequest) => {
  const state = assertReady(message.requestId, "delete file");

  if (!state) {
    return;
  }

  const { root, fileHandle, accessHandle } = state;

  if (state.flushTimeout) {
    clearTimeout(state.flushTimeout);
  }

  workerState = { state: "closing" };

  accessHandle.close();

  try {
    await root.removeEntry(fileHandle.name);
  } catch (error) {
    workerState = { state: "closed" };

    postError(message.requestId, OpfsSinkErrorCode.DELETE_FAILED, "Failed to delete file", error);

    return;
  }

  workerState = { state: "closed" };

  postSuccess(message.requestId, undefined);
};

/**
 * Closes the file handle cleanly without deleting the file contents.
 */
const closeFile = (message: CloseRequest) => {
  const state = assertReady(message.requestId, "close file");

  if (!state) {
    return;
  }

  const { accessHandle } = state;

  if (state.flushTimeout) {
    clearTimeout(state.flushTimeout);
  }

  workerState = { state: "closing" };

  accessHandle.close();

  workerState = { state: "closed" };

  postSuccess(message.requestId, undefined);
};

/**
 * Dispatches incoming client requests to the correct operation handler.
 *
 * Unsupported requests are reported with either a fatal notice or an operation
 * error, depending on whether the protocol shape was recognizable.
 */
const handleMessage = async (event: MessageEvent) => {
  const parseResult = WorkerRequestSchema.safeParse(event.data);

  if (!parseResult.success) {
    const looseParseResult = WithRequestIdSchema.safeParse(event.data);

    if (!looseParseResult.success) {
      postFatalNotice(
        OpfsSinkErrorCode.UNKNOWN_MESSAGE_TYPE,
        "Received unknown request type from client without any request id",
        new AggregateError([parseResult.error, looseParseResult.error]),
      );

      return;
    }

    postError(
      looseParseResult.data.requestId,
      OpfsSinkErrorCode.UNKNOWN_MESSAGE_TYPE,
      "Received unknown request type from client",
      parseResult.error,
    );

    return;
  }

  switch (parseResult.data.type) {
    case "initialize": {
      await initializeFile(parseResult.data);

      break;
    }

    case "write": {
      writeFile(parseResult.data);

      break;
    }

    case "getSize": {
      getFileSize(parseResult.data);

      break;
    }

    case "read": {
      readFile(parseResult.data);

      break;
    }

    case "delete": {
      await deleteFile(parseResult.data);

      break;
    }

    case "close": {
      closeFile(parseResult.data);

      break;
    }
  }
};

self.addEventListener("message", handleMessage);
self.addEventListener("error", (event) => {
  console.error(event.error);
});
