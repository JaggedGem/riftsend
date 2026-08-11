import { OpfsSinkErrorCode } from "./OpfsSinkError";
import type {
  CloseRequest,
  DeleteRequest,
  GetSizeRequest,
  InitializeRequest,
  ReadRequest,
  WorkerRequest,
  WorkerResponse,
  WriteRequest,
} from "./OpfsWorkerClient";
import { getOpfsSinkConfig } from "@/config/config";

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

const initializeFile = async (message: InitializeRequest) => {
  if (workerState.state !== "uninitialized") {
    const response: WorkerResponse<undefined> = {
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

    const response: WorkerResponse<undefined> = {
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

  const response: WorkerResponse<void> = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

// todo: implement written byte ranges persisting
const writeToFile = (message: WriteRequest) => {
  const state = workerState;

  if (state.state !== "ready") {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.WORKER_NOT_READY,
        message: "Cannot write to file: worker is not ready",
        cause: `current state: ${workerState.state}`,
      },
    };

    self.postMessage(response);

    return;
  }

  try {
    const written = state.accessHandle.write(message.data, { at: message.offset });

    if (written !== message.data.byteLength) {
      const response: WorkerResponse<void> = {
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
          const response: WorkerResponse<undefined> = {
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
    const response: WorkerResponse<undefined> = {
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

  const response: WorkerResponse<void> = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

const getFileSize = (message: GetSizeRequest) => {
  if (workerState.state !== "ready") {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.WORKER_NOT_READY,
        message: "Cannot get file size: worker is not ready",
        cause: `current state: ${workerState.state}`,
      },
    };

    self.postMessage(response);

    return;
  }

  const response: WorkerResponse<number> = {
    type: "success",
    requestId: message.requestId,
    result: workerState.accessHandle.getSize(),
  };

  self.postMessage(response);
};

const readFile = (message: ReadRequest) => {
  if (workerState.state !== "ready") {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.WORKER_NOT_READY,
        message: "Cannot read file: worker is not ready",
        cause: `current state: ${workerState.state}`,
      },
    };

    self.postMessage(response);

    return;
  }

  const fileSize = workerState.accessHandle.getSize();

  const fileOffset = message.offset ?? 0;

  const bufferLength = message.length ?? fileSize - fileOffset;

  if (
    fileOffset < 0 ||
    bufferLength < 0 ||
    fileOffset > fileSize ||
    fileOffset + bufferLength > fileSize
  ) {
    const response: WorkerResponse<undefined> = {
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
    const read = workerState.accessHandle.read(buffer, { at: fileOffset });

    if (read !== bufferLength) {
      const response: WorkerResponse<void> = {
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
    const response: WorkerResponse<undefined> = {
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

  const response: WorkerResponse<ArrayBuffer> = {
    type: "success",
    requestId: message.requestId,
    result: buffer,
  };

  self.postMessage(response, [buffer]);
};

const deleteFile = async (message: DeleteRequest) => {
  if (workerState.state !== "ready") {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.WORKER_NOT_READY,
        message: "Cannot delete file: worker is not ready",
        cause: `current state: ${workerState.state}`,
      },
    };

    self.postMessage(response);

    return;
  }

  const { root, fileHandle, accessHandle } = workerState;

  if (workerState.flushTimeout) {
    clearTimeout(workerState.flushTimeout);
  }

  workerState = { state: "closing" };

  accessHandle.close();

  try {
    await root.removeEntry(fileHandle.name);
  } catch (error) {
    workerState = { state: "closed" };

    const response: WorkerResponse<undefined> = {
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

  const response: WorkerResponse<void> = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

const closeFile = (message: CloseRequest) => {
  if (workerState.state !== "ready") {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkErrorCode.WORKER_NOT_READY,
        message: "Cannot close file: worker is not ready",
        cause: `current state: ${workerState.state}`,
      },
    };

    self.postMessage(response);

    return;
  }

  const { accessHandle } = workerState;

  if (workerState.flushTimeout) {
    clearTimeout(workerState.flushTimeout);
  }

  workerState = { state: "closing" };

  accessHandle.close();

  workerState = { state: "closed" };

  const response: WorkerResponse<void> = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

const handleMessage = async (event: MessageEvent) => {
  const message = event.data as WorkerRequest;

  switch (message.type) {
    case "initialize": {
      await initializeFile(message);

      break;
    }

    case "write": {
      writeToFile(message);

      break;
    }

    case "getSize": {
      getFileSize(message);

      break;
    }

    case "read": {
      readFile(message);

      break;
    }

    case "delete": {
      await deleteFile(message);

      break;
    }

    case "close": {
      closeFile(message);

      break;
    }
  }
};

self.addEventListener("message", handleMessage);
self.addEventListener("error", (event) => {
  console.error(event.error);
});
