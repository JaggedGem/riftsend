import { CHUNK_FORMAT, CHUNK_SIZE, HEADER_SIZE } from "./constants.js";
import { FrameValidationError, FrameValidationErrorCode } from "./errors/FrameValidationError.js";

export const buildChunk = (
  protocolVersion: number,
  transferId: number,
  chunkIndex: number,
  payload: ArrayBuffer,
) => {
  if (payload.byteLength > CHUNK_FORMAT.PAYLOAD.size) {
    throw new FrameValidationError(
      FrameValidationErrorCode.CHUNK_TOO_LARGE,
      `Chunk must be <= ${CHUNK_SIZE} bytes, got ${payload.byteLength}`,
    );
  }

  if (protocolVersion >= 2 ** 8 || protocolVersion < 0 || !Number.isInteger(protocolVersion)) {
    throw new FrameValidationError(
      FrameValidationErrorCode.PROTOCOL_VERSION_INVALID,
      `Protocol Version must be an integer < ${2 ** 8} and >= 0 bytes, got ${protocolVersion}`,
    );
  }

  if (transferId >= 2 ** 16 || transferId < 0 || !Number.isInteger(transferId)) {
    throw new FrameValidationError(
      FrameValidationErrorCode.FILE_ID_INVALID,
      `Transfer Id must be an integer < ${2 ** 16} and >= 0 bytes, got ${transferId}`,
    );
  }

  if (chunkIndex >= 2 ** 32 || chunkIndex < 0 || !Number.isInteger(chunkIndex)) {
    throw new FrameValidationError(
      FrameValidationErrorCode.CHUNK_INDEX_INVALID,
      `Chunk Index must be an integer < ${2 ** 32} bytes and >= 0, got ${chunkIndex}`,
    );
  }

  const buffer = new ArrayBuffer(HEADER_SIZE + payload.byteLength);

  const view = new DataView(buffer);

  view.setUint8(CHUNK_FORMAT.PROTOCOL_VERSION.offset, protocolVersion);
  view.setUint16(CHUNK_FORMAT.FILE_ID.offset, transferId);
  view.setUint32(CHUNK_FORMAT.CHUNK_INDEX.offset, chunkIndex);
  view.setUint32(CHUNK_FORMAT.LENGTH.offset, payload.byteLength);

  new Uint8Array(buffer, HEADER_SIZE).set(new Uint8Array(payload));

  return buffer;
};
