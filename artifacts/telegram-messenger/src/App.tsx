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
import { enUS } from 'date-fns/locale';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 12_000, retry: 1, refetchOnWindowFocus: true } } });
const dateLabel = (value?: string) => value ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: enUS }) : '';
const clock = (value?: string) => value ? format(new Date(value), 'HH:mm') : '';
const initials = (name?: string) => (name || '?').trim().slice(0, 1).toUpperCase();

function Avatar({ profile, size = 'md' }: { profile?: Pick<Profile, 'displayName' | 'avatarUrl'>; size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`avatar avatar-${size}`} aria-label={profile?.displayName || 'Profile'}>{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile?.displayName)}</div>;
}

function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const schema = z.object({
    displayName: z.string().optional(),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
  }).refine(v => !register || (v.displayName || '').trim().length >= 2, { path: ['displayName'], message: 'Enter a name of at least 2 characters.' });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { displayName: '', email: '', password: '' } });
  async function submit(values: z.infer<typeof schema>) {
    setError(''); setBusy(true);
    try {
      if (register) {
        const signedIn = await signUp(values.email, values.password, values.displayName || '');
        setError(signedIn ? '' : 'Check your email to confirm your account, then sign in.');
        if (!signedIn) setRegister(false);
      } else await signIn(values.email, values.password);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not continue. Try again.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page">
    <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" />
    <section className="auth-panel glass-card">
      <div className="brand-lockup"><div className="brand-icon"><MessageCircle size={22} /></div><span>monogram<span className="brand-period">.</span></span></div>
      <div className="auth-kicker">A quieter kind of connection</div>
      <h1>{register ? 'Make room for your people.' : 'Your conversations,\nyour own.'}</h1>
      <p className="auth-description">Private messages, thoughtful channels, and MonoStars — all in one personal space.</p>
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="form-stack">
        {register && <FormField control={form.control} name="displayName" render={({ field }) => <FormItem><FormLabel>Your name</FormLabel><FormControl><Input data-testid="input-display-name" placeholder="How people know you" {...field} /></FormControl><FormMessage /></FormItem>} />}
        <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email address</FormLabel><FormControl><Input data-testid="input-email" type="email" autoComplete="email" placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Password</FormLabel><FormControl><Input data-testid="input-password" type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder="At least 8 characters" {...field} /></FormControl><FormMessage /></FormItem>} />
        {error && <p className="form-error" role="alert" data-testid="auth-message">{error}</p>}
        <Button className="primary-button auth-submit" type="submit" disabled={busy} data-testid={register ? 'button-register' : 'button-sign-in'}>{busy ? <LoaderCircle className="spin" size={17} /> : register ? 'Create account' : 'Sign in'}<ArrowLeft className="submit-arrow" size={16} /></Button>
      </form></Form>
      <div className="auth-switch">{register ? 'Already have a Monogram account?' : 'New to Monogram?'} <button type="button" data-testid="button-toggle-auth" onClick={() => { setRegister(!register); setError(''); }}> {register ? 'Sign in' : 'Create account'}</button></div>
      <div className="auth-foot"><Shield size={14} /> Your account is private by default</div>
    </section>
    <div className="auth-side-note"><span className="note-rule" /> MADE FOR REAL CONVERSATIONS</div>
  </main>;
}

