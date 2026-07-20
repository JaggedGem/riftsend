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

export type { PeerId, SessionToken } from "@riftsend/shared";
export { CHUNK_SIZE, CHUNK_FORMAT } from "./constants.js";
export { buildChunk } from "./frames.js";

// Signaling messages
export * from "./signaling-messages/signalingMessages.js";
export * from "./signaling-messages/fieldSchemas.js";
export * from "./signaling-messages/peerMessages.js";
export * from "./signaling-messages/roomMessages.js";
export * from "./signaling-messages/connectionMessages.js";
export * from "./signaling-messages/serverMessages.js";

// Control messages
export * from "./control-messages/controlMessages.js";
export * from "./control-messages/negotiationMessages.js";
export * from "./control-messages/transferMessages.js";
export * from "./control-messages/recoveryMessages.js";
