import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, Link, useLocation, useParams } from 'wouter';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useChats, useChannels, useCreateChannel, useCreatePost, useJoinChannel, useMessages, usePosts, useProfile, useSaveProfile, useSendMessage, useSendStars, useStartConversation, useUserSearch, useWallet } from '@/hooks/use-messenger';
import { usePresence } from '@/hooks/use-presence';
import { useChatReadState } from '@/hooks/use-chat-read-state';
import { uploadMessagePhoto, type Channel, type ChannelPost, type Conversation, type DirectMessage, type Profile } from '@/lib/messenger';
import { apiBlobRequest } from '@/lib/api';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useForm } from 'react-hook-form';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowLeft, ArrowRight, AtSign, Camera, Check, CheckCheck, ChevronDown, CircleUserRound, Compass, Copy, Crown, Hash, ImagePlus, LoaderCircle, LogOut, MessageCircle, MoreHorizontal, MoreVertical, PenLine, Phone, Plus, Search, Send, Settings2, Shield, Sparkles, Star, UserRound, Wallet, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import './auth-screen.css';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 12_000, retry: 1, refetchOnWindowFocus: true } } });
const dateLabel = (value?: string) => value ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: ru }) : '';
const clock = (value?: string) => value ? format(new Date(value), 'HH:mm') : '';
const initials = (name?: string) => Array.from((name || '?').trim())[0]?.toUpperCase() || '?';
function formatPhone(phone?: string) {
  const digits = (phone || '').replace(/\D/g, '');
  const normalized = digits.length === 10 ? `7${digits}` : digits;
  if (/^7\d{10}$/.test(normalized)) {
    return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  }
  return phone?.trim() || 'Номер не указан';
}
function splitDisplayName(displayName?: string) {
  const normalized = (displayName || '').trim();
  if (!normalized || normalized.toLocaleLowerCase('ru') === 'новый пользователь') {
    return { firstName: '', lastName: '' };
  }
  const parts = normalized.split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}
const avatarPalette = [
  ['#34b8ff', '#635bff'],
  ['#8d68ff', '#d84fb5'],
  ['#32d2ad', '#3389ed'],
  ['#477dff', '#a34ff0'],
  ['#18bdd4', '#5369f4'],
  ['#75d65d', '#27a893'],
  ['#6d8cff', '#37c6df'],
] as const;
function avatarColorIndex(profile?: Pick<Profile, 'id' | 'displayName'>) {
  const seed = profile?.id || profile?.displayName || '?';
  let hash = 2166136261;
  for (const character of seed.toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % avatarPalette.length;
}
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
const UnreadChatsCountContext = createContext<(count: number) => void>(() => {});

function userError(error: unknown, fallback: string, authMode?: 'request-code') {
  const details = typeof error === 'object' && error !== null
    ? error as { message?: unknown; code?: unknown; status?: unknown }
    : {};
  const message = error instanceof Error
    ? error.message
    : typeof details.message === 'string' ? details.message : '';
  const status = typeof details.status === 'number' ? details.status : 0;
  const normalized = message.toLowerCase();
  if (/недостаточно monostars/.test(normalized)) return 'Недостаточно звёзд MonoGram.';
  if (/rate limit|too many attempts/.test(normalized) || status === 429) return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  if (/failed to fetch|network|fetch error|load failed/.test(normalized) || status === 0 || (status >= 502 && status <= 504)) return 'Не удалось подключиться. Проверьте интернет и попробуйте снова.';
  if (status === 404 && authMode === 'request-code') return 'Сервис выдачи демо-кода не найден. Обновите страницу и попробуйте снова.';
  if (status === 401) return 'Сессия завершена. Войдите снова.';
  if (status === 404) return fallback;
  if (/[А-Яа-яЁё]/.test(message)) return message;
  if (status === 409) return fallback;
  return fallback;
}

function isNetworkFailure(error: unknown) {
  const details = typeof error === 'object' && error !== null
    ? error as { message?: unknown; status?: unknown }
    : {};
  const message = typeof details.message === 'string' ? details.message.toLowerCase() : '';
  const status = typeof details.status === 'number' ? details.status : 0;
  return /failed to fetch|network|fetch error|load failed/.test(message)
    || status === 0
    || (status >= 502 && status <= 504);
}

function Avatar({ profile, size = 'md' }: { profile?: Pick<Profile, 'id' | 'displayName' | 'avatarUrl'>; size?: 'sm' | 'md' | 'lg' }) {
  const [start, end] = avatarPalette[avatarColorIndex(profile)];
  return <div
    className={`avatar avatar-${size}`}
    style={{ background: `linear-gradient(145deg, ${start}, ${end})`, color: '#fff' }}
    aria-label={profile?.displayName || 'Профиль'}
  >
    {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile?.displayName)}
  </div>;
}