function Navigation({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const [path] = useLocation();
  const links = [{ href: '/', label: 'Messages', icon: MessageCircle }, { href: '/channels', label: 'Channels', icon: Compass }, { href: '/stars', label: 'MonoStars', icon: Star }, { href: '/profile', label: 'My profile', icon: CircleUserRound }];
  return <nav className={`nav-links ${compact ? 'nav-compact' : ''}`}>{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={onNavigate} className={`nav-item ${path === href || (href === '/channels' && path.startsWith('/channels/')) ? 'nav-active' : ''}`} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={18} /><span>{label}</span>{href === '/stars' && <span className="nav-new">WALLET</span>}</Link>)}</nav>;
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
      <Link href="/" className="rail-brand" aria-label="Monogram home"><span className="brand-icon"><MessageCircle size={20} /></span></Link>
      <Navigation />
      <div className="rail-bottom">
        <button className="rail-profile" onClick={() => setMenuOpen(!menuOpen)} aria-label="Account menu" data-testid="button-account-menu"><Avatar profile={profile} size="sm" /></button>
        {menuOpen && <div className="account-pop glass-card">
          <div className="account-pop-head"><Avatar profile={profile} size="sm" /><div><b>{profile?.displayName || 'Your profile'}</b><span>@{profile?.username || 'set-username'}</span></div></div>
          <Link href="/profile" onClick={() => setMenuOpen(false)}><Settings2 size={16} /> Edit profile</Link>
          <button onClick={logout} data-testid="button-sign-out"><LogOut size={16} /> Sign out</button>
        </div>}
        <button className="mobile-menu-toggle" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)} data-testid="button-mobile-menu"><Menu size={20} /></button>
      </div>
    </aside>
    {mobileNav && <div className="mobile-nav glass-card"><button className="close-mobile-nav" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19} /></button><Navigation compact onNavigate={() => setMobileNav(false)} /></div>}
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
    catch (e) { setError(e instanceof Error ? e.message : 'Message could not be sent.'); }
  }
  async function beginChat(value = username) {
    setStartError('');
    try { const conversationId = await startConversation.mutateAsync(value.trim().replace(/^@/, '')); setNewChat(false); setUsername(''); setPath(`/chat/${encodeURIComponent(conversationId)}`); }
    catch (e) { setStartError(e instanceof Error ? e.message : 'Could not start a conversation.'); }
  }
  const messages = messagesQuery.data || [];
  return <div className={`chat-layout ${id ? 'chat-open' : ''}`}>
    <aside className="chat-sidebar">
      <header className="chat-sidebar-head">
        <div><span className="overline">YOUR SPACE</span><h1>Messages</h1></div>
        <button className="round-action" onClick={() => setNewChat(true)} title="Start a conversation" aria-label="Start a conversation" data-testid="button-new-chat"><Plus size={19} /></button>
      </header>
      {showSearch && <div className="search-control"><Search size={16} /><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a conversation" data-testid="input-chat-search" /><button onClick={() => { setSearch(''); setShowSearch(false); }} aria-label="Close search"><X size={16} /></button></div>}
      <div className="conversation-heading"><span>DIRECT CONVERSATIONS</span><button onClick={() => setShowSearch(!showSearch)} aria-label="Search messages" data-testid="button-search-chats"><Search size={16} /></button></div>
      <div className="conversation-list">
        {chatsQuery.isLoading ? <div className="list-skeleton">{[1,2,3,4].map(i => <div className="skeleton-chat" key={i}><i/><span/><b/></div>)}</div> : chatsQuery.isError ? <StateBlock title="Could not load messages" detail="Check your connection and try again." action="Retry" onAction={() => chatsQuery.refetch()} /> : filtered.length === 0 ? <div className="sidebar-empty"><div className="empty-mark"><MessageCircle size={19}/></div><b>{search ? 'No match found' : 'Your inbox is quiet'}</b><p>{search ? 'Try another name or username.' : 'Find someone by username to start a private conversation.'}</p>{!search && <button className="text-action" onClick={() => setNewChat(true)} data-testid="button-start-first-chat">Find someone <ArrowLeft size={14}/></button>}</div> : filtered.map((chat: Conversation) => <button className={`conversation-row ${id === chat.id ? 'row-selected' : ''}`} key={chat.id} onClick={() => setPath(`/chat/${encodeURIComponent(chat.id)}`)} data-testid={`conversation-${chat.id}`}>
          <Avatar profile={chat.person} />
          <span className="conversation-row-copy"><span className="row-title">{chat.person.displayName}<time>{clock(chat.lastMessage?.createdAt)}</time></span><span className="row-preview">{chat.lastMessage?.content || 'No messages yet'}</span><span className="row-username">@{chat.person.username}</span></span>
        </button>)}
      </div>
       <div className="sidebar-bottom-note"><span className={`live-dot ${presence.connected ? '' : 'live-offline'}`} />{presence.connected ? `${presence.onlineCount} online` : 'Reconnecting'}</div>
    </aside>
    <section className="chat-stage">
      {current ? <>
         <header className="chat-topbar"><button className="mobile-back" onClick={() => setPath('/')} aria-label="Back to conversations" data-testid="button-back-chats"><ArrowLeft size={19}/></button><Avatar profile={current.person} size="sm"/><div className="chat-top-person"><b>{current.person.displayName}</b><span className={presence.onlineUserIds.includes(current.person.id) ? 'presence-online' : ''}>{presence.onlineUserIds.includes(current.person.id) ? 'Online now' : `@${current.person.username}`}</span></div><button className="quiet-icon" aria-label="Conversation options" data-testid="button-conversation-options"><MoreHorizontal size={20}/></button></header>
        <div className="message-area">
          {messagesQuery.isLoading ? <div className="message-skeleton"><i/><i/><i/></div> : messagesQuery.isError ? <StateBlock title="Messages did not load" detail="Your conversation is safe. Please try again." action="Retry" onAction={() => messagesQuery.refetch()} /> : messages.length === 0 ? <div className="chat-welcome"><span className="welcome-symbol"><MessageCircle size={23}/></span><span className="overline">A PRIVATE CONVERSATION</span><h2>Say hello to {current.person.displayName.split(' ')[0]}.</h2><p>Messages here are just between the two of you.</p></div> : <div className="message-thread">{messages.map((message: DirectMessage) => {
            const mine = message.authorId === user?.id;
            return <div className={`message-row ${mine ? 'mine' : ''}`} key={message.id} data-testid={`message-${message.id}`}><div className="message-bubble"><p>{message.content}</p><time>{clock(message.createdAt)} {mine && <Check size={12}/>}</time></div></div>;
          })}<div ref={endRef}/></div>}
        </div>
        <form className="composer" onSubmit={send}><textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Write a message…" maxLength={4000} rows={1} data-testid="input-message" /><span className="composer-count">{draft.length ? `${draft.length}/4000` : 'Enter to send'}</span><button className="send-circle" type="submit" disabled={!draft.trim() || sendMessage.isPending} aria-label="Send message" data-testid="button-send-message">{sendMessage.isPending ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}</button></form>
        {error && <div className="inline-error" role="alert">{error}<button onClick={() => void send()} data-testid="button-retry-message">Try again</button></div>}
      </> : <div className="conversation-empty"><div className="empty-art"><div className="art-ring ring-a"/><div className="art-ring ring-b"/><span><MessageCircle size={28}/></span></div><span className="overline">MONOGRAM / PRIVATE MESSAGING</span><h2>A little space to talk.</h2><p>Select a conversation, or find someone by their username.</p><button className="primary-button" onClick={() => setNewChat(true)} data-testid="button-find-person"><Plus size={16}/> Find someone</button><div className="empty-caption">No sample conversations. Your space starts with you.</div></div>}
    </section>
    {newChat && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setNewChat(false); }}><section className="dialog glass-card"><button className="dialog-close" onClick={() => setNewChat(false)} aria-label="Close"><X size={18}/></button><span className="overline">START SOMETHING PERSONAL</span><h2>Find by username</h2><p>Search the exact username. People stay private until you reach out.</p><div className="username-input"><AtSign size={17}/><input autoFocus value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ''))} placeholder="username" data-testid="input-find-username"/></div>
      {username.length >= 2 && <div className="user-results">{searchUsers.isLoading ? <div className="result-hint">Looking for people…</div> : searchUsers.isError ? <div className="result-hint">Search is unavailable right now.</div> : searchUsers.data?.length ? searchUsers.data.map(person => <button key={person.id} className="user-result" onClick={() => void beginChat(person.username)} data-testid={`user-result-${person.id}`}><Avatar profile={person} size="sm"/><span><b>{person.displayName}</b><small>@{person.username}</small></span><ArrowLeft size={15}/></button>) : <div className="result-hint">No accounts found for that username.</div>}</div>}
      {startError && <p className="form-error" role="alert">{startError}</p>}
      <button className="primary-button full-button" onClick={() => void beginChat()} disabled={!username.trim() || startConversation.isPending} data-testid="button-start-conversation">{startConversation.isPending ? <LoaderCircle className="spin" size={16}/> : <MessageCircle size={16}/>} Start conversation</button>
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
    catch (e) { form.setError('root', { message: e instanceof Error ? e.message : 'Could not create channel.' }); }
  }
  return <div className="page-content">
    <PageHeader kicker="PUBLIC VOICES" title="Channels" description="Follow the voices you care about. Share something of your own." action={<button className="primary-button" onClick={() => setModal(true)} data-testid="button-create-channel"><Plus size={16}/> Create channel</button>}/>
    <div className="directory-toolbar"><div className="search-control directory-search"><Search size={16}/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search channels" data-testid="input-channel-search"/></div><span>{query.isLoading ? 'Loading…' : `${channels.length} ${channels.length === 1 ? 'channel' : 'channels'}`}</span></div>
    {query.isLoading ? <div className="channel-grid">{[1,2,3].map(i=><div className="channel-skeleton glass-card" key={i}><i/><b/><span/></div>)}</div> : query.isError ? <StateBlock title="Channels unavailable" detail="Please check your connection." action="Retry" onAction={() => query.refetch()}/> : shown.length === 0 ? <div className="empty-panel"><div className="empty-mark"><Compass size={21}/></div><h2>{filter ? 'No channels match' : 'The directory is waiting'}</h2><p>{filter ? 'Try a different title or username.' : 'Channels you join and publish will appear here. Start a channel when you have something to share.'}</p>{!filter && <button className="outline-button" onClick={() => setModal(true)} data-testid="button-create-first-channel"><Plus size={15}/> Create a channel</button>}</div> : <div className="channel-grid">{shown.map((channel: Channel, index) => <ChannelCard key={channel.id} channel={channel} index={index}/>)}</div>}
    {modal && <div className="modal-backdrop"><section className="dialog glass-card"><button className="dialog-close" onClick={() => setModal(false)} aria-label="Close"><X size={18}/></button><span className="overline">A PLACE FOR YOUR VOICE</span><h2>Create a channel</h2><p>Choose a title and a memorable public username.</p><Form {...form}><form onSubmit={form.handleSubmit(submit)} className="form-stack">
      <FormField control={form.control} name="title" rules={{ required: 'Add a channel title.' }} render={({field})=><FormItem><FormLabel>Channel title</FormLabel><FormControl><Input placeholder="The Sunday Edit" {...field} data-testid="input-channel-title"/></FormControl><FormMessage/></FormItem>}/>
      <FormField control={form.control} name="username" rules={{required:'Choose a username.',pattern:{value:/^[a-z][a-z0-9_]{2,31}$/i,message:'Use 3–32 letters, numbers, or underscores.'}}} render={({field})=><FormItem><FormLabel>Username</FormLabel><FormControl><div className="input-prefix"><span>@</span><Input placeholder="yourchannel" {...field} data-testid="input-channel-username"/></div></FormControl><FormMessage/></FormItem>}/>
      <FormField control={form.control} name="description" render={({field})=><FormItem><FormLabel>About</FormLabel><FormControl><Textarea placeholder="What will people find here?" {...field} data-testid="input-channel-description"/></FormControl><FormMessage/></FormItem>}/>
      {form.formState.errors.root && <p className="form-error">{form.formState.errors.root.message}</p>}
      <Button className="primary-button full-button" disabled={create.isPending} data-testid="button-submit-channel">{create.isPending ? 'Creating…' : 'Create channel'}</Button>
    </form></Form></section></div>}
  </div>;
}
function ChannelCard({ channel, index }: {channel: Channel; index:number}) {
  return <Link href={`/channels/${channel.id}`} className="channel-card glass-card" data-testid={`channel-card-${channel.id}`}><div className="channel-card-top"><span className={`channel-monogram tone-${index % 4}`}><Hash size={21}/></span><span className="channel-member">{channel.isMember ? 'FOLLOWING' : 'PUBLIC'}</span></div><h2>{channel.title}</h2><span className="channel-handle">@{channel.username}</span><p>{channel.description || 'A channel on Monogram.'}</p><div className="channel-card-bottom"><span>Open channel</span><ArrowLeft size={15}/></div></Link>;
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
  async function publish(e: FormEvent) { e.preventDefault(); if (!user || !body.trim()) return; setPostError(''); try { await createPost.mutateAsync({channelId,authorId:user.id,body:body.trim()}); setBody(''); } catch(e) { setPostError(e instanceof Error ? e.message : 'Post could not be published.'); } }
  async function sendReaction(postId:string) { setReactionError(''); try { await sendStars.mutateAsync({postId,stars:Number(stars)}); setStarsTarget(''); } catch(e) { setReactionError(e instanceof Error ? e.message : 'Could not send MonoStars.'); } }
  if (channelsQuery.isLoading) return <div className="page-content"><div className="loading-panel glass-card"><i/><b/><span/></div></div>;
  if (!channel) return <div className="page-content"><StateBlock title="Channel not found" detail="It may have been removed, or the address is incorrect."/><Link href="/channels" className="text-action">Back to channels</Link></div>;
  return <div className="page-content channel-page">
    <div className="channel-hero glass-card"><Link href="/channels" className="back-link"><ArrowLeft size={15}/> All channels</Link><div className="channel-hero-mark"><Hash size={25}/></div><span className="overline">CHANNEL / @{channel.username}</span><h1>{channel.title}</h1><p>{channel.description || 'A public Monogram channel.'}</p><div className="channel-hero-actions">{channel.isMember ? <span className="member-status"><Check size={15}/> Following</span> : <button className="primary-button" onClick={() => join.mutate(channelId)} disabled={join.isPending} data-testid="button-join-channel">{join.isPending ? 'Joining…' : 'Follow channel'}</button>}<span className="star-balance"><Star size={15}/>{wallet.data?.balance ?? '—'} MonoStars</span></div></div>
     {channel.role === 'owner' && <form className="publish-box glass-card" onSubmit={publish}><Textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} placeholder="Share something with your channel…" data-testid="input-channel-post"/>{postError&&<p className="form-error" role="alert">{postError}</p>}<div><span>{body.length}/4000</span><button className="primary-button" disabled={!body.trim() || createPost.isPending} data-testid="button-publish-post">{createPost.isPending ? 'Publishing…' : 'Publish'}<Send size={15}/></button></div></form>}
    <div className="posts-heading"><div><span className="overline">THE FEED</span><h2>Latest posts</h2></div><span>{postsQuery.data?.length ?? ''}</span></div>
    {postsQuery.isLoading ? <div className="post-skeleton glass-card"><i/><span/><b/><span/></div> : postsQuery.isError ? <StateBlock title="Posts did not load" detail="Try again in a moment." action="Retry" onAction={() => postsQuery.refetch()}/> : !postsQuery.data?.length ? <div className="empty-panel compact-empty"><div className="empty-mark"><MessageCircle size={19}/></div><h2>No posts yet</h2><p>{channel.isMember ? 'Your first post can set the tone.' : 'Follow the channel to see future updates.'}</p></div> : <div className="post-list">{postsQuery.data.map((post:ChannelPost)=><article className="post-card glass-card" key={post.id} data-testid={`post-${post.id}`}><div className="post-byline"><span className="author-mark">{initials(post.authorName)}</span><div><b>{post.authorName}</b><small>@{post.authorUsername} · {dateLabel(post.createdAt)}</small></div><button className={`stars-react ${post.myStars ? 'reacted' : ''}`} onClick={()=>{setStarsTarget(starsTarget===post.id?'':post.id);setReactionError('');}} aria-label="Send MonoStars" data-testid={`button-react-${post.id}`}><Star size={16}/><span>{post.starsTotal}</span></button></div><p className="post-body">{post.body}</p>{starsTarget===post.id && <div className="reaction-panel"><label>Send MonoStars</label><select value={stars} onChange={e=>setStars(e.target.value)} data-testid={`select-stars-${post.id}`}><option value="1">1 star</option><option value="5">5 stars</option><option value="10">10 stars</option><option value="25">25 stars</option></select><span>Balance: {wallet.data?.balance ?? 0}</span><button onClick={()=>void sendReaction(post.id)} disabled={sendStars.isPending} data-testid={`button-send-stars-${post.id}`}>{sendStars.isPending?'Sending…':'Send'}</button>{reactionError&&<small className="form-error">{reactionError}</small>}</div>}</article>)}</div>}
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
  async function submit(v:{displayName:string;username:string;bio:string;avatarUrl:string}){if(!user)return;setSaved(false);try{await save.mutateAsync({id:user.id,...v,avatarUrl:v.avatarUrl||null});setSaved(true);}catch(e){form.setError('root',{message:e instanceof Error?e.message:'Profile could not be saved.'});}}
  return <div className="page-content narrow-page"><PageHeader kicker="YOUR IDENTITY" title="Profile" description="This is how people find and recognize you."/>
    {query.isLoading ? <div className="loading-panel glass-card"><i/><b/><span/></div> : query.isError ? <StateBlock title="Profile unavailable" detail="Please try loading your profile again." action="Retry" onAction={()=>query.refetch()}/> : <><div className="profile-preview glass-card"><Avatar profile={profile} size="lg"/><div><span className="overline">YOUR MONOGRAM</span><h2>{profile?.displayName}</h2><span>@{profile?.username}</span></div><span className="profile-private"><Shield size={14}/> PRIVATE</span></div>
    <section className="settings-card glass-card"><div className="settings-heading"><div><h2>Public details</h2><p>Only the details you choose are shown.</p></div><CircleUserRound size={19}/></div>
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="form-stack profile-form">
        <FormField control={form.control} name="displayName" rules={{required:'Your display name is required.'}} render={({field})=><FormItem><FormLabel>Display name</FormLabel><FormControl><Input {...field} data-testid="input-profile-name"/></FormControl><FormMessage/></FormItem>}/>
        <FormField control={form.control} name="username" rules={{required:'Username is required.',pattern:{value:/^[a-z][a-z0-9_]{2,31}$/,message:'3–32 lowercase letters, numbers, or underscores.'}}} render={({field})=><FormItem><FormLabel>Username</FormLabel><FormControl><div className="input-prefix"><span>@</span><Input {...field} data-testid="input-profile-username"/></div></FormControl><FormMessage/></FormItem>}/>
        <FormField control={form.control} name="bio" render={({field})=><FormItem><FormLabel>About you</FormLabel><FormControl><Textarea maxLength={280} placeholder="A sentence or two, if you like." {...field} data-testid="input-profile-bio"/></FormControl><FormMessage/></FormItem>}/>
        <FormField control={form.control} name="avatarUrl" render={({field})=><FormItem><FormLabel>Avatar image URL</FormLabel><FormControl><Input type="url" placeholder="https://…" {...field} data-testid="input-profile-avatar"/></FormControl><FormMessage/></FormItem>}/>
        {form.formState.errors.root&&<p className="form-error">{form.formState.errors.root.message}</p>}
        <div className="form-actions">{saved&&<span className="saved-note"><Check size={15}/> Changes saved</span>}<Button className="primary-button" disabled={save.isPending} data-testid="button-save-profile">{save.isPending?'Saving…':'Save changes'}</Button></div>
      </form></Form>
    </section></>}
  </div>;
}

