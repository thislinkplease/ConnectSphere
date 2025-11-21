import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  Keyboard,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import communityService from '@/src/services/communityService';
import type { Comment, CommentsSheetProps } from '@/src/types';
import ApiService from '@/src/services/api';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = Math.round(SCREEN_H * 0.66);

export default function CommentsSheet(props: CommentsSheetProps) {
  const { visible, onClose, communityId, postId, me } = props;
  const router = useRouter();
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const [loading, setLoading] = useState(false);
  const [rootComments, setRootComments] = useState<Comment[]>([]);
  const [repliesMap, setRepliesMap] = useState<Record<number, Comment[]>>({});
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [visibleReplies, setVisibleReplies] = useState<Record<number, number>>({});
  const [userAvatar, setUserAvatar] = useState<Record<string, string>>({});
  const [userData, setUserData] = useState<Record<string, { name: string; avatar: string }>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    if (!visible || !me?.username) return;
    (async () => {
      try {
        const role = await communityService.getMemberRole(communityId, me.username);
        setIsAdmin(role === 'admin' || role === 'moderator');
      } catch (e) {
        console.warn('Error checking admin status:', e);
      }
    })();
  }, [visible, communityId, me?.username]);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : SHEET_H,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) {
        // reset on hide
        setInput('');
        setReplyTo(null);
        setRootComments([]);
        setRepliesMap({});
      }
    });
  }, [visible, translateY]);

  // load comments
  useEffect(() => {
  if (!visible) return;

  (async () => {
    setLoading(true);

    try {
      const all: Comment[] = await communityService.getAllPostComments(
        communityId,
        postId
      );

      const roots: Comment[] = all.filter(
        (c: Comment) => c.parent_id === null
      );

      const newRepliesMap: Record<number, Comment[]> = {};

      for (const root of roots) {
        newRepliesMap[root.id] = all.filter((c: Comment) => {
          const isChildOfRoot = c.parent_id === root.id;
          const isChildOfReply = all.some(
            (rc: Comment) =>
              rc.parent_id === root.id && c.parent_id === rc.id
          );

          return isChildOfRoot || isChildOfReply;
        });
      }

      setRootComments(roots);
      setRepliesMap(newRepliesMap);

      const initVisible: Record<number, number> = {};
      for (const root of roots) {
        const replyCount = newRepliesMap[root.id]?.length ?? 0;
        initVisible[root.id] = Math.min(1, replyCount);
      }
      setVisibleReplies(initVisible);


      const usernames = Array.from(
        new Set(all.map((c: Comment) => c.author_username))
      );

      for (const username of usernames) {
        if (userData[username]) continue;

        try {
          const user = await ApiService.getUserByUsername(username);

          setUserData((prev) => ({
            ...prev,
            [username]: {
              name: user.name || username,
              avatar: user.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user.name || username
                )}&background=random`,
            },
          }));
        } catch (err) {
          console.log("Failed loading user:", username);

          setUserData((prev) => ({
            ...prev,
            [username]: {
              name: username,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                username
              )}&background=random`,
            },
          }));
        }
      }
    } catch (err) {
      console.error("Load comments error:", err);
    } finally {
      setLoading(false);
    }
  })();
}, [visible, communityId, postId]);


  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLongPressComment = (comment: Comment) => {
    if (!me?.username) return;

    const isOwnComment = comment.author_username === me.username;
    
    if (isOwnComment) {
      Alert.alert(
        "Comment options",
        "Choose an action",
        [
          {
            text: "Edit",
            onPress: () => {
              setReplyTo(comment);
              setInput(comment.content);
              setIsEditing(true);
            }
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteComment(comment)
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } else if (isAdmin) {
      // Admin can delete any comment
      Alert.alert(
        "Admin options",
        "Manage this comment",
        [
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                "Delete Comment",
                "Are you sure you want to delete this comment as an admin?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteComment(comment)
                  }
                ]
              );
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } else {
      setReplyTo(comment);
    }
  };

  const handlePressUsername = (username: string) => {
    if (!username) return;

    onClose?.();
    setTimeout(() => {
      router.push({
        pathname: '/account/profile',
        params: { username },
      });
    }, 50);
  };

  const loadMoreReplies = (rootId: number) => {
    setVisibleReplies(prev => {
      const currentlyVisible = prev[rootId] ?? 0;
      const total = repliesMap[rootId]?.length ?? 0;
      const nextVisible = Math.min(currentlyVisible + 1, total);
      return { ...prev, [rootId]: nextVisible };
    });
  };


  const deleteComment = async (comment: Comment) => {
    try {
      await communityService.deletePostComment(
        communityId,
        postId,
        comment.id,
        me!.username
      );

      if (comment.parent_id === null) {
        setRootComments((prev) => prev.filter((c) => c.id !== comment.id));
      } else {
        setRepliesMap(prev => {
          const res = { ...prev };
          for (const key in res) {
            res[key] = res[key].filter(c => c.id !== comment.id);
          }
          return res;
        });
      }

    } catch (e) {
      console.error("Delete comment error", e);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(Math.min(g.dy, SHEET_H));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 120) {
            Animated.spring(translateY, { toValue: SHEET_H, useNativeDriver: true }).start(onClose);
          } else {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [onClose, translateY]
  );

  const sendComment = useCallback(async () => {
    if (!input.trim() || !me?.username) return;

    setSubmitting(true);

    try {
      // ================
      // 1) EDIT COMMENT
      // ================
      if (isEditing && replyTo) {
        try {
          const updated = await communityService.editPostComment(
            communityId,
            postId,
            replyTo.id,
            input.trim(),
            me.username
          );

          // update local state
          if (replyTo.parent_id === null) {
            setRootComments(prev =>
              prev.map((c: Comment) =>
                c.id === replyTo.id ? { ...c, content: input.trim() } : c
              )
            );
          } else {
            const parentId = replyTo.parent_id as number;

            setRepliesMap(prev => {
              const group = prev[parentId] || [];
              return {
                ...prev,
                [parentId]: group.map((c: Comment) =>
                  c.id === replyTo.id ? { ...c, content: input.trim() } : c
                )
              };
            });
          }

          setInput("");
          setReplyTo(null);
          setIsEditing(false);
          setSubmitting(false);
          return;

        } catch (e) {
          console.error("edit comment error", e);
        }
      }

      // ========================
      // 2) THÊM COMMENT MỚI
      // ========================
      const newCmt = await communityService.addPostComment(
        communityId,
        postId,
        me.username,
        input.trim(),
        replyTo ? replyTo.id : null
      );

      // xác định parent root đúng
      const parentRootId = replyTo?.parent_id ? replyTo.parent_id : replyTo?.id;

      if (parentRootId) {
        // push vào replies
        setRepliesMap((prev) => ({
          ...prev,
          [parentRootId]: [...(prev[parentRootId] || []), newCmt],
        }));
      } else {
        // push comment root
        setRootComments((prev) => [...prev, newCmt]);
      }

      // reset
      setInput("");
      setReplyTo(null);

    } catch (e) {
      console.error("send comment error", e);
    } finally {
      setSubmitting(false);
    }
  }, [communityId, postId, me?.username, input, replyTo]);

  const closeReply = () => setReplyTo(null);

  const formattedTime = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const renderReply = (reply: Comment) => (
    <View key={reply.id} style={styles.replyRow}>
      <View style={{ width: 32, alignItems: 'center' }}>
        <Ionicons name="return-down-forward" size={18} color="#9ca3af" />
      </View>

      <Image
        source={{
          uri:
            userData[reply.author_username]?.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.author_username)}&background=random`
        }}
        style={styles.avatar}
      />

      <View style={{ flex: 1 }}>
        <Pressable
          onLongPress={() => handleLongPressComment(reply)}
          delayLongPress={200}
          style={styles.commentBubble}
        >
          <Pressable onPress={() => handlePressUsername(reply.author_username)}>
            <Text style={styles.usernameText}>{userData[reply.author_username]?.name || reply.author_username}</Text>
          </Pressable>
          <Text style={styles.contentText}>{reply.content}</Text>
          <Text style={styles.timeText}>{formattedTime(reply.created_at)}</Text>
        </Pressable>

        <Pressable onPress={() => setReplyTo(reply)} style={{ marginTop: 6 }}>
          <Text style={styles.replyAction}>Reply</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderRoot = ({ item }: { item: Comment }) => {
    const replies = repliesMap[item.id] || [];
    return (
      <View style={styles.commentRow}>
        <Image
          source={{
            uri:
              userData[item.author_username]?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.author_username)}&background=random`
          }}
          style={styles.avatar}
        />

        <View style={{ flex: 1 }}>
          <Pressable 
            onLongPress={() => handleLongPressComment(item)}
            delayLongPress={200}
            style={styles.commentBubble}
          >
            <Pressable onPress={() => handlePressUsername(item.author_username)}>
              <Text style={styles.usernameText}>{userData[item.author_username]?.name || item.author_username}</Text>
            </Pressable>
            <Text style={styles.contentText}>{item.content}</Text>
            <Text style={styles.timeText}>{formattedTime(item.created_at)}</Text>
          </Pressable>

          <Pressable onPress={() => setReplyTo(item)} style={{ marginTop: 6 }}>
            <Text style={styles.replyAction}>Reply</Text>
          </Pressable>

          {replies.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {replies
                .slice(0, visibleReplies[item.id] ?? 0)
                .map(renderReply)}

              {visibleReplies[item.id] < replies.length && (
                <Pressable
                  onPress={() => loadMoreReplies(item.id)}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: "#3b82f6", fontSize: 14, marginLeft: 20, }}>
                    View more replies ({replies.length - visibleReplies[item.id]})
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {/* === BOTTOM SHEET === */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY }] }
        ]}
        {...panResponder.panHandlers}
      >
        {/* drag handle */}
        <View style={styles.dragHandleWrap}>
          <View style={styles.dragHandle} />
        </View>

        {/* header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Comments</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="#111" />
          </Pressable>
        </View>

        {/* ===== COMMENT LIST ===== */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={rootComments}
            keyExtractor={(it) => String(it.id)}
            renderItem={renderRoot}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 24 }}>
                <Text style={{ color: "#9ca3af" }}>Give the first comment!</Text>
              </View>
            }
          />
        )}

        {/* Replying to box */}
        {!!replyTo && (
          <View style={styles.replyingTo}>
            <Text style={{ color: '#111' }}>
              Replying to{' '}
              <Text
                style={{ fontWeight: '600', textDecorationLine: 'underline' }}
                onPress={() => handlePressUsername(replyTo.author_username)}
              >
                {userData[replyTo.author_username]?.name || replyTo.author_username}
              </Text>
            </Text>

            <Pressable onPress={closeReply}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </Pressable>
          </View>
        )}

        {/* ===== INPUT BAR ===== */}
        <View style={[styles.inputRow, { marginBottom: keyboardHeight }]}>
          <Image
            source={{ uri: me?.avatar || "https://i.pravatar.cc/100" }}
            style={styles.inputAvatar}
          />

          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
            multiline
          />

          <Pressable onPress={sendComment} disabled={submitting || !input.trim()}>
            <Ionicons
              name="send"
              size={22}
              color={input.trim() ? "#111" : "#d1d5db"}
            />
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: SHEET_H,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  dragHandleWrap: { alignItems: 'center', paddingVertical: 6 },
  dragHandle: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#e5e7eb', marginTop: 10 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  commentRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, marginRight: 10, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' },
  commentBubble: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 10 },
  usernameText: { fontWeight: '600', color: '#111', marginBottom: 4 },
  contentText: { color: '#111' },
  timeText: { marginTop: 6, fontSize: 11, color: '#6b7280' },
  replyAction: { color: '#6b7280', fontSize: 13 },
  replyRow: { flexDirection: 'row', gap: 8, marginLeft: -40, marginRight: 10, marginTop: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 10, paddingBottom: 20, paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  inputAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee' },
  input: { flex: 1, maxHeight: 100, paddingVertical: 8, color: '#111' },
  replyingTo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f9fafb',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee',
  },
});
