import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Match Queries ============

import { Match, InsertMatch, matches, ReplaySession, InsertReplaySession, replaySessions, ReplayPlaylistItem, InsertReplayPlaylistItem, replayPlaylist, Message, InsertMessage, messages } from "../drizzle/schema";
import { desc } from "drizzle-orm";

export async function createMatch(match: InsertMatch): Promise<Match | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(matches).values(match);
    if (result[0]?.insertId) {
      return await getMatchById(Number(result[0].insertId));
    }
    return null;
  } catch (error) {
    console.error("[Database] Failed to create match:", error);
    return null;
  }
}

export async function getMatchById(id: number): Promise<Match | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  return result[0] || null;
}

export async function getMatchByMatchId(matchId: string): Promise<Match | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(matches).where(eq(matches.matchId, matchId)).limit(1);
  return result[0] || null;
}

export async function getAllMatches(): Promise<Match[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(matches).orderBy(desc(matches.scheduledTime));
}

export async function upsertMatch(match: InsertMatch): Promise<Match | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    await db.insert(matches).values(match).onDuplicateKeyUpdate({
      set: {
        name: match.name,
        sportType: match.sportType,
        scheduledTime: match.scheduledTime,
        status: match.status,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        rawData: match.rawData,
        updatedAt: new Date(),
      },
    });
    return await getMatchByMatchId(match.matchId);
  } catch (error) {
    console.error("[Database] Failed to upsert match:", error);
    return null;
  }
}

// ============ Replay Session Queries ============

export async function createReplaySession(session: InsertReplaySession): Promise<ReplaySession | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(replaySessions).values(session);
    if (result[0]?.insertId) {
      return await getReplaySessionById(Number(result[0].insertId));
    }
    return null;
  } catch (error) {
    console.error("[Database] Failed to create replay session:", error);
    return null;
  }
}

export async function getReplaySessionById(id: number): Promise<ReplaySession | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(replaySessions).where(eq(replaySessions.id, id)).limit(1);
  return result[0] || null;
}

export async function getActiveReplaySession(): Promise<ReplaySession | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(replaySessions)
    .where(eq(replaySessions.status, "playing"))
    .orderBy(desc(replaySessions.startedAt))
    .limit(1);
  return result[0] || null;
}

export async function updateReplaySessionStatus(id: number, status: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.update(replaySessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(replaySessions.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update replay session status:", error);
    return false;
  }
}

// ============ Replay Playlist Queries ============

export async function addToPlaylist(item: InsertReplayPlaylistItem): Promise<ReplayPlaylistItem | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(replayPlaylist).values(item);
    if (result[0]?.insertId) {
      const inserted = await db.select().from(replayPlaylist)
        .where(eq(replayPlaylist.id, Number(result[0].insertId)))
        .limit(1);
      return inserted[0] || null;
    }
    return null;
  } catch (error) {
    console.error("[Database] Failed to add to playlist:", error);
    return null;
  }
}

export async function getPlaylistBySessionId(sessionId: number): Promise<ReplayPlaylistItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(replayPlaylist)
    .where(eq(replayPlaylist.sessionId, sessionId))
    .orderBy(replayPlaylist.playOrder);
}

export async function removeFromPlaylist(sessionId: number, matchId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const { and } = await import("drizzle-orm");
    await db.delete(replayPlaylist)
      .where(and(
        eq(replayPlaylist.sessionId, sessionId),
        eq(replayPlaylist.matchId, matchId)
      ));
    return true;
  } catch (error) {
    console.error("[Database] Failed to remove from playlist:", error);
    return false;
  }
}

// ============ Message Queries ============

export async function saveMessage(message: InsertMessage): Promise<Message | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(messages).values(message);
    if (result[0]?.insertId) {
      const inserted = await db.select().from(messages)
        .where(eq(messages.id, Number(result[0].insertId)))
        .limit(1);
      return inserted[0] || null;
    }
    return null;
  } catch (error) {
    console.error("[Database] Failed to save message:", error);
    return null;
  }
}

export async function getMessagesBySessionId(sessionId: number, limit: number = 100): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(desc(messages.receivedAt))
    .limit(limit);
}

export async function getMessagesByMatchId(matchId: string, limit: number = 100): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(messages)
    .where(eq(messages.matchId, matchId))
    .orderBy(desc(messages.receivedAt))
    .limit(limit);
}

export async function getAllMessages(limit: number = 100): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(messages)
    .orderBy(desc(messages.receivedAt))
    .limit(limit);
}
