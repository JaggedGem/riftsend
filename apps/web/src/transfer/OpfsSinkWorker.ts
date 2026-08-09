import type { InitializeRequest, WorkerRequest, WorkerResponse } from "./OpfsWorkerClient";

export enum OpfsSinkWorkerErrorCodes {
  WORKER_ALREADY_INITIALIZED = "opfs_sink_worker.worker_already_initialized",
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

const handleMessage = async (event: MessageEvent) => {
  const message = event.data as WorkerRequest;

  switch (message.type) {
    case "initialize": {
      await initializeFile(message);

      break;
    }
  }
};

self.addEventListener("message", handleMessage);
