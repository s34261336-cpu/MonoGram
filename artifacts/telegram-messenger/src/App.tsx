import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, Link, useLocation, useParams } from 'wouter';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useChats, useChannels, useCreateChannel, useCreatePost, useJoinChannel, useMessages, useMessengerRealtime, usePosts, useProfile, useSaveProfile, useSendMessage, useSendStars, useStartConversation, useUserSearch, useWallet } from '@/hooks/use-messenger';
import { usePresence } from '@/hooks/use-presence';
import type { Channel, ChannelPost, Conversation, DirectMessage, Profile } from '@/lib/messenger';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowLeft, AtSign, Check, ChevronDown, CircleUserRound, Compass, Crown, Hash, LoaderCircle, LogOut, Menu, MessageCircle, MoreHorizontal, Plus, Search, Send, Settings2, Shield, Sparkles, Star, Wallet, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 12_000, retry: 1, refetchOnWindowFocus: true } } });
const dateLabel = (value?: string) => value ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: ru }) : '';
const clock = (value?: string) => value ? format(new Date(value), 'HH:mm') : '';
const initials = (name?: string) => (name || '?').trim().slice(0, 1).toUpperCase();
const channelCountLabel = (count: number) => {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'каналов';
  if (last === 1) return 'канал';
  if (last >= 2 && last <= 4) return 'канала';
  return 'каналов';
};
const transactionLabel = (reason: string) => ({
  welcome_bonus: 'Приветственный бонус',
  channel_reaction: 'Отправка звёзд за публикацию',
}[reason] || 'Операция со звёздами');

function userError(error: unknown, fallback: string) {
  const details = typeof error === 'object' && error !== null
    ? error as { message?: unknown; code?: unknown; status?: unknown }
    : {};
  const message = error instanceof Error
    ? error.message
    : typeof details.message === 'string' ? details.message : '';
  const code = typeof details.code === 'string' ? details.code.toLowerCase() : '';
  const status = typeof details.status === 'number' ? details.status : 0;
  const normalized = `${message} ${code}`.toLowerCase();
  if (/invalid login credentials|invalid email or password/.test(normalized)) return 'Неверный адрес почты или пароль.';
  if (/email not confirmed/.test(normalized) || code === 'email_not_confirmed') return 'Сначала подтвердите адрес электронной почты.';
  if (/недостаточно monostars/.test(normalized)) return 'Недостаточно звёзд MonoGram.';
  if (/user already registered|already exists|duplicate key/.test(normalized) || ['user_already_exists', 'email_exists'].includes(code)) return 'Эти данные уже используются. Проверьте адрес почты и имя пользователя.';
  if (/signup.*disabled|signups?.*(not allowed|disabled)|registration.*(not allowed|disabled)|not allowed.*signup/.test(normalized) || code === 'signup_disabled') return 'Регистрация отключена. Разрешите создание аккаунтов по электронной почте в настройках Supabase.';
  if (/unable to validate email|invalid email|email address.*invalid/.test(normalized) || code === 'email_address_invalid') return 'Введите корректный адрес электронной почты.';
  if (/database error saving new user|database error creating user/.test(normalized)) return 'Supabase не смог сохранить профиль при регистрации. Нужно проверить триггер создания профиля в базе данных.';
  if (/error sending confirmation email|failed to send.*email|smtp.*(error|not configured)/.test(normalized) || code === 'email_provider_disabled') return 'Не удалось отправить письмо для подтверждения. Проверьте настройки почты в Supabase.';
  if (/security purposes|only request this after/.test(normalized)) return 'Слишком частые попытки. Подождите минуту и попробуйте снова.';
  if (/password.*(weak|short|characters)|at least \d+ characters/.test(normalized) || code === 'weak_password') return 'Пароль слишком короткий. Используйте не менее 8 символов.';
  if (/rate limit|too many requests/.test(normalized) || status === 429) return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  if (/failed to fetch|network|fetch error/.test(normalized) || status === 503) return 'Не удалось подключиться. Проверьте интернет и попробуйте снова.';
  if (/[А-Яа-яЁё]/.test(message)) return message;
  return fallback;
}

function Avatar({ profile, size = 'md' }: { profile?: Pick<Profile, 'displayName' | 'avatarUrl'>; size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`avatar avatar-${size}`} aria-label={profile?.displayName || 'Профиль'}>{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile?.displayName)}</div>;
}

