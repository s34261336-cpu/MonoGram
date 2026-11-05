import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createChannel,
  createPost,
  getChannelPosts,
  getChannels,
  getConversations,
  getMessages,
  getProfile,
  getWallet,
  joinChannel,
  saveProfile,
  saveProfileBio,
  searchUsers,
  sendMessage,
  sendStarReaction,
  startConversation,
  type ChannelPost,
  type Profile,
} from '@/lib/messenger';

export const messengerKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  wallet: (userId: string) => ['wallet', userId] as const,
  chats: (userId: string) => ['chats', userId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  channels: (userId: string) => ['channels', userId] as const,
  posts: (channelId: string) => ['channel-posts', channelId] as const,
  userSearch: (userId: string, term: string) => ['user-search', userId, term] as const,
};

export function useProfile(userId: string) {
  return useQuery({
    queryKey: messengerKeys.profile(userId),
    queryFn: () => getProfile(userId),
    enabled: Boolean(userId),
  });
}

export function useWallet(userId: string) {
  return useQuery({
    queryKey: messengerKeys.wallet(userId),
    queryFn: () => getWallet(userId),
    enabled: Boolean(userId),
  });
}

export function useChats(userId: string) {
  return useQuery({
    queryKey: messengerKeys.chats(userId),
    queryFn: () => getConversations(userId),
    enabled: Boolean(userId),
    refetchInterval: 8_000,
  });
}

export function useMessages(conversationId: string, userId: string) {
  return useQuery({
    queryKey: messengerKeys.messages(conversationId),
    queryFn: () => getMessages(conversationId),
    enabled: Boolean(conversationId && userId),
    refetchInterval: 4_000,
  });
}

export function useChannels(userId: string) {
  return useQuery({
    queryKey: messengerKeys.channels(userId),
    queryFn: () => getChannels(userId),
    enabled: Boolean(userId),
  });
}

export function usePosts(channelId: string, userId: string) {
  return useQuery({
    queryKey: messengerKeys.posts(channelId),
    queryFn: () => getChannelPosts(channelId, userId),
    enabled: Boolean(channelId && userId),
    refetchInterval: 10_000,
  });
}

export function useUserSearch(term: string, userId: string) {
  return useQuery({
    queryKey: messengerKeys.userSearch(userId, term.trim()),
    queryFn: () => searchUsers(term, userId),
    enabled: Boolean(userId && term.trim().length >= 2),
    staleTime: 15_000,
  });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(messengerKeys.profile(profile.id), profile);
      void queryClient.invalidateQueries({ queryKey: messengerKeys.chats(profile.id) });
    },
  });
}

export function useSaveProfileBio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveProfileBio,
    onSuccess: (profile) => {
      queryClient.setQueryData(messengerKeys.profile(profile.id), profile);
      void queryClient.invalidateQueries({ queryKey: messengerKeys.chats(profile.id) });
    },
  });
}

export function useStartConversation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messengerKeys.chats(userId) }),
  });
}

export function useSendMessage(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (message) => {
      queryClient.setQueryData(messengerKeys.messages(message.conversationId), (old: unknown) => {
        const messages = (old as typeof message[] | undefined) ?? [];
        return messages.some((item) => item.id === message.id) ? messages : [...messages, message];
      });
      void queryClient.invalidateQueries({ queryKey: messengerKeys.chats(userId) });
    },
  });
}

export function useCreateChannel(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createChannel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messengerKeys.channels(userId) }),
  });
}

export function useJoinChannel(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: joinChannel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messengerKeys.channels(userId) }),
  });
}

export function useCreatePost(userId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messengerKeys.posts(channelId) });
      void queryClient.invalidateQueries({ queryKey: messengerKeys.channels(userId) });
    },
  });
}

export function useSendStars(userId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendStarReaction,
    onSuccess: (balance, variables) => {
      queryClient.setQueryData(messengerKeys.wallet(userId), (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        return { ...(old as Record<string, unknown>), balance };
      });
      queryClient.setQueryData<ChannelPost[]>(messengerKeys.posts(channelId), (old) => old?.map((post) => (
        post.id === variables.postId
          ? { ...post, myStars: post.myStars + variables.stars, starsTotal: post.starsTotal + variables.stars }
          : post
      )));
      void queryClient.invalidateQueries({ queryKey: messengerKeys.wallet(userId) });
    },
  });
}
