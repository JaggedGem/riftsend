import { TypedEventEmitter } from "@/events/TypedEventEmitter";
import type { FileId } from "@riftsend/shared";

export type RequestId = number & { readonly __brand: unique symbol };

export const createRequestId = (requestId: number): RequestId => {
  return requestId as RequestId;
};

export type InitializeRequest = {
  type: "initialize";
  requestId: RequestId;
  fileId: FileId;
  fileSize: number;
};

export type WriteRequest = {
  type: "write";
  requestId: RequestId;
  offset: number;
  data: ArrayBuffer;
};

export type GetSizeRequest = {
  type: "getSize";
  requestId: RequestId;
};

export type ReadRequest = {
  type: "read";
  requestId: RequestId;
  offset?: number;
  length?: number;
};

export type DeleteRequest = {
  type: "delete";
  requestId: RequestId;
};

export type CloseRequest = {
  type: "close";
  requestId: RequestId;
};

export type WorkerRequest =
  InitializeRequest | WriteRequest | GetSizeRequest | ReadRequest | DeleteRequest | CloseRequest;

export type SuccessResponse<ResultType> = {
  type: "success";
  requestId: RequestId;
  result: ResultType;
};

export type ErrorResponse = {
  type: "error";
  requestId: RequestId;
  error: {
    code: string;
    message: string;
    cause?: string;
  };
};

export type WorkerResponse<ResultType> = SuccessResponse<ResultType> | ErrorResponse;

type PendingResponse<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export type WorkerSinkState =
  | { state: "uninitialized" }
  | { state: "initializing" }
  | {
      state: "ready";
      root: FileSystemDirectoryHandle;
      fileHandle: FileSystemFileHandle;
      accessHandle: FileSystemSyncAccessHandle;
    }
  | { state: "closing" }
  | { state: "closed" };

type OfpsWorkerClientEvents = {
  workerDead: void;
};

export class OpfsWorkerClient extends TypedEventEmitter<OfpsWorkerClientEvents> {
  private readonly worker = new Worker("./OpfsSinkWorker.ts");

  private nextRequestId = createRequestId(0);
  private readonly pendingRequests = new Map<RequestId, PendingResponse<unknown>>();

  private isDisposed = false;

  constructor() {
    super();

    this.worker.addEventListener("message", this.handleWorkerMessage);
    this.worker.addEventListener("error", this.handleError);
    this.worker.addEventListener("messageerror", this.handleError);
  }

  private assertAlive(): void {
    if (this.isDisposed) {
      throw new Error("OPFS worker client is no longer available");
    }
  }

  private createRequest<T>(): { requestId: RequestId; promise: Promise<T> } {
    const requestId = this.nextRequestId;

    this.nextRequestId = createRequestId(requestId + 1);

    return {
      requestId,
      promise: new Promise<T>((resolve, reject) => {
        this.pendingRequests.set(requestId, {
          resolve: (value: unknown) => {
            resolve(value as T);
          },
          reject,
        });
      }),
    };
  }

  private readonly handleWorkerMessage = (event: MessageEvent) => {
    const message = event.data as WorkerResponse<unknown>;

    switch (message.type) {
      case "success": {
        this.handleSuccessMessage(message);

        break;
      }

      case "error": {
        this.handleErrorMessage(message);

        break;
      }

      default: {
        // todo: revisit this (might not even need to throw)
        throw new Error("Invalid message received");
      }
    }
  };

  private handleSuccessMessage(message: SuccessResponse<unknown>) {
    const request = this.pendingRequests.get(message.requestId);

    if (!request) {
      // todo: revisit
      throw new Error();
    }

    if (!this.pendingRequests.delete(message.requestId)) {
      throw new Error();
    }

    request.resolve(message.result);
  }

  private handleErrorMessage(message: ErrorResponse) {
    const request = this.pendingRequests.get(message.requestId);

    if (!request) {
      // todo: revisit
      throw new Error();
    }

    if (!this.pendingRequests.delete(message.requestId)) {
      throw new Error();
    }

    request.reject(message.error);
  }

  private die(error: Error, emitWorkerDead: boolean): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    for (const pendingResponse of this.pendingRequests.values()) {
      pendingResponse.reject(error);
    }

    this.pendingRequests.clear();

    this.worker.removeEventListener("message", this.handleWorkerMessage);
    this.worker.removeEventListener("error", this.handleError);
    this.worker.removeEventListener("messageerror", this.handleError);

    this.worker.terminate();

    if (emitWorkerDead) {
      this.emit("workerDead");
    }
  }

  private handleError = (event: Event) => {
    const error = new Error("An unhandled error occurred in the OPFS worker", {
      cause: event instanceof ErrorEvent ? event.error : undefined,
    });

    this.die(error, true);
  };

  public initialize(fileId: FileId, fileSize: number): Promise<void> {
    this.assertAlive();

    const { requestId, promise } = this.createRequest<void>();

    const message: WorkerRequest = {
      type: "initialize",
      requestId,
      fileId,
      fileSize,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public write(offset: number, data: ArrayBuffer): Promise<void> {
    this.assertAlive();

    const { requestId, promise } = this.createRequest<void>();

    const message: WorkerRequest = {
      type: "write",
      requestId,
      offset,
      data,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public getSize(): Promise<number> {
    this.assertAlive();

    const { requestId, promise } = this.createRequest<number>();

    const message: WorkerRequest = {
      type: "getSize",
      requestId,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public read(offset?: number, length?: number): Promise<ArrayBuffer> {
    this.assertAlive();

    const { requestId, promise } = this.createRequest<ArrayBuffer>();

    const message: WorkerRequest = {
      type: "read",
      requestId,
      offset,
      length,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public delete(): Promise<void> {
    this.assertAlive();

    const { requestId, promise } = this.createRequest<void>();

    const message: WorkerRequest = {
      type: "delete",
      requestId,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public close(): Promise<void> {
    const { requestId, promise } = this.createRequest<void>();

    const message: WorkerRequest = {
      type: "close",
      requestId,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public dispose(): void {
    this.die(new Error("OPFS worker client was disposed"), false);
  }
}
