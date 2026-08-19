import type { FileDatabaseErrorCode } from "@riftsend/shared";

export class FileDatabaseError extends Error {
  /**
   * Creates a new `FileDatabaseError`.
   *
   * @param code The machine-readable error code.
   * @param message A human-readable description of the error.
   * @param options Optional additional context.
   * @param options.cause The original error that caused this error, if any.
   */
  public constructor(
    public readonly code: FileDatabaseErrorCode,
    message: string,
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });

    this.name = "FileDatabaseError";
  }

  public override toString(): string {
    const parts = [`${this.name}: ${this.code}`, this.message];

    if (this.cause !== undefined) {
      parts.push(`cause: ${String(this.cause)}`);
    }

    return parts.join("\n");
  }

  public toJSON(): {
    name: string;
    code: FileDatabaseErrorCode;
    message: string;
    cause?: unknown;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.cause !== undefined && { cause: this.cause }),
    };
  }
}
