import { useState } from 'react';
import { CircleUserRound, MessageCircle, Search, Settings2, UserRound } from 'lucide-react';
import './_group.css';

const tabs = [
  { label: 'Чаты', icon: MessageCircle },
  { label: 'Контакты', icon: CircleUserRound },
  { label: 'Настройки', icon: Settings2 },
  { label: 'Профиль', icon: UserRound },
];

const chats = [
  { initials: 'М', name: 'Мария', preview: 'Увидимся вечером?', time: '15:42', color: '#a3486c' },
  { initials: 'А', name: 'Александр', preview: 'Отправил фотографию', time: '14:18', color: '#326c9b' },
  { initials: 'И', name: 'Ирина', preview: 'Спасибо, договорились', time: '12:07', color: '#55846d' },
  { initials: 'Р', name: 'Рабочая группа', preview: 'Новое сообщение', time: 'Вчера', color: '#8466a4' },
];

export function GlassBottomNav() {
  const [active, setActive] = useState('Чаты');

  return (
    <main className="mono-nav-demo mono-glass-screen">
      <header className="mono-glass-header">
        <div><small>MONO</small><h1>{active}</h1></div>
        <button className="mono-glass-search" type="button" aria-label="Поиск">
          <Search size={19} />
        </button>
      </header>
      <section className="mono-glass-list" aria-label="Последние переписки">
        {chats.map((chat) => (
          <article className="mono-glass-row" key={chat.name}>
            <span className="mono-glass-avatar" style={{ background: `linear-gradient(145deg, ${chat.color}, #202c39)` }}>
              {chat.initials}
            </span>
            <span className="mono-glass-copy">
              <b>{chat.name}</b>
              <span>{chat.preview}</span>
            </span>
            <time className="mono-glass-time">{chat.time}</time>
          </article>
        ))}
      </section>
      <button className="mono-glass-compose" type="button" aria-label="Новое сообщение">
        <MessageCircle size={22} />
      </button>
      <nav className="mono-glass-tabs" aria-label="Главное меню">
        {tabs.map(({ label, icon: Icon }) => (
          <button
            className={`mono-glass-tab ${active === label ? 'is-active' : ''}`}
            key={label}
            onClick={() => setActive(label)}
            type="button"
          >
            <span className="mono-glass-tab__icon"><Icon size={25} strokeWidth={2.1} /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
