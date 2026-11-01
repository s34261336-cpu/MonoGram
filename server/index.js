const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");
const { verifySupabaseUser } = require("./supabase-auth.cjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: "/api/socket.io",
  cors: { origin: true, credentials: true },
});
const onlineSocketsByUser = new Map();
const publicDir = path.resolve(
  __dirname,
  "../artifacts/telegram-messenger/dist/public",
);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

io.use(async (socket, next) => {
  const user = await verifySupabaseUser(socket.handshake.auth?.token);
  if (!user) {
    next(new Error("Unauthorized"));
    return;
  }
  socket.data.userId = user.id;
  next();
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Не найдено" });
});

app.use(express.static(publicDir));
app.use((req, res, next) => {
  if (req.method !== "GET") {
    next();
    return;
  }
  res.sendFile(path.join(publicDir, "index.html"), (error) => {
    if (error) next(error);
  });
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  const sockets = onlineSocketsByUser.get(userId) ?? new Set();
  sockets.add(socket.id);
  onlineSocketsByUser.set(userId, sockets);
  const broadcastPresence = (extra = {}) => io.emit("presence:update", {
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.info(`Telegram Messenger is listening on port ${PORT}`);
});
