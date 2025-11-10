import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Message, User } from '@/src/types';
import { formatTime } from '@/src/utils/date';
import WebSocketService from '@/src/services/websocket';
import ImageService from '@/src/services/image';
import ApiService from '@/src/services/api';
import { useAuth } from '@/src/context/AuthContext';

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const chatId = params.id as string;
  const { user: currentUser } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Người còn lại trong DM (suy ra từ các sender khác currentUser)
  const otherUser = useMemo<User | undefined>(() => {
    const others = Object.values(userMap).filter(
      (u) => u.username && u.username !== currentUser?.username
    );
    return others[0];
  }, [userMap, currentUser?.username]);

  // Tạo một User "đủ field" để thỏa mãn type nếu thiếu dữ liệu
  const makeFullUser = (partial: Partial<User> & { id?: string; username?: string; name?: string; avatar?: string }): User => {
    const username = partial.username || partial.id || 'user';
    return {
      id: partial.id || username,
      username: username,
      name: partial.name || username,
      email: partial.email || `${username}@example.com`, // bắt buộc theo type
      avatar: partial.avatar || '',
      country: partial.country || '',
      city: partial.city || '',
      status: partial.status || 'Chilling',
      languages: partial.languages || [],
      interests: partial.interests || [],
      bio: partial.bio,
      gender: partial.gender,
      age: partial.age,
      memberSince: partial.memberSince,
      followersCount: partial.followersCount,
      followingCount: partial.followingCount,
      postsCount: partial.postsCount,
      specialties: partial.specialties,
      isAvailableToHangout: partial.isAvailableToHangout,
      hangoutActivities: partial.hangoutActivities,
      currentActivity: partial.currentActivity,
      location: partial.location,
      isOnline: partial.isOnline,
      flag: partial.flag,
    };
  };

  // Chuẩn hóa 1 message trả về từ API/WS để luôn có sender (ít nhất là placeholder)
  const normalizeMessage = (raw: any): Message => {
    const senderUsername: string =
      raw?.senderId ??
      raw?.sender_username ??
      raw?.sender?.username ??
      raw?.sender ??
      '';

    const existingUser = senderUsername ? userMap[senderUsername] : undefined;

    // Nếu đã có user chi tiết thì dùng, nếu không tạo user tối thiểu (đủ fields)
    const sender: User =
      existingUser ||
      (raw?.sender
        ? makeFullUser({
            id: raw.sender.id,
            username: raw.sender.username,
            name: raw.sender.name,
            avatar: raw.sender.avatar,
            email: raw.sender.email,
            country: raw.sender.country,
            city: raw.sender.city,
            status: raw.sender.status,
            languages: raw.sender.languages,
            interests: raw.sender.interests,
          })
        : makeFullUser({ username: senderUsername }));

    const imageUrl: string | undefined =
      raw?.image ||
      raw?.message_media?.[0]?.media_url ||
      undefined;

    return {
      id: String(raw?.id ?? `${Date.now()}`),
      chatId: String(raw?.chatId ?? raw?.conversation_id ?? chatId),
      senderId: String(senderUsername || ''),
      sender,
      content: raw?.content ?? '',
      image: imageUrl,
      timestamp: raw?.timestamp ?? raw?.created_at ?? new Date().toISOString(),
      read: Boolean(raw?.read ?? false),
    };
  };

  // Enrich: load profile thật cho các sender để có avatar/tên thật
  const enrichSenders = async (msgs: Message[]) => {
    try {
      const usernames = Array.from(
        new Set(
          msgs
            .map((m) => m.senderId)
            .filter((u): u is string => typeof u === 'string' && u.length > 0)
        )
      );

      const fetchers = usernames.map(async (u) => {
        if (userMap[u]) return [u, userMap[u]] as const;
        try {
          const user = await ApiService.getUserByUsername(u);
          return [u, user] as const;
        } catch {
          // fallback nếu không fetch được
          return [u, makeFullUser({ username: u })] as const;
        }
      });

      const results = await Promise.all(fetchers);
      const newMap: Record<string, User> = { ...userMap };
      results.forEach(([u, user]) => {
        newMap[u] = user;
      });

      setUserMap(newMap);

      // Cập nhật lại messages với sender đầy đủ
      setMessages((prev) =>
        prev.map((m) => (newMap[m.senderId] ? { ...m, sender: newMap[m.senderId] } : m))
      );
    } catch (e) {
      console.warn('Failed to enrich sender profiles', e);
    }
  };

  // Tải messages thật từ API, chuẩn hóa, rồi enrich
  const loadMessages = async () => {
    try {
      const rawMessages = await ApiService.getChatMessages(chatId);
      const normalized = (rawMessages as any[]).map((m) => normalizeMessage(m));
      // Nếu API trả newest first thì đảo để render từ cũ -> mới
      const ordered = normalized.reverse();
      setMessages(ordered);

      // Enrich avatars + names
      enrichSenders(ordered);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  // WebSocket setup
  useEffect(() => {
    if (!chatId || !currentUser?.username) return;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    if (!WebSocketService.isConnected()) {
      const token = currentUser.username; // TODO: thay bằng token thực nếu có
      WebSocketService.connect(apiUrl, token);
      setTimeout(() => {
        if (WebSocketService.isConnected()) {
          WebSocketService.joinConversation(chatId);
        }
      }, 800);
    } else {
      WebSocketService.joinConversation(chatId);
    }

    const onNewMsg = (incoming: any) => {
      const msg = normalizeMessage(incoming);
      if (String(msg.chatId) === String(chatId)) {
        setMessages((prev) => [...prev, msg]);
        // Cố gắng enrich sender vừa đến
        if (msg.senderId && !userMap[msg.senderId]) {
          enrichSenders([msg]);
        }
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    };

    const onTyping = (data: any) => {
      if (String(data.conversationId) === String(chatId) && data.username !== currentUser.username) {
        setOtherUserTyping(Boolean(data.isTyping));
      }
    };

    WebSocketService.onNewMessage(onNewMsg);
    WebSocketService.onTyping(onTyping);

    return () => {
      try {
        WebSocketService.leaveConversation(chatId);
      } catch {}
      WebSocketService.off('new_message');
      WebSocketService.off('typing');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, currentUser?.username, userMap]);

  // Load messages khi vào màn hình
  useEffect(() => {
    if (chatId) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUser?.username) return;

    const messageContent = inputText;
    setInputText('');

    // optimistic message dùng currentUser (đã là User đầy đủ)
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      chatId: String(chatId),
      senderId: currentUser.username,
      sender: currentUser,
      content: messageContent,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);

    try {
      const sentViaWs = WebSocketService.isConnected()
        ? WebSocketService.sendMessage(chatId, currentUser.username, messageContent)
        : false;

      if (!sentViaWs) {
        await ApiService.sendMessage(chatId, currentUser.username, messageContent);
      }

      handleTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
    }
  };

  const handleImagePick = async () => {
    try {
      const image = await ImageService.pickImageFromGallery({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!image) return;

      if (!ImageService.validateImageSize(image, 5)) {
        Alert.alert('Error', 'Image size must be less than 5MB');
        return;
      }

      setUploading(true);

      const imageFile: any = {
        uri: image.uri,
        type: image.type,
        name: image.name,
      };

      if (currentUser?.username) {
        await ApiService.sendMessageWithImage(
          chatId,
          currentUser.username,
          inputText || '📷 Photo',
          imageFile
        );
        setInputText('');
      }

      setUploading(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
      setUploading(false);
    }
  };

  const handleTyping = (typing: boolean) => {
    if (!currentUser?.username) return;

    setIsTyping(typing);

    if (WebSocketService.isConnected()) {
      WebSocketService.sendTyping(chatId, currentUser.username, typing);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (typing) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        if (currentUser?.username && WebSocketService.isConnected()) {
          WebSocketService.sendTyping(chatId, currentUser.username, false);
        }
      }, 3000);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (text.length > 0 && !isTyping) {
      handleTyping(true);
    } else if (text.length === 0 && isTyping) {
      handleTyping(false);
    }
  };

  const handleQuickMessage = (message: string) => {
    setInputText(message);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === (currentUser?.username || '');

    const senderAvatar = item.sender?.avatar || '';
    const senderName = item.sender?.name || item.senderId;

    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        {!isOwnMessage && (
          senderAvatar.length > 0 ? (
            <Image source={{ uri: senderAvatar }} style={styles.messageAvatar} />
          ) : (
            <View style={[styles.messageAvatar, styles.messageAvatarPlaceholder]}>
              <Ionicons name="person-circle-outline" size={28} color="#999" />
            </View>
          )
        )}
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.messageImage} />
          )}
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const quickMessages = [
    { shortcut: '/x', message: 'Xin chào' },
    { shortcut: '/h', message: 'Hello!' },
    { shortcut: '/t', message: 'Thank you!' },
    { shortcut: '/s', message: 'See you soon!' },
  ];

  const [showQuickMessages, setShowQuickMessages] = useState(false);

  return (
    <>
      <Stack.Screen
        options={{
          title: otherUser?.name || 'Conversation',
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="call-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="videocam-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="ellipsis-vertical" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 0)}
          />

          {showQuickMessages && (
            <View style={styles.quickMessagesPanel}>
              <View style={styles.quickMessagesPanelHeader}>
                <Text style={styles.quickMessagesPanelTitle}>Quick Messages</Text>
                <TouchableOpacity onPress={() => setShowQuickMessages(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.quickMessagesList}>
                {quickMessages.map((qm, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickMessageItem}
                    onPress={() => {
                      handleQuickMessage(qm.message);
                      setShowQuickMessages(false);
                    }}
                  >
                    <Text style={styles.quickMessageShortcut}>{qm.shortcut}</Text>
                    <Text style={styles.quickMessageText}>{qm.message}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.inputIconButton}
              onPress={() => setShowQuickMessages(!showQuickMessages)}
            >
              <Ionicons name="flash-outline" size={24} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inputIconButton}
              onPress={handleImagePick}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#666" />
              ) : (
                <Ionicons name="image-outline" size={24} color="#666" />
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={[styles.sendButton, inputText.trim().length > 0 && styles.sendButtonActive]}
              onPress={handleSendMessage}
              disabled={inputText.trim().length === 0}
            >
              <Ionicons name="send" size={20} color={inputText.trim().length > 0 ? '#fff' : '#999'} />
            </TouchableOpacity>
          </View>

          {otherUserTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>{otherUser?.name || 'Someone'} is typing...</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
    marginRight: 8,
  },
  headerButton: {
    padding: 4,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    overflow: 'hidden',
  },
  messageAvatarPlaceholder: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: '#E3F2FD',
  },
  quickMessagesPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    maxHeight: 200,
  },
  quickMessagesPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  quickMessagesPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  quickMessagesList: {
    padding: 8,
  },
  quickMessageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  quickMessageShortcut: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    width: 40,
  },
  quickMessageText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputIconButton: {
    padding: 8,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    maxHeight: 100,
    marginHorizontal: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  typingIndicator: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});