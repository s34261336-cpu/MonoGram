import { Router, type IRouter, type Request, type Response, type RequestHandler } from 'express';
import { requireDemoSession } from '../lib/demo-session';
import { supabaseAdmin } from '../lib/supabase-admin';

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
};

const router: IRouter = Router();
const profileFields = 'id, username, display_name, bio, avatar_url';

function apiError(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

function checkError(error: { message?: string; code?: string } | null) {
  if (error) throw apiError(error.message || 'Не удалось выполнить запрос.');
}

function toProfile(row: ProfileRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url,
  };
}

function handleRoute(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next);
  };
}

function userId(req: Request) {
  if (!req.demoIdentity) throw apiError('Сессия завершена. Войдите снова.', 401);
  return req.demoIdentity.id;
}

async function isMember(conversationId: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from('dm_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', id)
    .maybeSingle();
  checkError(error);
  return Boolean(data);
}

async function isChannelMember(channelId: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from('channel_members')
    .select('user_id')
    .eq('channel_id', channelId)
    .eq('user_id', id)
    .maybeSingle();
  checkError(error);
  return Boolean(data);
}

router.use(requireDemoSession);

router.get('/profile', handleRoute(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(profileFields)
    .eq('id', userId(req))
    .single();
  checkError(error);
  res.json(toProfile(data as ProfileRow));
}));

router.patch('/profile/bio', handleRoute(async (req, res) => {
  const id = userId(req);
  if (typeof req.body?.bio !== 'string') {
    throw apiError('Введите текст о себе.');
  }
  const bio = req.body.bio.trim().slice(0, 280);
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ bio, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(profileFields)
    .single();
  checkError(error);
  res.json(toProfile(data as ProfileRow));
}));

router.patch('/profile', handleRoute(async (req, res) => {
  const id = userId(req);
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const username = typeof req.body?.username === 'string'
    ? req.body.username.trim().toLowerCase().replace(/^@/, '')
    : '';
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim().slice(0, 280) : '';
  const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl.trim() || null : null;
  if (displayName.length < 2 || displayName.length > 80) throw apiError('Имя должно содержать от 2 до 80 символов.');
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(username)) throw apiError('Юзернейм: латинская буква в начале и 3–32 символа.');
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ display_name: displayName, username, bio, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(profileFields)
    .single();
  checkError(error);
  res.json(toProfile(data as ProfileRow));
}));