function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const schema = z.object({
    displayName: z.string().optional(),
    email: z.string().email('Введите корректный адрес электронной почты.'),
    password: z.string().min(8, 'Пароль должен содержать не менее 8 символов.'),
  }).refine(v => !register || (v.displayName || '').trim().length >= 2, { path: ['displayName'], message: 'Имя должно содержать не менее 2 символов.' });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { displayName: '', email: '', password: '' } });
  async function submit(values: z.infer<typeof schema>) {
    setError(''); setBusy(true);
    try {
      if (register) {
        const signedIn = await signUp(values.email, values.password, values.displayName || '');
        setError(signedIn ? '' : 'Проверьте почту, подтвердите адрес и затем войдите.');
        if (!signedIn) setRegister(false);
      } else await signIn(values.email, values.password);
    } catch (e) {
      setError(userError(
        e,
        register
          ? 'Не удалось создать аккаунт. Проверьте адрес почты и настройки регистрации, затем попробуйте снова.'
          : 'Не удалось войти. Проверьте адрес почты и пароль.',
      ));
    }
    finally { setBusy(false); }
  }
  return <main className="auth-page">
    <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" />
    <section className="auth-panel glass-card">
      <div className="brand-lockup"><div className="brand-icon"><MessageCircle size={22} /></div><span>monogram<span className="brand-period">.</span></span></div>
      <div className="auth-kicker">Общение без лишнего шума</div>
      <h1>{register ? 'Больше места для близких.' : 'Ваши разговоры —\nтолько ваши.'}</h1>
      <p className="auth-description">Личные сообщения, интересные каналы и звёзды MonoGram — в одном месте.</p>
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="form-stack">
        {register && <FormField control={form.control} name="displayName" render={({ field }) => <FormItem><FormLabel>Ваше имя</FormLabel><FormControl><Input data-testid="input-display-name" placeholder="Как к вам обращаться" {...field} /></FormControl><FormMessage /></FormItem>} />}
        <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Адрес электронной почты</FormLabel><FormControl><Input data-testid="input-email" type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Пароль</FormLabel><FormControl><Input data-testid="input-password" type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder="Не менее 8 символов" {...field} /></FormControl><FormMessage /></FormItem>} />
        {error && <p className="form-error" role="alert" data-testid="auth-message">{error}</p>}
        <Button className="primary-button auth-submit" type="submit" disabled={busy} data-testid={register ? 'button-register' : 'button-sign-in'}>{busy ? <LoaderCircle className="spin" size={17} /> : register ? 'Создать аккаунт' : 'Войти'}<ArrowLeft className="submit-arrow" size={16} /></Button>
      </form></Form>
      <div className="auth-switch">{register ? 'Уже есть аккаунт MonoGram?' : 'Впервые в MonoGram?'} <button type="button" data-testid="button-toggle-auth" onClick={() => { setRegister(!register); setError(''); }}> {register ? 'Войти' : 'Создать аккаунт'}</button></div>
      <div className="auth-foot"><Shield size={14} /> Ваш аккаунт по умолчанию закрыт</div>
    </section>
    <div className="auth-side-note"><span className="note-rule" /> ДЛЯ НАСТОЯЩИХ РАЗГОВОРОВ</div>
  </main>;
}