function MessageImage({ src }: { src: string }) {
  const [objectUrl, setObjectUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let localUrl = '';
    setObjectUrl('');
    setFailed(false);
    apiBlobRequest(src, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      localUrl = URL.createObjectURL(blob);
      setObjectUrl(localUrl);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => {
      controller.abort();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [src]);

  if (failed) return <span className="message-image-error">Не удалось загрузить фото</span>;
  if (!objectUrl) return <span className="message-image-loading" aria-label="Загрузка фото" />;
  return <img className="message-image" src={objectUrl} alt="Фото в сообщении" loading="lazy" />;
}

function AuthScreen() {
  const { requestDemoCode, verifyDemoCode } = useAuth();
  const [phoneDigits, setPhoneDigits] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const [codeFeedback, setCodeFeedback] = useState<'idle' | 'error' | 'success'>('idle');
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const formattedPhone = `+7 (${phoneDigits.slice(0, 3).padEnd(3, '_')}) ${phoneDigits.slice(3, 6).padEnd(3, '_')}-${phoneDigits.slice(6, 8).padEnd(2, '_')}-${phoneDigits.slice(8, 10).padEnd(2, '_')}`;

  function updatePhone(event: ChangeEvent<HTMLInputElement>) {
    let digits = event.currentTarget.value.replace(/\D/g, '');
    if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.slice(1);
    const inputType = (event.nativeEvent as InputEvent).inputType;
    if (inputType.startsWith('delete') && digits.length >= phoneDigits.length && phoneDigits.length) {
      digits = phoneDigits.slice(0, -1);
    }
    setPhoneDigits(digits.slice(0, 10));
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    if (phoneDigits.length !== 10) return;
    setError('');
    setBusy(true);
    try {
      setDemoCode(await requestDemoCode(`+7${phoneDigits}`));
      setInputCode('');
      setCodeFeedback('idle');
      setStep('code');
    } catch (e) {
      if (isNetworkFailure(e)) {
        setError(userError(e, 'Не удалось подключиться. Проверьте интернет и попробуйте снова.', 'request-code'));
      }
    }
    finally { setBusy(false); }
  }

  async function confirmCode(event: FormEvent) {
    event.preventDefault();
    if (inputCode.length !== 5) {
      setCodeFeedback('error');
      setShakeKey(current => current + 1);
      setError('Введите все пять цифр кода.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await verifyDemoCode(`+7${phoneDigits}`, inputCode, async () => {
        setCodeFeedback('success');
        const transitionDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 430;
        await new Promise<void>(resolve => window.setTimeout(resolve, transitionDelay));
      });
    } catch (e) {
      setCodeFeedback('error');
      setShakeKey(current => current + 1);
      setError(userError(e, 'Не удалось подтвердить код. Попробуйте ещё раз.'));
    } finally {
      setBusy(false);
    }
  }

  return <main className={`mono-auth ${codeFeedback === 'success' ? 'mono-auth--success' : ''}`} data-step={step}>
    <div className="mono-auth__grid" aria-hidden="true" />
    <div className="mono-auth__glow mono-auth__glow--top" aria-hidden="true" />
    <div className="mono-auth__glow mono-auth__glow--bottom" aria-hidden="true" />
    <div className="mono-auth__shell">
      <section className="mono-auth__card" aria-labelledby="mono-auth-title">
        <a className="mono-auth__mobile-brand" href="/" aria-label="MonoGram — главная">
          <span className="mono-auth__brand-icon"><MessageCircle size={20} strokeWidth={2.2} /></span>
          <span>MonoGram</span>
        </a>
        <div className="mono-auth__card-meta">
          <span className="mono-auth__eyebrow">{step === 'phone'
            ? 'ВХОД И РЕГИСТРАЦИЯ'
            : 'ПОДТВЕРЖДЕНИЕ НОМЕРА'}</span>
          <span className="mono-auth__secure"><Shield size={14} /> MonoGram Messenger</span>
        </div>
        <header className="mono-auth__intro">
          <h1 id="mono-auth-title">{step === 'phone'
            ? 'Ваш номер телефона'
            : 'Введите код'}</h1>
          <p>{step === 'phone'
            ? 'Пожалуйста, подтвердите код страны и введите номер телефона.'
            : `Код для номера ${formattedPhone}. SMS не отправляется — это демо-вход.`}</p>
        </header>

        {step === 'phone' ? <form className="mono-auth__form" onSubmit={requestCode}>
          <div className="mono-auth__field">
            <label htmlFor="input-phone">Номер телефона</label>
            <div className="mono-auth__control">
              <Phone size={17} aria-hidden="true" />
              <input
                id="input-phone"
                autoComplete="tel"
                aria-label="Номер телефона"
                inputMode="tel"
                value={formattedPhone}
                onChange={updatePhone}
                data-testid="input-phone"
              />
            </div>
          </div>
          {error && <p className="mono-auth__error" role="alert" data-testid="auth-message">{error}</p>}
          <Button className="mono-auth__submit" type="submit" disabled={busy || phoneDigits.length !== 10} data-testid="button-request-code">
            {busy ? <><LoaderCircle className="spin" size={17} /> Подождите</> : <>Далее <ArrowRight size={17} /></>}
          </Button>
          <p className="mono-auth__hint">На этом демо-этапе код появится на экране, SMS не отправляется.</p>
        </form> : <form className="mono-auth__form" onSubmit={confirmCode}>
          <div className="mono-auth__demo-code" role="status" data-testid="demo-code">
            <span>Ваш демо-код</span>
            <strong>{demoCode}</strong>
          </div>
          <div className="mono-auth__field">
            <label htmlFor="input-demo-code">Код из пяти цифр</label>
            <div
              className="mono-auth__otp-frame"
              data-feedback={codeFeedback}
              data-shake={shakeKey % 2}
            >
              <InputOTP
                id="input-demo-code"
                maxLength={5}
                autoFocus
                autoComplete="one-time-code"
                aria-label="Код из пяти цифр"
                aria-invalid={codeFeedback === 'error'}
                inputMode="numeric"
                value={inputCode}
                disabled={busy || codeFeedback === 'success'}
                pasteTransformer={pasted => pasted.replace(/\D/g, '').slice(0, 5)}
                onChange={value => {
                  setInputCode(value.replace(/\D/g, '').slice(0, 5));
                  if (codeFeedback === 'error') setCodeFeedback('idle');
                  if (error) setError('');
                }}
                data-testid="input-demo-code"
                containerClassName="mono-auth__otp"
                className="mono-auth__otp-input"
              >
                <InputOTPGroup className="mono-auth__otp-group">
                  {Array.from({ length: 5 }, (_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className={`mono-auth__otp-slot ${inputCode[index] ? 'mono-auth__otp-slot--filled' : ''}`}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          {error && <p className="mono-auth__error" role="alert" data-testid="auth-message">{error}</p>}
          {codeFeedback === 'success' && <p className="mono-auth__success-message" role="status">Код подтверждён. Открываем чаты…</p>}
          <Button className="mono-auth__submit" type="submit" disabled={busy || inputCode.length !== 5} data-testid="button-confirm-code">
            {busy
              ? <><LoaderCircle className="spin" size={17} /> Проверяем</>
              : <>Подтвердить <Check size={17} /></>}
          </Button>
          <button className="mono-auth__back" type="button" onClick={() => { setError(''); setStep('phone'); }} data-testid="button-edit-phone">
            <ArrowLeft size={15} /> Изменить номер
          </button>
        </form>}
        <footer className="mono-auth__foot"><Shield size={15} /><span>Демо-режим: SMS не отправляется</span></footer>
      </section>
    </div>
  </main>;
}

function Navigation({ profile, hidden = false, unreadChatsCount = 0 }: {
  profile?: Pick<Profile, 'id' | 'displayName' | 'avatarUrl'>;
  hidden?: boolean;
  unreadChatsCount?: number;
}) {
  const [path] = useLocation();
  const links = [
    { href: '/', label: 'Чаты', testId: 'messages', icon: MessageCircle },
    { href: '/contacts', label: 'Контакты', testId: 'contacts', icon: CircleUserRound },
    { href: '/settings', label: 'Настройки', testId: 'settings', icon: Settings2 },
    { href: '/profile', label: 'Профиль', testId: 'my-profile', icon: UserRound },
  ];
  return <nav className={`mono-tabbar glass-surface ${hidden ? 'mono-tabbar--hidden' : ''}`} aria-label="Главная навигация">
    {links.map(({ href, label, testId, icon: Icon }) => {
      const active = href === '/'
        ? path === '/' || path.startsWith('/chat/')
        : href === '/settings'
          ? path === '/settings' || path.startsWith('/channels') || path === '/stars'
          : path === href;
      return <Link
        key={href}
        href={href}
        className={`mono-tab ${active ? 'mono-tab--active' : ''}`}
        aria-current={active ? 'page' : undefined}
        data-testid={`link-${testId}`}
      >
        <span className="mono-tab__icon">
          {href === '/profile' ? <Avatar profile={profile} size="sm" /> : <Icon size={26} strokeWidth={2.1} />}
          {href === '/' && unreadChatsCount > 0 && <span className="mono-tab__badge" aria-label={`${unreadChatsCount} непрочитанных чатов`}>
            {unreadChatsCount > 99 ? '99+' : unreadChatsCount}
          </span>}
        </span>
        <span className="mono-tab__label">{label}</span>
      </Link>;
    })}
  </nav>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [path] = useLocation();
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const profileQuery = useProfile(user?.id || '');
  const profile = profileQuery.data;
  const inConversation = path.startsWith('/chat/');
  return <UnreadChatsCountContext.Provider value={setUnreadChatsCount}>
    <div className={`workspace ${inConversation ? 'workspace--chat-open' : ''}`}>
      <div className="workspace-main">{children}</div>
      <Navigation profile={profile} hidden={inConversation || path === '/profile/edit' || path === '/profile/username'} unreadChatsCount={unreadChatsCount} />
    </div>
  </UnreadChatsCountContext.Provider>;
}

function ChatWorkspace() {
  const { user } = useAuth();
  const [path, setPath] = useLocation();
  const [search, setSearch] = useState('');
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showConversationDetails, setShowConversationDetails] = useState(false);
  const [username, setUsername] = useState('');
  const [newChat, setNewChat] = useState(false);
  const [startError, setStartError] = useState('');
  const id = path.startsWith('/chat/') ? decodeURIComponent(path.slice(6)) : '';
  const chatsQuery = useChats(user?.id || '');
  const messagesQuery = useMessages(id, user?.id || '');
  const profileQuery = useProfile(user?.id || '');
  const presence = usePresence(user?.id);
  const chats = chatsQuery.data || [];
  const current = chats.find(c => c.id === id);
  const sendMessage = useSendMessage(user?.id || '');
  const startConversation = useStartConversation(user?.id || '');
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string; uploadedPath?: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const setUnreadChatsCount = useContext(UnreadChatsCountContext);
  const { markRead, unreadCountFor } = useChatReadState(user?.id || '');
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const searchUsers = useUserSearch(username.replace(/^@/, ''), user?.id || '');
  const normalizedChatSearch = search.trim().toLocaleLowerCase('ru').replace(/^@+/, '');
  const filtered = useMemo(() => chats.filter(c => (
    `${c.person.displayName} ${c.person.username} ${c.lastMessage?.content || ''}`
      .toLocaleLowerCase('ru')
      .includes(normalizedChatSearch)
  )), [chats, normalizedChatSearch]);
  const unreadChatsCount = chats.filter(chat => unreadCountFor(chat) > 0).length;
  useEffect(() => { setDraft(''); setError(''); setPendingImage(null); }, [id]);
  useEffect(() => {
    const preview = pendingImage?.preview;
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [pendingImage?.preview]);
  useLayoutEffect(() => {
    const messageArea = messageAreaRef.current;
    if (!id || !messageArea || messagesQuery.isLoading || !messagesQuery.data) return;
    messageArea.scrollTop = messageArea.scrollHeight;
  }, [id, messagesQuery.data?.length, messagesQuery.isLoading]);
  useEffect(() => { setUnreadChatsCount(unreadChatsCount); }, [setUnreadChatsCount, unreadChatsCount]);
  useEffect(() => {
    if (id && current?.lastMessage) markRead(id);
  }, [id, current?.lastMessage?.id, markRead]);
  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!user || !id || (!draft.trim() && !pendingImage) || sendMessage.isPending || uploadingImage) return;
    setError('');
    try {
      let imagePath: string | undefined;
      if (pendingImage) {
        imagePath = pendingImage.uploadedPath;
        if (!imagePath) {
          setUploadingImage(true);
          imagePath = await uploadMessagePhoto(pendingImage.file);
          const uploadedPath = imagePath;
          setPendingImage(current => current?.file === pendingImage.file ? { ...current, uploadedPath } : current);
        }
      }
      await sendMessage.mutateAsync({
        conversationId: id,
        authorId: user.id,
        content: draft.trim(),
        imagePath,
      });
      setDraft('');
      setPendingImage(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
    catch (e) { setError(userError(e, 'Не удалось отправить сообщение.')); }
    finally { setUploadingImage(false); }
  }
  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Выберите фото JPG, PNG или WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Фото должно быть меньше 10 МБ.');
      return;
    }
    setError('');
    setPendingImage({ file, preview: URL.createObjectURL(file) });
  }
  async function beginChat(value = username) {
    setStartError('');
    try { const conversationId = await startConversation.mutateAsync(value.trim().replace(/^@/, '')); setNewChat(false); setUsername(''); setPath(`/chat/${encodeURIComponent(conversationId)}`); }
    catch (e) { setStartError(userError(e, 'Не удалось начать переписку.')); }
  }
  const messages = messagesQuery.data || [];
  return <div className={`chat-layout ${id ? 'chat-open' : ''}`}>
    <aside className="chat-sidebar">
      <div className="chat-sidebar-top">
        <header className="chat-sidebar-head">
          <h1>Чаты</h1>
          <div className="chat-header-actions">
            <button
              className="chat-menu-button"
              type="button"
              onClick={() => document.querySelector<HTMLInputElement>('[data-testid="input-chat-search"]')?.focus()}
              aria-label="Поиск чатов"
              title="Поиск чатов"
              data-testid="button-chat-search"
            >
              <Search size={21}/>
            </button>
            <button
              className="chat-menu-button"
              type="button"
              onClick={() => setShowChatMenu(value => !value)}
              title="Меню чатов"
              aria-label="Меню чатов"
              aria-expanded={showChatMenu}
              data-testid="button-chat-menu"
            >
              <MoreVertical size={22} />
            </button>
            {showChatMenu && <div className="chat-header-menu" role="menu">
              <button role="menuitem" onClick={() => { setNewChat(true); setShowChatMenu(false); }}>
                <PenLine size={16} /> Новая переписка
              </button>
              <button role="menuitem" onClick={() => { setPath('/contacts'); setShowChatMenu(false); }}>
                <CircleUserRound size={16} /> Контакты
              </button>
              <button role="menuitem" onClick={() => { setPath('/settings'); setShowChatMenu(false); }}>
                <Settings2 size={16} /> Настройки
              </button>
            </div>}
          </div>
        </header>
        <div className="search-control chat-search glass-surface">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Поиск чатов" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск чатов" data-testid="input-chat-search" />
          {search && <button onClick={() => setSearch('')} aria-label="Очистить поиск"><X size={16} /></button>}
        </div>
      </div>
      <div className="conversation-list">
        {chatsQuery.isLoading ? <div className="list-skeleton">{[1,2,3,4].map(i => <div className="skeleton-chat" key={i}><i/><span/><b/></div>)}</div> : chatsQuery.isError ? <StateBlock title="Не удалось загрузить сообщения" detail="Проверьте подключение и попробуйте снова." action="Повторить" onAction={() => chatsQuery.refetch()} /> : filtered.length === 0 ? <div className="sidebar-empty"><div className="empty-mark"><MessageCircle size={19}/></div><b>{search ? 'Ничего не найдено' : 'Пока здесь тихо'}</b><p>{search ? 'Попробуйте другое имя или никнейм.' : 'Найдите человека по имени пользователя, чтобы начать личную переписку.'}</p>{!search && <button className="text-action" onClick={() => setNewChat(true)} data-testid="button-start-first-chat">Найти человека <ArrowLeft size={14}/></button>}</div> : filtered.map((chat: Conversation) => {
          const unreadCount = unreadCountFor(chat);
          const lastMessage = chat.lastMessage;
          const isOwnMessage = lastMessage?.authorId === user?.id;
          const isRead = lastMessage?.isRead === true || Boolean(lastMessage?.readAt);
          return <button className={`conversation-row ${id === chat.id ? 'row-selected' : ''}`} key={chat.id} onClick={() => { markRead(chat.id); setPath(`/chat/${encodeURIComponent(chat.id)}`); }} data-testid={`conversation-${chat.id}`}>
          <Avatar profile={chat.person} />
          <span className="conversation-row-copy">
            <span className="row-title"><span className="row-name">{chat.person.displayName}</span><time>{clock(lastMessage?.createdAt)}</time></span>
            <span className="row-bottom">
              <span className="row-preview">
                {isOwnMessage && (isRead
                  ? <CheckCheck size={16} className="row-read-check" aria-label="Прочитано" />
                  : <Check size={14} className="row-sent-check" aria-label="Отправлено" />)}
                <span className="row-preview-text">{lastMessage ? `${isOwnMessage ? 'Вы: ' : ''}${lastMessage.content || (lastMessage.imageUrl ? 'Фото' : '')}` : 'Сообщений пока нет'}</span>
              </span>
              {unreadCount > 0 && <span className="conversation-unread" aria-label={`${unreadCount} непрочитанных`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>}
            </span>
          </span>
        </button>;
        })}
      </div>
    </aside>
    <section className="chat-stage">
      {current ? <>
         <header className="chat-topbar glass-surface"><button className="mobile-back" onClick={() => setPath('/')} aria-label="Назад к перепискам" data-testid="button-back-chats"><ArrowLeft size={19}/></button><Avatar profile={current.person} size="sm"/><div className="chat-top-person"><b>{current.person.displayName}</b><span className={presence.onlineUserIds.includes(current.person.id) ? 'presence-online' : ''}>{presence.onlineUserIds.includes(current.person.id) ? 'В сети' : `@${current.person.username}`}</span></div><button className="quiet-icon" onClick={() => setShowConversationDetails(value => !value)} aria-label="Информация о собеседнике" aria-expanded={showConversationDetails} data-testid="button-conversation-options"><MoreHorizontal size={20}/></button>{showConversationDetails && <div className="conversation-details"><b>{current.person.displayName}</b><span>@{current.person.username}</span>{current.person.bio && <p>{current.person.bio}</p>}<small><Shield size={13}/> Личная переписка</small></div>}</header>
         <div className="message-area" ref={messageAreaRef}>
          {messagesQuery.isLoading ? <div className="message-skeleton"><i/><i/><i/></div> : messagesQuery.isError ? <StateBlock title="Не удалось загрузить сообщения" detail="Переписка сохранена. Попробуйте ещё раз." action="Повторить" onAction={() => messagesQuery.refetch()} /> : messages.length === 0 ? <div className="chat-welcome"><span className="welcome-symbol"><MessageCircle size={23}/></span><span className="overline">ЛИЧНАЯ ПЕРЕПИСКА</span><h2>Поздоровайтесь с {current.person.displayName.split(' ')[0]}.</h2><p>Эту переписку видите только вы и собеседник.</p></div> : <div className="message-thread">{messages.map((message: DirectMessage) => {
            const mine = message.authorId === user?.id;
             return <div className={`message-row ${mine ? 'mine' : ''}`} key={message.id} data-testid={`message-${message.id}`}><div className="message-bubble">{message.imageUrl && <MessageImage src={message.imageUrl} />}{message.content && <p>{message.content}</p>}<time>{clock(message.createdAt)} {mine && <Check size={12}/>}</time></div></div>;
          })}</div>}
        </div>
         <form className={`composer ${pendingImage ? 'composer--with-image' : ''}`} onSubmit={send}>
           {pendingImage && <div className="composer-image-preview"><img src={pendingImage.preview} alt="Фото для отправки"/><span>{pendingImage.file.name}</span><button type="button" aria-label="Убрать фото" onClick={() => setPendingImage(null)} data-testid="button-remove-chat-image"><X size={16}/></button></div>}
           <div className="composer-main">
             <input ref={imageInputRef} className="composer-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} aria-label="Выбрать фото"/>
             <button className="composer-attach" type="button" aria-label="Прикрепить фото" title="Прикрепить фото" onClick={() => imageInputRef.current?.click()} disabled={sendMessage.isPending || uploadingImage} data-testid="button-attach-photo"><ImagePlus size={21}/></button>
             <textarea aria-label="Текст сообщения" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder={pendingImage ? 'Подпись к фото…' : 'Напишите сообщение…'} maxLength={4000} rows={1} data-testid="input-message" />
             <span className="composer-count">{draft.length ? `${draft.length}/4000` : 'Ввод — отправить'}</span>
             <button className="send-circle" type="submit" disabled={(!draft.trim() && !pendingImage) || sendMessage.isPending || uploadingImage} aria-label="Отправить сообщение" data-testid="button-send-message">{sendMessage.isPending || uploadingImage ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}</button>
           </div>
         </form>
        {error && <div className="inline-error" role="alert">{error}<button onClick={() => void send()} data-testid="button-retry-message">Попробовать снова</button></div>}
      </> : <div className="conversation-empty"><div className="empty-art"><div className="art-ring ring-a"/><div className="art-ring ring-b"/><span><MessageCircle size={28}/></span></div><span className="overline">MONOGRAM / ЛИЧНЫЕ СООБЩЕНИЯ</span><h2>Место для важных разговоров.</h2><p>Выберите переписку или найдите человека по имени пользователя.</p><button className="primary-button" onClick={() => setNewChat(true)} data-testid="button-find-person"><Plus size={16}/> Найти человека</button><div className="empty-caption">Здесь нет примеров переписок. Начните с первого сообщения.</div></div>}
    </section>
    <button className="chat-compose-fab" type="button" onClick={() => setNewChat(true)} aria-label="Написать сообщение" title="Новое сообщение" data-testid="button-new-chat">
      <PenLine size={22} />
    </button>
     {newChat && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setNewChat(false); }}><section className="dialog glass-card"><button className="dialog-close" onClick={() => setNewChat(false)} aria-label="Закрыть"><X size={18}/></button><span className="overline">НАЧНИТЕ ЛИЧНУЮ ПЕРЕПИСКУ</span><h2>Найти по имени пользователя</h2><p>Введите точное имя пользователя латинскими буквами. Профиль останется закрытым, пока вы не напишете первым.</p><div className="username-input"><AtSign size={17}/><input autoFocus aria-label="Имя пользователя для поиска" value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ''))} placeholder="имя пользователя" data-testid="input-find-username"/></div>
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
  return <header className="page-header glass-surface"><div><span className="overline">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
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
  const shown = channels.filter(c => `${c.title} ${c.username} ${c.description}`.toLocaleLowerCase('ru').includes(filter.trim().toLocaleLowerCase('ru')));
  async function submit(value: {title:string;username:string;description:string}) {
    try { const id = await create.mutateAsync({ title: value.title, username: value.username, description: value.description }); form.reset(); setModal(false); setPath(`/channels/${id}`); }
    catch (e) { form.setError('root', { message: userError(e, 'Не удалось создать канал.') }); }
  }
  return <div className="page-content">
    <PageHeader kicker="ОТКРЫТЫЕ СООБЩЕСТВА" title="Каналы" description="Читайте авторов, которые вам интересны, и делитесь своими мыслями." action={<button className="primary-button" onClick={() => setModal(true)} data-testid="button-create-channel"><Plus size={16}/> Создать канал</button>}/>
    <div className="directory-toolbar"><div className="search-control directory-search"><Search size={16}/><input aria-label="Поиск по каналам" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Найти канал" data-testid="input-channel-search"/></div><span>{query.isLoading ? 'Загрузка…' : `${channels.length} ${channelCountLabel(channels.length)}`}</span></div>
    {query.isLoading ? <div className="channel-grid">{[1,2,3].map(i=><div className="channel-skeleton glass-card" key={i}><i/><b/><span/></div>)}</div> : query.isError ? <StateBlock title="Каналы недоступны" detail="Проверьте подключение к интернету." action="Повторить" onAction={() => query.refetch()}/> : shown.length === 0 ? <div className="empty-panel"><div className="empty-mark"><Compass size={21}/></div><h2>{filter ? 'Ничего не найдено' : 'Здесь пока пусто'}</h2><p>{filter ? 'Попробуйте другое название или имя пользователя.' : 'Здесь появятся каналы, на которые вы подпишетесь. Создайте канал, если хотите чем-то поделиться.'}</p>{!filter && <button className="outline-button" onClick={() => setModal(true)} data-testid="button-create-first-channel"><Plus size={15}/> Создать канал</button>}</div> : <div className="channel-grid">{shown.map((channel: Channel, index) => <ChannelCard key={channel.id} channel={channel} index={index}/>)}</div>}
    {modal && <div className="modal-backdrop"><section className="dialog glass-card"><button className="dialog-close" onClick={() => setModal(false)} aria-label="Закрыть"><X size={18}/></button><h2>Создать канал</h2><p>Придумайте название и короткое имя для поиска.</p><Form {...form}><form onSubmit={form.handleSubmit(submit)} className="form-stack">
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
      {channel.role === 'owner' && <form className="publish-box glass-card" onSubmit={publish}><Textarea aria-label="Текст публикации" value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} placeholder="Поделитесь новостью с подписчиками…" data-testid="input-channel-post"/>{postError&&<p className="form-error" role="alert">{postError}</p>}<div><span>{body.length}/4000</span><button className="primary-button" disabled={!body.trim() || createPost.isPending} data-testid="button-publish-post">{createPost.isPending ? 'Публикуем…' : 'Опубликовать'}<Send size={15}/></button></div></form>}
    <div className="posts-heading"><div><span className="overline">ПУБЛИКАЦИИ</span><h2>Последние записи</h2></div><span>{postsQuery.data?.length ?? ''}</span></div>
    {postsQuery.isLoading ? <div className="post-skeleton glass-card"><i/><span/><b/><span/></div> : postsQuery.isError ? <StateBlock title="Не удалось загрузить записи" detail="Попробуйте ещё раз через минуту." action="Повторить" onAction={() => postsQuery.refetch()}/> : !postsQuery.data?.length ? <div className="empty-panel compact-empty"><div className="empty-mark"><MessageCircle size={19}/></div><h2>Записей пока нет</h2><p>{channel.isMember ? 'Опубликуйте первую запись.' : 'Подпишитесь на канал, чтобы видеть новые записи.'}</p></div> : <div className="post-list">{postsQuery.data.map((post:ChannelPost)=><article className="post-card glass-card" key={post.id} data-testid={`post-${post.id}`}><div className="post-byline"><span className="author-mark">{initials(post.authorName)}</span><div><b>{post.authorName}</b><small>@{post.authorUsername} · {dateLabel(post.createdAt)}</small></div><button className={`stars-react ${post.myStars ? 'reacted' : ''}`} onClick={()=>{setStarsTarget(starsTarget===post.id?'':post.id);setReactionError('');}} aria-label="Отправить звёзды MonoGram" data-testid={`button-react-${post.id}`}><Star size={16}/><span>{post.starsTotal}</span></button></div><p className="post-body">{post.body}</p>{starsTarget===post.id && <div className="reaction-panel"><label>Отправить звёзды</label><select aria-label="Количество звёзд для отправки" value={stars} onChange={e=>setStars(e.target.value)} data-testid={`select-stars-${post.id}`}><option value="1">1 звезда</option><option value="5">5 звёзд</option><option value="10">10 звёзд</option><option value="25">25 звёзд</option></select><span>Баланс: {wallet.data?.balance ?? 0}</span><button onClick={()=>void sendReaction(post.id)} disabled={sendStars.isPending} data-testid={`button-send-stars-${post.id}`}>{sendStars.isPending?'Отправляем…':'Отправить'}</button>{reactionError&&<small className="form-error">{reactionError}</small>}</div>}</article>)}</div>}
  </div>;
}

