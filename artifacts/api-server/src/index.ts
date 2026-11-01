import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const chatStore = require("../../../server/chat-store.cjs") as {
  getChats: () => unknown;
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
app.set("io", io);
const onlineUsers = new Map<string, string>();

io.on("connection", (socket) => {
  socket.emit("presence:update", { onlineCount: onlineUsers.size });

  socket.on("presence:join", (payload: { displayName?: unknown } = {}) => {
    const displayName =
      typeof payload.displayName === "string"
        ? payload.displayName.slice(0, 80)
        : "Пользователь";
    onlineUsers.set(socket.id, displayName);
    io.emit("presence:update", {
      onlineCount: onlineUsers.size,
      users: [...new Set(onlineUsers.values())],
    });
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    io.emit("presence:update", {
      onlineCount: onlineUsers.size,
      users: [...new Set(onlineUsers.values())],
    });
  });
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});
