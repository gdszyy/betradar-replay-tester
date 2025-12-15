import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeWebSocket } from "../websocket";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  try {
    console.log("[Server] Starting server initialization...");
    console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[Server] PORT: ${process.env.PORT || 3000}`);
    console.log(`[Server] DATABASE_URL: ${process.env.DATABASE_URL ? "configured" : "NOT SET"}`);
    
    const app = express();
    const server = createServer(app);
    console.log("[Server] Express app and HTTP server created");
    
    // Configure body parser with larger size limit for file uploads
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));
    console.log("[Server] Body parser middleware configured");
    
    // OAuth callback under /api/oauth/callback
    console.log("[Server] Registering OAuth routes...");
    registerOAuthRoutes(app);
    console.log("[Server] OAuth routes registered");
    
    // tRPC API
    console.log("[Server] Setting up tRPC middleware...");
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      })
    );
    console.log("[Server] tRPC middleware configured");
    
    // development mode uses Vite, production mode uses static files
    console.log("[Server] Setting up static file serving...");
    if (process.env.NODE_ENV === "development") {
      console.log("[Server] Development mode: using Vite");
      await setupVite(app, server);
    } else {
      console.log("[Server] Production mode: using static files");
      serveStatic(app);
    }
    console.log("[Server] Static file serving configured");

    // Initialize WebSocket server
    console.log("[Server] Initializing WebSocket server...");
    initializeWebSocket(server);
    console.log("[Server] WebSocket server initialized");

    const preferredPort = parseInt(process.env.PORT || "3000");
    console.log(`[Server] Checking port availability starting from ${preferredPort}...`);
    const port = await findAvailablePort(preferredPort);
    console.log(`[Server] Using port ${port}`);

    if (port !== preferredPort) {
      console.log(`[Server] Port ${preferredPort} is busy, using port ${port} instead`);
    }

    server.listen(port, () => {
      console.log(`[Server] ✅ Server running on http://localhost:${port}/`);
      console.log(`[Server] ✅ WebSocket server running on ws://localhost:${port}/socket.io`);
      console.log("[Server] ✅ All systems initialized successfully");
    });
    
    server.on("error", (error) => {
      console.error("[Server] ❌ Server error:", error);
    });
  } catch (error) {
    console.error("[Server] ❌ Fatal error during startup:", error);
    if (error instanceof Error) {
      console.error("[Server] Error message:", error.message);
      console.error("[Server] Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

startServer().catch(console.error);
