import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { io, type Socket } from 'socket.io-client';
import {
  ArrowLeft, Check, CheckCheck, ChevronDown, FileText, Headphones, Menu, Mic, MoreVertical,
  Paperclip, Search, Send, Settings, Smile, X, WifiOff, MessageCircle,
} from 'lucide-react';
import {
  getGetChatsQueryKey, getGetChatMessagesQueryKey, useGetChats, useGetChatMessages, useSendMessage,
} from '@workspace/api-client-react';
import type { Chat, Message, MessageInput } from '@workspace/api-client-react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true } },
});
type Profile = { phone: string; name: string };

function readProfile(): Profile | null {
  try {
    const value = localStorage.getItem('telegram.profile');
    return value ? JSON.parse(value) as Profile : null;
  } catch { return null; }
}

function Avatar({ chat, size = 'normal' }: { chat: Pick<Chat, 'initials' | 'color' | 'name'>; size?: 'normal' | 'small' }) {
  return <div aria-label={chat.name} className={`avatar ${size === 'small' ? 'avatar-small' : ''}`} style={{ background: chat.color || '#406783' }}>{chat.initials || chat.name.slice(0, 1)}</div>;
}

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function Login({ onLogin }: { onLogin: (profile: Profile) => void }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (phone.replace(/\D/g, '').length < 7) { setError('Введите номер телефона, чтобы продолжить'); return; }
    if (name.trim().length < 2) { setError('Укажите имя для переписки'); return; }
    onLogin({ phone: phone.trim(), name: name.trim() });
  };
  return <main className="login-screen">
    <section className="login-card fade-in">
      <div className="brand-mark"><MessageCircle size={30} strokeWidth={2.1} /></div>
      <span className="eyebrow">ЛИЧНЫЕ СООБЩЕНИЯ</span>
      <h1>Начните разговор</h1>
      <p className="login-copy">Введите номер и имя. Код из SMS не понадобится.</p>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="phone">Номер телефона</label>
        <input id="phone" data-testid="input-phone" type="tel" autoComplete="tel" placeholder="+7 900 123-45-67" value={phone} onChange={e => { setPhone(e.target.value); setError(''); }} />
        <label htmlFor="displayName">Как вас зовут?</label>
        <input id="displayName" data-testid="input-display-name" maxLength={80} placeholder="Ваше имя" value={name} onChange={e => { setName(e.target.value); setError(''); }} />
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="login-submit" data-testid="button-sign-in" type="submit">Продолжить <Send size={16} /></button>
      </form>
      <div className="privacy-note"><span className="privacy-dot" /> Локальный вход без подтверждения по SMS</div>
    </section>
  </main>;
}

function MessageStatus({ read }: { read: boolean }) {
  return read ? <CheckCheck size={15} className="read-check" /> : <Check size={15} className="message-check" />;
}

function SkeletonRows() {
  return <div className="skeleton-list" aria-label="Загрузка чатов">{[1, 2, 3, 4, 5].map(n => <div className="skeleton-row" key={n}><i /><div><b /><span /></div></div>)}</div>;
}

