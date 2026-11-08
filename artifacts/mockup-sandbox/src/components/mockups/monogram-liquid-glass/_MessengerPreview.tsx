import {
  Check,
  CheckCheck,
  CircleUserRound,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  PenLine,
  Search,
  Send,
  Settings2,
  Smile,
  UserRound,
} from "lucide-react";

const conversations = [
  { initials: "АМ", name: "Александра Морозова", time: "12:42", preview: "Уже отправила тебе подборку мест", tone: "lavender", unread: "2" },
  { initials: "ИК", name: "Илья Ковалёв", time: "11:18", preview: "Договорились, до встречи!", tone: "blue", unread: "" },
  { initials: "МК", name: "Мария Ким", time: "Вчера", preview: "Вы: Спасибо, очень красиво", tone: "peach", unread: "" },
  { initials: "ДП", name: "Дизайн-практика", time: "Пн", preview: "Новые материалы уже в канале", tone: "mint", unread: "" },
];

const messages = [
  { text: "Привет! Нашла то место, о котором ты рассказывал.", time: "12:38", mine: false },
  { text: "Да, оно самое. Там по утрам особенно красиво.", time: "12:39", mine: true },
  { text: "Сохранила адрес. Давай заглянем в субботу?", time: "12:40", mine: false },
  { text: "Отличная идея, буду свободен после обеда.", time: "12:41", mine: true },
  { text: "Уже отправила тебе подборку мест", time: "12:42", mine: false },
];

function Avatar({ initials, tone = "blue" }: { initials: string; tone?: string }) {
  return <span className={`avatar avatar-${tone}`} aria-hidden="true">{initials}</span>;
}

export function MessengerPreview({ theme = "light" }: { theme?: "light" | "dark" }) {
  return (
    <div className="mono-preview-root" data-theme={theme}>
      <div className="workspace">
        <div className="workspace-main">
          <div className="chat-layout chat-open">
            <aside className="chat-sidebar">
              <div className="chat-sidebar-top">
                <header className="chat-sidebar-head">
                  <div>
                    <span className="overline">MONOGRAM</span>
                    <h1>Чаты</h1>
                  </div>
                  <div className="chat-header-actions">
                    <button className="chat-menu-button" aria-label="Новый чат"><PenLine size={19} /></button>
                    <button className="chat-menu-button" aria-label="Дополнительное меню"><MoreVertical size={20} /></button>
                  </div>
                </header>
                <div className="search-control chat-search glass-surface">
                  <Search size={17} aria-hidden="true" />
                  <input aria-label="Поиск чатов" placeholder="Поиск чатов" readOnly />
                </div>
              </div>
              <div className="conversation-list">
                {conversations.map((chat, index) => (
                  <button className={`conversation-row ${index === 0 ? "row-selected" : ""}`} key={chat.name}>
                    <Avatar initials={chat.initials} tone={chat.tone} />
                    <span className="conversation-row-copy">
                      <span className="row-title"><span className="row-name">{chat.name}</span><time>{chat.time}</time></span>
                      <span className="row-bottom">
                        <span className="row-preview">
                          {index === 2 && <CheckCheck size={15} className="row-read-check" aria-label="Прочитано" />}
                          <span className="row-preview-text">{chat.preview}</span>
                        </span>
                        {chat.unread && <span className="conversation-unread">{chat.unread}</span>}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="chat-stage">
              <header className="chat-topbar glass-surface">
                <Avatar initials="АМ" tone="lavender" />
                <div className="chat-top-person">
                  <b>Александра Морозова</b>
                  <span className="presence-online">в сети</span>
                </div>
                <button className="quiet-icon" aria-label="Информация о собеседнике"><MoreHorizontal size={21} /></button>
              </header>
              <div className="message-area">
                <div className="message-day"><span>Сегодня</span></div>
                <div className="message-thread">
                  {messages.map((message, index) => (
                    <div className={`message-row ${message.mine ? "mine" : ""}`} key={`${message.time}-${index}`}>
                      <div className="message-bubble">
                        <p>{message.text}</p>
                        <time>{message.time} {message.mine && <Check size={12} />}</time>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <form className="composer">
                <button className="composer-attach" type="button" aria-label="Прикрепить файл"><Paperclip size={19} /></button>
                <textarea aria-label="Текст сообщения" placeholder="Напишите сообщение…" rows={1} readOnly />
                <button className="composer-emoji" type="button" aria-label="Добавить эмодзи"><Smile size={19} /></button>
                <span className="composer-count">Ввод — отправить</span>
                <button className="send-circle" type="button" aria-label="Отправить сообщение"><Send size={17} /></button>
              </form>
            </section>
          </div>
          <button className="chat-compose-fab" type="button" aria-label="Написать сообщение"><PenLine size={21} /></button>
          <nav className="mono-tabbar glass-surface" aria-label="Главная навигация">
            <a className="mono-tab mono-tab--active" href="#"><span className="mono-tab__icon"><MessageCircle size={22} /><i className="mono-tab__badge">2</i></span><span className="mono-tab__label">Чаты</span></a>
            <a className="mono-tab" href="#"><span className="mono-tab__icon"><CircleUserRound size={22} /></span><span className="mono-tab__label">Контакты</span></a>
            <a className="mono-tab" href="#"><span className="mono-tab__icon"><Settings2 size={22} /></span><span className="mono-tab__label">Настройки</span></a>
            <a className="mono-tab" href="#"><span className="mono-tab__icon"><UserRound size={22} /></span><span className="mono-tab__label">Профиль</span></a>
          </nav>
        </div>
      </div>
    </div>
  );
}
