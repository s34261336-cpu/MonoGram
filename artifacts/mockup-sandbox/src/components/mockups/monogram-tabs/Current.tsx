import { useState } from 'react';
import { CircleUserRound, Compass, MessageCircle, Star } from 'lucide-react';
import './_group.css';

const items = [
  { label: 'Сообщения', icon: MessageCircle },
  { label: 'Каналы', icon: Compass },
  { label: 'Звёзды', icon: Star },
  { label: 'Профиль', icon: CircleUserRound },
];

export function Current() {
  const [active, setActive] = useState('Сообщения');

  return (
    <div className="mono-nav-demo mono-current-screen">
      <aside className="mono-current-rail">
        <span className="mono-current-brand"><MessageCircle size={20} /></span>
        <nav className="mono-current-links" aria-label="Текущая навигация">
          {items.map(({ label, icon: Icon }) => (
            <button
              className={`mono-current-link ${active === label ? 'is-active' : ''}`}
              key={label}
              onClick={() => setActive(label)}
              type="button"
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="mono-current-content">
        <small>ТЕКУЩИЙ ВИД</small>
        <h1>{active}</h1>
        <p>Исходная вертикальная навигация Mono.</p>
      </main>
    </div>
  );
}
