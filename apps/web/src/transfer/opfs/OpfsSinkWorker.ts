import {
  type CloseRequest,
  type DeleteRequest,
  type GetSizeRequest,
  type InitializeRequest,
  type ReadRequest,
  type FatalNotice,
  type WriteRequest,
  type WorkerResponse,
  type ErrorResponse,
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

const assertReady = (
  requestId: RequestId,
  operation: string,
): Extract<WorkerSinkState, { state: "ready" }> | undefined => {
  if (workerState.state !== "ready") {
    const response: ErrorResponse = {
      type: "error",
      requestId,
      error: {
        code: OpfsSinkErrorCode.WORKER_NOT_READY,
        message: `Cannot ${operation}: worker is not ready`,
        cause: `current state: ${workerState.state}`,
      },
    };

    self.postMessage(response);

    return undefined;
  }

  return workerState;
};

const initializeFile = async (message: InitializeRequest) => {
  if (workerState.state !== "uninitialized") {
    const response: ErrorResponse = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.WORKER_ALREADY_INITIALIZED,
        message: "Cannot initialize file: worker has already been initialized",
        cause: `current state: ${workerState.state}`,
      },
    };

    self.postMessage(response);

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

    const response: ErrorResponse = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.INITIALIZATION_FAILED,
        message: "Failed to initialize file",
        cause: error,
      },
    };

    self.postMessage(response);

    return;
  }

  const response: WorkerResponse = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
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
      const response: WorkerResponse = {
        type: "error",
        requestId: message.requestId,
        error: {
          code: OpfsSinkErrorCode.SHORT_WRITE,
          message: `Failed to write all bytes: expected ${message.data.byteLength}, wrote ${written}`,
        },
      };

      self.postMessage(response);

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
          const response: ErrorResponse = {
            type: "error",
            requestId: message.requestId,
            error: {
              code: OpfsSinkErrorCode.TIMED_FLUSH_FAILED,
              message: "Failed to flush the file after the timeout was hit",
              cause: error,
            },
          };

          self.postMessage(response);

          return;
        }
      }, timeThreshold);
    }
  } catch (error) {
    const response: ErrorResponse = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.WRITE_FAILED,
        message: "Failed to write to file",
        cause: error,
      },
    };

    self.postMessage(response);

    return;
  }

  const response: WorkerResponse = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

const getFileSize = (message: GetSizeRequest) => {
  const state = assertReady(message.requestId, "get file size");

  if (!state) {
    return;
  }

  const response: WorkerResponse = {
    type: "success",
    requestId: message.requestId,
    result: state.accessHandle.getSize(),
  };

  self.postMessage(response);
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
    const response: ErrorResponse = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.INVALID_READ_RANGE,
        message: `Invalid read range: offset ${fileOffset} exceeds file size ${fileSize}`,
      },
    };

    self.postMessage(response);

    return;
  }

  const buffer = new ArrayBuffer(bufferLength);
  try {
    const read = state.accessHandle.read(buffer, { at: fileOffset });

    if (read !== bufferLength) {
      const response: WorkerResponse = {
        type: "error",
        requestId: message.requestId,
        error: {
          code: OpfsSinkErrorCode.SHORT_READ,
          message: `Failed to read all requested bytes: expected ${bufferLength}, read ${read}`,
        },
      };

      self.postMessage(response);

      return;
    }
  } catch (error) {
    const response: ErrorResponse = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.READ_FAILED,
        message: "Failed to read file",
        cause: error,
      },
    };

    self.postMessage(response);

    return;
  }

  const response: WorkerResponse = {
    type: "success",
    requestId: message.requestId,
    result: buffer,
  };

  self.postMessage(response, [buffer]);
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

    const response: ErrorResponse = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.DELETE_FAILED,
        message: "Failed to delete file",
        cause: error,
      },
    };

    self.postMessage(response);

    return;
  }

  workerState = { state: "closed" };

  const response: WorkerResponse = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
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

  const response: WorkerResponse = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

const handleMessage = async (event: MessageEvent) => {
  const parseResult = WorkerRequestSchema.safeParse(event.data);

  if (!parseResult.success) {
    const looseParseResult = WithRequestIdSchema.safeParse(parseResult.data);

    if (!looseParseResult.success) {
      const response: FatalNotice = {
        type: "fatal-notice",
        error: {
          code: OpfsSinkErrorCode.UNKNOWN_MESSAGE_TYPE,
          message: "Received unknown request type from client without any request id",
          cause: parseResult.error,
        },
      };

      self.postMessage(response);

      return;
    }

    const response: ErrorResponse = {
      type: "error",
      requestId: looseParseResult.data.requestId,
      error: {
        code: OpfsSinkErrorCode.UNKNOWN_MESSAGE_TYPE,
        message: "Received unknown request type from client",
        cause: parseResult.error,
      },
    };

    self.postMessage(response);

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
