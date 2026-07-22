export class TestClientError extends Error {
  constructor(public readonly label: string) {
    super(label);
    this.name = "TestClientError";
  }
}

export class TestConnectionTimeoutError extends TestClientError {
  constructor(timeoutMs: number) {
    super(`WebSocket connection timed out after ${timeoutMs}ms`);
  }
}

export class TestMessageTimeoutError extends TestClientError {
  constructor(type: string, timeoutMs: number) {
    super(`Timeout waiting for message type "${type}" after ${timeoutMs}ms`);
  }
}

export class TestCloseTimeoutError extends TestClientError {
  constructor(timeoutMs: number) {
    super(`Timeout waiting for WebSocket close after ${timeoutMs}ms`);
  }
}
