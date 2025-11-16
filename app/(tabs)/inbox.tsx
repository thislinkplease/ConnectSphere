import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chat } from '@/src/types';
import { getRelativeTime } from '@/src/utils/date';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import ApiService from '@/src/services/api';
import WebSocketService from '@/src/services/websocket';
import { useFocusEffect } from '@react-navigation/native';

export default function InboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'events' | 'users'>('all');
  const [loading, setLoading] = useState(true);

  const loadChats = useCallback(async () => {
    if (!user?.username) return;
    try {
      setLoading(true);
      const data = await ApiService.getConversations(user.username);
      setChats(data);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Note: Removed useFocusEffect reload since WebSocket provides real-time updates
  // No need to reload when returning to the tab - conversations update automatically

  // WebSocket real-time updates for new messages
  useEffect(() => {
    if (!user?.username) return;

    // Handle new messages to update conversation list
    const handleNewMessage = (message: any) => {
      const conversationId = String(message.chatId || message.conversation_id || message.conversationId);
      const senderId = message.senderId || message.sender_username || message.sender?.username;
      
      setChats(prevChats => {
        // Find existing conversation
        const existingIndex = prevChats.findIndex(c => String(c.id) === conversationId);
        
        if (existingIndex >= 0) {
          // Update existing conversation
          const updatedChats = [...prevChats];
          const existingChat = updatedChats[existingIndex];
          
          // Build complete sender info, prioritizing message.sender data
          let senderInfo = message.sender;
          
          // If sender info is incomplete, try to find from existing participants
          if (!senderInfo || !senderInfo.name) {
            const existingParticipant = existingChat.participants?.find(p => p.username === senderId);
            if (existingParticipant) {
              senderInfo = existingParticipant;
            }
          }
          
          // Ensure we have complete sender info with all required fields
          if (!senderInfo || !senderInfo.username) {
            senderInfo = {
              id: senderId,
              username: senderId,
              name: senderId,
              email: `${senderId}@example.com`,
              avatar: '',
              country: '',
              city: '',
              status: 'Chilling',
              languages: [],
              interests: [],
            };
          } else {
            // Merge to ensure all fields exist
            senderInfo = {
              id: senderInfo.id || senderId,
              username: senderInfo.username || senderId,
              name: senderInfo.name || senderInfo.username || senderId,
              email: senderInfo.email || `${senderId}@example.com`,
              avatar: senderInfo.avatar || '',
              country: senderInfo.country || '',
              city: senderInfo.city || '',
              status: senderInfo.status || 'Chilling',
              languages: senderInfo.languages || [],
              interests: senderInfo.interests || [],
              bio: senderInfo.bio,
              gender: senderInfo.gender,
              age: senderInfo.age,
              flag: senderInfo.flag,
              followersCount: senderInfo.followersCount,
              followingCount: senderInfo.followingCount,
              postsCount: senderInfo.postsCount,
              isOnline: senderInfo.isOnline,
            };
          }
          
          // Update participants if sender is not in the list (for DM conversations)
          let updatedParticipants = existingChat.participants || [];
          if (existingChat.type === 'user' || existingChat.type === 'dm') {
            // Ensure both current user and sender are in participants
            const hasCurrentUser = updatedParticipants.some(p => p.username === user.username);
            const hasSender = updatedParticipants.some(p => p.username === senderId);
            
            if (!hasCurrentUser) {
              updatedParticipants.push({
                id: user.id || user.username || '',
                username: user.username || '',
                name: user.name || user.username || '',
                email: user.email || `${user.username}@example.com`,
                avatar: user.avatar || '',
                country: user.country || '',
                city: user.city || '',
                status: user.status || 'Chilling',
                languages: user.languages || [],
                interests: user.interests || [],
              });
            }
            
            if (!hasSender && senderId !== user.username) {
              updatedParticipants.push(senderInfo);
            } else if (hasSender && senderId !== user.username) {
              // Update existing participant with fresh data
              updatedParticipants = updatedParticipants.map(p => 
                p.username === senderId ? senderInfo : p
              );
            }
          }
          
          // Move to top and update last message
          updatedChats.splice(existingIndex, 1);
          updatedChats.unshift({
            ...existingChat,
            participants: updatedParticipants,
            lastMessage: {
              id: String(message.id || Date.now()),
              chatId: conversationId,
              senderId: senderId,
              sender: senderInfo,
              content: message.content || '',
              timestamp: message.timestamp || message.created_at || new Date().toISOString(),
              read: false,
            },
            // Increment unread count if message is from someone else
            unreadCount: senderId !== user.username 
              ? (existingChat.unreadCount || 0) + 1 
              : existingChat.unreadCount,
          });
          
          return updatedChats;
        } else {
          // New conversation - reload the full list to get complete data
          loadChats();
          return prevChats;
        }
      });
    };

    // Listen to new messages
    WebSocketService.onNewMessage(handleNewMessage);

    return () => {
      // Clean up listener
      WebSocketService.off('new_message', handleNewMessage);
    };
  }, [user?.username, user, loadChats]);

  const handleOpenChat = useCallback(async (chat: Chat) => {
    try {
      if (user?.username) {
        await ApiService.markAllMessagesAsRead(chat.id, user.username);
      }
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } as Chat : c));
    } catch (e) {
      console.warn('mark read failed:', e);
    } finally {
      router.push(`/inbox/chat?id=${chat.id}`);
    }
  }, [router, user?.username]);

  const filteredChats = chats.filter(chat => {
    if (activeTab === 'all') return true;
    if (activeTab === 'events') return chat.type === 'event';
    if (activeTab === 'users') return chat.type === 'user';
    return true;
  });

  const renderChatItem = ({ item }: { item: Chat }) => {
    const isDM = item.type === 'dm' || item.type === 'user';

    // Find the other user in participants (not the current user)
    let otherUser = isDM
      ? item.participants?.find(p => p.username && p.username !== user?.username)
      : undefined;

    // If otherUser not found in participants, try to get from lastMessage sender
    if (isDM && !otherUser && item.lastMessage?.sender) {
      const sender = item.lastMessage.sender;
      if (sender.username !== user?.username) {
        otherUser = sender;
      }
    }

    // Build robust display name - prioritize actual name over username
    const displayName = isDM
      ? (otherUser?.name || otherUser?.username || 'Unknown User')
      : (item.name || 'Group Chat');

    // Get avatar - ensure we use the other user's avatar for DM
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
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