function ProfilePage() {
  const { user } = useAuth();
  const [, setPath] = useLocation();
  const query = useProfile(user?.id || '');
  const save = useSaveProfile();
  const [saved,setSaved] = useState(false);
  const [editing,setEditing] = useState(false);
  const [bioMenuOpen,setBioMenuOpen] = useState(false);
  const [usernameMenuOpen,setUsernameMenuOpen] = useState(false);
  const [profileMenuOpen,setProfileMenuOpen] = useState(false);
  const [bioNotice,setBioNotice] = useState('');
  const [usernameNotice,setUsernameNotice] = useState('');
  const bioMenuRef = useRef<HTMLDivElement>(null);
  const usernameMenuRef = useRef<HTMLDivElement>(null);
  const form = useForm<{username:string;avatarUrl:string}>({defaultValues:{username:'',avatarUrl:''}});
  const profile = query.data;
  const initialized = useRef('');
  useEffect(()=>{if(profile && initialized.current !== profile.id){initialized.current=profile.id;form.reset({username:profile.username,avatarUrl:profile.avatarUrl||''});}},[profile,form]);
  useEffect(() => {
    if (!bioMenuOpen && !usernameMenuOpen) return;
    function closeMenu(event: PointerEvent) {
      if (event.target instanceof Node && bioMenuOpen && !bioMenuRef.current?.contains(event.target)) {
        setBioMenuOpen(false);
      }
      if (event.target instanceof Node && usernameMenuOpen && !usernameMenuRef.current?.contains(event.target)) {
        setUsernameMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setBioMenuOpen(false);
        setUsernameMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [bioMenuOpen,usernameMenuOpen]);
  async function submit(v:{username:string;avatarUrl:string}){if(!user || !profile)return;setSaved(false);try{await save.mutateAsync({id:user.id,displayName:profile.displayName,username:v.username,bio:profile.bio,avatarUrl:v.avatarUrl||null});setSaved(true);}catch(e){form.setError('root',{message:userError(e,'Не удалось сохранить профиль.')});}}
  function openBioEditor() {
    setBioMenuOpen(false);
    setPath('/profile/edit');
  }
  function openUsernameEditor() {
    setUsernameMenuOpen(false);
    setPath('/profile/username');
  }
  async function copyUsername() {
    const username = profile?.username.trim() ?? '';
    setUsernameMenuOpen(false);
    if (!username) {
      setUsernameNotice('Имя пользователя пока не задано.');
      return;
    }
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setUsernameNotice('Имя пользователя скопировано.');
    } catch {
      setUsernameNotice('Не удалось скопировать имя пользователя.');
    }
  }
  async function copyBio() {
    const bio = profile?.bio?.trim() ?? '';
    setBioMenuOpen(false);
    if (!bio) {
      setBioNotice('Пока нечего копировать.');
      return;
    }
    try {
      await navigator.clipboard.writeText(bio);
      setBioNotice('Текст «О себе» скопирован.');
    } catch {
      setBioNotice('Не удалось скопировать текст.');
    }
  }
  function openPhotoEditor() {
    if (editing) {
      setEditing(false);
      return;
    }
    setEditing(true);
    window.requestAnimationFrame(() => {
      const photoField = document.querySelector<HTMLInputElement>('[data-testid="input-profile-avatar"]');
      photoField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      photoField?.focus();
    });
  }
  return <div className="page-content tg-profile-page">
    {query.isLoading ? <div className="loading-panel glass-card"><i/><b/><span/></div> : query.isError ? <StateBlock title="Профиль недоступен" detail="Попробуйте загрузить профиль ещё раз." action="Повторить" onAction={()=>query.refetch()}/> : <main className="tg-profile">
      <header className="mono-screen-header tg-profile-toolbar">
        <span className="mono-screen-header-spacer" aria-hidden="true"/>
        <h2>Профиль</h2>
        <div className="mono-screen-header-actions">
          <button type="button" aria-label="Дополнительные действия" title="Дополнительные действия" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(value => !value)} data-testid="button-profile-menu">
            <MoreVertical size={21}/>
          </button>
          {profileMenuOpen && <div className="mono-screen-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); setPath('/profile/edit'); }}>Изменить аккаунт</button>
            <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); setPath('/settings'); }}>Настройки</button>
          </div>}
        </div>
      </header>
      <header className="tg-profile-header">
        <div className="tg-profile-avatar-wrap">
          <Avatar profile={profile} size="lg"/>
          <button className="tg-profile-camera" type="button" onClick={openPhotoEditor} aria-label="Изменить фото профиля">
            <Camera size={18}/>
          </button>
        </div>
        <h1>{profile?.displayName || 'Пользователь'}</h1>
        <span className="tg-profile-status">{formatPhone(user?.phone)} · @{profile?.username || 'username'}</span>
      </header>

      <div className="tg-profile-actions" aria-label="Действия профиля">
        <button type="button" onClick={openPhotoEditor} data-testid="button-profile-photo">
          <Camera size={19}/><span>{editing ? 'Скрыть фото' : 'Выбрать фото'}</span>
        </button>
        <button type="button" onClick={() => setPath('/profile/edit')} data-testid="button-edit-profile">
          <PenLine size={19}/><span>Изменить</span>
        </button>
        <button type="button" onClick={() => setPath('/settings')} data-testid="button-profile-settings">
          <Settings2 size={19}/><span>Настройки</span>
        </button>
      </div>

      <section className="tg-profile-card glass-card" aria-label="Данные профиля">
        <div className="tg-profile-info-row">
          <p>{formatPhone(user?.phone)}</p>
          <span>Телефон</span>
        </div>
        <div className="tg-profile-info-row tg-profile-bio-row" ref={bioMenuRef}>
          <button
            className="tg-profile-bio-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={bioMenuOpen}
            onClick={() => { setBioNotice(''); setUsernameMenuOpen(false); setBioMenuOpen(value => !value); }}
            data-testid="button-profile-bio-menu"
          >
            <p>{profile?.bio?.trim() || 'Добавьте пару слов о себе'}</p>
            <span>О себе</span>
          </button>
          {bioMenuOpen && <div className="tg-profile-bio-menu glass-card" role="menu" aria-label="Действия с текстом «О себе»">
            <button type="button" role="menuitem" onClick={() => void copyBio()} data-testid="button-copy-profile-bio">
              <Copy size={16}/><span>Копировать</span>
            </button>
            <button type="button" role="menuitem" onClick={openBioEditor} data-testid="button-edit-profile-bio">
              <PenLine size={16}/><span>Изменить «О себе»</span>
            </button>
          </div>}
        </div>
        <div className="tg-profile-info-row tg-profile-username-row" ref={usernameMenuRef}>
          <button
            className="tg-profile-username-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={usernameMenuOpen}
            onClick={() => { setUsernameNotice(''); setBioMenuOpen(false); setUsernameMenuOpen(value => !value); }}
            data-testid="button-profile-username-menu"
          >
            <p className="tg-profile-username">@{profile?.username || 'username'}</p>
            <span>Имя пользователя</span>
          </button>
          {usernameMenuOpen && <div className="tg-profile-username-menu glass-card" role="menu" aria-label="Действия с именем пользователя">
            <button type="button" role="menuitem" onClick={() => void copyUsername()} data-testid="button-copy-profile-username">
              <Copy size={16}/><span>Копировать имя</span>
            </button>
            <button type="button" role="menuitem" onClick={openUsernameEditor} data-testid="button-edit-profile-username">
              <PenLine size={16}/><span>Изменить имя</span>
            </button>
          </div>}
        </div>
      </section>
      {bioNotice && <p className="tg-profile-bio-notice" role="status">{bioNotice}</p>}
      {usernameNotice && <p className="tg-profile-username-notice" role="status">{usernameNotice}</p>}

      {editing && <section className="tg-profile-edit glass-card" aria-label="Редактирование профиля">
        <h2>Редактировать профиль</h2>
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="form-stack profile-form">
        <FormField control={form.control} name="username" rules={{required:'Укажите имя пользователя.',pattern:{value:/^[a-z][a-z0-9_]{4,31}$/,message:'От 5 до 32 строчных латинских букв, цифр или знаков подчёркивания.'}}} render={({field})=><FormItem><FormLabel>Имя пользователя</FormLabel><FormControl><div className="input-prefix"><span>@</span><Input {...field} data-testid="input-profile-username"/></div></FormControl><FormMessage/></FormItem>}/>
        <FormField control={form.control} name="avatarUrl" render={({field})=><FormItem><FormLabel>Ссылка на фото профиля</FormLabel><FormControl><Input type="url" placeholder="https://…" {...field} data-testid="input-profile-avatar"/></FormControl><FormMessage/></FormItem>}/>
        {form.formState.errors.root&&<p className="form-error">{form.formState.errors.root.message}</p>}
        <div className="form-actions">{saved&&<span className="saved-note"><Check size={15}/> Изменения сохранены</span>}<Button className="primary-button" disabled={save.isPending} data-testid="button-save-profile">{save.isPending?'Сохраняем…':'Сохранить изменения'}</Button></div>
      </form></Form>
      </section>}
    </main>}
  </div>;
}

