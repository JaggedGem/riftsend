import { CHUNK_FORMAT, CHUNK_SIZE, HEADER_SIZE } from "./constants.js";

export const buildChunk = (
  protocolVersion: number,
  fileId: number,
  chunkIndex: number,
  payload: ArrayBuffer,
) => {
  if (payload.byteLength > CHUNK_FORMAT.PAYLOAD.size) {
    throw new Error(`Chunk should be smaller than ${CHUNK_SIZE}`);
  }

  const buffer = new ArrayBuffer(HEADER_SIZE + payload.byteLength);

  const view = new DataView(buffer);

  view.setUint8(CHUNK_FORMAT.PROTOCOL_VERSION.offset, protocolVersion);
  view.setUint16(CHUNK_FORMAT.FILE_ID.offset, fileId);
  view.setUint32(CHUNK_FORMAT.CHUNK_INDEX.offset, chunkIndex);
  view.setUint32(CHUNK_FORMAT.LENGTH.offset, payload.byteLength);

  new Uint8Array(buffer, HEADER_SIZE).set(new Uint8Array(payload));

  return buffer;
};
