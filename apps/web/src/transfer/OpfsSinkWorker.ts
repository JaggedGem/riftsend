import type {
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
}

const root = await navigator.storage.getDirectory();

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

  fileHandle = await root.getFileHandle(message.fileId, { create: true });

  accessHandle = await fileHandle.createSyncAccessHandle();

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
    // todo: revisit errors
    throw new Error("Didn't write enough bytes");
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

  const fileOffset = message.offset ?? 0;

  const bufferLength = message.length ?? accessHandle.getSize() - fileOffset;

  const buffer = new ArrayBuffer(bufferLength);

  const read = accessHandle.read(buffer, { at: fileOffset });

  if (read !== bufferLength) {
    throw new Error("Didn't read enough bytes");
  }

  const response: WorkerResponse<ArrayBuffer> = {
    type: "success",
    requestId: message.requestId,
    result: buffer,
  };

  self.postMessage(response);
};

const deleteFile = (message: DeleteRequest) => {
  if (!fileHandle || !accessHandle) {
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

  root.removeEntry(fileHandle.name);

  fileHandle = undefined;
  accessHandle = undefined;

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
      deleteFile(message);

      break;
    }
  }
};

self.addEventListener("message", handleMessage);
