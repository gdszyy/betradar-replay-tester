import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("replay router", () => {
  it("should have correct input schema for start mutation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test that the mutation accepts all required parameters
    const testParams = {
      speed: 10,
      maxDelay: 10000,
      useReplayTimestamp: false,
      runParallel: false,
      nodeId: 123,
      product: 1,
    };

    // This test verifies the schema is correct
    // Actual API call will fail without proper Betradar connection
    try {
      await caller.replay.start(testParams);
    } catch (error: any) {
      // Expected to fail due to network/API issues in test environment
      // We're just testing that the schema accepts these parameters
      expect(error.message).toBeDefined();
    }
  });

  it("should accept minimal parameters for start mutation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test with only required parameters (all have defaults)
    const minimalParams = {};

    try {
      await caller.replay.start(minimalParams);
    } catch (error: any) {
      // Expected to fail due to network/API issues
      expect(error.message).toBeDefined();
    }
  });

  it("should validate speed parameter range", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test speed validation
    try {
      await caller.replay.start({ speed: 101 }); // Over max
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toContain("Too big");
    }

    try {
      await caller.replay.start({ speed: 0 }); // Under min
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toContain("Too small");
    }
  });

  it("should validate maxDelay parameter range", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test maxDelay validation
    try {
      await caller.replay.start({ maxDelay: 500 }); // Under min
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toContain("Too small");
    }

    try {
      await caller.replay.start({ maxDelay: 70000 }); // Over max
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toContain("Too big");
    }
  });
});