function Navigation({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const [path] = useLocation();
  const links = [{ href: '/', label: 'Сообщения', testId: 'messages', icon: MessageCircle }, { href: '/channels', label: 'Каналы', testId: 'channels', icon: Compass }, { href: '/stars', label: 'Звёзды', testId: 'monostars', icon: Star }, { href: '/profile', label: 'Профиль', testId: 'my-profile', icon: CircleUserRound }];
  return <nav className={`nav-links ${compact ? 'nav-compact' : ''}`}>{links.map(({ href, label, testId, icon: Icon }) => <Link key={href} href={href} onClick={onNavigate} className={`nav-item ${path === href || (href === '/channels' && path.startsWith('/channels/')) ? 'nav-active' : ''}`} data-testid={`link-${testId}`}><Icon size={18} /><span>{label}</span>{href === '/stars' && <span className="nav-new">СЧЁТ</span>}</Link>)}</nav>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const profileQuery = useProfile(user?.id || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const profile = profileQuery.data;
  useMessengerRealtime(user?.id || '');
  async function logout() { await signOut(); }
  return <div className="workspace">
    <aside className="rail">
      <Link href="/" className="rail-brand" aria-label="На главную MonoGram"><span className="brand-icon"><MessageCircle size={20} /></span></Link>
      <Navigation />
      <div className="rail-bottom">
        <button className="rail-profile" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню аккаунта" data-testid="button-account-menu"><Avatar profile={profile} size="sm" /></button>
        {menuOpen && <div className="account-pop glass-card">
          <div className="account-pop-head"><Avatar profile={profile} size="sm" /><div><b>{profile?.displayName || 'Ваш профиль'}</b><span>@{profile?.username || 'никнейм'}</span></div></div>
          <Link href="/profile" onClick={() => setMenuOpen(false)}><Settings2 size={16} /> Изменить профиль</Link>
          <button onClick={logout} data-testid="button-sign-out"><LogOut size={16} /> Выйти</button>
        </div>}
        <button className="mobile-menu-toggle" aria-label="Открыть меню" onClick={() => setMobileNav(!mobileNav)} data-testid="button-mobile-menu"><Menu size={20} /></button>
      </div>
    </aside>
    {mobileNav && <div className="mobile-nav glass-card"><button className="close-mobile-nav" onClick={() => setMobileNav(false)} aria-label="Закрыть меню"><X size={19} /></button><Navigation compact onNavigate={() => setMobileNav(false)} /></div>}
    <div className="workspace-main">{children}</div>
  </div>;
}

function ChatWorkspace() {
  const { user, session } = useAuth();
  const [path, setPath] = useLocation();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [username, setUsername] = useState('');
  const [newChat, setNewChat] = useState(false);
  const [startError, setStartError] = useState('');
  const id = path.startsWith('/chat/') ? decodeURIComponent(path.slice(6)) : '';
  const chatsQuery = useChats(user?.id || '');
  const messagesQuery = useMessages(id, user?.id || '');
  const profileQuery = useProfile(user?.id || '');
  const presence = usePresence(session?.access_token);
  const chats = chatsQuery.data || [];
  const current = chats.find(c => c.id === id);
  const sendMessage = useSendMessage(user?.id || '');
  const startConversation = useStartConversation(user?.id || '');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const searchUsers = useUserSearch(username.replace(/^@/, ''), user?.id || '');
  const filtered = useMemo(() => chats.filter(c => `${c.person.displayName} ${c.person.username} ${c.lastMessage?.content || ''}`.toLowerCase().includes(search.toLowerCase())), [chats, search]);
  useEffect(() => { setDraft(''); setError(''); }, [id]);
  useEffect(() => { if (messagesQuery.data?.length) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messagesQuery.data?.length, id]);
  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!user || !id || !draft.trim() || sendMessage.isPending) return;
    setError('');
    try { await sendMessage.mutateAsync({ conversationId: id, authorId: user.id, content: draft.trim() }); setDraft(''); }
    catch (e) { setError(userError(e, 'Не удалось отправить сообщение.')); }
  }
  async function beginChat(value = username) {
    setStartError('');
    try { const conversationId = await startConversation.mutateAsync(value.trim().replace(/^@/, '')); setNewChat(false); setUsername(''); setPath(`/chat/${encodeURIComponent(conversationId)}`); }
    catch (e) { setStartError(userError(e, 'Не удалось начать переписку.')); }
  }
  const messages = messagesQuery.data || [];
  return <div className={`chat-layout ${id ? 'chat-open' : ''}`}>
    <aside className="chat-sidebar">
      <header className="chat-sidebar-head">
        <div><span className="overline">ВАШЕ ПРОСТРАНСТВО</span><h1>Сообщения</h1></div>
        <button className="round-action" onClick={() => setNewChat(true)} title="Начать переписку" aria-label="Начать переписку" data-testid="button-new-chat"><Plus size={19} /></button>
      </header>
      {showSearch && <div className="search-control"><Search size={16} /><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти переписку" data-testid="input-chat-search" /><button onClick={() => { setSearch(''); setShowSearch(false); }} aria-label="Закрыть поиск"><X size={16} /></button></div>}
      <div className="conversation-heading"><span>ЛИЧНЫЕ ПЕРЕПИСКИ</span><button onClick={() => setShowSearch(!showSearch)} aria-label="Искать сообщения" data-testid="button-search-chats"><Search size={16} /></button></div>
      <div className="conversation-list">
        {chatsQuery.isLoading ? <div className="list-skeleton">{[1,2,3,4].map(i => <div className="skeleton-chat" key={i}><i/><span/><b/></div>)}</div> : chatsQuery.isError ? <StateBlock title="Не удалось загрузить сообщения" detail="Проверьте подключение и попробуйте снова." action="Повторить" onAction={() => chatsQuery.refetch()} /> : filtered.length === 0 ? <div className="sidebar-empty"><div className="empty-mark"><MessageCircle size={19}/></div><b>{search ? 'Ничего не найдено' : 'Пока здесь тихо'}</b><p>{search ? 'Попробуйте другое имя или никнейм.' : 'Найдите человека по имени пользователя, чтобы начать личную переписку.'}</p>{!search && <button className="text-action" onClick={() => setNewChat(true)} data-testid="button-start-first-chat">Найти человека <ArrowLeft size={14}/></button>}</div> : filtered.map((chat: Conversation) => <button className={`conversation-row ${id === chat.id ? 'row-selected' : ''}`} key={chat.id} onClick={() => setPath(`/chat/${encodeURIComponent(chat.id)}`)} data-testid={`conversation-${chat.id}`}>
          <Avatar profile={chat.person} />
          <span className="conversation-row-copy"><span className="row-title">{chat.person.displayName}<time>{clock(chat.lastMessage?.createdAt)}</time></span><span className="row-preview">{chat.lastMessage?.content || 'Сообщений пока нет'}</span><span className="row-username">@{chat.person.username}</span></span>
        </button>)}
      </div>
       <div className="sidebar-bottom-note"><span className={`live-dot ${presence.connected ? '' : 'live-offline'}`} />{presence.connected ? `${presence.onlineCount} в сети` : 'Подключаемся…'}</div>
    </aside>
    <section className="chat-stage">
      {current ? <>
         <header className="chat-topbar"><button className="mobile-back" onClick={() => setPath('/')} aria-label="Назад к перепискам" data-testid="button-back-chats"><ArrowLeft size={19}/></button><Avatar profile={current.person} size="sm"/><div className="chat-top-person"><b>{current.person.displayName}</b><span className={presence.onlineUserIds.includes(current.person.id) ? 'presence-online' : ''}>{presence.onlineUserIds.includes(current.person.id) ? 'В сети' : `@${current.person.username}`}</span></div><button className="quiet-icon" aria-label="Действия с перепиской" data-testid="button-conversation-options"><MoreHorizontal size={20}/></button></header>
        <div className="message-area">
          {messagesQuery.isLoading ? <div className="message-skeleton"><i/><i/><i/></div> : messagesQuery.isError ? <StateBlock title="Не удалось загрузить сообщения" detail="Переписка сохранена. Попробуйте ещё раз." action="Повторить" onAction={() => messagesQuery.refetch()} /> : messages.length === 0 ? <div className="chat-welcome"><span className="welcome-symbol"><MessageCircle size={23}/></span><span className="overline">ЛИЧНАЯ ПЕРЕПИСКА</span><h2>Поздоровайтесь с {current.person.displayName.split(' ')[0]}.</h2><p>Эту переписку видите только вы и собеседник.</p></div> : <div className="message-thread">{messages.map((message: DirectMessage) => {
            const mine = message.authorId === user?.id;
            return <div className={`message-row ${mine ? 'mine' : ''}`} key={message.id} data-testid={`message-${message.id}`}><div className="message-bubble"><p>{message.content}</p><time>{clock(message.createdAt)} {mine && <Check size={12}/>}</time></div></div>;
          })}<div ref={endRef}/></div>}
        </div>
        <form className="composer" onSubmit={send}><textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Напишите сообщение…" maxLength={4000} rows={1} data-testid="input-message" /><span className="composer-count">{draft.length ? `${draft.length}/4000` : 'Ввод — отправить'}</span><button className="send-circle" type="submit" disabled={!draft.trim() || sendMessage.isPending} aria-label="Отправить сообщение" data-testid="button-send-message">{sendMessage.isPending ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}</button></form>
        {error && <div className="inline-error" role="alert">{error}<button onClick={() => void send()} data-testid="button-retry-message">Попробовать снова</button></div>}
      </> : <div className="conversation-empty"><div className="empty-art"><div className="art-ring ring-a"/><div className="art-ring ring-b"/><span><MessageCircle size={28}/></span></div><span className="overline">MONOGRAM / ЛИЧНЫЕ СООБЩЕНИЯ</span><h2>Место для важных разговоров.</h2><p>Выберите переписку или найдите человека по имени пользователя.</p><button className="primary-button" onClick={() => setNewChat(true)} data-testid="button-find-person"><Plus size={16}/> Найти человека</button><div className="empty-caption">Здесь нет примеров переписок. Начните с первого сообщения.</div></div>}
    </section>
    {newChat && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setNewChat(false); }}><section className="dialog glass-card"><button className="dialog-close" onClick={() => setNewChat(false)} aria-label="Закрыть"><X size={18}/></button><span className="overline">НАЧНИТЕ ЛИЧНУЮ ПЕРЕПИСКУ</span><h2>Найти по имени пользователя</h2><p>Введите точное имя пользователя латинскими буквами. Профиль останется закрытым, пока вы не напишете первым.</p><div className="username-input"><AtSign size={17}/><input autoFocus value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ''))} placeholder="имя пользователя" data-testid="input-find-username"/></div>
      {username.length >= 2 && <div className="user-results">{searchUsers.isLoading ? <div className="result-hint">Ищем людей…</div> : searchUsers.isError ? <div className="result-hint">Сейчас поиск недоступен.</div> : searchUsers.data?.length ? searchUsers.data.map(person => <button key={person.id} className="user-result" onClick={() => void beginChat(person.username)} data-testid={`user-result-${person.id}`}><Avatar profile={person} size="sm"/><span><b>{person.displayName}</b><small>@{person.username}</small></span><ArrowLeft size={15}/></button>) : <div className="result-hint">Пользователей с таким именем нет.</div>}</div>}
      {startError && <p className="form-error" role="alert">{startError}</p>}
      <button className="primary-button full-button" onClick={() => void beginChat()} disabled={!username.trim() || startConversation.isPending} data-testid="button-start-conversation">{startConversation.isPending ? <LoaderCircle className="spin" size={16}/> : <MessageCircle size={16}/>} Начать переписку</button>
    </section></div>}
  </div>;
}

