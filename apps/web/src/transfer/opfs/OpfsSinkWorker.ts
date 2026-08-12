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
    }
  | { state: "closing" }
  | { state: "closed" };

let workerState: WorkerSinkState = { state: "uninitialized" };

const config = getOpfsSinkConfig();

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

  try {
    const root = await navigator.storage.getDirectory();

    const fileHandle = await root.getFileHandle(message.fileId, { create: true });

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
    };
  } catch (error) {
    accessHandle?.close();

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

// todo: implement written byte ranges persisting
const writeToFile = (message: WriteRequest) => {
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
      state.accessHandle.flush();

      clearTimeout(state.flushTimeout);

      state.flushTimeout = undefined;
      state.writtenBytesSinceLastFlush = 0;
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

          state.writtenBytesSinceLastFlush = 0;
        } catch (error) {
          postError(
            message.requestId,
            OpfsSinkErrorCode.TIMED_FLUSH_FAILED,
            "Failed to flush the file after the timeout was hit",
            error,
          );

          return;
        }
      }, timeThreshold);
    }
  } catch (error) {
    postError(message.requestId, OpfsSinkErrorCode.WRITE_FAILED, "Failed to write to file", error);

    return;
  }

  postSuccess(message.requestId, undefined);
};

const getFileSize = (message: GetSizeRequest) => {
  const state = assertReady(message.requestId, "get file size");

  if (!state) {
    return;
  }

  postSuccess(message.requestId, state.accessHandle.getSize());
};

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

const handleMessage = async (event: MessageEvent) => {
  const parseResult = WorkerRequestSchema.safeParse(event.data);

  if (!parseResult.success) {
    const looseParseResult = WithRequestIdSchema.safeParse(parseResult.data);

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
      writeToFile(parseResult.data);

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
