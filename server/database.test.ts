import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Basic tests for database operations
 */

function createTestContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("database operations", () => {
  it("should get all matches", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const matches = await caller.db.getAllMatches();

    expect(Array.isArray(matches)).toBe(true);
  });

  it("should get all messages", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const messages = await caller.db.getAllMessages({ limit: 10 });

    expect(Array.isArray(messages)).toBe(true);
  });

  it("should create and retrieve match", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const testMatchId = `test-match-${Date.now()}`;

    const created = await caller.db.upsertMatch({
      matchId: testMatchId,
      name: "Test Match",
      sportType: "football",
      status: "scheduled",
      homeTeam: "Team A",
      awayTeam: "Team B",
    });

    expect(created).toBeTruthy();
    expect(created?.matchId).toBe(testMatchId);

    const retrieved = await caller.db.getMatch({ matchId: testMatchId });

    expect(retrieved).toBeTruthy();
    expect(retrieved?.matchId).toBe(testMatchId);
    expect(retrieved?.name).toBe("Test Match");
  });

  it("should save and retrieve message", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const saved = await caller.db.saveMessage({
      messageType: "test_message",
      producer: "test_producer",
      matchId: "test-match-123",
      routingKey: "test.routing.key",
      rawContent: "<test>content</test>",
      parsedData: JSON.stringify({ test: true }),
    });

    expect(saved).toBeTruthy();
    expect(saved?.messageType).toBe("test_message");

    const messages = await caller.db.getAllMessages({ limit: 1 });

    expect(messages.length).toBeGreaterThan(0);
  });
});
