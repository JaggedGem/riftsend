import { CHUNK_FORMAT, CHUNK_SIZE } from "./constants.js";

export const buildChunk = (
  protocolVersion: number,
  fileId: number,
  chunkIndex: number,
  payload: ArrayBuffer,
) => {
  if (payload.byteLength + 11 > CHUNK_SIZE) {
    throw new Error(`Chunk should be smaller than ${CHUNK_SIZE}`);
  }

  const buffer = new ArrayBuffer(11 + payload.byteLength);

  const view = new DataView(buffer);

  view.setUint8(CHUNK_FORMAT.PROTOCOL_VERSION.offset, protocolVersion);
  view.setUint16(CHUNK_FORMAT.FILE_ID.offset, fileId);
  view.setUint32(CHUNK_FORMAT.CHUNK_INDEX.offset, chunkIndex);
  view.setUint32(CHUNK_FORMAT.LENGTH.offset, payload.byteLength);

  new Uint8Array(buffer, 11).set(new Uint8Array(payload));

  return buffer;
};
