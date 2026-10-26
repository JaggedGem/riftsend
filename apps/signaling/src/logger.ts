import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const isDisabled = process.env.LOGGER_DISABLED === "true";

const loggerOptions =
  isDisabled || !isDev
    ? {
        level: "silent",
      }
    : {
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
      };

/** Pre-configured pino logger for the signaling server. Set LOGGER_DISABLED=true to disable logging (e.g. during tests). */
export const logger = pino(loggerOptions);
export { loggerOptions };
