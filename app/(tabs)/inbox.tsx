import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chat } from '@/src/types';
import { getRelativeTime } from '@/src/utils/date';
import { useAuth } from '@/src/context/AuthContext';
import ApiService from '@/src/services/api';

export default function InboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'events' | 'users'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = useCallback(async () => {
    if (!user?.username) return;
    
    try {
      setLoading(true);
      const data = await ApiService.getConversations(user.username);
      setChats(data);
    } catch (error) {
      console.error('Error loading chats:', error);
      // Don't show alert on every failed load, just log it
      // The user can refresh manually if needed
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

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

  const renderChatItem = ({ item }: { item: Chat }) => {
    const isDM = item.type === 'dm' || item.type === 'user';
    const otherUser = isDM
      ? item.participants?.find(p => p.username !== user?.username)
      : undefined;

    const fallbackUser = item.lastMessage?.sender;

    const displayName = isDM
      ? (otherUser?.name || fallbackUser?.name || otherUser?.username || fallbackUser?.username || 'Direct Message')
      : (item.name || 'Group');

    const avatarUrl = isDM
      ? (otherUser?.avatar || fallbackUser?.avatar)
      : undefined;

    const relativeTime = item.lastMessage?.timestamp
      ? getRelativeTime(item.lastMessage.timestamp)
      : '';

    const isUnread = (item.unreadCount ?? 0) > 0;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => router.push(`/chat?id=${item.id}`)}
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
              <Ionicons name="people-outline" size={24} color="#007AFF" />
            </View>
          )}
          {isUnread && <View style={styles.unreadDot} />}
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
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
            Events
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Users
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  chatItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  eventAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  unreadText: {
    fontWeight: '700',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