function AccountEditPage() {
  const { user } = useAuth();
  const [, setPath] = useLocation();
  const query = useProfile(user?.id || '');
  const save = useSaveProfile();
  const profile = query.data;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!profile) return;
    const name = splitDisplayName(profile.displayName);
    setFirstName(name.firstName);
    setLastName(name.lastName);
    setUsername(profile.username);
    setBio(profile.bio);
    setError('');
  }, [profile?.id, profile?.displayName, profile?.username, profile?.bio]);

  useEffect(() => {
    const textarea = bioTextareaRef.current;
    if (!textarea) return;
    const minHeight = 78;
    const maxHeight = 130;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [bio]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;

    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    if (displayName.length < 2) {
      setError('Укажите имя и фамилию длиной не менее двух символов.');
      return;
    }
    if (displayName.length > 80) {
      setError('Имя и фамилия вместе должны содержать не более 80 символов.');
      return;
    }
    const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z][a-z0-9_]{4,31}$/.test(normalizedUsername)) {
      setError('Имя пользователя: от 5 до 32 латинских букв, цифр или знаков подчёркивания.');
      return;
    }

    setError('');
    try {
      await save.mutateAsync({
        id: user.id,
        displayName,
        username: normalizedUsername,
        bio: bio.trim(),
        avatarUrl: profile.avatarUrl,
      });
      setPath('/profile');
    } catch (saveError) {
      setError(userError(saveError, 'Не удалось сохранить изменения.'));
    }
  }

  return <div className="tg-account-page">
    <div className="tg-account-screen">
      <header className="tg-account-header">
        <button type="button" className="tg-account-back" onClick={() => setPath('/profile')} aria-label="Назад в профиль" data-testid="button-account-back">
          <ArrowLeft size={21}/>
        </button>
        <h1>Аккаунт</h1>
        <button
          type="submit"
          form="tg-account-edit-form"
          className="tg-account-save"
          aria-label="Сохранить"
          title="Сохранить"
          disabled={save.isPending || !profile}
          data-testid="button-account-save"
        >
          {save.isPending ? <LoaderCircle size={20} className="spin"/> : <Check size={21}/>}
        </button>
      </header>

      {query.isLoading ? <div className="loading-panel glass-card"><i/><b/><span/></div> : query.isError ? (
        <StateBlock title="Профиль недоступен" detail="Попробуйте загрузить профиль ещё раз." action="Повторить" onAction={() => query.refetch()}/>
      ) : profile && <form id="tg-account-edit-form" className="tg-account-form" onSubmit={event => void submit(event)}>
        <section className="tg-account-group" aria-labelledby="tg-account-name-label">
          <h2 className="tg-account-section-label" id="tg-account-name-label">Ваше имя</h2>
          <div className="tg-account-name-card">
            <Input
              id="tg-account-first-name"
              aria-label="Имя"
              placeholder="Имя"
              value={firstName}
              onChange={event => setFirstName(event.target.value)}
              maxLength={80}
              data-testid="input-account-first-name"
            />
            <div className="tg-account-divider" aria-hidden="true"/>
            <Input
              id="tg-account-last-name"
              aria-label="Фамилия"
              placeholder="Фамилия"
              value={lastName}
              onChange={event => setLastName(event.target.value)}
              maxLength={80}
              data-testid="input-account-last-name"
            />
          </div>
        </section>
        <section className="tg-account-group" aria-labelledby="tg-account-username-label">
          <h2 className="tg-account-section-label" id="tg-account-username-label">Имя пользователя</h2>
          <div className="tg-account-username-card">
            <span aria-hidden="true">@</span>
            <Input
              id="tg-account-username"
              aria-label="Имя пользователя"
              value={username}
              onChange={event => setUsername(event.target.value.replace(/^@/, ''))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={32}
              data-testid="input-account-username"
            />
          </div>
          <p className="tg-account-username-hint">5–32 символа: латинские буквы, цифры и подчёркивание.</p>
        </section>
        <section className="tg-account-group" aria-labelledby="tg-account-bio-label">
          <h2 className="tg-account-section-label" id="tg-account-bio-label">О себе</h2>
          <div className="tg-account-bio-card">
            <Textarea
              ref={bioTextareaRef}
              id="tg-account-bio"
              aria-label="О себе"
              value={bio}
              onChange={event => setBio(event.target.value.slice(0, 280))}
              maxLength={280}
              rows={3}
              placeholder="Пара слов о себе — если хотите."
              data-testid="input-account-bio"
            />
            <span className="tg-account-counter">{bio.length}/280</span>
          </div>
        </section>
        {error && <p className="form-error tg-account-error" role="alert">{error}</p>}
      </form>}
    </div>
  </div>;
}

