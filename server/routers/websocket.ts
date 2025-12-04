/**
 * tRPC router for WebSocket operations
 * Provides endpoints to broadcast messages via WebSocket
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { broadcastMessage, sendToMatch, sendToSession, broadcastReplayStatus } from "../websocket";

export const websocketRouter = router({
  // Broadcast message to all clients
  broadcast: publicProcedure
    .input(
      z.object({
        type: z.string(),
        data: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      const success = broadcastMessage(input);
      return { success };
    }),

  // Send message to specific match subscribers
  sendToMatch: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        data: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      const success = sendToMatch(input.matchId, input.data);
      return { success };
    }),

  // Send message to specific session subscribers
  sendToSession: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
        data: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      const success = sendToSession(input.sessionId, input.data);
      return { success };
    }),

  // Broadcast replay status
  broadcastStatus: publicProcedure
    .input(
      z.object({
        status: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      const success = broadcastReplayStatus(input.status);
      return { success };
    }),
});
