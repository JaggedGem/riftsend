import { SIGNALING_MESSAGE_TYPES } from "@riftsend/shared";
import { z } from "zod";
import { PeerIdZod } from "./fieldSchemas.js";

/**
 * WebRTC SDP offer forwarded from one peer to another through the signaling server.
 *
 * The `sdp` field is limited to 64 KiB to prevent abuse.
 */
export const OfferMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.offer),
    from: PeerIdZod,
    to: PeerIdZod,
    payload: z
      .object({
        description: z
          .object({
            type: z.literal("offer"),
            sdp: z.string().max(65536),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type OfferMessage = z.infer<typeof OfferMessageSchema>;

/**
 * WebRTC SDP answer forwarded from one peer to another through the signaling server.
 */
export const AnswerMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.answer),
    from: PeerIdZod,
    to: PeerIdZod,
    payload: z
      .object({
        description: z
          .object({
            type: z.literal("answer"),
            sdp: z.string().max(65536),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type AnswerMessage = z.infer<typeof AnswerMessageSchema>;

/**
 * WebRTC ICE candidate forwarded from one peer to another through the signaling server.
 *
 * The `candidate` string is limited to 4 KiB. The `sdpMid` and `sdpMLineIndex`
 * identify which media stream the candidate belongs to.
 */
export const IceCandidateMessageSchema = z
  .object({
    type: z.literal(SIGNALING_MESSAGE_TYPES.iceCandidate),
    from: PeerIdZod,
    to: PeerIdZod,
    payload: z
      .object({
        candidate: z
          .object({
            candidate: z.string().max(4096),
            sdpMid: z.string().max(256).nullable(),
            sdpMLineIndex: z.number().int().nonnegative().nullable(),
            usernameFragment: z.string().max(256).optional(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type IceCandidateMessage = z.infer<typeof IceCandidateMessageSchema>;