function UsernameEditPage() {
  const { user } = useAuth();
  const [, setPath] = useLocation();
  const query = useProfile(user?.id || '');
  const save = useSaveProfile();
  const profile = query.data;
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setError('');
    }
  }, [profile?.id, profile?.username]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;

    const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z][a-z0-9_]{4,31}$/.test(normalizedUsername)) {
      setError('Имя пользователя должно содержать от 5 до 32 символов: латинские буквы, цифры или подчёркивание.');
      return;
    }

    setError('');
    try {
      await save.mutateAsync({
        id: user.id,
        displayName: profile.displayName,
        username: normalizedUsername,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      });
      setPath('/profile');
    } catch (saveError) {
      setError(userError(saveError, 'Не удалось сохранить имя пользователя.'));
    }
  }

  return <div className="tg-account-page tg-username-page">
    <div className="tg-account-screen">
      <header className="tg-account-header">
        <button type="button" className="tg-account-back" onClick={() => setPath('/profile')} aria-label="Назад в профиль" data-testid="button-username-back">
          <ArrowLeft size={21}/>
        </button>
        <h1>Имя пользователя</h1>
        <button
          type="submit"
          form="tg-username-edit-form"
          className="tg-account-save"
          aria-label="Сохранить"
          title="Сохранить"
          disabled={save.isPending || !profile}
          data-testid="button-username-save"
        >
          {save.isPending ? <LoaderCircle size={20} className="spin"/> : <Check size={21}/>}
        </button>
      </header>

      {query.isLoading ? <div className="loading-panel glass-card"><i/><b/><span/></div> : query.isError ? (
        <StateBlock title="Профиль недоступен" detail="Попробуйте загрузить профиль ещё раз." action="Повторить" onAction={() => query.refetch()}/>
      ) : profile && <form id="tg-username-edit-form" className="tg-account-form tg-username-form" onSubmit={event => void submit(event)}>
        <section className="tg-account-group" aria-labelledby="tg-username-section-label">
          <h2 className="tg-account-section-label" id="tg-username-section-label">Задать имя пользователя</h2>
          <div className="tg-account-username-card">
            <span aria-hidden="true">@</span>
            <Input
              id="tg-profile-username-edit"
              aria-label="Имя пользователя"
              aria-describedby="tg-username-description tg-username-rules"
              value={username}
              onChange={event => setUsername(event.target.value.replace(/^@/, ''))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={32}
              data-testid="input-profile-username-edit"
            />
          </div>
        </section>
        <p className="tg-username-description" id="tg-username-description">
          Вы можете выбрать публичное имя пользователя в MonoGram. По нему другие люди смогут найти вас и связаться с вами, не зная вашего телефона.
        </p>
        <p className="tg-username-rules" id="tg-username-rules">
          Можно использовать символы a–z, 0–9 и подчёркивание. Минимальная длина — 5 символов, максимальная — 32.
        </p>
        {error && <p className="form-error tg-account-error" role="alert">{error}</p>}
      </form>}
    </div>
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

function ContactsPage() {
  const { user } = useAuth();
  const [, setPath] = useLocation();
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');
  const normalizedTerm = term.trim().replace(/^@/, '');
  const search = useUserSearch(normalizedTerm, user?.id || '');
  const startConversation = useStartConversation(user?.id || '');
  const canSearch = normalizedTerm.length >= 2;

  async function openConversation(username: string) {
    setError('');
    try {
      const conversationId = await startConversation.mutateAsync(username);
      setPath(`/chat/${encodeURIComponent(conversationId)}`);
    } catch (cause) {
      setError(userError(cause, 'Не удалось начать переписку.'));
    }
  }

  return <div className="page-content mono-page">
    <PageHeader
      kicker="ЛЮДИ MONOGRAM"
      title="Контакты"
      description="Найдите человека по имени пользователя и начните переписку."
    />
    <label className="mono-contact-search glass-card">
      <Search size={18} />
      <input
        aria-label="Поиск контактов"
        autoComplete="off"
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Имя пользователя"
        value={term}
      />
      {term && <button type="button" aria-label="Очистить поиск" onClick={() => setTerm('')}><X size={16} /></button>}
    </label>
    {error && <p className="mono-contact-error" role="alert">{error}</p>}
    {!canSearch
      ? <div className="mono-contact-hint"><CircleUserRound size={23} /><b>Поиск по имени пользователя</b><span>Введите не менее двух символов.</span></div>
      : search.isLoading
        ? <StateBlock title="Ищем контакты" detail="Подождите немного." />
        : search.isError
          ? <StateBlock title="Не удалось выполнить поиск" detail="Проверьте соединение и попробуйте ещё раз." action="Повторить" onAction={() => { void search.refetch(); }} />
          : !search.data?.length
            ? <StateBlock title="Никого не нашли" detail="Проверьте имя пользователя и попробуйте ещё раз." />
            : <div className="mono-contact-list">
              {search.data.map((person) => <button
                className="mono-contact-result glass-card"
                disabled={startConversation.isPending}
                key={person.id}
                onClick={() => { void openConversation(person.username); }}
                type="button"
              >
                <Avatar profile={person} />
                <span><b>{person.displayName}</b><small>@{person.username}</small></span>
                <ArrowRight size={18} />
              </button>)}
            </div>}
  </div>;
}

function SettingsPage() {
  const { signOut } = useAuth();
  const [, setPath] = useLocation();
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matches = (value: string) => !normalizedSearch || value.toLowerCase().includes(normalizedSearch);
  const hasVisibleRows = matches('Профиль Имя имя пользователя описание') ||
    matches('Каналы Публикации и подписки') ||
    matches('Звёзды MonoGram Баланс и история операций') ||
    matches('Выйти из аккаунта Завершить текущий сеанс');

  async function logout() {
    setError('');
    try {
      await signOut();
    } catch (cause) {
      setError(userError(cause, 'Не удалось выйти из аккаунта.'));
    }
  }

  return <div className="page-content mono-page">
    <header className="mono-screen-header">
      <span className="mono-screen-header-spacer" aria-hidden="true"/>
      <h1>Настройки</h1>
      <div className="mono-screen-header-actions">
        <button type="button" aria-label="Поиск настроек" title="Поиск настроек" aria-expanded={searchOpen} onClick={() => { setSearchOpen(value => !value); setMenuOpen(false); if (searchOpen) setSearchTerm(''); }} data-testid="button-settings-search">
          <Search size={21}/>
        </button>
        <button type="button" aria-label="Дополнительные действия" title="Дополнительные действия" aria-expanded={menuOpen} onClick={() => { setMenuOpen(value => !value); setSearchOpen(false); }} data-testid="button-settings-menu">
          <MoreVertical size={21}/>
        </button>
        {menuOpen && <div className="mono-screen-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPath('/profile'); }}>Профиль</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void logout(); }}>Выйти из аккаунта</button>
        </div>}
      </div>
    </header>
    {searchOpen && <label className="mono-settings-search">
      <Search size={17} aria-hidden="true"/>
      <input aria-label="Поиск по настройкам" placeholder="Поиск настроек" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} autoComplete="off"/>
      {searchTerm && <button type="button" aria-label="Очистить поиск" onClick={() => setSearchTerm('')}><X size={16}/></button>}
    </label>}
    <section className="mono-settings-list" aria-label="Разделы приложения">
      {matches('Профиль Имя имя пользователя описание') && <Link className="mono-settings-row" href="/profile">
        <span className="mono-settings-icon"><UserRound size={19} /></span>
        <span><b>Профиль</b><small>Имя, имя пользователя и описание</small></span>
        <ArrowRight size={17} />
      </Link>}
      {matches('Каналы Публикации и подписки') && <Link className="mono-settings-row" href="/channels">
        <span className="mono-settings-icon"><Compass size={19} /></span>
        <span><b>Каналы</b><small>Публикации и подписки</small></span>
        <ArrowRight size={17} />
      </Link>}
      {matches('Звёзды MonoGram Баланс и история операций') && <Link className="mono-settings-row" href="/stars">
        <span className="mono-settings-icon"><Star size={19} /></span>
        <span><b>Звёзды MonoGram</b><small>Баланс и история операций</small></span>
        <ArrowRight size={17} />
      </Link>}
      {matches('Выйти из аккаунта Завершить текущий сеанс') && <button className="mono-settings-row mono-settings-row--logout" onClick={() => { void logout(); }} type="button">
        <span className="mono-settings-icon"><LogOut size={19} /></span>
        <span><b>Выйти из аккаунта</b><small>Завершить текущий сеанс</small></span>
        <ArrowRight size={17} />
      </button>}
      {!hasVisibleRows && <p className="mono-settings-empty">Ничего не найдено</p>}
    </section>
    {error && <p className="mono-contact-error" role="alert">{error}</p>}
  </div>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot-screen"><div className="boot-mark"><MessageCircle size={20}/></div><span>MONOGRAM</span><div className="boot-line"/></div>;
  if (!user) return <AuthScreen/>;
  return <AppShell><ErrorBoundary resetKey={window.location.pathname}><Switch>
    <Route path="/" component={ChatWorkspace}/>
    <Route path="/chat/:conversationId" component={ChatWorkspace}/>
    <Route path="/contacts" component={ContactsPage}/>
    <Route path="/settings" component={SettingsPage}/>
    <Route path="/channels" component={ChannelsPage}/>
    <Route path="/channels/:channelId" component={ChannelPage}/>
    <Route path="/profile/edit" component={AccountEditPage}/>
    <Route path="/profile/username" component={UsernameEditPage}/>
    <Route path="/profile" component={ProfilePage}/>
    <Route path="/stars" component={StarsPage}/>
    <Route component={NotFound}/>
  </Switch></ErrorBoundary></AppShell>;
}
function App() {
  return <QueryClientProvider client={client}><AuthProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppRoutes/></WouterRouter><Toaster/></TooltipProvider></AuthProvider></QueryClientProvider>;
}
export default App;
