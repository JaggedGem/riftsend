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

export enum OpfsSinkWorkerErrorCodes {
  WORKER_ALREADY_INITIALIZED = "opfs_sink_worker.worker_already_initialized",
  WORKER_NOT_INITIALIZED = "opfs_sink_worker.worker_not_initialized",
  SHORT_WRITE = "opfs_sink_worker.short_write",
  SHORT_READ = "opfs_sink_worker.short_read",
  INVALID_READ_RANGE = "opfs_sink_worker.invalid_read_range",
  INITIALIZATION_FAILED = "opfs_sink_worker.initialization_failed",
  DELETION_FAILED = "opfs_sink_worker.deletion_failed",
}

let root: FileSystemDirectoryHandle | undefined;
let fileHandle: FileSystemFileHandle | undefined;
let accessHandle: FileSystemSyncAccessHandle | undefined;

const initializeFile = async (message: InitializeRequest) => {
  if (accessHandle) {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.WORKER_ALREADY_INITIALIZED,
        message: "Worker was already initialized",
      },
    };

    self.postMessage(response);

    return;
  }

  try {
    root = await navigator.storage.getDirectory();

    fileHandle = await root.getFileHandle(message.fileId, { create: true });

    accessHandle = await fileHandle.createSyncAccessHandle();
  } catch (error) {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.INITIALIZATION_FAILED,
        message:
          error instanceof Error
            ? `Failed to initialize file: ${error.message}`
            : "Failed to initialize file",
      },
    };

    self.postMessage(response);

    return;
  }

  accessHandle.truncate(message.fileSize);

  accessHandle.flush();

  const response: WorkerResponse<void> = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

const writeToFile = (message: WriteRequest) => {
  if (!accessHandle) {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.WORKER_NOT_INITIALIZED,
        message: "Worker was not initialized",
      },
    };

    self.postMessage(response);

    return;
  }

  const written = accessHandle.write(message.data, { at: message.offset });

  if (written !== message.data.byteLength) {
    const response: WorkerResponse<void> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.SHORT_WRITE,
        message: `Failed to write all bytes: expected ${message.data.byteLength}, wrote ${written}`,
      },
    };

    self.postMessage(response);

    return;
  }

  accessHandle.flush();

  const response: WorkerResponse<void> = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

const getFileSize = (message: GetSizeRequest) => {
  if (!accessHandle) {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.WORKER_NOT_INITIALIZED,
        message: "Worker was not initialized",
      },
    };

    self.postMessage(response);

    return;
  }

  const response: WorkerResponse<number> = {
    type: "success",
    requestId: message.requestId,
    result: accessHandle.getSize(),
  };

  self.postMessage(response);
};

const readFile = (message: ReadRequest) => {
  if (!accessHandle) {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.WORKER_NOT_INITIALIZED,
        message: "Worker was not initialized",
      },
    };

    self.postMessage(response);

    return;
  }

  const fileSize = accessHandle.getSize();

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
        code: OpfsSinkWorkerErrorCodes.INVALID_READ_RANGE,
        message: `Invalid read range: offset ${fileOffset} exceeds file size ${fileSize}`,
      },
    };

    self.postMessage(response);

    return;
  }

  const buffer = new ArrayBuffer(bufferLength);

  const read = accessHandle.read(buffer, { at: fileOffset });

  if (read !== bufferLength) {
    const response: WorkerResponse<void> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.SHORT_READ,
        message: `Failed to read all requested bytes: expected ${bufferLength}, read ${read}`,
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

  self.postMessage(response);
};

const deleteFile = async (message: DeleteRequest) => {
  if (!fileHandle || !accessHandle || !root) {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.WORKER_NOT_INITIALIZED,
        message: "Worker was not initialized",
      },
    };

    self.postMessage(response);

    return;
  }

  accessHandle.close();

  try {
    await root.removeEntry(fileHandle.name);
  } catch (error) {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.DELETION_FAILED,
        message:
          error instanceof Error
            ? `Failed to delete file: ${error.message}`
            : "Failed to delete file",
      },
    };

    self.postMessage(response);

    return;
  }

  fileHandle = undefined;
  accessHandle = undefined;

  const response: WorkerResponse<void> = {
    type: "success",
    requestId: message.requestId,
    result: undefined,
  };

  self.postMessage(response);
};

const closeFile = (message: CloseRequest) => {
  if (!accessHandle) {
    const response: WorkerResponse<undefined> = {
      type: "error",
      requestId: message.requestId,
      error: {
        code: OpfsSinkWorkerErrorCodes.WORKER_NOT_INITIALIZED,
        message: "Worker was not initialized",
      },
    };

    self.postMessage(response);

    return;
  }

  accessHandle.close();

  accessHandle = undefined;
  fileHandle = undefined;

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

    default: {
      // todo: revisit this (might not even need to throw)
      throw new Error("Invalid message received");
    }
  }
};

self.addEventListener("message", handleMessage);
self.addEventListener("error", (event) => {
  console.error(event.error);
});
