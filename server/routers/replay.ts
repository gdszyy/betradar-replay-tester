/**
 * tRPC router for Replay control
 * This router communicates with the Python FastAPI replay service
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import axios from "axios";

// Replay service base URL
const REPLAY_SERVICE_URL = process.env.REPLAY_SERVICE_URL || "http://localhost:8001";

// Create axios instance for replay service
const replayClient = axios.create({
  baseURL: REPLAY_SERVICE_URL,
  timeout: 30000,
});

// ============ Replay Control Procedures ============

export const replayRouter = router({
  // Start replay
  start: publicProcedure
    .input(
      z.object({
        speed: z.number().default(10),
        maxDelay: z.number().default(10000),
        useReplayTimestamp: z.boolean().default(false),
        nodeId: z.string().optional(),
        productId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await replayClient.post("/replay/start", {
          speed: input.speed,
          max_delay: input.maxDelay,
          use_replay_timestamp: input.useReplayTimestamp,
          node_id: input.nodeId,
          product_id: input.productId,
        });
        return response.data;
      } catch (error: any) {
        console.error("Error starting replay:", error);
        throw new Error(error.response?.data?.detail || "Failed to start replay");
      }
    }),

  // Stop replay
  stop: publicProcedure.mutation(async () => {
    try {
      const response = await replayClient.post("/replay/stop");
      return response.data;
    } catch (error: any) {
      console.error("Error stopping replay:", error);
      throw new Error(error.response?.data?.detail || "Failed to stop replay");
    }
  }),

  // Reset replay
  reset: publicProcedure.mutation(async () => {
    try {
      const response = await replayClient.post("/replay/reset");
      return response.data;
    } catch (error: any) {
      console.error("Error resetting replay:", error);
      throw new Error(error.response?.data?.detail || "Failed to reset replay");
    }
  }),

  // Get replay status
  getStatus: publicProcedure.query(async () => {
    try {
      const response = await replayClient.get("/replay/status");
      return response.data;
    } catch (error: any) {
      console.error("Error getting replay status:", error);
      throw new Error(error.response?.data?.detail || "Failed to get replay status");
    }
  }),

  // ============ Playlist Management Procedures ============

  // Add event to playlist
  addToPlaylist: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        eventType: z.enum(["match", "stage", "season", "tournament"]).default("match"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await replayClient.post("/replay/playlist/add", {
          event_id: input.eventId,
          event_type: input.eventType,
        });
        return response.data;
      } catch (error: any) {
        console.error("Error adding to playlist:", error);
        throw new Error(error.response?.data?.detail || "Failed to add to playlist");
      }
    }),

  // Remove event from playlist
  removeFromPlaylist: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        eventType: z.enum(["match", "stage", "season", "tournament"]).default("match"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await replayClient.delete("/replay/playlist/remove", {
          data: {
            event_id: input.eventId,
            event_type: input.eventType,
          },
        });
        return response.data;
      } catch (error: any) {
        console.error("Error removing from playlist:", error);
        throw new Error(error.response?.data?.detail || "Failed to remove from playlist");
      }
    }),

  // Get playlist
  getPlaylist: publicProcedure.query(async () => {
    try {
      const response = await replayClient.get("/replay/playlist");
      return response.data;
    } catch (error: any) {
      console.error("Error getting playlist:", error);
      throw new Error(error.response?.data?.detail || "Failed to get playlist");
    }
  }),

  // ============ UOF API Procedures ============

  // Get match summary
  getMatchSummary: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        language: z.string().default("en"),
      })
    )
    .query(async ({ input }) => {
      try {
        const response = await replayClient.get(`/uof/match/${input.matchId}/summary`, {
          params: { language: input.language },
        });
        return response.data;
      } catch (error: any) {
        console.error("Error getting match summary:", error);
        throw new Error(error.response?.data?.detail || "Failed to get match summary");
      }
    }),

  // Get match timeline
  getMatchTimeline: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        language: z.string().default("en"),
      })
    )
    .query(async ({ input }) => {
      try {
        const response = await replayClient.get(`/uof/match/${input.matchId}/timeline`, {
          params: { language: input.language },
        });
        return response.data;
      } catch (error: any) {
        console.error("Error getting match timeline:", error);
        throw new Error(error.response?.data?.detail || "Failed to get match timeline");
      }
    }),

  // Get recent matches
  getRecentMatches: publicProcedure
    .input(
      z.object({
        hours: z.number().default(48),
      })
    )
    .query(async ({ input }) => {
      try {
        const response = await replayClient.get("/uof/matches/recent", {
          params: { hours: input.hours },
        });
        return response.data;
      } catch (error: any) {
        console.error("Error getting recent matches:", error);
        throw new Error(error.response?.data?.detail || "Failed to get recent matches");
      }
    }),

  // ============ Scenarios Procedures ============

  // List scenarios
  listScenarios: publicProcedure.query(async () => {
    try {
      const response = await replayClient.get("/replay/scenarios");
      return response.data;
    } catch (error: any) {
      console.error("Error listing scenarios:", error);
      throw new Error(error.response?.data?.detail || "Failed to list scenarios");
    }
  }),

  // Play scenario
  playScenario: publicProcedure
    .input(
      z.object({
        scenarioId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await replayClient.post(`/replay/scenarios/${input.scenarioId}/play`);
        return response.data;
      } catch (error: any) {
        console.error("Error playing scenario:", error);
        throw new Error(error.response?.data?.detail || "Failed to play scenario");
      }
    }),
});
