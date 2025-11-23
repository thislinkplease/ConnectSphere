import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import WebSocketService from '@/src/services/websocket';
import ApiService from '@/src/services/api';
import { formatMessageTime } from '@/src/utils/date';

interface CommunityMessage {
  id: string;
  communityId: number;
  conversation_id: number;
  sender_username: string;
  content: string;
  created_at: string;
  sender?: {
    username: string;
    name: string;
    avatar?: string;
  };
}

export default function CommunityChatScreen() {
  const params = useLocalSearchParams<{ id: string; name: string }>();
  const communityId = Number(params.id);
  const communityName = params.name || 'Community Chat';
  const { colors } = useTheme();
  const { user, token } = useAuth();

  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<CommunityMessage>>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial messages
  const loadMessages = useCallback(async () => {
    if (!user?.username) return;

    try {
      setLoading(true);
      const response = await ApiService.client.get(`/communities/${communityId}/chat/messages`, {
        params: { viewer: user.username, limit: 50 },
      });

      const msgs = response.data.map((m: any) => ({
        id: String(m.id),
        communityId,
        conversation_id: m.conversation_id,
        sender_username: m.sender_username,
        content: m.content,
        created_at: m.created_at,
        sender: m.sender,
      }));

      setMessages(msgs);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error loading community chat messages:', error);
    } finally {
      setLoading(false);
    }
  }, [communityId, user?.username]);

  // Setup WebSocket
  useEffect(() => {
    if (!user?.username) return;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    if (!WebSocketService.isConnected() && token) {
      WebSocketService.connect(apiUrl, token);
      setTimeout(() => {
        if (WebSocketService.isConnected()) {
          WebSocketService.joinCommunityChat(communityId);
        }
      }, 800);
    } else {
      WebSocketService.joinCommunityChat(communityId);
    }

    // Load messages
    loadMessages();

    // Listen for new messages
    const handleNewMessage = (message: any) => {
      if (Number(message.communityId) === communityId) {
        const newMsg: CommunityMessage = {
          id: String(message.id),
          communityId,
          conversation_id: message.conversation_id || message.chatId,
          sender_username: message.sender_username || message.senderId,
          content: message.content,
          created_at: message.created_at || message.timestamp,
          sender: message.sender,
        };

        setMessages((prev) => {
          // Check if message already exists
          const exists = prev.some(m => m.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg];
        });

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    // Listen for typing indicators
    const handleTyping = (data: any) => {
      if (Number(data.communityId) === communityId && data.username !== user.username) {
        if (data.isTyping) {
          setOtherUserTyping(data.username);
        } else {
          setOtherUserTyping(null);
        }
      }
    };

    WebSocketService.onNewCommunityMessage(handleNewMessage);
    WebSocketService.onCommunityTyping(handleTyping);

    return () => {
      WebSocketService.leaveCommunityChat(communityId);
      WebSocketService.off('new_community_message', handleNewMessage);
      WebSocketService.off('community_typing', handleTyping);
    };
  }, [communityId, user?.username, loadMessages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user?.username || sending) return;

    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // Send via WebSocket
      if (WebSocketService.isConnected()) {
        WebSocketService.sendCommunityMessage(communityId, user.username, messageContent);
      }

      // Stop typing indicator
      handleTyping(false);
    } catch (error) {
      console.error('Error sending community message:', error);
      // Restore input on error
      setInputText(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (typing: boolean) => {
    if (!user?.username) return;

    if (WebSocketService.isConnected()) {
      WebSocketService.sendCommunityTyping(communityId, user.username, typing);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (typing) {
      typingTimeoutRef.current = setTimeout(() => {
        if (user?.username && WebSocketService.isConnected()) {
          WebSocketService.sendCommunityTyping(communityId, user.username, false);
        }
      }, 3000);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      handleTyping(true);
    } else {
      handleTyping(false);
    }
  };

  const renderMessage = ({ item, index }: { item: CommunityMessage; index: number }) => {
    const isOwnMessage = item.sender_username === user?.username;
    const senderName = item.sender?.name || item.sender_username;
    const senderAvatar = item.sender?.avatar;

    // Check if this is the first message from this sender in a group
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const isFirstInGroup = !prevMessage || prevMessage.sender_username !== item.sender_username;

    // Check if this is the last message from this sender in a group
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const isLastInGroup = !nextMessage || nextMessage.sender_username !== item.sender_username;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage && styles.ownMessageContainer,
          !isFirstInGroup && styles.groupedMessage,
        ]}
      >
        {!isOwnMessage && isLastInGroup && (
          senderAvatar ? (
            <Image source={{ uri: senderAvatar }} style={styles.messageAvatar} />
          ) : (
            <View style={[styles.messageAvatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={28} color={colors.textMuted} />
            </View>
          )
        )}
        {!isOwnMessage && !isLastInGroup && (
          <View style={styles.messageAvatarSpacer} />
        )}

        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isOwnMessage ? colors.primary : colors.card,
              borderColor: isOwnMessage ? colors.primary : colors.border,
            },
            isOwnMessage && { alignSelf: 'flex-end' },
            !isFirstInGroup && styles.groupedBubble,
          ]}
        >
          {!isOwnMessage && isFirstInGroup && (
            <Text style={[styles.senderName, { color: colors.primary }]}>
              {senderName}
            </Text>
          )}
          <Text
            style={[
              styles.messageText,
              { color: isOwnMessage ? '#fff' : colors.text },
            ]}
          >
            {item.content}
          </Text>
          {isLastInGroup && (
            <Text
              style={[
                styles.messageTime,
                { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
              ]}
            >
              {formatMessageTime(item.created_at)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Stack.Screen options={{ title: communityName }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: communityName }} />
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color={colors.disabled} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            }
          />

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
              },
            ]}
          >
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
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: inputText.trim().length > 0 && !sending ? colors.primary : colors.border,
                },
              ]}
              onPress={handleSendMessage}
              disabled={inputText.trim().length === 0 || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={inputText.trim().length > 0 ? '#fff' : colors.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>

          {otherUserTyping && (
            <View style={[styles.typingIndicator, { backgroundColor: colors.card }]}>
              <Text style={[styles.typingText, { color: colors.secondary }]}>
                {otherUserTyping} is typing...
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
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  groupedMessage: {
    marginBottom: 2,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageAvatarSpacer: {
    width: 32,
    marginRight: 8,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupedBubble: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});
