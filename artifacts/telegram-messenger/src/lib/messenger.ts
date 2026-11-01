import { requireSupabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  person: Profile;
  lastMessage: DirectMessage | null;
};

export type Channel = {
  id: string;
  ownerId: string;
  title: string;
  username: string;
  description: string;
  createdAt: string;
  isMember: boolean;
  role: string | null;
};

export type ChannelPost = {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  body: string;
  createdAt: string;
  starsTotal: number;
  myStars: number;
};

export type StarTransaction = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type Wallet = {
  balance: number;
  transactions: StarTransaction[];
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
};

const fail = (error: { message?: string } | null) => {
  if (error) throw new Error(error.message || 'Не удалось выполнить запрос.');
};

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  bio: row.bio ?? '',
  avatarUrl: row.avatar_url,
});

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .eq('id', userId)
    .single();
  fail(error);
  return toProfile(data as ProfileRow);
}

export async function saveProfile(input: {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl?: string | null;
}): Promise<Profile> {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(username)) {
    throw new Error('Юзернейм: латинская буква в начале и 3–32 символа.');
  }
  if (input.displayName.trim().length < 2 || input.displayName.trim().length > 80) {
    throw new Error('Имя должно содержать от 2 до 80 символов.');
  }

  const { data, error } = await requireSupabase()
    .from('profiles')
    .update({
      display_name: input.displayName.trim(),
      username,
      bio: input.bio.trim().slice(0, 280),
      avatar_url: input.avatarUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('id, username, display_name, bio, avatar_url')
    .single();
  fail(error);
  return toProfile(data as ProfileRow);
}

export async function searchUsers(term: string, currentUserId: string): Promise<Profile[]> {
  const query = term.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (query.length < 2) return [];
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .ilike('username', `${query}%`)
    .neq('id', currentUserId)
    .order('username')
    .limit(12);
  fail(error);
  return (data ?? []).map((row) => toProfile(row as ProfileRow));
}

export async function getWallet(userId: string): Promise<Wallet> {
  const client = requireSupabase();
  const [walletResult, transactionsResult] = await Promise.all([
    client.from('star_wallets').select('balance').eq('user_id', userId).single(),
    client.from('star_transactions')
      .select('id, amount, reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  fail(walletResult.error);
  fail(transactionsResult.error);
  if (!walletResult.data) throw new Error('Кошелёк не найден.');
  return {
    balance: walletResult.data.balance,
    transactions: (transactionsResult.data ?? []).map((row) => ({
      id: row.id,
      amount: row.amount,
      reason: row.reason,
      createdAt: row.created_at,
    })),
  };
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const client = requireSupabase();
  const { data: ownMemberships, error: ownError } = await client
    .from('dm_members')
    .select('conversation_id')
    .eq('user_id', userId);
  fail(ownError);
  const conversationIds = [...new Set((ownMemberships ?? []).map((row) => row.conversation_id))];
  if (!conversationIds.length) return [];

  const [membersResult, messagesResult] = await Promise.all([
    client.from('dm_members')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds),
    client.from('dm_messages')
      .select('id, conversation_id, author_id, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  fail(membersResult.error);
  fail(messagesResult.error);

  const memberRows = membersResult.data ?? [];
  const personIds = [...new Set(memberRows.filter((row) => row.user_id !== userId).map((row) => row.user_id))];
  if (!personIds.length) return [];
  const { data: profileRows, error: profilesError } = await client
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url')
    .in('id', personIds);
  fail(profilesError);

  const profiles = new Map((profileRows ?? []).map((row) => [row.id, toProfile(row as ProfileRow)]));
  const personByConversation = new Map<string, Profile>();
  for (const member of memberRows) {
    if (member.user_id === userId) continue;
    const profile = profiles.get(member.user_id);
    if (profile) personByConversation.set(member.conversation_id, profile);
  }

  const latestByConversation = new Map<string, DirectMessage>();
  for (const row of messagesResult.data ?? []) {
    if (latestByConversation.has(row.conversation_id)) continue;
    const author = row.author_id === userId ? null : profiles.get(row.author_id);
    latestByConversation.set(row.conversation_id, {
      id: row.id,
      conversationId: row.conversation_id,
      authorId: row.author_id,
      authorName: author?.displayName ?? (row.author_id === userId ? 'Вы' : 'Пользователь'),
      authorUsername: author?.username ?? '',
      content: row.content,
      createdAt: row.created_at,
    });
  }

  return conversationIds
    .map((id) => ({ id, person: personByConversation.get(id), lastMessage: latestByConversation.get(id) ?? null }))
    .filter((item): item is Conversation => Boolean(item.person))
    .sort((a, b) => new Date(b.lastMessage?.createdAt ?? 0).getTime() - new Date(a.lastMessage?.createdAt ?? 0).getTime());
}

export async function getMessages(conversationId: string): Promise<DirectMessage[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('dm_messages')
    .select('id, conversation_id, author_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  fail(error);
  const rows = data ?? [];
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const { data: profiles, error: profilesError } = authorIds.length
    ? await client.from('profiles').select('id, username, display_name, bio, avatar_url').in('id', authorIds)
    : { data: [], error: null };
  fail(profilesError);
  const profileById = new Map((profiles ?? []).map((row) => [row.id, toProfile(row as ProfileRow)]));

  return rows.map((row) => {
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
  });
}

export async function startConversation(username: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('start_conversation', {
    p_username: username.trim().replace(/^@/, '').toLowerCase(),
  });
  fail(error);
  return data as string;
}

export async function sendMessage(input: {
  conversationId: string;
  authorId: string;
  content: string;
}): Promise<DirectMessage> {
  const content = input.content.trim();
  if (!content || content.length > 4000) throw new Error('Сообщение должно содержать от 1 до 4000 символов.');
  const { data, error } = await requireSupabase()
    .from('dm_messages')
    .insert({
      conversation_id: input.conversationId,
      author_id: input.authorId,
      content,
    })
    .select('id, conversation_id, author_id, content, created_at')
    .single();
  fail(error);
  if (!data) throw new Error('Сообщение не сохранено.');
  const profile = await getProfile(input.authorId);
  return {
    id: data.id,
    conversationId: data.conversation_id,
    authorId: data.author_id,
    authorName: profile.displayName,
    authorUsername: profile.username,
    content: data.content,
    createdAt: data.created_at,
  };
}

export async function getChannels(userId: string): Promise<Channel[]> {
  const client = requireSupabase();
  const [channelsResult, membershipsResult] = await Promise.all([
    client.from('channels')
      .select('id, owner_id, title, username, description, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    client.from('channel_members')
      .select('channel_id, role')
      .eq('user_id', userId),
  ]);
  fail(channelsResult.error);
  fail(membershipsResult.error);
  const roles = new Map((membershipsResult.data ?? []).map((row) => [row.channel_id, row.role]));
  return (channelsResult.data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    username: row.username,
    description: row.description ?? '',
    createdAt: row.created_at,
    isMember: roles.has(row.id),
    role: roles.get(row.id) ?? null,
  }));
}

export async function createChannel(input: {
  title: string;
  username: string;
  description: string;
}): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_channel', {
    p_title: input.title.trim(),
    p_username: input.username.trim().replace(/^@/, '').toLowerCase(),
    p_description: input.description.trim(),
  });
  fail(error);
  return data as string;
}

export async function joinChannel(channelId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('join_channel', { p_channel_id: channelId });
  fail(error);
}

export async function getChannelPosts(channelId: string, userId: string): Promise<ChannelPost[]> {
  const client = requireSupabase();
  const { data: rows, error } = await client.from('channel_posts')
    .select('id, channel_id, author_id, body, created_at')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(300);
  fail(error);
  if (!rows?.length) return [];

  const postIds = rows.map((row) => row.id);
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const [profilesResult, reactionsResult] = await Promise.all([
    client.from('profiles').select('id, username, display_name, bio, avatar_url').in('id', authorIds),
    client.from('star_reactions').select('post_id, user_id, stars').in('post_id', postIds),
  ]);
  fail(profilesResult.error);
  fail(reactionsResult.error);
  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.id, toProfile(row as ProfileRow)]));
  const totals = new Map<string, { total: number; mine: number }>();
  for (const reaction of reactionsResult.data ?? []) {
    const value = totals.get(reaction.post_id) ?? { total: 0, mine: 0 };
    value.total += reaction.stars;
    if (reaction.user_id === userId) value.mine = reaction.stars;
    totals.set(reaction.post_id, value);
  }

  return rows.map((row) => {
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
  });
}

export async function createPost(input: {
  channelId: string;
  authorId: string;
  body: string;
}): Promise<void> {
  const body = input.body.trim();
  if (!body || body.length > 4000) throw new Error('Публикация должна содержать от 1 до 4000 символов.');
  const { error } = await requireSupabase().from('channel_posts').insert({
    channel_id: input.channelId,
    author_id: input.authorId,
    body,
  });
  fail(error);
}

export async function sendStarReaction(input: {
  postId: string;
  stars: number;
}): Promise<number> {
  const { data, error } = await requireSupabase().rpc('send_star_reaction', {
    p_post_id: input.postId,
    p_stars: input.stars,
  });
  fail(error);
  return data as number;
}
