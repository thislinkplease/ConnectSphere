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
import { formatMessageTime } from '@/src/utils/date';
import WebSocketService from '@/src/services/websocket';
import ImageService from '@/src/services/image';
import ApiService from '@/src/services/api';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const chatId = params.id as string;
  const { user: currentUser } = useAuth();
  const { colors } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Người còn lại trong DM (suy ra từ các sender khác currentUser)
  const otherUser = useMemo<User | undefined>(() => {
    const others = Object.values(userMap).filter(
      (u) => u.username && u.username !== currentUser?.username
    );
    return others[0];
  }, [userMap, currentUser?.username]);

  // Tạo một User "đủ field"
  const makeFullUser = (
    partial: Partial<User> & { id?: string; username?: string; name?: string; avatar?: string }
  ): User => {
    const username = partial.username || partial.id || 'user';
    return {
      id: partial.id || username,
      username: username,
      name: partial.name || username,
      email: partial.email || `${username}@example.com`,
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

  // Chuẩn hóa message
  const normalizeMessage = (raw: any): Message => {
    const senderUsername: string =
      raw?.senderId ??
      raw?.sender_username ??
      raw?.sender?.username ??
      raw?.sender ??
      '';

    const existingUser = senderUsername ? userMap[senderUsername] : undefined;

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
      raw?.image || raw?.message_media?.[0]?.media_url || undefined;

    // CRITICAL: Ensure we use the server's timestamp, not current time
    // Priority: timestamp (WebSocket) > created_at (REST API) > fallback only for temp messages
    const messageTimestamp = raw?.timestamp || raw?.created_at;
    const timestamp = messageTimestamp || (raw?.id?.toString().startsWith('temp-') ? new Date().toISOString() : '');

    return {
      id: String(raw?.id ?? `${Date.now()}`),
      chatId: String(raw?.chatId ?? raw?.conversation_id ?? chatId),
      senderId: String(senderUsername || ''),
      sender,
      content: raw?.content ?? '',
      image: imageUrl,
      timestamp: timestamp,
      read: Boolean(raw?.read ?? false),
    };
  };

  // Enrich sender profiles
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
          return [u, makeFullUser({ username: u })] as const;
        }
      });

      const results = await Promise.all(fetchers);
      const newMap: Record<string, User> = { ...userMap };
      results.forEach(([u, user]) => {
        newMap[u] = user;
      });

      setUserMap(newMap);
      setMessages((prev) =>
        prev.map((m) => (newMap[m.senderId] ? { ...m, sender: newMap[m.senderId] } : m))
      );
    } catch (e) {
      console.warn('Failed to enrich sender profiles', e);
    }
  };

  // Load messages
  const loadMessages = async () => {
    try {
      const rawMessages = await ApiService.getChatMessages(chatId);
      const normalized = (rawMessages as any[]).map((m) => normalizeMessage(m));
      const ordered = normalized.reverse();
      setMessages(ordered);
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
      const token = currentUser.username;
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
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              m.id === msg.id ||
              (m.content === msg.content &&
                m.senderId === msg.senderId &&
                Math.abs(
                  new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()
                ) < 5000)
          );
          if (exists) {
            return prev.map((m) =>
              m.id.startsWith('temp-') &&
              m.content === msg.content &&
              m.senderId === msg.senderId
                ? msg
                : m
            );
          }
          return [...prev, msg];
        });

        if (msg.senderId && !userMap[msg.senderId]) {
          enrichSenders([msg]);
        }
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    };

    const onTyping = (data: any) => {
      if (
        String(data.conversationId) === String(chatId) &&
        data.username !== currentUser.username
      ) {
        setOtherUserTyping(Boolean(data.isTyping));
      }
    };

    WebSocketService.onNewMessage(onNewMsg);
    WebSocketService.onTyping(onTyping);

    return () => {
      try {
        WebSocketService.leaveConversation(chatId);
      } catch {}
      WebSocketService.off('new_message', onNewMsg);
      WebSocketService.off('typing', onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, currentUser?.username]);

  // Load messages khi vào
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
        
        // Reload messages to show the newly sent image
        setTimeout(() => {
          loadMessages();
        }, 500);
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

  const quickMessages = [
    { shortcut: '/x', message: 'Xin chào' },
    { shortcut: '/h', message: 'Hello!' },
    { shortcut: '/t', message: 'Thank you!' },
    { shortcut: '/s', message: 'See you soon!' },
  ];

  // Render từng message
  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === (currentUser?.username || '');
    const senderAvatar = item.sender?.avatar || '';
    const senderName = item.sender?.name || item.senderId;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage && styles.ownMessageContainer,
        ]}
      >
        {!isOwnMessage && (
          senderAvatar.length > 0 ? (
            <Image source={{ uri: senderAvatar }} style={styles.messageAvatar} />
          ) : (
            <View
              style={[
                styles.messageAvatar,
                styles.messageAvatarPlaceholder,
                { backgroundColor: colors.border },
              ]}
            >
              <Ionicons name="person-circle-outline" size={28} color="#999" />
            </View>
          )
        )}

        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isOwnMessage ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: isOwnMessage ? colors.primary : colors.border,
              shadowColor: '#000',
            },
            isOwnMessage && { alignSelf: 'flex-end' },
          ]}
        >
          {!isOwnMessage && (
            <Text style={[styles.senderName, { color: colors.text }]}>
              {senderName}
            </Text>
          )}
          {item.image && (
            <Image
              source={{ uri: item.image }}
              style={[
                styles.messageImage,
                { borderColor: colors.border },
              ]}
            />
          )}
            <Text
              style={[
              styles.messageText,
              {
                color: isOwnMessage ? '#fff' : colors.text,
              },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              {
                color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#666',
              },
            ]}
          >
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: otherUser?.name || 'Conversation',
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="ellipsis-vertical" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
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
            onLayout={() =>
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 0)
            }
          />

          {showQuickMessages && (
            <View
              style={[
                styles.quickMessagesPanel,
                { backgroundColor: colors.card, borderTopColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.quickMessagesPanelHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.quickMessagesPanelTitle, { color: colors.text }]}>
                  Quick Messages
                </Text>
                <TouchableOpacity onPress={() => setShowQuickMessages(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.quickMessagesList}>
                {quickMessages.map((qm, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.quickMessageItem,
                      { borderBottomColor: colors.background },
                    ]}
                    onPress={() => {
                      handleQuickMessage(qm.message);
                      setShowQuickMessages(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.quickMessageShortcut,
                        { color: colors.primary },
                      ]}
                    >
                      {qm.shortcut}
                    </Text>
                    <Text
                      style={[styles.quickMessageText, { color: colors.text }]}
                    >
                      {qm.message}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
              },
            ]}
          >
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
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="image-outline" size={24} color="#666" />
              )}
            </TouchableOpacity>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Type a message..."
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    inputText.trim().length > 0 ? colors.primary : colors.border,
                },
              ]}
              onPress={handleSendMessage}
              disabled={inputText.trim().length === 0}
            >
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim().length > 0 ? '#fff' : '#888'}
              />
            </TouchableOpacity>
          </View>

          {otherUserTyping && (
            <View
              style={[
                styles.typingIndicator,
                { backgroundColor: colors.card },
              ]}
            >
              <Text style={[styles.typingText, { color: colors.secondary }]}>
                {otherUser?.name || 'Someone'} is typing...
              </Text>
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
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  headerButton: {
    padding: 4,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF6D1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 4,
    gap: 4,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B8860B',
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 120,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 14,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  quickMessagesPanel: {
    borderTopWidth: 1,
    maxHeight: 200,
  },
  quickMessagesPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  quickMessagesPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  quickMessageShortcut: {
    fontSize: 14,
    fontWeight: '600',
    width: 40,
  },
  quickMessageText: {
    fontSize: 15,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
  },
  inputIconButton: {
    padding: 8,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginHorizontal: 8,
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  typingIndicator: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});