import { TypedEventEmitter } from "@/events/TypedEventEmitter";
import type { FileId } from "@riftsend/shared";
import { OpfsSinkError, OpfsSinkErrorCode } from "./OpfsSinkError";

export type RequestId = number & { readonly __brand: unique symbol };

export const createRequestId = (requestId: number): RequestId => {
  return requestId as RequestId;
};

export type InitializeRequest = {
  type: "initialize";
  requestId: RequestId;
  fileId: FileId;
  fileSize: number;
  isResume: boolean;
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
    code: OpfsSinkErrorCode;
    message: string;
    cause?: unknown;
  };
};

export type WorkerResponse<ResultType> = SuccessResponse<ResultType> | ErrorResponse;

type PendingResponse<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type WorkerClientState =
  | {
      state: "uninitialized";
    }
  | {
      state: "initializing";
      initializeRequest: {
        requestId: RequestId;
        pendingResponse: PendingResponse<void>;
      };
    }
  | {
      state: "ready";
      pendingRequests: Map<RequestId, PendingResponse<unknown>>;
    }
  | {
      state: "closing";
      pendingRequests: Map<RequestId, PendingResponse<unknown>>;
    }
  | {
      state: "closed";
    }
  | {
      state: "errored";
    };

type OfpsWorkerClientEvents = {
  workerDead: void;
};

export class OpfsWorkerClient extends TypedEventEmitter<OfpsWorkerClientEvents> {
  private readonly worker = new Worker("./OpfsSinkWorker.ts");

  private nextRequestId = createRequestId(0);
  private clientState: WorkerClientState = { state: "uninitialized" };

  constructor() {
    super();

    this.worker.addEventListener("message", this.handleWorkerMessage);
    this.worker.addEventListener("error", this.handleError);
    this.worker.addEventListener("messageerror", this.handleError);
  }

  private assertReady(
    state: WorkerClientState,
  ): asserts state is Extract<WorkerClientState, { state: "ready" }> {
    if (state.state !== "ready") {
      throw new OpfsSinkError(
        OpfsSinkErrorCode.CLIENT_NOT_READY,
        "OPFS worker client is not ready",
        {
          cause: `current state: ${state.state}`,
        },
      );
    }
  }

  private createRequest<T>(): {
    requestId: RequestId;
    pendingResponse: PendingResponse<T>;
    promise: Promise<T>;
  } {
    const requestId = this.nextRequestId;

    this.nextRequestId = createRequestId(requestId + 1);

    let pendingResponse!: PendingResponse<T>;

    const promise = new Promise<T>((resolve, reject) => {
      pendingResponse = {
        resolve,
        reject,
      };
    });

    return {
      requestId,
      pendingResponse,
      promise,
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
    }
  };

  private handleSuccessMessage(message: SuccessResponse<unknown>) {
    if (this.clientState.state === "initializing") {
      if (message.requestId !== this.clientState.initializeRequest.requestId) {
        this.emit(
          "error",
          new OpfsSinkError(
            OpfsSinkErrorCode.CLIENT_INITIALIZATION_REQUEST_MISMATCH,
            `Received response for request ${message.requestId}, but expected response for initialization request ${this.clientState.initializeRequest.requestId}`,
            { requestId: message.requestId },
          ),
        );

        return;
      }

      this.clientState.initializeRequest.pendingResponse.resolve();

      this.clientState = {
        state: "ready",
        pendingRequests: new Map<RequestId, PendingResponse<unknown>>(),
      };

      return;
    }

    if (this.clientState.state !== "ready" && this.clientState.state !== "closing") {
      this.emit(
        "error",
        new OpfsSinkError(
          OpfsSinkErrorCode.CLIENT_INVALID_STATE,
          `Cannot handle response while client is in "${this.clientState.state}" state; expected "ready" or "closing"`,
        ),
      );

      return;
    }

    const request = this.clientState.pendingRequests.get(message.requestId);

    if (!request) {
      this.emit(
        "error",
        new OpfsSinkError(
          OpfsSinkErrorCode.CLIENT_REQUEST_NOT_FOUND,
          `Received response for request ${message.requestId}, but no matching pending request was found`,
          { requestId: message.requestId },
        ),
      );

      return;
    }

    if (!this.clientState.pendingRequests.delete(message.requestId)) {
      this.emit(
        "error",
        new OpfsSinkError(
          OpfsSinkErrorCode.CLIENT_REQUEST_DELETE_FAILED,
          `Failed to remove pending request ${message.requestId}`,
          { requestId: message.requestId },
        ),
      );

      return;
    }

    request.resolve(message.result);
  }