function Messenger() {
  const [profile, setProfile] = useState<Profile | null>(() => readProfile());
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [socketOnline, setSocketOnline] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const chatId = location.startsWith('/chat/') ? decodeURIComponent(location.slice('/chat/'.length)) : '';
  const activeChatIdRef = useRef(chatId);
  activeChatIdRef.current = chatId;
  const chatsQuery = useGetChats({ query: { enabled: !!profile, queryKey: getGetChatsQueryKey() } });
  const messagesQuery = useGetChatMessages(chatId, { query: { enabled: !!profile && !!chatId, queryKey: getGetChatMessagesQueryKey(chatId) } });
  const sendMessage = useSendMessage();
  const chats = (chatsQuery.data ?? []) as Chat[];
  const messages = (messagesQuery.data ?? []) as Message[];
  const activeChat = chats.find(chat => chat.id === chatId);
  const visibleChats = useMemo(() => chats.filter(chat => `${chat.name} ${chat.lastMessage?.text ?? ''}`.toLocaleLowerCase('ru').includes(filter.toLocaleLowerCase('ru'))), [chats, filter]);

  useEffect(() => {
    if (!profile) return;
    const socket: Socket = io(window.location.origin, { path: '/api/socket.io', autoConnect: true, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 700, reconnectionDelayMax: 6000 });
    socket.on('connect', () => {
      setSocketOnline(true);
      socket.emit('presence:join', { displayName: profile.name });
    });
    socket.on('disconnect', () => setSocketOnline(false));
    socket.on('connect_error', () => setSocketOnline(false));
    socket.on('message:new', (incoming: Message) => {
      if (!incoming?.chatId || !incoming?.id) return;
      queryClient.setQueryData<Message[]>(getGetChatMessagesQueryKey(incoming.chatId), old => {
        const list = old ?? [];
        return list.some(message => message.id === incoming.id) ? list : [...list, incoming];
      });
      queryClient.setQueryData<Chat[]>(getGetChatsQueryKey(), old => {
        if (!old) return old;
        return old.map(chat => chat.id === incoming.chatId ? {
          ...chat, lastMessage: { text: incoming.text, time: incoming.createdAt, fromMe: incoming.outgoing, read: incoming.read },
          unreadCount: incoming.outgoing || incoming.chatId === activeChatIdRef.current ? chat.unreadCount : chat.unreadCount + 1,
        } : chat);
      });
    });
    socket.on('presence:update', (payload: { onlineCount?: number; id?: string; chatId?: string; online?: boolean; userId?: string }) => {
      if (typeof payload.onlineCount === 'number') setOnlineCount(payload.onlineCount);
      const targetId = payload.chatId ?? payload.id ?? payload.userId;
      if (!targetId || typeof payload.online !== 'boolean') return;
      queryClient.setQueryData<Chat[]>(getGetChatsQueryKey(), old => old?.map(chat => chat.id === targetId ? { ...chat, online: payload.online! } : chat));
    });
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [profile, queryClient]);

  useEffect(() => {
    if (messages.length) messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, chatId]);

  useEffect(() => { setDraft(''); setSendError(''); }, [chatId]);

  const login = (next: Profile) => {
    localStorage.setItem('telegram.profile', JSON.stringify(next));
    setProfile(next);
  };
  const logout = () => {
    localStorage.removeItem('telegram.profile');
    setProfile(null);
    setLocation('/');
  };
  const send = (text: string, kind: MessageInput['kind'] = 'text', fileName?: string) => {
    if (!activeChat || !profile || !text.trim() || sendMessage.isPending) return;
    setSendError('');
    sendMessage.mutate({ data: { chatId: activeChat.id, text: text.trim(), authorName: profile.name, kind, fileName } }, {
      onSuccess: message => {
        queryClient.setQueryData<Message[]>(getGetChatMessagesQueryKey(activeChat.id), old => {
          const list = old ?? [];
          return list.some(item => item.id === message.id) ? list : [...list, message];
        });
        queryClient.invalidateQueries({ queryKey: getGetChatsQueryKey() });
        setDraft('');
      },
      onError: () => setSendError('Не удалось отправить сообщение. Проверьте соединение и попробуйте ещё раз.'),
    });
  };
  const submitDraft = (event: FormEvent) => { event.preventDefault(); send(draft); };
  const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(draft); }
  };
  const attachFile = (file?: File) => {
    if (!file || !activeChat) return;
    send(file.name, 'file', file.name);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (!profile) return <Login onLogin={login} />;

  return <main className={`app-shell ${chatId ? 'mobile-chat-open' : ''}`}>
    <aside className="sidebar">
      <header className="sidebar-top">
        <button className="icon-button menu-trigger" aria-label="Меню" data-testid="button-menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={21} /></button>
        <button className="profile-chip" onClick={() => setMenuOpen(!menuOpen)} data-testid="button-profile"><span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span><span>{profile.name}</span><ChevronDown size={14} /></button>
        <button className={`icon-button ${searchOpen ? 'active' : ''}`} aria-label="Поиск" data-testid="button-search" onClick={() => { setSearchOpen(!searchOpen); setFilter(''); }}><Search size={19} /></button>
      </header>
      {menuOpen && <div className="profile-menu fade-in"><div className="menu-profile"><span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span><div><strong>{profile.name}</strong><small>{profile.phone}</small></div></div><button onClick={logout} data-testid="button-sign-out"><Settings size={16} /> Выйти из аккаунта</button></div>}
      {searchOpen && <div className="search-box"><Search size={17} /><input autoFocus data-testid="input-search" placeholder="Поиск" value={filter} onChange={e => setFilter(e.target.value)} /><button onClick={() => { setSearchOpen(false); setFilter(''); }} aria-label="Закрыть поиск"><X size={17} /></button></div>}
      <div className="sidebar-caption"><span>СООБЩЕНИЯ</span><span>{chats.length ? chats.length : ''}</span></div>
      <div className="chat-list-scroll">
        {chatsQuery.isLoading ? <SkeletonRows /> : chatsQuery.isError ? <div className="state-card"><WifiOff size={22} /><strong>Чаты не загрузились</strong><p>Проверьте подключение к сети.</p><button onClick={() => chatsQuery.refetch()} data-testid="button-retry-chats">Повторить</button></div> : visibleChats.length === 0 ? <div className="state-card empty-list"><MessageCircle size={24} /><strong>{filter ? 'Ничего не найдено' : 'Пока нет переписок'}</strong><p>{filter ? 'Попробуйте изменить запрос.' : 'Когда появятся новые сообщения, они будут здесь.'}</p></div> : visibleChats.map(chat => <button className={`chat-row ${chat.id === chatId ? 'selected' : ''}`} key={chat.id} onClick={() => { setLocation(`/chat/${encodeURIComponent(chat.id)}`); setMenuOpen(false); }} data-testid={`chat-row-${chat.id}`}>
          <div className="avatar-wrap"><Avatar chat={chat} />{chat.online && !chat.isGroup && <span className="online-dot" />}</div>
          <div className="chat-row-content">
            <div className="chat-row-heading"><strong>{chat.name}</strong><time>{formatTime(chat.lastMessage?.time)}</time></div>
            <div className="chat-preview"><span>{chat.lastMessage?.fromMe && <span className="preview-check"><MessageStatus read={chat.lastMessage.read} /></span>}{chat.lastMessage?.text || 'Начните переписку'}</span>{chat.unreadCount > 0 && <b className="unread-badge">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</b>}</div>
          </div>
        </button>)}
      </div>
      <div className="sidebar-footer"><span className={`connection-indicator ${socketOnline ? 'is-online' : ''}`}><i />{socketOnline ? `${onlineCount} в сети` : 'Переподключение'}</span><span>Мессенджер</span></div>
    </aside>
    <section className="conversation">
      {activeChat ? <>
        <header className="conversation-header">
          <button className="icon-button back-button" onClick={() => setLocation('/')} aria-label="К списку чатов" data-testid="button-back"><ArrowLeft size={20} /></button>
          <div className="header-avatar"><Avatar chat={activeChat} size="small" /></div>
          <div className="conversation-person"><strong>{activeChat.name}</strong><span>{activeChat.online ? 'в сети' : activeChat.isGroup ? 'группа' : 'был(а) недавно'}</span></div>
          <div className="header-actions"><button className="icon-button" aria-label="Поиск в чате" onClick={() => { setSearchOpen(true); setLocation('/'); }}><Search size={19} /></button><button className="icon-button" aria-label="Дополнительные действия" onClick={() => setMenuOpen(!menuOpen)}><MoreVertical size={20} /></button></div>
        </header>
        {!socketOnline && <div className="reconnect-banner"><WifiOff size={14} /> Соединение прервано. Переподключаемся…</div>}
        <div className="message-scroll message-backdrop">
          <div className="date-pill">СЕГОДНЯ</div>
          {messagesQuery.isLoading ? <div className="message-loading"><span /><span /><span /></div> : messagesQuery.isError ? <div className="conversation-state"><WifiOff size={22} /><strong>Не удалось загрузить сообщения</strong><button onClick={() => messagesQuery.refetch()} data-testid="button-retry-messages">Повторить</button></div> : messages.length === 0 ? <div className="welcome-chat fade-in"><div className="welcome-icon"><MessageCircle size={26} /></div><strong>Здесь начнётся ваша переписка</strong><span>Напишите первое сообщение</span></div> : messages.map(message => <div className={`message-line ${message.outgoing ? 'outgoing' : 'incoming'}`} key={message.id} data-testid={`message-${message.id}`}>
            {!message.outgoing && activeChat.isGroup && <span className="message-author">{message.authorName}</span>}
            <div className={`message-bubble ${message.outgoing ? 'bubble-out' : 'bubble-in'}`}>
              {message.kind === 'file' && <div className="file-preview"><span><FileText size={18} /></span><div><strong>{message.fileName || message.text}</strong><small>Файл</small></div></div>}
              {message.kind === 'voice' && <div className="voice-preview"><span className="voice-play"><Headphones size={15} /></span><i className="voice-wave" /><span>Голосовое сообщение</span></div>}
              {message.kind === 'text' && <span>{message.text}</span>}
              <time>{formatTime(message.createdAt)}{message.outgoing && <MessageStatus read={message.read} />}</time>
            </div>
          </div>)}
          <div ref={messageEndRef} />
        </div>
        <div className="composer-area">
          {sendError && <div className="send-error" role="alert">{sendError}<button onClick={() => send(draft)} data-testid="button-retry-send">Повторить</button></div>}
          <form className="composer" onSubmit={submitDraft}>
            <input ref={fileRef} type="file" className="sr-only" onChange={e => attachFile(e.target.files?.[0])} data-testid="input-attachment" />
            <button type="button" className="composer-icon" aria-label="Прикрепить файл" data-testid="button-attach" onClick={() => fileRef.current?.click()}><Paperclip size={21} /></button>
            <textarea rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onComposerKey} placeholder="Сообщение" maxLength={4000} data-testid="input-message" />
            <button type="button" className="composer-icon emoji-button" aria-label="Добавить точку в конец" onClick={() => setDraft(value => `${value}${value ? ' ' : ''}…`)}><Smile size={20} /></button>
            {draft.trim() ? <button className="send-button" type="submit" aria-label="Отправить сообщение" disabled={sendMessage.isPending} data-testid="button-send"><Send size={18} /></button> : <button className={`send-button mic-button ${isRecording ? 'recording' : ''}`} type="button" aria-label={isRecording ? 'Отправить голосовое сообщение' : 'Записать голосовое сообщение'} data-testid="button-voice" onClick={() => { if (isRecording) { setIsRecording(false); send('Голосовое сообщение', 'voice'); } else setIsRecording(true); }}><Mic size={19} /></button>}
          </form>
          <div className="composer-hint">Enter — отправить <span>·</span> Shift + Enter — новая строка</div>
        </div>
      </> : <div className="empty-conversation message-backdrop"><div className="empty-center"><div className="empty-logo"><MessageCircle size={30} /></div><strong>Выберите чат</strong><span>Откройте переписку, чтобы увидеть сообщения</span></div><div className="connection-pill"><span className={`status-pip ${socketOnline ? 'live' : ''}`} />{socketOnline ? 'Соединение активно' : 'Ожидание соединения'}</div></div>}
    </section>
  </main>;
}

function Router() {
  return <ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/" component={Messenger} /><Route path="/chat/:chatId" component={Messenger} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
