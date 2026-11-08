import { useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  CircleUserRound,
  Compass,
  LogOut,
  MessageCircle,
  MoreVertical,
  Search,
  Settings2,
  Star,
  UserRound,
} from 'lucide-react';
import './_group.css';

type Screen = 'chats' | 'settings' | 'profile';
type Profile = { id: string; displayName: string; avatarUrl?: string | null };

const profile: Profile = {
  id: 'alex-morozov',
  displayName: 'Алексей Морозов',
};

const avatarPalette = [
  ['#34b8ff', '#635bff'],
  ['#8d68ff', '#d84fb5'],
  ['#32d2ad', '#3389ed'],
  ['#477dff', '#a34ff0'],
  ['#18bdd4', '#5369f4'],
  ['#75d65d', '#27a893'],
  ['#6d8cff', '#37c6df'],
] as const;

function avatarColorIndex(person?: Pick<Profile, 'id' | 'displayName'>) {
  const seed = person?.id || person?.displayName || '?';
  let hash = 2166136261;
  for (const character of seed.toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % avatarPalette.length;
}

function Avatar({ person = profile, size = 'md' }: {
  person?: Pick<Profile, 'id' | 'displayName' | 'avatarUrl'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [start, end] = avatarPalette[avatarColorIndex(person)];
  const initials = Array.from((person?.displayName || '?').trim())[0]?.toUpperCase() || '?';
  return <div
    className={`avatar avatar-${size}`}
    style={{ background: `linear-gradient(145deg, ${start}, ${end})`, color: '#fff' }}
    aria-label={person?.displayName || 'Профиль'}
  >
    {person?.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initials}
  </div>;
}

function Navigation({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  const links = [
    { href: '/', label: 'Чаты', testId: 'messages', icon: MessageCircle, screen: 'chats' as const },
    { href: '/contacts', label: 'Контакты', testId: 'contacts', icon: CircleUserRound, screen: 'chats' as const },
    { href: '/settings', label: 'Настройки', testId: 'settings', icon: Settings2, screen: 'settings' as const },
    { href: '/profile', label: 'Профиль', testId: 'my-profile', icon: UserRound, screen: 'profile' as const },
  ];
  return <nav className="mono-tabbar glass-surface" aria-label="Главная навигация">
    {links.map(({ href, label, testId, icon: Icon, screen: linkScreen }) => {
      const active = screen === linkScreen && (linkScreen !== 'chats' || href === '/');
      return <a
        key={href}
        href={href}
        className={`mono-tab ${active ? 'mono-tab--active' : ''}`}
        aria-current={active ? 'page' : undefined}
        data-testid={`link-${testId}`}
        onClick={event => { event.preventDefault(); onNavigate(linkScreen); }}
      >
        <span className="mono-tab__icon">
          {href === '/profile' ? <Avatar size="sm" /> : <Icon size={26} strokeWidth={2.1} />}
        </span>
        <span className="mono-tab__label">{label}</span>
      </a>;
    })}
  </nav>;
}

const conversations = [
  { id: 'maria', name: 'Мария Смирнова', time: '14:32', preview: 'Отлично, тогда до встречи!', unread: 2, own: false, read: false },
  { id: 'team', name: 'Команда MonoGram', time: '13:18', preview: 'Вы: Новый макет уже готов', unread: 0, own: true, read: true },
  { id: 'dmitry', name: 'Дмитрий Волков', time: 'Вчера', preview: 'Спасибо за помощь 🙌', unread: 0, own: false, read: false },
  { id: 'anna', name: 'Анна Кузнецова', time: 'Вчера', preview: 'Вы: Да, звучит хорошо', unread: 0, own: true, read: true },
  { id: 'travel', name: 'Планы на выходные', time: 'Пн', preview: 'Кто-нибудь уже выбрал маршрут?', unread: 0, own: false, read: false },
];

function ChatsScreen() {
  return <div className="page-screen chat-layout">
    <aside className="chat-sidebar">
      <div className="chat-sidebar-top">
        <header className="chat-sidebar-head">
          <h1>Чаты</h1>
          <div className="chat-header-actions">
            <button className="chat-menu-button" type="button" aria-label="Поиск чатов" title="Поиск чатов" data-testid="button-chat-search"><Search size={21} /></button>
            <button className="chat-menu-button" type="button" aria-label="Меню чатов" title="Меню чатов" data-testid="button-chat-menu"><MoreVertical size={22} /></button>
          </div>
        </header>
        <div className="search-control chat-search glass-surface">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Поиск чатов" placeholder="Поиск чатов" data-testid="input-chat-search" />
        </div>
      </div>
      <div className="conversation-list">
        {conversations.map(chat => <button className="conversation-row" key={chat.id} data-testid={`conversation-${chat.id}`}>
          <Avatar person={{ id: chat.id, displayName: chat.name }} />
          <span className="conversation-row-copy">
            <span className="row-title"><span className="row-name">{chat.name}</span><time>{chat.time}</time></span>
            <span className="row-bottom">
              <span className="row-preview">
                {chat.own && (chat.read
                  ? <CheckCheck size={16} className="row-read-check" aria-label="Прочитано" />
                  : <Check size={14} className="row-sent-check" aria-label="Отправлено" />)}
                <span className="row-preview-text">{chat.preview}</span>
              </span>
              {chat.unread > 0 && <span className="conversation-unread" aria-label={`${chat.unread} непрочитанных`}>{chat.unread}</span>}
            </span>
          </span>
        </button>)}
      </div>
    </aside>
  </div>;
}

function SettingsScreen() {
  return <div className="page-screen page-content mono-page">
    <header className="mono-screen-header">
      <span className="mono-screen-header-spacer" aria-hidden="true" />
      <h1>Настройки</h1>
      <div className="mono-screen-header-actions">
        <button type="button" aria-label="Поиск настроек" title="Поиск настроек" data-testid="button-settings-search"><Search size={21} /></button>
        <button type="button" aria-label="Дополнительные действия" title="Дополнительные действия" data-testid="button-settings-menu"><MoreVertical size={21} /></button>
      </div>
    </header>
    <section className="mono-settings-list" aria-label="Разделы приложения">
      <a className="mono-settings-row" href="/profile" data-testid="link-profile-settings" onClick={event => event.preventDefault()}>
        <span className="mono-settings-icon"><UserRound size={19} /></span>
        <span><b>Профиль</b><small>Имя, имя пользователя и описание</small></span>
        <ArrowRight size={17} />
      </a>
      <a className="mono-settings-row" href="/channels" data-testid="link-channels" onClick={event => event.preventDefault()}>
        <span className="mono-settings-icon"><Compass size={19} /></span>
        <span><b>Каналы</b><small>Публикации и подписки</small></span>
        <ArrowRight size={17} />
      </a>
      <a className="mono-settings-row" href="/stars" data-testid="link-stars" onClick={event => event.preventDefault()}>
        <span className="mono-settings-icon"><Star size={19} /></span>
        <span><b>Звёзды MonoGram</b><small>Баланс и история операций</small></span>
        <ArrowRight size={17} />
      </a>
      <button className="mono-settings-row mono-settings-row--logout" type="button">
        <span className="mono-settings-icon"><LogOut size={19} /></span>
        <span><b>Выйти из аккаунта</b><small>Завершить текущий сеанс</small></span>
        <ArrowRight size={17} />
      </button>
    </section>
  </div>;
}

function ProfileScreen() {
  return <div className="page-screen page-content tg-profile-page">
    <main className="tg-profile">
      <header className="mono-screen-header tg-profile-toolbar">
        <span className="mono-screen-header-spacer" aria-hidden="true" />
        <h2>Профиль</h2>
        <div className="mono-screen-header-actions">
          <button type="button" aria-label="Поиск контактов" title="Поиск контактов" data-testid="button-profile-search"><Search size={21} /></button>
          <button type="button" aria-label="Дополнительные действия" title="Дополнительные действия" data-testid="button-profile-menu"><MoreVertical size={21} /></button>
        </div>
      </header>
      <header className="tg-profile-header">
        <div className="tg-profile-avatar-wrap">
          <Avatar size="lg" />
          <button className="tg-profile-camera" type="button" aria-label="Изменить фото профиля"><Camera size={18} /></button>
        </div>
        <h1>{profile.displayName}</h1>
        <span className="tg-profile-status">+7 (999) 123-45-67 · @alexmorozov</span>
      </header>
      <div className="tg-profile-actions" aria-label="Действия профиля">
        <button type="button" data-testid="button-profile-photo"><Camera size={19} /><span>Выбрать фото</span></button>
        <button type="button" data-testid="button-edit-profile"><UserRound size={19} /><span>Изменить</span></button>
        <button type="button" data-testid="button-profile-settings"><Settings2 size={19} /><span>Настройки</span></button>
      </div>
      <section className="tg-profile-card glass-card" aria-label="Данные профиля">
        <div className="tg-profile-info-row">
          <p>+7 (999) 123-45-67</p>
          <span>Телефон</span>
        </div>
        <div className="tg-profile-info-row tg-profile-bio-row">
          <button className="tg-profile-bio-trigger" type="button" aria-haspopup="menu" data-testid="button-profile-bio-menu">
            <p>Дизайнер и путешественник</p>
            <span>О себе</span>
          </button>
        </div>
        <div className="tg-profile-info-row">
          <p className="tg-profile-username">@alexmorozov</p>
          <span>Имя пользователя</span>
        </div>
      </section>
    </main>
  </div>;
}

export function Current() {
  const [screen, setScreen] = useState<Screen>('chats');
  return <div className="monogram-light-refresh">
    <div className="screen-switcher" aria-label="Экран предпросмотра">
      {(['chats', 'settings', 'profile'] as const).map((value, index) => (
        <button
          className={screen === value ? 'screen-switcher__active' : ''}
          key={value}
          type="button"
          onClick={() => setScreen(value)}
        >
          {['Чаты', 'Настройки', 'Профиль'][index]}
        </button>
      ))}
    </div>
    <div className="screen-viewport">
      {screen === 'chats' ? <ChatsScreen /> : screen === 'settings' ? <SettingsScreen /> : <ProfileScreen />}
      <Navigation screen={screen} onNavigate={setScreen} />
    </div>
  </div>;
}