function StateBlock({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="state-block"><span className="state-icon"><MessageCircle size={18}/></span><b>{title}</b><p>{detail}</p>{action && <button className="text-action" onClick={onAction} data-testid={`button-${action.toLowerCase().replaceAll(' ', '-')}`}>{action}</button>}</div>;
}

function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><span className="overline">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

function ChannelsPage() {
  const { user } = useAuth();
  const [, setPath] = useLocation();
  const query = useChannels(user?.id || '');
  const create = useCreateChannel(user?.id || '');
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState('');
  const form = useForm<{title:string;username:string;description:string}>({ defaultValues: { title:'', username:'', description:'' } });
  const channels = query.data || [];
  const shown = channels.filter(c => `${c.title} ${c.username} ${c.description}`.toLowerCase().includes(filter.toLowerCase()));
  async function submit(value: {title:string;username:string;description:string}) {
    try { const id = await create.mutateAsync({ title: value.title, username: value.username, description: value.description }); form.reset(); setModal(false); setPath(`/channels/${id}`); }
    catch (e) { form.setError('root', { message: userError(e, 'Не удалось создать канал.') }); }
  }
  return <div className="page-content">
    <PageHeader kicker="ОТКРЫТЫЕ СООБЩЕСТВА" title="Каналы" description="Читайте авторов, которые вам интересны, и делитесь своими мыслями." action={<button className="primary-button" onClick={() => setModal(true)} data-testid="button-create-channel"><Plus size={16}/> Создать канал</button>}/>
    <div className="directory-toolbar"><div className="search-control directory-search"><Search size={16}/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Найти канал" data-testid="input-channel-search"/></div><span>{query.isLoading ? 'Загрузка…' : `${channels.length} ${channelCountLabel(channels.length)}`}</span></div>
    {query.isLoading ? <div className="channel-grid">{[1,2,3].map(i=><div className="channel-skeleton glass-card" key={i}><i/><b/><span/></div>)}</div> : query.isError ? <StateBlock title="Каналы недоступны" detail="Проверьте подключение к интернету." action="Повторить" onAction={() => query.refetch()}/> : shown.length === 0 ? <div className="empty-panel"><div className="empty-mark"><Compass size={21}/></div><h2>{filter ? 'Ничего не найдено' : 'Здесь пока пусто'}</h2><p>{filter ? 'Попробуйте другое название или имя пользователя.' : 'Здесь появятся каналы, на которые вы подпишетесь. Создайте канал, если хотите чем-то поделиться.'}</p>{!filter && <button className="outline-button" onClick={() => setModal(true)} data-testid="button-create-first-channel"><Plus size={15}/> Создать канал</button>}</div> : <div className="channel-grid">{shown.map((channel: Channel, index) => <ChannelCard key={channel.id} channel={channel} index={index}/>)}</div>}
    {modal && <div className="modal-backdrop"><section className="dialog glass-card"><button className="dialog-close" onClick={() => setModal(false)} aria-label="Закрыть"><X size={18}/></button><span className="overline">МЕСТО ДЛЯ ВАШИХ ИДЕЙ</span><h2>Создать канал</h2><p>Придумайте название и короткое имя для поиска.</p><Form {...form}><form onSubmit={form.handleSubmit(submit)} className="form-stack">
      <FormField control={form.control} name="title" rules={{ required: 'Введите название канала.' }} render={({field})=><FormItem><FormLabel>Название канала</FormLabel><FormControl><Input placeholder="Например, «Идеи на выходные»" {...field} data-testid="input-channel-title"/></FormControl><FormMessage/></FormItem>}/>
      <FormField control={form.control} name="username" rules={{required:'Придумайте имя пользователя.',pattern:{value:/^[a-z][a-z0-9_]{2,31}$/i,message:'От 3 до 32 латинских букв, цифр или знаков подчёркивания.'}}} render={({field})=><FormItem><FormLabel>Имя пользователя</FormLabel><FormControl><div className="input-prefix"><span>@</span><Input placeholder="primer_kanala" {...field} data-testid="input-channel-username"/></div></FormControl><FormMessage/></FormItem>}/>
      <FormField control={form.control} name="description" render={({field})=><FormItem><FormLabel>Описание</FormLabel><FormControl><Textarea placeholder="О чём будет этот канал?" {...field} data-testid="input-channel-description"/></FormControl><FormMessage/></FormItem>}/>
      {form.formState.errors.root && <p className="form-error">{form.formState.errors.root.message}</p>}
      <Button className="primary-button full-button" disabled={create.isPending} data-testid="button-submit-channel">{create.isPending ? 'Создаём…' : 'Создать канал'}</Button>
    </form></Form></section></div>}
  </div>;
}
function ChannelCard({ channel, index }: {channel: Channel; index:number}) {
  return <Link href={`/channels/${channel.id}`} className="channel-card glass-card" data-testid={`channel-card-${channel.id}`}><div className="channel-card-top"><span className={`channel-monogram tone-${index % 4}`}><Hash size={21}/></span><span className="channel-member">{channel.isMember ? 'ВЫ ПОДПИСАНЫ' : 'ОТКРЫТЫЙ'}</span></div><h2>{channel.title}</h2><span className="channel-handle">@{channel.username}</span><p>{channel.description || 'Канал MonoGram.'}</p><div className="channel-card-bottom"><span>Открыть канал</span><ArrowLeft size={15}/></div></Link>;
}

function ChannelPage() {
  const { channelId = '' } = useParams<{channelId:string}>();
  const { user } = useAuth();
  const channelsQuery = useChannels(user?.id || '');
  const channel = channelsQuery.data?.find(c => c.id === channelId);
  const postsQuery = usePosts(channelId, user?.id || '');
  const join = useJoinChannel(user?.id || '');
  const createPost = useCreatePost(user?.id || '', channelId);
  const wallet = useWallet(user?.id || '');
  const sendStars = useSendStars(user?.id || '', channelId);
  const [body,setBody] = useState('');
  const [postError,setPostError] = useState('');
  const [reactionError,setReactionError] = useState('');
  const [starsTarget,setStarsTarget] = useState('');
  const [stars,setStars] = useState('1');
  async function publish(e: FormEvent) { e.preventDefault(); if (!user || !body.trim()) return; setPostError(''); try { await createPost.mutateAsync({channelId,authorId:user.id,body:body.trim()}); setBody(''); } catch(e) { setPostError(userError(e, 'Не удалось опубликовать запись.')); } }
  async function sendReaction(postId:string) { setReactionError(''); try { await sendStars.mutateAsync({postId,stars:Number(stars)}); setStarsTarget(''); } catch(e) { setReactionError(userError(e, 'Не удалось отправить звёзды.')); } }
  if (channelsQuery.isLoading) return <div className="page-content"><div className="loading-panel glass-card"><i/><b/><span/></div></div>;
  if (!channel) return <div className="page-content"><StateBlock title="Канал не найден" detail="Возможно, его удалили или ссылка неверна."/><Link href="/channels" className="text-action">Вернуться к каналам</Link></div>;
  return <div className="page-content channel-page">
    <div className="channel-hero glass-card"><Link href="/channels" className="back-link"><ArrowLeft size={15}/> Все каналы</Link><div className="channel-hero-mark"><Hash size={25}/></div><span className="overline">КАНАЛ / @{channel.username}</span><h1>{channel.title}</h1><p>{channel.description || 'Открытый канал MonoGram.'}</p><div className="channel-hero-actions">{channel.isMember ? <span className="member-status"><Check size={15}/> Вы подписаны</span> : <button className="primary-button" onClick={() => join.mutate(channelId)} disabled={join.isPending} data-testid="button-join-channel">{join.isPending ? 'Подписываем…' : 'Подписаться'}</button>}<span className="star-balance"><Star size={15}/>{wallet.data?.balance ?? '—'} звёзд MonoGram</span></div></div>
      {channel.role === 'owner' && <form className="publish-box glass-card" onSubmit={publish}><Textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} placeholder="Поделитесь новостью с подписчиками…" data-testid="input-channel-post"/>{postError&&<p className="form-error" role="alert">{postError}</p>}<div><span>{body.length}/4000</span><button className="primary-button" disabled={!body.trim() || createPost.isPending} data-testid="button-publish-post">{createPost.isPending ? 'Публикуем…' : 'Опубликовать'}<Send size={15}/></button></div></form>}
    <div className="posts-heading"><div><span className="overline">ПУБЛИКАЦИИ</span><h2>Последние записи</h2></div><span>{postsQuery.data?.length ?? ''}</span></div>
    {postsQuery.isLoading ? <div className="post-skeleton glass-card"><i/><span/><b/><span/></div> : postsQuery.isError ? <StateBlock title="Не удалось загрузить записи" detail="Попробуйте ещё раз через минуту." action="Повторить" onAction={() => postsQuery.refetch()}/> : !postsQuery.data?.length ? <div className="empty-panel compact-empty"><div className="empty-mark"><MessageCircle size={19}/></div><h2>Записей пока нет</h2><p>{channel.isMember ? 'Опубликуйте первую запись.' : 'Подпишитесь на канал, чтобы видеть новые записи.'}</p></div> : <div className="post-list">{postsQuery.data.map((post:ChannelPost)=><article className="post-card glass-card" key={post.id} data-testid={`post-${post.id}`}><div className="post-byline"><span className="author-mark">{initials(post.authorName)}</span><div><b>{post.authorName}</b><small>@{post.authorUsername} · {dateLabel(post.createdAt)}</small></div><button className={`stars-react ${post.myStars ? 'reacted' : ''}`} onClick={()=>{setStarsTarget(starsTarget===post.id?'':post.id);setReactionError('');}} aria-label="Отправить звёзды MonoGram" data-testid={`button-react-${post.id}`}><Star size={16}/><span>{post.starsTotal}</span></button></div><p className="post-body">{post.body}</p>{starsTarget===post.id && <div className="reaction-panel"><label>Отправить звёзды</label><select value={stars} onChange={e=>setStars(e.target.value)} data-testid={`select-stars-${post.id}`}><option value="1">1 звезда</option><option value="5">5 звёзд</option><option value="10">10 звёзд</option><option value="25">25 звёзд</option></select><span>Баланс: {wallet.data?.balance ?? 0}</span><button onClick={()=>void sendReaction(post.id)} disabled={sendStars.isPending} data-testid={`button-send-stars-${post.id}`}>{sendStars.isPending?'Отправляем…':'Отправить'}</button>{reactionError&&<small className="form-error">{reactionError}</small>}</div>}</article>)}</div>}
  </div>;
}

