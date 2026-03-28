"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Base URL for API + Socket.IO. Uses NEXT_PUBLIC_SERVER_URL when set;
 * otherwise same-origin (Next.js rewrites proxy to the game server).
 */
export function getServerUrl(): string {
  const u = process.env.NEXT_PUBLIC_SERVER_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function getSocket(): Socket {
  if (!socket) {
    const url = getServerUrl();
    if (!url) {
      throw new Error(
        "Socket URL unavailable (use NEXT_PUBLIC_SERVER_URL or open in the browser)"
      );
    }
    socket = io(url, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      path: "/socket.io/",
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
