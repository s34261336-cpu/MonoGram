import { Router, type IRouter } from "express";
import { createRequire } from "node:module";
import {
  GetChatsResponse,
  GetChatMessagesParams,
  GetChatMessagesResponse,
  SendMessageBody,
  SendMessageResponse,
} from "@workspace/api-zod";

const require = createRequire(import.meta.url);
const chatStore = require("../../../server/chat-store.cjs") as {
  getChats: () => unknown;
  getMessages: (chatId: string) => unknown[] | null;
  addMessage: (input: {
    chatId: string;
    text: string;
    authorName: string;
    kind?: "text" | "file" | "voice";
    fileName?: string | null;
  }) => unknown;
};

const router: IRouter = Router();

router.get("/chats", (_req, res) => {
  res.json(GetChatsResponse.parse(chatStore.getChats()));
});

router.get("/chats/:chatId/messages", (req, res) => {
  const params = GetChatMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Некорректный чат" });
    return;
  }

  const history = chatStore.getMessages(params.data.chatId);
  if (!history) {
    res.status(404).json({ error: "Чат не найден" });
    return;
  }

  res.json(GetChatMessagesResponse.parse(history));
});

router.post("/messages", (req, res) => {
  const input = SendMessageBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Проверьте текст сообщения" });
    return;
  }

  const message = chatStore.addMessage({
    chatId: input.data.chatId,
    text: input.data.text,
    authorName: input.data.authorName,
    kind: input.data.kind,
    fileName: input.data.fileName ?? null,
  });
  if (!message) {
    res.status(404).json({ error: "Чат не найден" });
    return;
  }

  const responseMessage = SendMessageResponse.parse(message);
  const io = req.app.get("io");
  io?.emit("message:new", responseMessage);
  io?.emit("chats:update", chatStore.getChats());
  res.status(201).json(responseMessage);
});

export default router;
