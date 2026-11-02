import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Маршрут API не найден." });
});

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectoryCandidates = [
  path.resolve(process.cwd(), "artifacts/telegram-messenger/dist/public"),
  path.resolve(serverDirectory, "../../telegram-messenger/dist/public"),
  path.resolve(process.cwd(), "artifacts/telegram-messenger/dist"),
  path.resolve(serverDirectory, "../../telegram-messenger/dist"),
];
const webDirectory = webDirectoryCandidates.find((candidate) =>
  existsSync(path.join(candidate, "index.html")),
);
const shouldServeWeb = Boolean(webDirectory);

if (
  process.env["SERVE_WEB"] === "true" ||
  process.env["NODE_ENV"] === "production"
) {
  if (!webDirectory) {
    throw new Error(
      `Frontend build not found. Checked: ${webDirectoryCandidates.join(", ")}`,
    );
  }
}

if (shouldServeWeb && webDirectory) {
  logger.info({ webDirectory }, "Serving web application");
  app.use(express.static(webDirectory));
  app.use((req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    res.sendFile(path.join(webDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : 500;
  const message = error instanceof Error ? error.message : "Не удалось выполнить запрос.";
  req.log.error({ err: error, status }, "Request failed");
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status === 500 ? "Внутренняя ошибка сервера." : message,
  });
});

export default app;
