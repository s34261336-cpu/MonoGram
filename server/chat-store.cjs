const now = Date.now();
const ago = (minutes) => new Date(now - minutes * 60_000).toISOString();

const chats = [
  {
    id: "anna",
    name: "Анна Смирнова",
    initials: "АС",
    color: "#c76c8a",
    online: true,
    unreadCount: 0,
    isGroup: false,
  },
  {
    id: "design",
    name: "Дизайн-команда",
    initials: "ДК",
    color: "#527da8",
    online: true,
    unreadCount: 3,
    isGroup: true,
  },
  {
    id: "mom",
    name: "Мама",
    initials: "М",
    color: "#b47a52",
    online: false,
    unreadCount: 0,
    isGroup: false,
  },
  {
    id: "maxim",
    name: "Максим",
    initials: "М",
    color: "#658c73",
    online: true,
    unreadCount: 1,
    isGroup: false,
  },
  {
    id: "travel",
    name: "Путешествие в Грузию",
    initials: "ГР",
    color: "#8874aa",
    online: false,
    unreadCount: 0,
    isGroup: true,
  },
  {
    id: "dima",
    name: "Дима Ковалёв",
    initials: "ДК",
    color: "#668c9e",
    online: false,
    unreadCount: 0,
    isGroup: false,
  },
];

const messages = {
  anna: [
    {
      id: "anna-1",
      chatId: "anna",
      text: "Привет! Как ты? Давно не виделись",
      createdAt: ago(82),
      authorId: "anna",
      authorName: "Анна",
      outgoing: false,
      read: true,
      kind: "text",
      fileName: null,
    },
    {
      id: "anna-2",
      chatId: "anna",
      text: "Привет! Всё отлично, спасибо. Как раз хотела тебе написать",
      createdAt: ago(77),
      authorId: "me",
      authorName: "Вы",
      outgoing: true,
      read: true,
      kind: "text",
      fileName: null,
    },
    {
      id: "anna-3",
      chatId: "anna",
      text: "Может, сегодня вечером прогуляемся? Погода наконец-то хорошая",
      createdAt: ago(72),
      authorId: "anna",
      authorName: "Анна",
      outgoing: false,
      read: true,
      kind: "text",
      fileName: null,
    },
    {
      id: "anna-4",
      chatId: "anna",
      text: "С удовольствием! Буду к семи",
      createdAt: ago(68),
      authorId: "me",
      authorName: "Вы",
      outgoing: true,
      read: true,
      kind: "text",
      fileName: null,
    },
  ],
  design: [
    {
      id: "design-1",
      chatId: "design",
      text: "Макет уже в фигме, можно смотреть",
      createdAt: ago(240),
      authorId: "anna",
      authorName: "Анна",
      outgoing: false,
      read: true,
      kind: "text",
      fileName: null,
    },
    {
      id: "design-2",
      chatId: "design",
      text: "Отлично, добавил комментарии к главной",
      createdAt: ago(205),
      authorId: "me",
      authorName: "Вы",
      outgoing: true,
      read: true,
      kind: "text",
      fileName: null,
    },
    {
      id: "design-3",
      chatId: "design",
      text: "Супер! Проверьте, пожалуйста, новый вариант карточки",
      createdAt: ago(43),
      authorId: "maxim",
      authorName: "Максим",
      outgoing: false,
      read: true,
      kind: "text",
      fileName: null,
    },
  ],
  mom: [
    {
      id: "mom-1",
      chatId: "mom",
      text: "Не забудь взять зонт, обещали дождь",
      createdAt: ago(390),
      authorId: "mom",
      authorName: "Мама",
      outgoing: false,
      read: true,
      kind: "text",
      fileName: null,
    },
    {
      id: "mom-2",
      chatId: "mom",
      text: "Хорошо, спасибо! Уже положил в сумку",
      createdAt: ago(372),
      authorId: "me",
      authorName: "Вы",
      outgoing: true,
      read: true,
      kind: "text",
      fileName: null,
    },
  ],
  maxim: [
    {
      id: "maxim-1",
      chatId: "maxim",
      text: "Кинул ссылку на плейлист, зацени",
      createdAt: ago(56),
      authorId: "maxim",
      authorName: "Максим",
      outgoing: false,
      read: true,
      kind: "text",
      fileName: null,
    },
  ],
  travel: [
    {
      id: "travel-1",
      chatId: "travel",
      text: "Билеты взяли! Вылетаем в пятницу утром",
      createdAt: ago(1_440),
      authorId: "anna",
      authorName: "Анна",
      outgoing: false,
      read: true,
      kind: "text",
      fileName: null,
    },
  ],
  dima: [
    {
      id: "dima-1",
      chatId: "dima",
      text: "Спасибо за помощь с переездом!",
      createdAt: ago(2_880),
      authorId: "dima",
      authorName: "Дима",
      outgoing: false,
      read: true,
      kind: "text",
      fileName: null,
    },
  ],
};

const timeFor = (value) =>
  new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });

function getChats() {
  return chats
    .map((chat) => {
      const history = messages[chat.id] || [];
      const latest = history[history.length - 1];
      return {
        ...chat,
        lastMessage: {
          text: latest?.text || "Начните общение",
          time: latest ? timeFor(latest.createdAt) : "",
          fromMe: latest?.outgoing || false,
          read: latest?.read || false,
        },
        sortTime: latest ? new Date(latest.createdAt).getTime() : 0,
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime)
    .map(({ sortTime, ...chat }) => chat);
}

function getMessages(chatId) {
  if (!chats.some((chat) => chat.id === chatId)) return null;
  return [...(messages[chatId] || [])];
}

function addMessage({ chatId, text, authorName, kind = "text", fileName = null }) {
  if (!chats.some((chat) => chat.id === chatId)) return null;

  const message = {
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chatId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    authorId: "me",
    authorName: authorName.trim() || "Вы",
    outgoing: true,
    read: false,
    kind,
    fileName,
  };

  messages[chatId] ||= [];
  messages[chatId].push(message);
  return message;
}

module.exports = { getChats, getMessages, addMessage };
