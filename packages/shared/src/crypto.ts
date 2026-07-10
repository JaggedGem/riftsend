export const getRandomValues = (buffer: Uint8Array): void => {
  globalThis.crypto.getRandomValues(buffer as Uint8Array<ArrayBuffer>);
};

export const createRandomValues = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
  return bytes;
};

export const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};