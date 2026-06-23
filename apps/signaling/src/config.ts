export const WS_PORT = parseInt(process.env.WS_PORT || "8080", 10);
export const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3000", 10);
export const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
export const MAX_PAYLOAD = 1024 * 128;
export const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || "1000", 10);
export const MAX_MESSAGES_PER_SEC = parseInt(
  process.env.MAX_MESSAGES_PER_SEC || "60",
  10,
);