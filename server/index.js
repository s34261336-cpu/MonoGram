const express = require("express");
const http = require("node:http");
const path = require("node:path");

const app = express();
const server = http.createServer(app);
const publicDir = path.resolve(
  __dirname,
  "../artifacts/telegram-messenger/dist/public",
);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.info(`Telegram Messenger is listening on port ${PORT}`);
});
