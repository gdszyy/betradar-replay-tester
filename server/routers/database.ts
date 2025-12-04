/**
 * tRPC router for database operations
 * Handles matches, sessions, and messages
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  createMatch,
  getAllMatches,
  getMatchByMatchId,
  upsertMatch,
  createReplaySession,
  getReplaySessionById,
  getActiveReplaySession,
  updateReplaySessionStatus,
  addToPlaylist,
  getPlaylistBySessionId,
  removeFromPlaylist,
  saveMessage,
  getMessagesBySessionId,
  getMessagesByMatchId,
  getAllMessages,
} from "../db";

export const databaseRouter = router({
  // ============ Match Procedures ============

  // Get all matches
  getAllMatches: publicProcedure.query(async () => {
    const matches = await getAllMatches();
    return matches;
  }),

  // Get match by match ID
  getMatch: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const match = await getMatchByMatchId(input.matchId);
      return match;
    }),

  // Create or update match
  upsertMatch: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        name: z.string().optional(),
        sportType: z.string().optional(),
        scheduledTime: z.date().optional(),
        status: z.string().optional(),
        homeTeam: z.string().optional(),
        awayTeam: z.string().optional(),
        rawData: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const match = await upsertMatch(input);
      return match;
    }),

  // ============ Replay Session Procedures ============

  // Create replay session
  createSession: protectedProcedure
    .input(
      z.object({
        sessionName: z.string().optional(),
        speed: z.number().default(10),
        maxDelay: z.number().default(10000),
        nodeId: z.string().optional(),
        productId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await createReplaySession({
        sessionName: input.sessionName,
        speed: input.speed,
        maxDelay: input.maxDelay,
        nodeId: input.nodeId,
        productId: input.productId,
        startedBy: ctx.user.id,
        status: "idle",
      });
      return session;
    }),

  // Get active session
  getActiveSession: publicProcedure.query(async () => {
    const session = await getActiveReplaySession();
    return session;
  }),

  // Get session by ID
  getSession: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const session = await getReplaySessionById(input.sessionId);
      return session;
    }),

  // Update session status
  updateSessionStatus: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
        status: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await updateReplaySessionStatus(input.sessionId, input.status);
      return { success };
    }),

  // ============ Playlist Procedures ============

  // Add to playlist
  addToPlaylist: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
        matchId: z.string(),
        playOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const item = await addToPlaylist(input);
      return item;
    }),

  // Get playlist
  getPlaylist: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const playlist = await getPlaylistBySessionId(input.sessionId);
      return playlist;
    }),

  // Remove from playlist
  removeFromPlaylist: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
        matchId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const success = await removeFromPlaylist(input.sessionId, input.matchId);
      return { success };
    }),

  // ============ Message Procedures ============

  // Save message
  saveMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.number().optional(),
        matchId: z.string().optional(),
        messageType: z.string(),
        producer: z.string().optional(),
        messageTimestamp: z.date().optional(),
        routingKey: z.string().optional(),
        rawContent: z.string().optional(),
        parsedData: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const message = await saveMessage(input);
      return message;
    }),

  // Get all messages
  getAllMessages: publicProcedure
    .input(
      z.object({
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      const messages = await getAllMessages(input.limit);
      return messages;
    }),

  // Get messages by session
  getMessagesBySession: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      const messages = await getMessagesBySessionId(input.sessionId, input.limit);
      return messages;
    }),

  // Get messages by match
  getMessagesByMatch: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      const messages = await getMessagesByMatchId(input.matchId, input.limit);
      return messages;
    }),
});
