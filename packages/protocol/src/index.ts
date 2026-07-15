/**
 * `@riftsend/protocol`
 *
 * Shared protocol message schemas and types for the Riftsend signaling protocol.
 *
 * All messages flowing over the WebSocket connection are validated against the
 * Zod schemas defined here. The {@link SignalingMessageSchema} discriminated
 * union is the entry point for parsing any inbound message.
 *
 * ## Conventions
 *
 * - Every message has a `type` field matching a key in
 *   {@link @riftsend/shared!SIGNALING_MESSAGE_TYPES}.
 * - Server-sent messages use `from: "server"`.
 * - Client-sent messages use `from: PeerId`.
 * - Payloads are validated with `.strict()` to reject unexpected fields.
 */

export * from "./signalingMessages.js";
export type { PeerId, SessionToken } from "@riftsend/shared";
export { CHUNK_SIZE, CHUNK_FORMAT } from "./constants.js";
export { buildChunk } from "./frames.js";
export * from "./controlMessages.js";
