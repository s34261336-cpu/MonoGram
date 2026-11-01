import { apiRequest } from '@/lib/api';

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

const json = (body: unknown) => JSON.stringify(body);

export function getProfile(_userId: string): Promise<Profile> {
  return apiRequest('/api/messenger/profile');
}

export function saveProfile(input: {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl?: string | null;
}): Promise<Profile> {
  return apiRequest('/api/messenger/profile', {
    method: 'PATCH',
    body: json(input),
  });
}

export function searchUsers(term: string, _currentUserId: string): Promise<Profile[]> {
  return apiRequest(`/api/messenger/search?term=${encodeURIComponent(term)}`);
}

export function getWallet(_userId: string): Promise<Wallet> {
  return apiRequest('/api/messenger/wallet');
}

export function getConversations(_userId: string): Promise<Conversation[]> {
  return apiRequest('/api/messenger/chats');
}

export function getMessages(conversationId: string): Promise<DirectMessage[]> {
  return apiRequest(`/api/messenger/messages?conversationId=${encodeURIComponent(conversationId)}`);
}

export function startConversation(username: string): Promise<string> {
  return apiRequest('/api/messenger/conversations', {
    method: 'POST',
    body: json({ username }),
  });
}

export function sendMessage(input: {
  conversationId: string;
  authorId: string;
  content: string;
}): Promise<DirectMessage> {
  return apiRequest('/api/messenger/messages', {
    method: 'POST',
    body: json({ conversationId: input.conversationId, content: input.content }),
  });
}

export function getChannels(_userId: string): Promise<Channel[]> {
  return apiRequest('/api/messenger/channels');
}

export function createChannel(input: {
  title: string;
  username: string;
  description: string;
}): Promise<string> {
  return apiRequest('/api/messenger/channels', {
    method: 'POST',
    body: json(input),
  });
}

export async function joinChannel(channelId: string): Promise<void> {
  await apiRequest(`/api/messenger/channels/${encodeURIComponent(channelId)}/join`, {
    method: 'POST',
    body: json({}),
  });
}

export function getChannelPosts(channelId: string, _userId: string): Promise<ChannelPost[]> {
  return apiRequest(`/api/messenger/channels/${encodeURIComponent(channelId)}/posts`);
}

export async function createPost(input: {
  channelId: string;
  authorId: string;
  body: string;
}): Promise<void> {
  await apiRequest(`/api/messenger/channels/${encodeURIComponent(input.channelId)}/posts`, {
    method: 'POST',
    body: json({ body: input.body }),
  });
}

export function sendStarReaction(input: {
  postId: string;
  stars: number;
}): Promise<number> {
  return apiRequest('/api/messenger/stars', {
    method: 'POST',
    body: json(input),
  });
}
