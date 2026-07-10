import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const loggerOptions = isDev
  ? {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: false,
          minimumLevel: "trace",
        },
      },
    }
  : {};

/** Pre-configured pino logger for the signaling server. */
export const logger = pino(loggerOptions);
export { loggerOptions };
