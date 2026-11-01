import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const auth = require("../../../server/supabase-auth.cjs") as {
  verifySupabaseUser: (accessToken: unknown) => Promise<{ id: string } | null>;
};

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
const io = new Server(server, {
  path: "/api/socket.io",
  cors: { origin: true, credentials: true },
});
const onlineSocketsByUser = new Map<string, Set<string>>();

io.use((socket, next) => {
  void auth.verifySupabaseUser(socket.handshake.auth?.token).then((user) => {
    if (!user) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.userId = user.id;
    next();
  }).catch(() => next(new Error("Unauthorized")));
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  const sockets = onlineSocketsByUser.get(userId) ?? new Set<string>();
  sockets.add(socket.id);
  onlineSocketsByUser.set(userId, sockets);
  const broadcastPresence = (extra: Record<string, unknown> = {}) => io.emit("presence:update", {
    onlineCount: onlineSocketsByUser.size,
    onlineUserIds: [...onlineSocketsByUser.keys()],
    ...extra,
  });
  socket.emit("presence:update", {
    onlineCount: onlineSocketsByUser.size,
    onlineUserIds: [...onlineSocketsByUser.keys()],
  });
  broadcastPresence({ userId, online: true });

  socket.on("disconnect", () => {
    const current = onlineSocketsByUser.get(userId);
    current?.delete(socket.id);
    if (current?.size === 0) onlineSocketsByUser.delete(userId);
    broadcastPresence({ userId, online: onlineSocketsByUser.has(userId) });
  });
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});
