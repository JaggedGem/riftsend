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
  };
};

export type WorkerResponse<ResultType> = SuccessResponse<ResultType> | ErrorResponse;

type PendingResponse<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export class OpfsWorkerClient {
  private readonly worker = new Worker("./OpfsSinkWorker.ts");

  private nextRequestId = createRequestId(0);
  private readonly pendingRequests = new Map<RequestId, PendingResponse<unknown>>();

  constructor() {
    this.worker.addEventListener("message", this.handleWorkerMessage);
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

  public initialize(fileId: FileId, fileSize: number): Promise<void> {
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
}