function ProfilePage() {
  const { user } = useAuth();
  const query = useProfile(user?.id || '');
  const save = useSaveProfile();
  const [saved,setSaved] = useState(false);
  const form = useForm<{displayName:string;username:string;bio:string;avatarUrl:string}>({defaultValues:{displayName:'',username:'',bio:'',avatarUrl:''}});
  const profile = query.data;
  const initialized = useRef('');
  useEffect(()=>{if(profile && initialized.current !== profile.id){initialized.current=profile.id;form.reset({displayName:profile.displayName,username:profile.username,bio:profile.bio,avatarUrl:profile.avatarUrl||''});}},[profile,form]);
  async function submit(v:{displayName:string;username:string;bio:string;avatarUrl:string}){if(!user)return;setSaved(false);try{await save.mutateAsync({id:user.id,...v,avatarUrl:v.avatarUrl||null});setSaved(true);}catch(e){form.setError('root',{message:userError(e,'Не удалось сохранить профиль.')});}}
  return <div className="page-content narrow-page"><PageHeader kicker="ВАША ЛИЧНОСТЬ" title="Профиль" description="Так вас будут находить и узнавать другие."/>
    {query.isLoading ? <div className="loading-panel glass-card"><i/><b/><span/></div> : query.isError ? <StateBlock title="Профиль недоступен" detail="Попробуйте загрузить профиль ещё раз." action="Повторить" onAction={()=>query.refetch()}/> : <><div className="profile-preview glass-card"><Avatar profile={profile} size="lg"/><div><span className="overline">ВАШ ПРОФИЛЬ MONOGRAM</span><h2>{profile?.displayName}</h2><span>@{profile?.username}</span></div><span className="profile-private"><Shield size={14}/> ЗАКРЫТЫЙ</span></div>
    <section className="settings-card glass-card"><div className="settings-heading"><div><h2>Открытые сведения</h2><p>Показываются только выбранные вами данные.</p></div><CircleUserRound size={19}/></div>
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="form-stack profile-form">
        <FormField control={form.control} name="displayName" rules={{required:'Укажите отображаемое имя.'}} render={({field})=><FormItem><FormLabel>Отображаемое имя</FormLabel><FormControl><Input {...field} data-testid="input-profile-name"/></FormControl><FormMessage/></FormItem>}/>
        <FormField control={form.control} name="username" rules={{required:'Укажите имя пользователя.',pattern:{value:/^[a-z][a-z0-9_]{2,31}$/,message:'От 3 до 32 строчных латинских букв, цифр или знаков подчёркивания.'}}} render={({field})=><FormItem><FormLabel>Имя пользователя</FormLabel><FormControl><div className="input-prefix"><span>@</span><Input {...field} data-testid="input-profile-username"/></div></FormControl><FormMessage/></FormItem>}/>
        <FormField control={form.control} name="bio" render={({field})=><FormItem><FormLabel>О себе</FormLabel><FormControl><Textarea maxLength={280} placeholder="Пара слов о себе — если хотите." {...field} data-testid="input-profile-bio"/></FormControl><FormMessage/></FormItem>}/>
        <FormField control={form.control} name="avatarUrl" render={({field})=><FormItem><FormLabel>Ссылка на изображение профиля</FormLabel><FormControl><Input type="url" placeholder="https://…" {...field} data-testid="input-profile-avatar"/></FormControl><FormMessage/></FormItem>}/>
        {form.formState.errors.root&&<p className="form-error">{form.formState.errors.root.message}</p>}
        <div className="form-actions">{saved&&<span className="saved-note"><Check size={15}/> Изменения сохранены</span>}<Button className="primary-button" disabled={save.isPending} data-testid="button-save-profile">{save.isPending?'Сохраняем…':'Сохранить изменения'}</Button></div>
      </form></Form>
    </section></>}
  </div>;
}