function StarsPage() {
  const { user } = useAuth();
  const query = useWallet(user?.id || '');
  const wallet = query.data;
  return <div className="page-content narrow-page"><PageHeader kicker="APPRECIATION, IN YOUR HANDS" title="MonoStars" description="A little recognition you can send to the posts that stay with you."/>
    {query.isLoading ? <div className="loading-panel glass-card"><i/><b/><span/></div> : query.isError ? <StateBlock title="Wallet unavailable" detail="Your balance is safe. Try again shortly." action="Retry" onAction={()=>query.refetch()}/> : <><section className="balance-card glass-card"><div className="balance-decoration"><Star size={32}/></div><div><span className="overline">YOUR BALANCE</span><div className="balance-value">{wallet?.balance ?? 0}<span>MonoStars</span></div><p>Use your stars to appreciate channel posts.</p></div><div className="balance-stamp"><Sparkles size={18}/><span>MEANINGFUL<br/>REACTIONS</span></div></section>
      <section className="ledger-section"><div className="section-title"><div><span className="overline">RECENT ACTIVITY</span><h2>Star ledger</h2></div><span>{wallet?.transactions.length || 0} entries</span></div>
        {!wallet?.transactions.length ? <div className="empty-panel ledger-empty"><div className="empty-mark"><Wallet size={20}/></div><h2>No activity yet</h2><p>Your MonoStars transactions will appear here.</p></div> : <div className="ledger-list glass-card">{wallet.transactions.map(tx=><div className="ledger-row" key={tx.id} data-testid={`transaction-${tx.id}`}><div className={`ledger-icon ${tx.amount < 0 ? 'spent' : ''}`}>{tx.amount < 0 ? <Send size={16}/> : <Star size={16}/>}</div><div className="ledger-copy"><b>{tx.reason}</b><span>{dateLabel(tx.createdAt)}</span></div><strong className={tx.amount < 0 ? 'amount-out' : 'amount-in'}>{tx.amount > 0 ? '+' : ''}{tx.amount}</strong></div>)}</div>}
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
