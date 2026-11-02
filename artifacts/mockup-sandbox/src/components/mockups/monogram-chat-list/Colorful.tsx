import { CircleUserRound, MessageCircle, Plus, Search, Settings2, UserRound } from 'lucide-react';
import './_group.css';

const chats = [
  { id: 'user-alexander-174', displayName: 'Александр Смирнов', username: 'alex_s', message: 'Давай созвонимся вечером?', time: '12:41' },
  { id: 'user-ekaterina-528', displayName: 'Екатерина Волкова', username: 'katya_v', message: 'Фото очень красивое!', time: '11:18' },
  { id: 'user-mikhail-391', displayName: 'Михаил Орлов', username: 'm_orlov', message: 'Отправил документы', time: 'Вчера' },
  { id: 'user-daria-807', displayName: 'Дарья Иванова', username: 'dasha_i', message: 'Спасибо, договорились', time: 'Вт' },
  { id: 'user-leonid-263', displayName: 'Леонид Ким', username: 'leonid_k', message: 'Увидимся на выходных', time: 'Пн' },
];

const avatarPalette = [
  ['#f1767e', '#d64c61'],
  ['#ffa35e', '#e17442'],
  ['#b18af2', '#7956c8'],
  ['#65c88f', '#2e9167'],
  ['#61c8d0', '#27899e'],
  ['#79a8f8', '#456fc3'],
  ['#e782b5', '#bd4f87'],
] as const;

function colorIndex(id: string, displayName: string) {
  const seed = id || displayName || '?';
  let hash = 2166136261;
  for (const character of seed.toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % avatarPalette.length;
}

function Avatar({ id, displayName, size = 'md' }: { id: string; displayName: string; size?: 'sm' | 'md' }) {
  const [start, end] = avatarPalette[colorIndex(id, displayName)];
  return <span
    className={`avatar avatar-${size}`}
    style={{ background: `linear-gradient(145deg, ${start}, ${end})`, color: '#fff' }}
    aria-label={displayName}
  >
    {Array.from(displayName.trim())[0]?.toUpperCase() || '?'}
  </span>;
}

function Navigation() {
  const links = [
    { label: 'Чаты', Icon: MessageCircle, active: true },
    { label: 'Контакты', Icon: CircleUserRound },
    { label: 'Настройки', Icon: Settings2 },
    { label: 'Профиль', Icon: UserRound, isProfile: true },
  ];

  return <nav className="mono-tabbar mono-tabbar--compact" aria-label="Главная навигация">
    {links.map(({ label, Icon, active, isProfile }) => <a
      key={label}
      href="#"
      className={`mono-tab ${active ? 'mono-tab--active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="mono-tab__icon">{isProfile ? <Avatar id="user-self-103" displayName="Мария" size="sm" /> : <Icon strokeWidth={2.1} />}</span>
      <span className="mono-tab__label">{label}</span>
    </a>)}
  </nav>;
}

export function Colorful() {
  return <main className="mono-preview">
    <header className="chat-sidebar-head">
      <div><span className="overline">ВАШЕ ПРОСТРАНСТВО</span><h1>Сообщения</h1></div>
      <button className="round-action" aria-label="Начать переписку"><Plus size={19} /></button>
    </header>
    <div className="conversation-heading"><span>ЛИЧНЫЕ ПЕРЕПИСКИ</span><button aria-label="Искать сообщения"><Search size={16} /></button></div>
    <section className="conversation-list" aria-label="Список переписок">
      {chats.map(chat => <button className="conversation-row" key={chat.id}>
        <Avatar id={chat.id} displayName={chat.displayName} />
        <span className="conversation-row-copy">
          <span className="row-title">{chat.displayName}<time>{chat.time}</time></span>
          <span className="row-preview">{chat.message}</span>
          <span className="row-username">@{chat.username}</span>
        </span>
      </button>)}
    </section>
    <Navigation />
  </main>;
}
