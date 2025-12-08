import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chat } from '@/src/types';
import { getRelativeTime } from '@/src/utils/date';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import ApiService from '@/src/services/api';
import WebSocketService from '@/src/services/websocket';

// Delay before refreshing conversation list after WebSocket event (ms)
const CONVERSATION_REFRESH_DELAY = 500;

// Time to keep processed messages in memory (5 minutes)
const MESSAGE_CACHE_DURATION = 5 * 60 * 1000;

export default function InboxScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'communities' | 'users'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Track processed messages to prevent duplicate counting
  const processedMessagesRef = useRef<Map<string, number>>(new Map());

  // Cleanup old processed messages periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const messagesToRemove: string[] = [];
      
      processedMessagesRef.current.forEach((timestamp, messageId) => {
        if (now - timestamp > MESSAGE_CACHE_DURATION) {
          messagesToRemove.push(messageId);
        }
      });
      
      messagesToRemove.forEach(messageId => {
        processedMessagesRef.current.delete(messageId);
      });
      
      if (messagesToRemove.length > 0) {
        console.log(`🧹 Cleaned up ${messagesToRemove.length} old processed messages`);
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // 1) Đảm bảo WebSocket kết nối khi ở Inbox và setup token properly
  useEffect(() => {
    if (!user?.username) return;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    if (!WebSocketService.isConnected()) {
      // Use token from AuthContext if available, otherwise fallback to username
      const authToken = token || user.username;
      WebSocketService.connect(apiUrl, authToken);
    }
  }, [user?.username, token]);

  // 2) Load chats và JOIN tất cả room để nhận realtime
  const loadChats = useCallback(async () => {
    if (!user?.username) return;
    try {
      setLoading(true);
      const data = await ApiService.getConversations(user.username);
      setChats(data);

      // Join tất cả conversation rooms (quan trọng để Inbox realtime)
      data.forEach(c => {
        if (c?.id) {
          WebSocketService.joinConversation(String(c.id));
        }
        // Also join community chat rooms for community conversations
        if (c?.type === 'community' && c?.communityId) {
          WebSocketService.joinCommunityChat(c.communityId);
        }
      });
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    if (!user?.username) return;
    try {
      setRefreshing(true);
      const data = await ApiService.getConversations(user.username);
      setChats(data);

      // Re-join all conversation rooms
      data.forEach(c => {
        if (c?.id) {
          WebSocketService.joinConversation(String(c.id));
        }
        if (c?.type === 'community' && c?.communityId) {
          WebSocketService.joinCommunityChat(c.communityId);
        }
      });
    } catch (error) {
      console.error('Error refreshing chats:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Note: Removed useFocusEffect reload since WebSocket provides real-time updates
  // No need to reload when returning to the tab - conversations update automatically

  // WebSocket real-time updates for new messages (both DM and Community)
  useEffect(() => {
    if (!user?.username) return;

    // IMPROVED: Handle when a new community conversation is ready
    const handleCommunityConversationReady = (data: { communityId: number; conversationId: string }) => {
      console.log(`✅ Community conversation ready for community ${data.communityId}, conversation ${data.conversationId}`);
      
      // Join the community chat WebSocket room immediately
      WebSocketService.joinCommunityChat(data.communityId);
      WebSocketService.joinConversation(String(data.conversationId));
      
      // Reload conversations to get the new one in the list
      setTimeout(() => {
        loadChats();
      }, CONVERSATION_REFRESH_DELAY);
    };

    // Handle new messages to update conversation list
    const handleNewMessage = (message: any) => {
      const conversationId = String(message.chatId || message.conversation_id || message.conversationId);
      const senderId = message.senderId || message.sender_username || message.sender?.username;
      const messageId = message.id || message.message_id;
      
      // CRITICAL: Check for duplicate messages to prevent double counting
      if (messageId) {
        const messageKey = `${conversationId}-${messageId}`;
        if (processedMessagesRef.current.has(messageKey)) {
          console.log('⚠️ Duplicate message detected, skipping:', messageKey);
          return;
        }
        // Mark as processed
        processedMessagesRef.current.set(messageKey, Date.now());
      }
      
      // CRITICAL: Always use server timestamp
      const messageTimestamp = message.timestamp || message.created_at;
      
      // Exit early if no valid timestamp - prevents corrupting the list order
      if (!messageTimestamp) {
        console.warn('⚠️ Received message without timestamp, skipping update:', message);
        return;
      }
      
      setChats(prevChats => {
        // Find existing conversation
        const existingIndex = prevChats.findIndex(c => String(c.id) === conversationId);
        
        if (existingIndex >= 0) {
          // Update existing conversation
          const updatedChats = [...prevChats];
          const existingChat = updatedChats[existingIndex];
          
          // Build complete sender info from message
          let senderInfo = message.sender;
          
          // If sender info is incomplete, try to find from existing participants
          if (!senderInfo || !senderInfo.name || !senderInfo.username) {
            const existingParticipant = existingChat.participants?.find(p => p.username === senderId);
            if (existingParticipant) {
              senderInfo = existingParticipant;
            }
          }
          
          // Ensure we have complete sender info with all required fields
          if (!senderInfo || !senderInfo.username) {
            senderInfo = {
              id: senderId || 'unknown',
              username: senderId || 'unknown',
              name: senderId || 'Unknown User',
              email: `${senderId || 'unknown'}@example.com`,
              avatar: '',
              country: '',
              city: '',
              status: 'Chilling',
              languages: [],
              interests: [],
            };
          } else {
            // Merge to ensure all fields exist with proper fallbacks
            senderInfo = {
              id: senderInfo.id || senderInfo.username || senderId || 'unknown',
              username: senderInfo.username || senderId || 'unknown',
              name: senderInfo.name || senderInfo.username || senderId || 'Unknown User',
              email: senderInfo.email || `${senderInfo.username || senderId}@example.com`,
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
              followersCount: senderInfo.followersCount || senderInfo.followers || 0,
              followingCount: senderInfo.followingCount || senderInfo.following || 0,
              postsCount: senderInfo.postsCount || senderInfo.posts || 0,
              isOnline: senderInfo.isOnline || senderInfo.is_online,
            };
          }
          
          // Update participants list for DM conversations to ensure both users are present
          let updatedParticipants = existingChat.participants || [];
          if (existingChat.type === 'user' || existingChat.type === 'dm') {
            // Ensure both current user and sender are in participants
            const hasCurrentUser = updatedParticipants.some(p => p.username === user.username);
            const hasSender = updatedParticipants.some(p => p.username === senderId);
            
            if (!hasCurrentUser && user.username) {
              updatedParticipants = [...updatedParticipants, {
                id: user.id || user.username,
                username: user.username,
                name: user.name || user.username,
                email: user.email || `${user.username}@example.com`,
                avatar: user.avatar || '',
                country: user.country || '',
                city: user.city || '',
                status: user.status || 'Chilling',
                languages: user.languages || [],
                interests: user.interests || [],
              }];
            }
            
            if (!hasSender && senderId && senderId !== user.username) {
              updatedParticipants = [...updatedParticipants, senderInfo];
            } else if (hasSender && senderId !== user.username) {
              // Update existing participant with fresh data
              updatedParticipants = updatedParticipants.map(p => 
                p.username === senderId ? senderInfo : p
              );
            }
          }
          
          // Create updated chat object with guaranteed message ID
          const messageId = message.id ? String(message.id) : `temp_${Date.now()}_${Math.random()}`;
          
          const updatedChat = {
            ...existingChat,
            participants: updatedParticipants,
            lastMessage: {
              id: messageId,
              chatId: conversationId,
              senderId: senderId || 'unknown',
              sender: senderInfo,
              content: message.content || '',
              timestamp: messageTimestamp,
              read: false,
            },
            // Increment unread count if message is from someone else
            unreadCount: senderId !== user.username 
              ? (existingChat.unreadCount || 0) + 1 
              : existingChat.unreadCount || 0,
          };
          
          // Remove from current position and add to top
          updatedChats.splice(existingIndex, 1);
          updatedChats.unshift(updatedChat);
          
          return updatedChats;
        } else {
          // New conversation first message
          // Build minimal sender info
          const minimalSender = message.sender || {
            id: senderId || 'unknown',
            username: senderId || 'unknown',
            name: senderId || 'Unknown User',
            email: `${senderId || 'unknown'}@example.com`,
            avatar: '',
            country: '',
            city: '',
            status: 'Chilling',
            languages: [],
            interests: [],
          };

          const messageId = message.id ? String(message.id) : `temp_${Date.now()}_${Math.random()}`;

          const minimalChat: Chat = {
            id: conversationId,
            type: 'dm',
            name: minimalSender.name || minimalSender.username,
            participants: [minimalSender],
            lastMessage: {
              id: messageId,
              chatId: conversationId,
              senderId: senderId || 'unknown',
              sender: minimalSender,
              content: message.content || '',
              timestamp: messageTimestamp,
              read: false,
            },
            unreadCount: senderId !== user.username ? 1 : 0,
          };

          // Join room immediately
          WebSocketService.joinConversation(conversationId);

          // Add to top of list
          const newList = [minimalChat, ...prevChats];

          // Enrich conversation data in background (debounced to avoid multiple calls)
          setTimeout(() => {
            loadChats();
          }, CONVERSATION_REFRESH_DELAY * 2); // Use 2x delay for debouncing

          return newList;
        }
      });
    };

    // Handle new community messages to update conversation list
    const handleNewCommunityMessage = (message: any) => {
      const communityId = message.communityId || message.community_id;
      if (!communityId) return;

      const senderId = message.sender_username || message.senderId || message.sender?.username;
      const messageId = message.id || message.message_id;
      
      // CRITICAL: Check for duplicate messages to prevent double counting
      if (messageId) {
        const messageKey = `community-${communityId}-${messageId}`;
        if (processedMessagesRef.current.has(messageKey)) {
          console.log('⚠️ Duplicate community message detected, skipping:', messageKey);
          return;
        }
        // Mark as processed
        processedMessagesRef.current.set(messageKey, Date.now());
      }
      
      // CRITICAL: Always use server timestamp
      const messageTimestamp = message.timestamp || message.created_at;
      
      // Exit early if no valid timestamp - prevents corrupting the list order
      if (!messageTimestamp) {
        console.warn('⚠️ Received community message without timestamp, skipping update:', message);
        return;
      }
      
      setChats(prevChats => {
        // Find the community conversation
        const existingIndex = prevChats.findIndex(
          c => c.type === 'community' && c.communityId === Number(communityId)
        );
        
        if (existingIndex >= 0) {
          // Update existing community conversation
          const updatedChats = [...prevChats];
          const existingChat = updatedChats[existingIndex];
          
          // Build sender info from message
          const senderInfo = message.sender || {
            id: senderId || 'unknown',
            username: senderId || 'unknown',
            name: message.sender?.name || senderId || 'Unknown User',
            email: `${senderId || 'unknown'}@example.com`,
            avatar: message.sender?.avatar || '',
            country: '',
            city: '',
            status: 'Chilling',
            languages: [],
            interests: [],
          };
          
          const messageId = message.id ? String(message.id) : `temp_${Date.now()}_${Math.random()}`;
          
          const updatedChat = {
            ...existingChat,
            lastMessage: {
              id: messageId,
              chatId: String(existingChat.id),
              senderId: senderId || 'unknown',
              sender: senderInfo,
              content: message.content || '',
              timestamp: messageTimestamp,
              read: false,
            },
            // Increment unread count if message is from someone else
            unreadCount: senderId !== user.username 
              ? (existingChat.unreadCount || 0) + 1 
              : existingChat.unreadCount || 0,
          };
          
          // Remove from current position and add to top
          updatedChats.splice(existingIndex, 1);
          updatedChats.unshift(updatedChat);
          
          return updatedChats;
        } else {
          // New community conversation - reload to get proper data (debounced)
          setTimeout(() => {
            loadChats();
          }, CONVERSATION_REFRESH_DELAY * 2); // Use 2x delay for debouncing
          return prevChats;
        }
      });
    };

    // Listen to new messages (DM)
    WebSocketService.onNewMessage(handleNewMessage);
    
    // Listen to new community messages
    WebSocketService.onNewCommunityMessage(handleNewCommunityMessage);
    
    // Listen for community conversation ready events
    WebSocketService.on('community_conversation_ready', handleCommunityConversationReady);

    return () => {
      // Clean up listeners
      WebSocketService.off('new_message', handleNewMessage);
      WebSocketService.off('new_community_message', handleNewCommunityMessage);
      WebSocketService.off('community_conversation_ready', handleCommunityConversationReady);
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
      // Route to community chat if it's a community conversation
      if (chat.type === 'community' && chat.communityId) {
        router.push(`/overview/community-chat?id=${chat.communityId}&name=${encodeURIComponent(chat.name || 'Community Chat')}`);
      } else {
        router.push(`/inbox/chat?id=${chat.id}`);
      }
    }
  }, [router, user?.username]);

  const filteredChats = chats.filter(chat => {
    if (activeTab === 'all') return true;
    if (activeTab === 'communities') return chat.type === 'community';
    if (activeTab === 'users') return chat.type === 'user' || chat.type === 'dm';
    return true;
  });

  const renderChatItem = ({ item }: { item: Chat }) => {
    const isDM = item.type === 'dm' || item.type === 'user';
    const isCommunity = item.type === 'community';

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

    // CRITICAL: Build robust display name - NEVER show "Direct Message" or generic text
    let displayName: string;
    if (isCommunity) {
      displayName = item.name || 'Community Chat';
    } else if (isDM) {
      if (otherUser?.name && otherUser.name !== otherUser.username) {
        // User has a proper display name
        displayName = otherUser.name;
      } else if (otherUser?.username) {
        // Fall back to username
        displayName = otherUser.username;
      } else {
        // EXTREME FALLBACK: This should never happen, but if it does,
        // extract username from conversation ID or use a safe fallback
        console.warn('⚠️ Missing otherUser data for conversation:', item.id);
        displayName = 'User';
        // Trigger reload to get proper data in background
        setTimeout(() => {
          console.log('Reloading chats due to missing user data');
          loadChats();
        }, CONVERSATION_REFRESH_DELAY);
      }
    } else {
      displayName = item.name || 'Group Chat';
    }

    // Get avatar - ensure we ALWAYS use the other user's avatar for DM or community avatar for community
    const avatarUrl = isCommunity 
      ? (item.communityAvatar || '') 
      : isDM 
        ? (otherUser?.avatar || '') 
        : '';
    const hasAvatar = Boolean(avatarUrl && avatarUrl.length > 0);

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
          {isDM || isCommunity ? (
            hasAvatar ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={styles.chatAvatar}
              />
            ) : (
              <View style={styles.eventAvatarPlaceholder}>
                <Ionicons name={isCommunity ? "people" : "person-circle"} size={32} color={isCommunity ? colors.primary : "#999"} />
              </View>
            )
          ) : (
            <View style={styles.eventAvatarPlaceholder}>
              <Ionicons name="people" size={24} color={colors.primary} />
            </View>
          )}
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary, borderColor: colors.card }]} />}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, isUnread && styles.unreadText]} numberOfLines={1}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
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
          style={[styles.tab, activeTab === 'communities' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('communities')}
        >
          <Text style={[styles.tabText, activeTab === 'communities' && [styles.activeTabText, { color: colors.primary }]]}>
            Community
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
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

      <View style={{ height: 5 }} />
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
