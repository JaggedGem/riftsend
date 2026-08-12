import { TypedEventEmitter } from "@/events/TypedEventEmitter";
import { type FileId, type RequestId, createRequestId, OpfsSinkErrorCode } from "@riftsend/shared";
import { OpfsSinkError } from "./OpfsSinkError";
import { getOpfsSinkConfig, type OpfsSinkConfig } from "@/config/config";
import {
  CHUNK_SIZE,
  type ErrorResponse,
  type SuccessResponse,
  type WorkerRequest,
  type OpfsResult,
  type OpfsMessageTypes,
  WorkerResponseSchema,
  OpfsResultSchemas,
} from "@riftsend/protocol";

type PendingResponse<T extends OpfsMessageTypes> = {
  resolve: (value: OpfsResult<T>) => void;
  reject: (reason: unknown) => void;
};

type PendingRequestEntry = {
  operation: OpfsMessageTypes;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

type WorkerClientState =
  | {
      state: "uninitialized";
    }
  | {
      state: "initializing";
      initializeRequest: {
        requestId: RequestId;
        pendingResponse: PendingResponse<"initialize">;
      };
      flushByteThreshold: number;
    }
  | {
      state: "ready";
      pendingRequests: Map<RequestId, PendingRequestEntry>;
      flushByteThreshold: number;
      capacityWaiters: Array<{
        resolve: (
          value:
            | Extract<WorkerClientState, { state: "ready" }>
            | PromiseLike<Extract<WorkerClientState, { state: "ready" }>>,
        ) => void;
        reject: (reason: unknown) => void;
      }>;
    }
  | {
      state: "closing";
      pendingRequests: Map<RequestId, PendingRequestEntry>;
      capacityWaiters: Array<{
        resolve: (
          value:
            | Extract<WorkerClientState, { state: "ready" }>
            | PromiseLike<Extract<WorkerClientState, { state: "ready" }>>,
        ) => void;
        reject: (reason: unknown) => void;
      }>;
    }
  | {
      state: "closed";
    }
  | {
      state: "errored";
    };

type OfpsSinkWorkerClientEvents = {
  workerDead: void;
};

export class OpfsSinkWorkerClient extends TypedEventEmitter<OfpsSinkWorkerClientEvents> {
  private readonly worker = new Worker("./OpfsSinkWorker.ts");

  private nextRequestId = createRequestId(0);
  private clientState: WorkerClientState = { state: "uninitialized" };

  private readonly config: OpfsSinkConfig;

  constructor() {
    super();

    this.config = getOpfsSinkConfig();

    this.worker.addEventListener("message", this.handleWorkerMessage);
    this.worker.addEventListener("error", this.handleError);
    this.worker.addEventListener("messageerror", this.handleError);
  }

  private assertReady(): Extract<WorkerClientState, { state: "ready" }> {
    if (this.clientState.state !== "ready") {
      throw new OpfsSinkError(
        OpfsSinkErrorCode.CLIENT_NOT_READY,
        "OPFS worker client is not ready",
        {
          cause: `current state: ${this.clientState.state}`,
        },
      );
    }

    return this.clientState;
  }

  private createRequest<T extends OpfsMessageTypes>(
    _type: T,
  ): {
    requestId: RequestId;
    pendingResponse: PendingResponse<T>;
    promise: Promise<OpfsResult<T>>;
  } {
    const requestId = this.nextRequestId;

    this.nextRequestId = createRequestId(requestId + 1);

    let pendingResponse!: PendingResponse<T>;

    const promise = new Promise<OpfsResult<T>>((resolve, reject) => {
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
    const { data: message, success } = WorkerResponseSchema.safeParse(event.data);

    if (!success) {
      throw new OpfsSinkError(
        OpfsSinkErrorCode.UNKNOWN_MESSAGE_TYPE,
        "Received an unknown worker response message",
        { cause: event.data },
      );
    }

    switch (message.type) {
      case "success": {
        this.handleSuccessMessage(message);

        break;
      }

      case "error": {
        this.handleErrorMessage(message);

        break;
      }

      case "fatal-notice": {
        throw new OpfsSinkError(message.error.code, message.error.message, {
          cause: message.error.cause,
        });
      }
    }
  };

  private handleSuccessMessage(message: SuccessResponse) {
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

      this.clientState.initializeRequest.pendingResponse.resolve(undefined);

      this.clientState = {
        state: "ready",
        pendingRequests: new Map<RequestId, PendingRequestEntry>(),
        flushByteThreshold: this.clientState.flushByteThreshold,
        capacityWaiters: new Array<{
          resolve: () => void;
          reject: (reason: unknown) => void;
        }>(),
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

    this.notifyCapacityAvailable();

    const parseResult = OpfsResultSchemas[request.operation].safeParse(message.result);

    if (!parseResult.success) {
      request.reject(
        new OpfsSinkError(
          OpfsSinkErrorCode.INVALID_WORKER_RESPONSE,
          "Received a response with the incorrect 'result' for the current operation",
          { cause: parseResult.error },
        ),
      );

      return;
    }

    request.resolve(parseResult.data);
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

    this.notifyCapacityAvailable();

    request.reject(
      new OpfsSinkError(message.error.code, message.error.message, {
        cause: message.error.cause,
        requestId: message.requestId,
      }),
    );
  }

  private die(error: OpfsSinkError, emitWorkerDead: boolean, isError: boolean): void {
    switch (this.clientState.state) {
      case "uninitialized": {
        this.clientState = {
          state: "closing",
          pendingRequests: new Map(),
          capacityWaiters: [],
        };

        break;
      }

      case "initializing": {
        const pendingResponse = this.clientState.initializeRequest.pendingResponse;

        this.clientState = {
          state: "closing",
          pendingRequests: new Map(),
          capacityWaiters: [],
        };

        pendingResponse.reject(error);

        break;
      }

      case "ready":
      case "closing": {
        this.clientState = {
          state: "closing",
          pendingRequests: this.clientState.pendingRequests,
          capacityWaiters: this.clientState.capacityWaiters,
        };

        for (const pendingResponse of this.clientState.pendingRequests.values()) {
          pendingResponse.reject(error);
        }

        this.clientState.pendingRequests.clear();

        let waiter: (typeof this.clientState.capacityWaiters)[number] | undefined;

        while ((waiter = this.clientState.capacityWaiters.shift()) !== undefined) {
          waiter.reject(error);
        }

        break;
      }

      case "errored":
      case "closed": {
        return;
      }
    }

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

    const { requestId, promise, pendingResponse } = this.createRequest("initialize");

    const flushByteThreshold = Math.min(
      Math.max(fileSize * 0.001, this.config.bufferThresholdMinBytes),
      this.config.bufferThresholdMaxBytes,
    );

    this.clientState = {
      state: "initializing",
      initializeRequest: {
        requestId,
        pendingResponse,
      },
      flushByteThreshold,
    };

    const message: WorkerRequest = {
      type: "initialize",
      requestId,
      fileId,
      fileSize,
      isResume,
      flushByteThreshold,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public async write(offset: number, data: ArrayBuffer): Promise<void> {
    const currentState = await this.acquireReadyState();

    const { requestId, promise, pendingResponse } = this.createRequest("write");

    currentState.pendingRequests.set(requestId, {
      operation: "write",
      resolve: pendingResponse.resolve as (value: unknown) => void,
      reject: pendingResponse.reject,
    });

    const message: WorkerRequest = {
      type: "write",
      requestId,
      offset,
      data,
    };

    this.worker.postMessage(message, [data]);

    return promise;
  }

  public async getSize(): Promise<number> {
    const currentState = await this.acquireReadyState();

    const { requestId, promise, pendingResponse } = this.createRequest("getSize");

    currentState.pendingRequests.set(requestId, {
      operation: "getSize",
      resolve: pendingResponse.resolve as (value: unknown) => void,
      reject: pendingResponse.reject,
    });

    const message: WorkerRequest = {
      type: "getSize",
      requestId,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public async read(offset?: number, length?: number): Promise<ArrayBuffer> {
    const currentState = await this.acquireReadyState();

    const { requestId, promise, pendingResponse } = this.createRequest("read");

    currentState.pendingRequests.set(requestId, {
      operation: "read",
      resolve: pendingResponse.resolve as (value: unknown) => void,
      reject: pendingResponse.reject,
    });

    const message: WorkerRequest = {
      type: "read",
      requestId,
      offset,
      length,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public async delete(): Promise<void> {
    const currentState = await this.acquireReadyState();

    const { requestId, promise, pendingResponse } = this.createRequest("delete");

    currentState.pendingRequests.set(requestId, {
      operation: "delete",
      resolve: pendingResponse.resolve as (value: unknown) => void,
      reject: pendingResponse.reject,
    });

    const message: WorkerRequest = {
      type: "delete",
      requestId,
    };

    this.worker.postMessage(message);

    return promise;
  }

  public async close(): Promise<void> {
    const currentState = await this.acquireReadyState();

    const { requestId, promise, pendingResponse } = this.createRequest("close");

    currentState.pendingRequests.set(requestId, {
      operation: "close",
      resolve: pendingResponse.resolve as (value: unknown) => void,
      reject: pendingResponse.reject,
    });

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

  private async acquireReadyState(): Promise<Extract<WorkerClientState, { state: "ready" }>> {
    const currentState = this.assertReady();

    if (currentState.pendingRequests.size < (currentState.flushByteThreshold / CHUNK_SIZE) * 2) {
      return currentState;
    }

    return new Promise((resolve, reject) => {
      currentState.capacityWaiters.push({ resolve, reject });
    });
  }

  private notifyCapacityAvailable(): void {
    const currentState = this.assertReady();

    const waiter = currentState.capacityWaiters.shift();

    waiter?.resolve(currentState);
  }
}