router.get('/search', handleRoute(async (req, res) => {
  const id = userId(req);
  const query = String(req.query.term || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (query.length < 2) {
    res.json([]);
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(profileFields)
    .ilike('username', `${query}%`)
    .neq('id', id)
    .order('username')
    .limit(12);
  checkError(error);
  res.json((data ?? []).map(row => toProfile(row as ProfileRow)));
}));

router.get('/wallet', handleRoute(async (req, res) => {
  const id = userId(req);
  const [walletResult, transactionsResult] = await Promise.all([
    supabaseAdmin.from('star_wallets').select('balance').eq('user_id', id).single(),
    supabaseAdmin.from('star_transactions')
      .select('id, amount, reason, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  checkError(walletResult.error);
  checkError(transactionsResult.error);
  if (!walletResult.data) throw apiError('Кошелёк не найден.', 404);
  res.json({
    balance: walletResult.data.balance,
    transactions: (transactionsResult.data ?? []).map(row => ({
      id: row.id,
      amount: row.amount,
      reason: row.reason,
      createdAt: row.created_at,
    })),
  });
}));

router.get('/chats', handleRoute(async (req, res) => {
  const id = userId(req);
  const { data: ownMemberships, error: ownError } = await supabaseAdmin
    .from('dm_members')
    .select('conversation_id')
    .eq('user_id', id);
  checkError(ownError);
  const conversationIds = [...new Set((ownMemberships ?? []).map(row => row.conversation_id))];
  if (!conversationIds.length) {
    res.json([]);
    return;
  }

  const [membersResult, messagesResult] = await Promise.all([
    supabaseAdmin.from('dm_members').select('conversation_id, user_id').in('conversation_id', conversationIds),
    supabaseAdmin.from('dm_messages')
      .select('id, conversation_id, author_id, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  checkError(membersResult.error);
  checkError(messagesResult.error);
  const members = membersResult.data ?? [];
  const personIds = [...new Set(members.filter(row => row.user_id !== id).map(row => row.user_id))];
  if (!personIds.length) {
    res.json([]);
    return;
  }
  const { data: profileRows, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select(profileFields)
    .in('id', personIds);
  checkError(profilesError);
  const profiles = new Map((profileRows ?? []).map(row => [row.id, toProfile(row as ProfileRow)]));
  const personByConversation = new Map<string, ReturnType<typeof toProfile>>();
  for (const member of members) {
    if (member.user_id === id) continue;
    const profile = profiles.get(member.user_id);
    if (profile) personByConversation.set(member.conversation_id, profile);
  }
  const latestByConversation = new Map<string, Record<string, unknown>>();
  for (const row of messagesResult.data ?? []) {
    if (latestByConversation.has(row.conversation_id)) continue;
    const author = row.author_id === id ? null : profiles.get(row.author_id);
    latestByConversation.set(row.conversation_id, {
      id: row.id,
      conversationId: row.conversation_id,
      authorId: row.author_id,
      authorName: author?.displayName ?? (row.author_id === id ? 'Вы' : 'Пользователь'),
      authorUsername: author?.username ?? '',
      content: row.content,
      createdAt: row.created_at,
    });
  }
  res.json(conversationIds
    .map(conversationId => ({
      id: conversationId,
      person: personByConversation.get(conversationId),
      lastMessage: latestByConversation.get(conversationId) ?? null,
    }))
    .filter(item => Boolean(item.person))
    .sort((a, b) => new Date(String(b.lastMessage?.createdAt ?? 0)).getTime() - new Date(String(a.lastMessage?.createdAt ?? 0)).getTime()));
}));

router.get('/messages', handleRoute(async (req, res) => {
  const id = userId(req);
  const conversationId = String(req.query.conversationId || '');
  if (!conversationId || !(await isMember(conversationId, id))) throw apiError('Переписка не найдена.', 404);
  const { data: rows, error } = await supabaseAdmin.from('dm_messages')
    .select('id, conversation_id, author_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  checkError(error);
  const messages = rows ?? [];
  const authorIds = [...new Set(messages.map(row => row.author_id))];
  const { data: profiles, error: profilesError } = authorIds.length
    ? await supabaseAdmin.from('profiles').select(profileFields).in('id', authorIds)
    : { data: [], error: null };
  checkError(profilesError);
  const profileById = new Map((profiles ?? []).map(row => [row.id, toProfile(row as ProfileRow)]));
  res.json(messages.map(row => {
    const author = profileById.get(row.author_id);
    return {
      id: row.id,
      conversationId: row.conversation_id,
      authorId: row.author_id,
      authorName: author?.displayName ?? 'Пользователь',
      authorUsername: author?.username ?? '',
      content: row.content,
      createdAt: row.created_at,
    };
  }));
}));

router.post('/messages', handleRoute(async (req, res) => {
  const id = userId(req);
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : '';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 4000) throw apiError('Сообщение должно содержать от 1 до 4000 символов.');
  if (!(await isMember(conversationId, id))) throw apiError('Переписка не найдена.', 404);
  const { data, error } = await supabaseAdmin.from('dm_messages')
    .insert({ conversation_id: conversationId, author_id: id, content })
    .select('id, conversation_id, author_id, content, created_at')
    .single();
  checkError(error);
  if (!data) throw apiError('Сообщение не сохранено.');
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select(profileFields).eq('id', id).single();
  checkError(profileError);
  if (!profile) throw apiError('Профиль не найден.', 404);
  res.json({
    id: data.id,
    conversationId: data.conversation_id,
    authorId: data.author_id,
    authorName: profile.display_name,
    authorUsername: profile.username,
    content: data.content,
    createdAt: data.created_at,
  });
}));

router.post('/conversations', handleRoute(async (req, res) => {
  const id = userId(req);
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().replace(/^@/, '').toLowerCase() : '';
  const { data, error } = await supabaseAdmin.rpc('demo_start_conversation', {
    p_user_id: id,
    p_username: username,
  });
  checkError(error);
  res.json(data);
}));

router.get('/channels', handleRoute(async (req, res) => {
  const id = userId(req);
  const [channelsResult, membershipsResult] = await Promise.all([
    supabaseAdmin.from('channels')
      .select('id, owner_id, title, username, description, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin.from('channel_members').select('channel_id, role').eq('user_id', id),
  ]);
  checkError(channelsResult.error);
  checkError(membershipsResult.error);
  const roles = new Map((membershipsResult.data ?? []).map(row => [row.channel_id, row.role]));
  res.json((channelsResult.data ?? []).map(row => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    username: row.username,
    description: row.description ?? '',
    createdAt: row.created_at,
    isMember: roles.has(row.id),
    role: roles.get(row.id) ?? null,
  })));
}));

router.post('/channels', handleRoute(async (req, res) => {
  const { data, error } = await supabaseAdmin.rpc('demo_create_channel', {
    p_user_id: userId(req),
    p_title: typeof req.body?.title === 'string' ? req.body.title.trim() : '',
    p_username: typeof req.body?.username === 'string' ? req.body.username.trim().replace(/^@/, '').toLowerCase() : '',
    p_description: typeof req.body?.description === 'string' ? req.body.description.trim() : '',
  });
  checkError(error);
  res.json(data);
}));

router.post('/channels/:channelId/join', handleRoute(async (req, res) => {
  const { error } = await supabaseAdmin.rpc('demo_join_channel', {
    p_user_id: userId(req),
    p_channel_id: String(req.params.channelId),
  });
  checkError(error);
  res.json({ ok: true });
}));

router.get('/channels/:channelId/posts', handleRoute(async (req, res) => {
  const id = userId(req);
  const channelId = String(req.params.channelId);
  if (!(await isChannelMember(channelId, id))) throw apiError('Сначала вступите в канал.', 403);
  const { data: rows, error } = await supabaseAdmin.from('channel_posts')
    .select('id, channel_id, author_id, body, created_at')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(300);
  checkError(error);
  if (!rows?.length) {
    res.json([]);
    return;
  }
  const postIds = rows.map(row => row.id);
  const authorIds = [...new Set(rows.map(row => row.author_id))];
  const [profilesResult, reactionsResult] = await Promise.all([
    supabaseAdmin.from('profiles').select(profileFields).in('id', authorIds),
    supabaseAdmin.from('star_reactions').select('post_id, user_id, stars').in('post_id', postIds),
  ]);
  checkError(profilesResult.error);
  checkError(reactionsResult.error);
  const profiles = new Map((profilesResult.data ?? []).map(row => [row.id, toProfile(row as ProfileRow)]));
  const totals = new Map<string, { total: number; mine: number }>();
  for (const reaction of reactionsResult.data ?? []) {
    const value = totals.get(reaction.post_id) ?? { total: 0, mine: 0 };
    value.total += reaction.stars;
    if (reaction.user_id === id) value.mine = reaction.stars;
    totals.set(reaction.post_id, value);
  }
  res.json(rows.map(row => {
    const author = profiles.get(row.author_id);
    const reaction = totals.get(row.id);
    return {
      id: row.id,
      channelId: row.channel_id,
      authorId: row.author_id,
      authorName: author?.displayName ?? 'Пользователь',
      authorUsername: author?.username ?? '',
      body: row.body,
      createdAt: row.created_at,
      starsTotal: reaction?.total ?? 0,
      myStars: reaction?.mine ?? 0,
    };
  }));
}));

router.post('/channels/:channelId/posts', handleRoute(async (req, res) => {
  const id = userId(req);
  const channelId = String(req.params.channelId);
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 4000) throw apiError('Публикация должна содержать от 1 до 4000 символов.');
  const { data: channel, error: channelError } = await supabaseAdmin
    .from('channels').select('owner_id').eq('id', channelId).single();
  checkError(channelError);
  if (!channel) throw apiError('Канал не найден.', 404);
  if (channel.owner_id !== id) throw apiError('Публиковать может только владелец канала.', 403);
  const { error } = await supabaseAdmin.from('channel_posts').insert({
    channel_id: channelId,
    author_id: id,
    body,
  });
  checkError(error);
  res.json({ ok: true });
}));

router.post('/stars', handleRoute(async (req, res) => {
  const stars = Number(req.body?.stars);
  const { data, error } = await supabaseAdmin.rpc('demo_send_star_reaction', {
    p_user_id: userId(req),
    p_post_id: req.body?.postId,
    p_stars: stars,
  });
  checkError(error);
  res.json(data);
}));

export default router;
