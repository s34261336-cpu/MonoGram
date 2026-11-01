const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");
const chatStore = require("./chat-store.cjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: "/api/socket.io",
  cors: { origin: true, credentials: true },
});
const onlineUsers = new Map();
const publicDir = path.resolve(
  __dirname,
  "../artifacts/telegram-messenger/dist/public",
);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/chats", (_req, res) => {
  res.json(chatStore.getChats());
});

app.get("/api/chats/:chatId/messages", (req, res) => {
  const history = chatStore.getMessages(req.params.chatId);
  if (!history) {
    res.status(404).json({ error: "Чат не найден" });
    return;
  }
  res.json(history);
});

app.post("/api/messages", (req, res) => {
  const { chatId, text, authorName, kind, fileName } = req.body || {};
  const validKinds = ["text", "file", "voice"];
  if (
    typeof chatId !== "string" ||
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 4000 ||
    typeof authorName !== "string" ||
    !authorName.trim() ||
    authorName.length > 80 ||
    (kind !== undefined && !validKinds.includes(kind)) ||
    (fileName !== undefined && typeof fileName !== "string")
  ) {
    res.status(400).json({ error: "Проверьте текст сообщения" });
    return;
  }

  const message = chatStore.addMessage({
    chatId,
    text,
    authorName,
    kind: kind || "text",
    fileName: fileName || null,
  });
  if (!message) {
    res.status(404).json({ error: "Чат не найден" });
    return;
  }

  io.emit("message:new", message);
  io.emit("chats:update", chatStore.getChats());
  res.status(201).json(message);
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
  socket.emit("presence:update", { onlineCount: onlineUsers.size });

  socket.on("presence:join", (payload = {}) => {
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.info(`Telegram Messenger is listening on port ${PORT}`);
});
