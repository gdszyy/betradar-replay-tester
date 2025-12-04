import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Test Betradar API access with the provided token
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

describe("Betradar API access", () => {
  it("should get replay status with valid token", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.replay.getStatus();

    // Should not throw an error
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    
    // If success is false, it might be because replay is not set up yet, which is ok
    // But we should not get a 403 error
    if (!result.success) {
      expect(result.error).not.toContain("403");
      expect(result.error).not.toContain("Access forbidden");
    }
  }, 10000);

  it("should get playlist with valid token", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.replay.getPlaylist();

    // Should not throw an error
    expect(result).toBeDefined();
    expect(result.events).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
    
    // If success is false, check that it's not a 403 error
    if (!result.success) {
      expect(result.error).not.toContain("403");
      expect(result.error).not.toContain("Access forbidden");
    }
  }, 10000);
});