  private handleErrorMessage(message: ErrorResponse) {
    if (this.clientState.state !== "ready" && this.clientState.state !== "closing") {
      this.emit(
        "error",
        new OpfsSinkError(
          OpfsSinkErrorCode.CLIENT_INVALID_STATE,
          `Cannot handle response while client is in "${this.clientState.state}" state; expected "ready" or "closing"`,
        ),
      );

      return;
    }

    const request = this.clientState.pendingRequests.get(message.requestId);

    if (!request) {
      this.emit(
        "error",
        new OpfsSinkError(
          OpfsSinkErrorCode.CLIENT_REQUEST_NOT_FOUND,
          `Received error response for request ${message.requestId}, but no matching pending request was found`,
          { requestId: message.requestId },
        ),
      );

      return;
    }

    if (!this.clientState.pendingRequests.delete(message.requestId)) {
      this.emit(
        "error",
        new OpfsSinkError(
          OpfsSinkErrorCode.CLIENT_REQUEST_DELETE_FAILED,
          `Failed to remove pending request ${message.requestId}`,
          { requestId: message.requestId },
        ),
      );

      return;
    }

    request.reject(
      new OpfsSinkError(message.error.code, message.error.message, {
        cause: message.error.cause,
        requestId: message.requestId,
      }),
    );
  }

  private die(error: OpfsSinkError, emitWorkerDead: boolean, isError: boolean): void {
    if (this.clientState.state !== "ready") {
      return;
    }

    this.clientState = { state: "closing", pendingRequests: this.clientState.pendingRequests };

    for (const pendingResponse of this.clientState.pendingRequests.values()) {
      pendingResponse.reject(error);
    }

    this.clientState.pendingRequests.clear();

    this.worker.removeEventListener("message", this.handleWorkerMessage);
    this.worker.removeEventListener("error", this.handleError);
    this.worker.removeEventListener("messageerror", this.handleError);

    this.worker.terminate();

    if (emitWorkerDead) {
      this.emit("workerDead");
    }

    this.clientState = { state: isError ? "errored" : "closed" };
  }

  private handleError = (event: Event) => {
    const error = new OpfsSinkError(
      OpfsSinkErrorCode.UNKNOWN_ERROR,
      "An unhandled error occurred in the OPFS worker",
      {
        cause: event instanceof ErrorEvent ? event.error : undefined,
      },
    );

    this.die(error, true, true);
  };

  public initialize(fileId: FileId, fileSize: number, isResume: boolean): Promise<void> {
    if (this.clientState.state !== "uninitialized") {
      throw new OpfsSinkError(
        OpfsSinkErrorCode.CLIENT_INVALID_STATE,
        "Cannot initialize: client must be in the 'uninitialized' state",
      );
    }

    const { requestId, promise, pendingResponse } = this.createRequest<void>();

    this.clientState = {
      state: "initializing",
      initializeRequest: {
        requestId,
        pendingResponse,
      },
    };

    const message: WorkerRequest = {
      type: "initialize",
      requestId,
      fileId,
      fileSize,
      isResume,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public write(offset: number, data: ArrayBuffer): Promise<void> {
    const currentState = this.clientState;

    this.assertReady(currentState);

    const { requestId, promise, pendingResponse } = this.createRequest<void>();

    currentState.pendingRequests.set(requestId, pendingResponse as PendingResponse<unknown>);

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
    const currentState = this.clientState;

    this.assertReady(currentState);

    const { requestId, promise, pendingResponse } = this.createRequest<number>();

    currentState.pendingRequests.set(requestId, pendingResponse as PendingResponse<unknown>);

    const message: WorkerRequest = {
      type: "getSize",
      requestId,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public read(offset?: number, length?: number): Promise<ArrayBuffer> {
    const currentState = this.clientState;

    this.assertReady(currentState);

    const { requestId, promise, pendingResponse } = this.createRequest<ArrayBuffer>();

    currentState.pendingRequests.set(requestId, pendingResponse as PendingResponse<unknown>);

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
    const currentState = this.clientState;

    this.assertReady(currentState);

    const { requestId, promise, pendingResponse } = this.createRequest<void>();

    currentState.pendingRequests.set(requestId, pendingResponse as PendingResponse<unknown>);

    const message: WorkerRequest = {
      type: "delete",
      requestId,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public close(): Promise<void> {
    const currentState = this.clientState;

    this.assertReady(currentState);

    const { requestId, promise, pendingResponse } = this.createRequest<void>();

    currentState.pendingRequests.set(requestId, pendingResponse as PendingResponse<unknown>);

    const message: WorkerRequest = {
      type: "close",
      requestId,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public dispose(): void {
    this.die(
      new OpfsSinkError(OpfsSinkErrorCode.CLIENT_DISPOSED, "OPFS sink client was disposed"),
      false,
      false,
    );
  }
}
