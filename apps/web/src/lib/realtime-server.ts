import type { Server as HTTPServer } from "node:http";
import { Server } from "socket.io";
import { SESSION_COOKIE, getUserBySessionToken } from "./session-user";
import { setIO } from "./realtime";

function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function firstString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

function handshakeToken(socket: {
  handshake: { auth?: Record<string, unknown>; query?: Record<string, unknown>; headers: Record<string, unknown> };
}) {
  const authToken = firstString(socket.handshake.auth?.token);
  const queryToken = firstString(socket.handshake.query?.token);
  const header = String(socket.handshake.headers.authorization ?? "");
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const cookieToken = readCookie(
    typeof socket.handshake.headers.cookie === "string" ? socket.handshake.headers.cookie : undefined,
    SESSION_COOKIE,
  );
  return authToken || queryToken || bearer || cookieToken;
}

export function attachRealtime(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    try {
      const user = await getUserBySessionToken(handshakeToken(socket));
      if (!user || user.isActive === false) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.userId = user.id;
      socket.data.hospitalId = user.hospitalId;
      socket.data.role = user.role;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.join(`role:${socket.data.role}`);
    if (socket.data.hospitalId) {
      socket.join(`hospital:${socket.data.hospitalId}`);
    }
  });

  setIO(io);
  return io;
}
