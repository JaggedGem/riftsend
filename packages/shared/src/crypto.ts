/**
 * Cryptographically-secure random value helpers.
 *
 * These wrap `globalThis.crypto.getRandomValues` to provide a single point of
 * control and a uniform interface. In the browser this uses the Web Crypto API;
 * in Node/Bun it uses the native `crypto` module.
 */

/**
 * Fills a `Uint8Array` with cryptographically-secure random bytes (in-place).
 */
export const getRandomValues = (buffer: Uint8Array<ArrayBuffer>): void => {
  globalThis.crypto.getRandomValues(buffer);
};

/**
 * Creates a new `Uint8Array` of the given size filled with random bytes.
 */
export const createRandomValues = (size: number): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Encodes raw bytes as a base64url string (RFC 4648 §5).
 *
 * Uses `btoa` internally, then replaces `+` → `-`, `/` → `_`, and strips
 * trailing `=` padding.
 */
export const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * A simple wrapper function to generate a random UUID
 */
export const getRandomUUID = () => {
  return globalThis.crypto.randomUUID();
};
