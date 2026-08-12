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

/**
 * Tracks a request that has been registered in the client state map.
 *
 * The `operation` field is used later to validate the worker's response payload
 * against the correct schema before resolving the promise.
 */
type PendingRequestEntry = {
  operation: OpfsMessageTypes;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

/**
 * Stateful lifecycle model for the OPFS sink worker client.
 *
 * The client transitions through initialization, readiness, graceful shutdown,
 * and terminal error/closed states while coordinating request concurrency.
 */
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

/**
 * Events emitted by the worker-backed OPFS sink client.
 */
type OpfsSinkWorkerClientEvents = {
  workerDead: void;
};

/**
 * Typed bridge between the UI and the worker that owns the OPFS file handle.
 *
 * The client serializes all file operations through a Web Worker, validates
 * responses against protocol schemas, and protects the worker behind explicit
 * ready-state and backlog limits.
 */
export class OpfsSinkWorkerClient extends TypedEventEmitter<OpfsSinkWorkerClientEvents> {
  /** Worker instance that hosts the actual OPFS sink implementation. */
  private readonly worker: Worker;

  /** Monotonic request ID generator used across all serialized worker calls. */
  private nextRequestId = createRequestId(0);

  /** Finite-state machine tracking worker readiness and pending request state. */
  private clientState: WorkerClientState = { state: "uninitialized" };

  /** Runtime configuration for flush thresholds and backlog policy. */
  private readonly config: OpfsSinkConfig;

  constructor() {
    super();

    this.config = getOpfsSinkConfig();

    this.worker = new Worker(new URL("./OpfsSinkWorker.ts", import.meta.url), { type: "module" });

    this.worker.addEventListener("message", this.handleWorkerMessage);
    this.worker.addEventListener("error", this.handleError);
    this.worker.addEventListener("messageerror", this.handleError);
  }

  /**
   * Asserts that the client is ready to send operations to the worker.
   *
   * @returns The current ready-state snapshot.
   * @throws {OpfsSinkError} When lifecycle state does not permit requests.
   */
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

  /**
   * Creates a pending request entry and its promise for a worker operation.
   *
   * @param _type - Operation type whose result schema will be validated later.
   * @returns A request ID, pending resolver/rejector pair, and promise.
   */
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

  /**
   * Handles the worker's response stream and routes success/error notices to the
   * correct state machine branch.
   */
  private readonly handleWorkerMessage = (event: MessageEvent) => {
    const { data: message, success } = WorkerResponseSchema.safeParse(event.data);

    if (!success) {
      this.terminateWithError(
        new OpfsSinkError(
          OpfsSinkErrorCode.UNKNOWN_MESSAGE_TYPE,
          "Received an unknown worker response message",
          { cause: event.data },
        ),
      );

      return;
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
        this.terminateWithError(
          new OpfsSinkError(message.error.code, message.error.message, {
            cause: message.error.cause,
          }),
        );

        return;
      }
    }
  };

  /**
   * Resolves or rejects the matching pending request when the worker reports a
   * successful operation result.
   */
  private handleSuccessMessage(message: SuccessResponse) {
    if (this.clientState.state === "initializing") {
      if (message.requestId !== this.clientState.initializeRequest.requestId) {
        this.terminateWithError(
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
      this.terminateWithError(
        new OpfsSinkError(
          OpfsSinkErrorCode.CLIENT_INVALID_STATE,
          `Cannot handle response while client is in "${this.clientState.state}" state; expected "ready" or "closing"`,
        ),
      );

      return;
    }

    const request = this.clientState.pendingRequests.get(message.requestId);

    if (!request) {
      this.terminateWithError(
        new OpfsSinkError(
          OpfsSinkErrorCode.CLIENT_REQUEST_NOT_FOUND,
          `Received response for request ${message.requestId}, but no matching pending request was found`,
          { requestId: message.requestId },
        ),
      );

      return;
    }

    if (!this.clientState.pendingRequests.delete(message.requestId)) {
      this.terminateWithError(
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

  /**
   * Rejects the matching pending request when the worker returns an operation
   * error instead of a result payload.
   */
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

  /**
   * Tears down the worker and rejects all remaining pending work.
   *
   * @param error - Terminal error that caused the shutdown.
   * @param options - Whether to emit the `workerDead` event and whether the
   * shutdown should be marked as an exceptional terminal state.
   */
  private terminate(
    error: OpfsSinkError,
    options: { emitWorkerDead: boolean; isError: boolean },
  ): void {
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

    try {
      if (options.emitWorkerDead) {
        this.emit("workerDead");
      }
    } finally {
      this.clientState = { state: options.isError ? "errored" : "closed" };
    }
  }

  /**
   * Converts an unhandled worker event into a typed `OpfsSinkError`.
   */
  private handleError = (event: Event) => {
    const error = new OpfsSinkError(
      OpfsSinkErrorCode.UNKNOWN_ERROR,
      "An unhandled error occurred in the OPFS worker",
      {
        cause: event instanceof ErrorEvent ? event.error : undefined,
      },
    );

    this.terminateWithError(error);
  };

  /**
   * Initializes the worker-backed file and waits for the ready state.
   *
   * @param fileId - Destination file ID within the OPFS root.
   * @param fileSize - Total file size expected on disk before flushing decisions.
   * @param isResume - Whether an existing file should be resumed without truncating it.
   * @returns A promise that resolves when the worker confirms initialization.
   */
  public initialize(fileId: FileId, fileSize: number, isResume: boolean): Promise<void> {
    if (this.clientState.state !== "uninitialized") {
      throw new OpfsSinkError(
        OpfsSinkErrorCode.CLIENT_INVALID_STATE,
        "Cannot initialize: client must be in the 'uninitialized' state",
      );
    }

    const { requestId, promise, pendingResponse } = this.createRequest("initialize");

    const flushByteThreshold = Math.min(
      Math.max(
        fileSize * (this.config.flushThresholdPercentageOfFileSize / 100),
        this.config.bufferThresholdMinBytes,
      ),
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

  /**
   * Writes a byte slice to a file at the supplied offset.
   *
   * @param offset - Absolute file offset to begin writing.
   * @param data - Buffer to append at that offset.
   * @returns A promise that resolves when the write completes.
   */
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

  /**
   * Returns the current byte size of the managed OPFS file.
   *
   * @returns The file size as reported by the worker.
   */
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

  /**
   * Reads a byte range from the file.
   *
   * @param offset - Starting offset, or the entire file when omitted.
   * @param length - Number of bytes to read, or the remaining file data when omitted.
   * @returns A `ArrayBuffer` containing the requested content.
   */
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

  /**
   * Deletes the managed file from the OPFS root.
   *
   * @returns A promise that resolves when the file is removed.
   */
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

  /**
   * Closes the file handle without deleting the data.
   *
   * @returns A promise that resolves when the worker has closed safely.
   */
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

  /**
   * Releases the worker immediately and prevents further use of the client.
   */
  public dispose(): void {
    this.terminate(
      new OpfsSinkError(OpfsSinkErrorCode.CLIENT_DISPOSED, "OPFS sink client was disposed"),
      { emitWorkerDead: false, isError: false },
    );
  }

  /**
   * Internal helper for terminating the client after a fatal worker-side error.
   *
   * @param error - Fatal error to surface to the caller.
   */
  private terminateWithError(error: OpfsSinkError) {
    this.terminate(error, { emitWorkerDead: true, isError: true });
  }

  /**
   * Waits until the worker is ready and the request backlog is below the configured
   * threshold.
   *
   * @returns The current ready-state snapshot once capacity is available.
   */
  private async acquireReadyState(): Promise<Extract<WorkerClientState, { state: "ready" }>> {
    const currentState = this.assertReady();

    const maxInFlightRequests =
      (currentState.flushByteThreshold / CHUNK_SIZE) * this.config.flushCyclesOfBacklog;

    if (currentState.pendingRequests.size < maxInFlightRequests) {
      return currentState;
    }

    return new Promise((resolve, reject) => {
      currentState.capacityWaiters.push({ resolve, reject });
    });
  }

  /**
   * Resolves the next queued capacity waiter once a request has completed.
   */
  private notifyCapacityAvailable(): void {
    const currentState = this.assertReady();

    const waiter = currentState.capacityWaiters.shift();

    waiter?.resolve(currentState);
  }
}
