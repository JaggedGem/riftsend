export const EnvErrorCode = {
  MISSING_REQUIRED: "ENV_MISSING_REQUIRED",
} as const;

export class MissingEnvError extends Error {
  readonly code = EnvErrorCode.MISSING_REQUIRED;
  readonly key: string;
  constructor(key: string) {
    super(`Missing required environment variable: ${key}`);
    this.key = key;
    this.name = "MissingEnvError";
  }
}
