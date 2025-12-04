/**
 * WebSocket server for real-time message broadcasting
 * Integrated with Express server
 */

import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Handle client disconnect
    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });

    // Handle subscription to specific match
    socket.on("subscribe:match", (matchId: string) => {
      console.log(`[WebSocket] Client ${socket.id} subscribed to match: ${matchId}`);
      socket.join(`match:${matchId}`);
    });

    // Handle unsubscription from specific match
    socket.on("unsubscribe:match", (matchId: string) => {
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from match: ${matchId}`);
      socket.leave(`match:${matchId}`);
    });

    // Handle subscription to session
    socket.on("subscribe:session", (sessionId: number) => {
      console.log(`[WebSocket] Client ${socket.id} subscribed to session: ${sessionId}`);
      socket.join(`session:${sessionId}`);
    });

    // Handle unsubscription from session
    socket.on("unsubscribe:session", (sessionId: number) => {
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from session: ${sessionId}`);
      socket.leave(`session:${sessionId}`);
    });
  });

  console.log("[WebSocket] Server initialized");
  return io;
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastMessage(data: any) {
  if (!io) {
    console.warn("[WebSocket] Server not initialized");
    return false;
  }

  io.emit("message", data);
  console.log("[WebSocket] Broadcasted message to all clients");
  return true;
}

/**
 * Send message to specific match subscribers
 */
export function sendToMatch(matchId: string, data: any) {
  if (!io) {
    console.warn("[WebSocket] Server not initialized");
    return false;
  }

  io.to(`match:${matchId}`).emit("message", data);
  console.log(`[WebSocket] Sent message to match: ${matchId}`);
  return true;
}

/**
 * Send message to specific session subscribers
 */
export function sendToSession(sessionId: number, data: any) {
  if (!io) {
    console.warn("[WebSocket] Server not initialized");
    return false;
  }

  io.to(`session:${sessionId}`).emit("message", data);
  console.log(`[WebSocket] Sent message to session: ${sessionId}`);
  return true;
}

/**
 * Broadcast replay status update
 */
export function broadcastReplayStatus(status: any) {
  if (!io) {
    console.warn("[WebSocket] Server not initialized");
    return false;
  }

  io.emit("replay:status", status);
  console.log("[WebSocket] Broadcasted replay status");
  return true;
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer() {
  return io;
}
