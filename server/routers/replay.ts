/**
 * Replay Router - Direct Betradar API Integration
 * Calls Betradar Replay API directly without Python service
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { addToPlaylist as dbAddToPlaylist, getPlaylistBySessionId, removeFromPlaylist as dbRemoveFromPlaylist, getActiveReplaySession, createReplaySession } from "../db";

const BETRADAR_API_BASE = process.env.UOF_API_BASE_URL || "https://api.betradar.com/v1";
const ACCESS_TOKEN = process.env.BETRADAR_ACCESS_TOKEN || "";

/**
 * Helper function to call Betradar API
 */
async function callBetradarAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${BETRADAR_API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "x-access-token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Betradar API error (${response.status}): ${errorText}`);
  }

  // Some endpoints return empty responses
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  }
  
  return { success: true };
}

export const replayRouter = router({
  /**
   * Get current replay status
   */
  getStatus: publicProcedure.query(async () => {
    try {
      const data = await callBetradarAPI("/replay/status");
      return {
        success: true,
        status: data.status || "idle",
        data,
      };
    } catch (error: any) {
      console.error("[Replay] Failed to get status:", error.message);
      // Return default status instead of throwing
      return {
        success: false,
        status: "unknown",
        error: error.message,
      };
    }
  }),

  /**
   * Get current playlist
   */
  getPlaylist: publicProcedure.query(async () => {
    try {
      const data = await callBetradarAPI("/replay/");
      
      // Also get from database
      const session = await getActiveReplaySession();
      const dbPlaylist = session ? await getPlaylistBySessionId(session.id) : [];
      
      return {
        success: true,
        events: data.events || dbPlaylist.map(item => ({ id: item.matchId, type: 'match' })),
      };
    } catch (error: any) {
      console.error("[Replay] Failed to get playlist:", error.message);
      
      // Fallback to database
      const session = await getActiveReplaySession();
      const dbPlaylist = session ? await getPlaylistBySessionId(session.id) : [];
      return {
        success: false,
        events: dbPlaylist,
        error: error.message,
      };
    }
  }),

  /**
   * Add event to replay playlist
   */
  addToPlaylist: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        eventType: z.enum(["match", "stage", "season", "tournament"]).default("match"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Add to Betradar replay
        await callBetradarAPI(`/replay/events/${input.eventId}`, {
          method: "PUT",
        });

        // Also save to database
        let session = await getActiveReplaySession();
        if (!session) {
          session = await createReplaySession({ status: 'idle' });
        }
        if (session) {
          await dbAddToPlaylist({ sessionId: session.id, matchId: input.eventId });
        }

        return {
          success: true,
          message: `Event ${input.eventId} added to playlist`,
        };
      } catch (error: any) {
        console.error("[Replay] Failed to add to playlist:", error.message);
        throw new Error(`Failed to add to playlist: ${error.message}`);
      }
    }),

  /**
   * Remove event from replay playlist
   */
  removeFromPlaylist: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        eventType: z.enum(["match", "stage", "season", "tournament"]).default("match"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Remove from Betradar replay
        await callBetradarAPI(`/replay/events/${input.eventId}`, {
          method: "DELETE",
        });

        // Also remove from database
        const session = await getActiveReplaySession();
        if (session) {
          await dbRemoveFromPlaylist(session.id, input.eventId);
        }

        return {
          success: true,
          message: `Event ${input.eventId} removed from playlist`,
        };
      } catch (error: any) {
        console.error("[Replay] Failed to remove from playlist:", error.message);
        throw new Error(`Failed to remove from playlist: ${error.message}`);
      }
    }),

  /**
   * Start replay
   */
  start: publicProcedure
    .input(
      z.object({
        speed: z.number().min(1).max(100).default(10),
        maxDelay: z.number().min(1000).max(60000).default(10000),
        useReplayTimestamp: z.boolean().default(false),
        nodeId: z.number().optional(),
        productFilter: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const params = new URLSearchParams();
        params.append("speed", input.speed.toString());
        params.append("max_delay", input.maxDelay.toString());
        params.append("use_replay_timestamp", input.useReplayTimestamp.toString());
        
        if (input.nodeId) {
          params.append("node_id", input.nodeId.toString());
        }
        
        if (input.productFilter && input.productFilter.length > 0) {
          params.append("product", input.productFilter.join(","));
        }

        await callBetradarAPI(`/replay/play?${params.toString()}`, {
          method: "POST",
        });

        return {
          success: true,
          message: "Replay started",
        };
      } catch (error: any) {
        console.error("[Replay] Failed to start:", error.message);
        throw new Error(`Failed to start replay: ${error.message}`);
      }
    }),

  /**
   * Stop replay
   */
  stop: publicProcedure.mutation(async () => {
    try {
      await callBetradarAPI("/replay/stop", {
        method: "POST",
      });

      return {
        success: true,
        message: "Replay stopped",
      };
    } catch (error: any) {
      console.error("[Replay] Failed to stop:", error.message);
      throw new Error(`Failed to stop replay: ${error.message}`);
    }
  }),

  /**
   * Reset replay (stop and clear playlist)
   */
  reset: publicProcedure.mutation(async () => {
    try {
      await callBetradarAPI("/replay/reset", {
        method: "POST",
      });

      return {
        success: true,
        message: "Replay reset",
      };
    } catch (error: any) {
      console.error("[Replay] Failed to reset:", error.message);
      throw new Error(`Failed to reset replay: ${error.message}`);
    }
  }),

  /**
   * Get event summary
   */
  getEventSummary: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        language: z.string().default("en"),
      })
    )
    .query(async ({ input }) => {
      try {
        const data = await callBetradarAPI(
          `/sports/en/sport_events/${input.eventId}/summary.json`
        );

        return {
          success: true,
          data,
        };
      } catch (error: any) {
        console.error("[Replay] Failed to get event summary:", error.message);
        throw new Error(`Failed to get event summary: ${error.message}`);
      }
    }),

  /**
   * Get event timeline
   */
  getEventTimeline: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        language: z.string().default("en"),
      })
    )
    .query(async ({ input }) => {
      try {
        const data = await callBetradarAPI(
          `/sports/en/sport_events/${input.eventId}/timeline.json`
        );

        return {
          success: true,
          data,
        };
      } catch (error: any) {
        console.error("[Replay] Failed to get event timeline:", error.message);
        throw new Error(`Failed to get event timeline: ${error.message}`);
      }
    }),
});
