import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chat } from '@/src/types';
import { getRelativeTime } from '@/src/utils/date';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import ApiService from '@/src/services/api';
import { useFocusEffect } from '@react-navigation/native';

export default function InboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'events' | 'users'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const enrichedConversationsRef = useRef<Set<string>>(new Set());

  const loadChats = useCallback(async () => {
    if (!user?.username) return;
    try {
      setLoading(true);
      const data = await ApiService.getConversations(user.username);
      setChats(data);
      // Reset enrichment tracking when reloading chats
      enrichedConversationsRef.current = new Set();
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Reload khi quay lại tab Inbox
  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats])
  );

  // Enrich: nếu DM thiếu otherUser hoặc thiếu avatar/name thì fetch full profile
  useEffect(() => {
    let cancelled = false;
    const enrichMissing = async () => {
      if (!user?.username) return;
      
      // Find conversations that need enrichment and haven't been enriched yet
      const targets = chats.filter(c => {
        // Skip if already enriched
        if (enrichedConversationsRef.current.has(c.id)) return false;
        
        if (c.type !== 'user' && c.type !== 'dm') return false;
        
        // Check if we have participants
        if (!c.participants || c.participants.length < 2) return true;
        
        // Find the other user in participants
        const otherUser = c.participants.find(p => p.username && p.username !== user.username);
        
        // Need enrichment if no other user found OR other user lacks name/avatar
        return !otherUser || !otherUser.name || !otherUser.avatar;
      });

      if (targets.length === 0) return;

      for (const conv of targets) {
        try {
          // Mark this conversation as being enriched to avoid duplicate requests
          enrichedConversationsRef.current.add(conv.id);
          
          // First try to get conversation details
          const detail = await ApiService.getConversation(conv.id);
          if (cancelled) return;

          // Find the other user from detailed participants
          const detailedOtherUser = detail.participants?.find(p => p.username && p.username !== user.username);
          
          // If we still don't have complete data, fetch user profile directly
          let completeOtherUser = detailedOtherUser;
          if (detailedOtherUser?.username && (!detailedOtherUser.name || !detailedOtherUser.avatar)) {
            try {
              completeOtherUser = await ApiService.getUserByUsername(detailedOtherUser.username);
            } catch {
              console.warn('Failed to fetch user profile for', detailedOtherUser.username);
            }
          }

          if (cancelled) return;

          // Update the conversation with enriched data
          setChats(prev =>
            prev.map(c => {
              if (c.id !== conv.id) return c;
              
              // Build enriched participants list
              const enrichedParticipants = [...(detail.participants || [])];
              
              // Replace the other user with complete data if we have it
              if (completeOtherUser) {
                const idx = enrichedParticipants.findIndex(p => p.username === completeOtherUser?.username);
                if (idx >= 0) {
                  enrichedParticipants[idx] = completeOtherUser;
                } else {
                  enrichedParticipants.push(completeOtherUser);
                }
              }

              return {
                ...c,
                participants: enrichedParticipants.length > 0 ? enrichedParticipants : c.participants,
              };
            })
          );
        } catch (e) {
          console.warn('Failed to enrich conversation', conv.id, e);
          // Keep it marked as enriched to avoid infinite retries
        }
      }
    };
    
    InteractionManager.runAfterInteractions(enrichMissing);
    return () => { cancelled = true; };
  }, [chats, user?.username]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  }, [loadChats]);

  const filteredChats = chats.filter(chat => {
    if (activeTab === 'all') return true;
    if (activeTab === 'events') return chat.type === 'event';
    if (activeTab === 'users') return chat.type === 'user';
    return true;
  });

  const handleOpenChat = useCallback(async (chat: Chat) => {
    try {
      if (user?.username) {
        await ApiService.markAllMessagesAsRead(chat.id, user.username);
      }
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } as Chat : c));
    } catch (e) {
      console.warn('mark read failed:', e);
    } finally {
      router.push(`/chat?id=${chat.id}`);
    }
  }, [router, user?.username]);

  const renderChatItem = ({ item }: { item: Chat }) => {
    const isDM = item.type === 'dm' || item.type === 'user';

    // 1) ưu tiên participants khác mình
    let otherUser = isDM
      ? item.participants?.find(p => p.username && p.username !== user?.username)
      : undefined;

    // 2) fallback dùng sender nếu KHÁC mình
    const sender = item.lastMessage?.sender;
    if (!otherUser && sender?.username && sender.username !== user?.username) {
      otherUser = sender;
    }

    // 3) fallback cuối: lấy bất kỳ participant nào khác mình
    if (!otherUser && item.participants && item.participants.length) {
      const first = item.participants.find(p => p.username !== user?.username);
      if (first) otherUser = first;
    }

    const displayName = isDM
      ? (otherUser?.name || otherUser?.username || 'Direct Message')
      : (item.name || 'Group');

    const avatarUrl = isDM ? (otherUser?.avatar || '') : '';

    const relativeTime = item.lastMessage?.timestamp
      ? getRelativeTime(item.lastMessage.timestamp)
      : '';

    const isUnread = (item.unreadCount ?? 0) > 0;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleOpenChat(item)}
      >
        <View style={styles.avatarContainer}>
          {isDM ? (
            avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.chatAvatar} />
            ) : (
              <View style={styles.eventAvatarPlaceholder}>
                <Ionicons name="person-circle-outline" size={32} color="#999" />
              </View>
            )
          ) : (
            <View style={styles.eventAvatarPlaceholder}>
              <Ionicons name="people-outline" size={24} color={colors.primary} />
            </View>
          )}
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary, borderColor: colors.card }]} />}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, isUnread && styles.unreadText]}>
              {displayName}
            </Text>
            {!!relativeTime && (
              <Text style={styles.chatTime}>{relativeTime}</Text>
            )}
          </View>
          <View style={styles.messageRow}>
            {item.lastMessage?.content && (
              <Text
                style={[styles.lastMessage, isUnread && styles.unreadText]}
                numberOfLines={1}
              >
                {item.lastMessage.content}
              </Text>
            )}
            {isUnread && item.unreadCount && item.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={styles.headerTitle}>Inbox</Text>
      </View>

      <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && [styles.activeTabText, { color: colors.primary }]]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && [styles.activeTabText, { color: colors.primary }]]}>
            Events
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && [styles.activeTabText, { color: colors.primary }]]}>
            Users
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Start a conversation with someone
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { },
  tabText: { fontSize: 15, color: '#666', fontWeight: '500' },
  activeTabText: { fontWeight: '600' },
  chatItem: { backgroundColor: '#fff', flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatarContainer: { position: 'relative', marginRight: 12 },
  chatAvatar: { width: 56, height: 56, borderRadius: 28 },
  eventAvatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chatName: { fontSize: 16, fontWeight: '500', color: '#333', flex: 1 },
  unreadText: { fontWeight: '700' },
  chatTime: { fontSize: 12, color: '#999' },
  messageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMessage: { fontSize: 14, color: '#666', flex: 1 },
  unreadBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8, minWidth: 20, alignItems: 'center' },
  unreadBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#999', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#aaa', marginTop: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});