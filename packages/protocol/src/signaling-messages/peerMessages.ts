import { SIGNALING_MESSAGE_TYPES } from "@riftsend/shared";
import { z } from "zod";
import { PeerErrorCodeSchema, PeerIdZod, SessionTokenZod } from "./fieldSchemas.js";

/**
 * Initial handshake message sent by the client on WebSocket open.
 *
 * If `from` and `sessionToken` are both non-null, the client is attempting to
 * resume a previous session.
 */
export const HelloMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.hello),
    from: z.union([PeerIdZod, z.null()]),
    protocolVersion: z.number(),
    clientVersion: z.string().max(64),
    sessionToken: z.union([SessionTokenZod, z.null()]),
    payload: z
      .object({
        name: z.string().max(256),
        platform: z.string().max(64),
        supportResume: z.boolean(),
        supportChunkAck: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type HelloMessage = z.infer<typeof HelloMessageSchema>;

/**
 * Server response to a successful `hello` handshake.
 *
 * Contains the assigned {@link PeerId} and {@link SessionToken} for the
 * connection. The session token may be used to resume the session on reconnect.
 */
export const PeerIdMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.peerId),
    from: z.literal("server"),
    payload: z
      .object({
        peerId: PeerIdZod,
        sessionToken: SessionTokenZod,
      })
      .strict(),
  })
  .strict();
export type PeerIdMessage = z.infer<typeof PeerIdMessageSchema>;

/**
 * Error message sent from one peer to another through the signaling relay.
 *
 * Carries an optional {@link WebRTCPeerErrorCode} for machine-readable error
 * handling and a human-readable message limited to 1 KiB.
 */
export const PeerErrorMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.peerError),
    from: PeerIdZod,
    to: PeerIdZod,
    payload: z
      .object({
        message: z.string().max(1024),
        code: PeerErrorCodeSchema.optional(),
      })
      .strict(),
  })
  .strict();
export type PeerErrorMessage = z.infer<typeof PeerErrorMessageSchema>;
