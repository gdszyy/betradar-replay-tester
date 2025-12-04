/**
 * Custom hook for WebSocket connection
 */

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onReplayStatus?: (status: any) => void;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, onReplayStatus, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    // Create socket connection
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on("connect", () => {
      console.log("[WebSocket] Connected");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[WebSocket] Disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("[WebSocket] Connection error:", error);
      setIsConnected(false);
    });

    // Message handlers
    socket.on("message", (data: any) => {
      console.log("[WebSocket] Received message:", data);
      if (onMessage) {
        onMessage(data);
      }
    });

    socket.on("replay:status", (status: any) => {
      console.log("[WebSocket] Received replay status:", status);
      if (onReplayStatus) {
        onReplayStatus(status);
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [autoConnect, onMessage, onReplayStatus]);

  // Subscribe to specific match
  const subscribeToMatch = (matchId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("subscribe:match", matchId);
    }
  };

  // Unsubscribe from specific match
  const unsubscribeFromMatch = (matchId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("unsubscribe:match", matchId);
    }
  };

  // Subscribe to session
  const subscribeToSession = (sessionId: number) => {
    if (socketRef.current) {
      socketRef.current.emit("subscribe:session", sessionId);
    }
  };

  // Unsubscribe from session
  const unsubscribeFromSession = (sessionId: number) => {
    if (socketRef.current) {
      socketRef.current.emit("unsubscribe:session", sessionId);
    }
  };

  return {
    isConnected,
    subscribeToMatch,
    unsubscribeFromMatch,
    subscribeToSession,
    unsubscribeFromSession,
  };
}
