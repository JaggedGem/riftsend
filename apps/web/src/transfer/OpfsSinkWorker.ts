import type {
  GetSizeRequest,
  InitializeRequest,
  WorkerRequest,
  WorkerResponse,
  WriteRequest,
} from "./OpfsWorkerClient";

export enum OpfsSinkWorkerErrorCodes {
  WORKER_ALREADY_INITIALIZED = "opfs_sink_worker.worker_already_initialized",
  WORKER_NOT_INITIALIZED = "opfs_sink_worker.worker_not_initialized",
}

const root = await navigator.storage.getDirectory();

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

  const fileHandle = await root.getFileHandle(message.fileId, { create: true });

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
  }
};

self.addEventListener("message", handleMessage);