function StarsPage() {
  const { user } = useAuth();
  const query = useWallet(user?.id || '');
  const wallet = query.data;
  return <div className="page-content narrow-page"><PageHeader kicker="БЛАГОДАРНОСТЬ В ВАШИХ РУКАХ" title="Звёзды" description="Отправляйте звёзды авторам понравившихся записей."/>
    {query.isLoading ? <div className="loading-panel glass-card"><i/><b/><span/></div> : query.isError ? <StateBlock title="Счёт недоступен" detail="Ваш баланс сохранён. Попробуйте чуть позже." action="Повторить" onAction={()=>query.refetch()}/> : <><section className="balance-card glass-card"><div className="balance-decoration"><Star size={32}/></div><div><span className="overline">ВАШ БАЛАНС</span><div className="balance-value">{wallet?.balance ?? 0}<span>звёзд</span></div><p>Благодарите авторов за публикации.</p></div><div className="balance-stamp"><Sparkles size={18}/><span>ВАЖНЫЕ<br/>ОТКЛИКИ</span></div></section>
      <section className="ledger-section"><div className="section-title"><div><span className="overline">НЕДАВНИЕ ОПЕРАЦИИ</span><h2>История звёзд</h2></div><span>{wallet?.transactions.length || 0} записей</span></div>
        {!wallet?.transactions.length ? <div className="empty-panel ledger-empty"><div className="empty-mark"><Wallet size={20}/></div><h2>Операций пока нет</h2><p>Здесь будут отображаться ваши звёзды MonoGram.</p></div> : <div className="ledger-list glass-card">{wallet.transactions.map(tx=><div className="ledger-row" key={tx.id} data-testid={`transaction-${tx.id}`}><div className={`ledger-icon ${tx.amount < 0 ? 'spent' : ''}`}>{tx.amount < 0 ? <Send size={16}/> : <Star size={16}/>}</div><div className="ledger-copy"><b>{transactionLabel(tx.reason)}</b><span>{dateLabel(tx.createdAt)}</span></div><strong className={tx.amount < 0 ? 'amount-out' : 'amount-in'}>{tx.amount > 0 ? '+' : ''}{tx.amount}</strong></div>)}</div>}
      </section></>}
  </div>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot-screen"><div className="boot-mark"><MessageCircle size={20}/></div><span>MONOGRAM</span><div className="boot-line"/></div>;
  if (!user) return <AuthScreen/>;
  return <AppShell><ErrorBoundary resetKey={window.location.pathname}><Switch>
    <Route path="/" component={ChatWorkspace}/>
    <Route path="/chat/:conversationId" component={ChatWorkspace}/>
    <Route path="/channels" component={ChannelsPage}/>
    <Route path="/channels/:channelId" component={ChannelPage}/>
    <Route path="/profile" component={ProfilePage}/>
    <Route path="/stars" component={StarsPage}/>
    <Route component={NotFound}/>
  </Switch></ErrorBoundary></AppShell>;
}
function App() {
  return <QueryClientProvider client={client}><AuthProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppRoutes/></WouterRouter><Toaster/></TooltipProvider></AuthProvider></QueryClientProvider>;
}
export default App;
