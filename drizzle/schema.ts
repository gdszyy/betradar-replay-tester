import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Matches table - stores match information for replay
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  /** Betradar match ID (e.g., sr:match:12345678) */
  matchId: varchar("matchId", { length: 128 }).notNull().unique(),
  /** Match name/title */
  name: text("name"),
  /** Sport type (e.g., football, basketball) */
  sportType: varchar("sportType", { length: 64 }),
  /** Match scheduled time */
  scheduledTime: timestamp("scheduledTime"),
  /** Match status (scheduled, live, ended, etc.) */
  status: varchar("status", { length: 32 }),
  /** Home team name */
  homeTeam: text("homeTeam"),
  /** Away team name */
  awayTeam: text("awayTeam"),
  /** Raw match data from UOF API (JSON) */
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Replay sessions table - tracks replay sessions
 */
export const replaySessions = mysqlTable("replay_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Session name/identifier */
  sessionName: varchar("sessionName", { length: 255 }),
  /** Replay status (idle, setting_up, playing, stopped) */
  status: varchar("status", { length: 32 }).notNull().default("idle"),
  /** Replay speed multiplier */
  speed: int("speed").default(10),
  /** Max delay in milliseconds */
  maxDelay: int("maxDelay").default(10000),
  /** Node ID for isolation */
  nodeId: varchar("nodeId", { length: 64 }),
  /** Product ID filter */
  productId: int("productId"),
  /** Started by user ID */
  startedBy: int("startedBy"),
  /** Session start time */
  startedAt: timestamp("startedAt"),
  /** Session end time */
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReplaySession = typeof replaySessions.$inferSelect;
export type InsertReplaySession = typeof replaySessions.$inferInsert;

/**
 * Replay playlist table - many-to-many relationship between sessions and matches
 */
export const replayPlaylist = mysqlTable("replay_playlist", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  matchId: varchar("matchId", { length: 128 }).notNull(),
  /** Order in playlist */
  playOrder: int("playOrder").default(0),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type ReplayPlaylistItem = typeof replayPlaylist.$inferSelect;
export type InsertReplayPlaylistItem = typeof replayPlaylist.$inferInsert;

/**
 * Messages table - stores AMQP messages received from UOF
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  /** Session ID this message belongs to */
  sessionId: int("sessionId"),
  /** Match ID this message is related to */
  matchId: varchar("matchId", { length: 128 }),
  /** Message type (odds_change, bet_stop, bet_settlement, etc.) */
  messageType: varchar("messageType", { length: 64 }).notNull(),
  /** Message producer (e.g., LiveOdds, PrematchOdds) */
  producer: varchar("producer", { length: 64 }),
  /** Message timestamp from UOF */
  messageTimestamp: timestamp("messageTimestamp"),
  /** Message routing key */
  routingKey: text("routingKey"),
  /** Raw message content (XML/JSON) */
  rawContent: text("rawContent"),
  /** Parsed message data (JSON) */
  parsedData: text("parsedData"),
  /** Message received timestamp */
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;