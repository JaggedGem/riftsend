/**
 * The size of a single chunk in bytes
 */
export const CHUNK_SIZE = 16 * 1024;

export const HEADER_SIZE = 11;

type ChunkHeaderField = {
  offset: number;
  size: number;
};

type ChunkFormatType = Record<string, ChunkHeaderField>;

/**
 * The format of a chunk with the binary offsets and sizes in bytes
 */
export const CHUNK_FORMAT: ChunkFormatType = {
  PROTOCOL_VERSION: {
    offset: 0,
    size: 1,
  },
  FILE_ID: {
    offset: 1,
    size: 2,
  },
  CHUNK_INDEX: {
    offset: 3,
    size: 4,
  },
  LENGTH: {
    offset: 7,
    size: 4,
  },
  PAYLOAD: {
    offset: 11,
    size: CHUNK_SIZE - HEADER_SIZE,
  },
};

export const MAX_CHUNK_SIZE = 16 * 1024 * 1024; // 16 MiB

export const MAX_FILES_PER_BATCH = 10000;

export const MAX_TOTAL_CHUNKS = 2 ** 32 - 1; // ~4 billion
