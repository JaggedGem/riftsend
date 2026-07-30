export enum EnvErrorCode {
  MISSING_REQUIRED = "config.missing_required",
  BAD_ENV_TYPE = "config.bad_env_type",
}

export class MissingEnvError extends Error {
  readonly code = EnvErrorCode.MISSING_REQUIRED;
  readonly key: string;
  constructor(key: string) {
    super(`Missing required environment variable: ${key}`);
    this.key = key;
    this.name = "MissingEnvError";
  }
}

export class BadEnvTypeError extends Error {
  readonly code = EnvErrorCode.BAD_ENV_TYPE;
  readonly key: string;
  constructor(key: string) {
    super(`The environment variable is the wrong type: ${key}`);
    this.key = key;
    this.name = "BadEnvTypeError";
  }
}
