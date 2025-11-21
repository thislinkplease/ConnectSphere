import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ApiService from '@/src/services/api';
import communityService, { CommunityPost } from '@/src/services/communityService';
import type { Community, User, UserLite } from '@/src/types';
import PostItem from '@/components/posts/post_item';
import CommentsSheet from '@/components/posts/comments_sheet';
import { useTheme } from '@/src/context/ThemeContext';

export default function CommunityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const communityId = useMemo(() => Number(id), [id]);
  const { colors, isPro } = useTheme();

  const [me, setMe] = useState<User | null>(null);
  const [community, setCommunity] = useState<(Community & { is_member?: boolean }) | null>(null);

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const meLite = useMemo(() => {
    if (me?.username) {
      return {
        username: me.username,
        avatar: me.avatar ?? null,
        name: me.name ?? undefined,
      } as UserLite;
    }
    return null;
  }, [me]);

  // Load current user (để lấy avatar + username)
  useEffect(() => {
    (async () => {
      try {
        const user = await ApiService.getCurrentUser();
        setMe(user as any);
      } catch (e) {
        console.warn('getMe error', e);
      }
    })();
  }, []);

  // Load community header
  useEffect(() => {
    if (!communityId) return;
    (async () => {
      try {
        setLoading(true);
        const viewer = me?.username;
        const c = await communityService.getCommunity(communityId, viewer);
        setCommunity(c);

        const first = await communityService.getCommunityPosts(communityId, { 
          limit: 10, 
          viewer: me?.username 
        });
        setPosts(first);
        cursorRef.current = first.length ? first[first.length - 1].created_at : null;
        setHasMore(first.length >= 10);
      } catch (e: any) {
        // If 403, user is not a member - show empty posts
        if (e?.response?.status === 403) {
          setPosts([]);
          setHasMore(false);
        } else {
          console.error('load community error', e);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [communityId, me?.username]);

  const onRefresh = useCallback(async () => {
    if (!communityId) return;
    setRefreshing(true);
    try {
      const viewer = me?.username;
      const c = await communityService.getCommunity(communityId, viewer);
      setCommunity(c);

      const fresh = await communityService.getCommunityPosts(communityId, { 
        limit: 10,
        viewer: me?.username
      });
      setPosts(fresh);
      cursorRef.current = fresh.length ? fresh[fresh.length - 1].created_at : null;
      setHasMore(fresh.length >= 10);
    } catch (e: any) {
      // If 403, user is not a member - show empty posts
      if (e?.response?.status === 403) {
        setPosts([]);
        setHasMore(false);
      } else {
        console.error(e);
      }
    } finally {
      setRefreshing(false);
    }
  }, [communityId, me?.username]);

  const loadMore = useCallback(async () => {
    if (!communityId || !hasMore || loading) return;
    try {
      const next = await communityService.getCommunityPosts(communityId, {
        limit: 10,
        before: cursorRef.current || undefined,
        viewer: me?.username,
      });
      if (next.length === 0) {
        setHasMore(false);
        return;
      }
      setPosts((prev) => [...prev, ...next]);
      cursorRef.current = next[next.length - 1].created_at;
      if (next.length < 10) setHasMore(false);
    } catch (e) {
      console.error(e);
    }
  }, [communityId, hasMore, loading]);

  const onJoinPress = useCallback(async () => {
    if (!communityId || !me?.username) return;
    try {
      await communityService.joinCommunity(communityId, me.username);
      setCommunity((prev) => prev ? { ...prev, is_member: true, member_count: (prev.member_count ?? 0) + 1 } : prev);
    } catch (e) {
      console.error(e);
    }
  }, [communityId, me?.username]);

  const onLeavePress = useCallback(async () => {
    if (!communityId || !me?.username) return;
    try {
      await communityService.leaveCommunity(communityId, me.username);
      setCommunity((prev) => prev ? { ...prev, is_member: false, member_count: Math.max(0, (prev.member_count ?? 0) - 1) } : prev);
      // Clear posts when leaving since user can no longer see them
      setPosts([]);
      setHasMore(false);
    } catch (e) {
      console.error(e);
    }
  }, [communityId, me?.username]);

  const onLikeToggle = useCallback(async (post: CommunityPost, isCurrentlyLiked: boolean) => {
    if (!me?.username) return;
    try {
      if (isCurrentlyLiked) {
        await communityService.unlikePost(communityId, post.id, me.username);
        setPosts((prev) => prev.map(p => p.id === post.id ? { ...p, like_count: Math.max(0, (p.like_count || 0) - 1) } : p));
      } else {
        await communityService.likePost(communityId, post.id, me.username);
        setPosts((prev) => prev.map(p => p.id === post.id ? { ...p, like_count: (p.like_count || 0) + 1 } : p));
      }
    } catch (e) {
      console.error(e);
    }
  }, [communityId, me?.username]);

  const renderHeader = useMemo(() => {
    if (!community) return null;
    
    // Check if current user is admin/moderator
    const isUserAdmin = me?.username && (
      me.username === community.created_by ||
      // We'll check this properly later when we fetch member role
      false
    );
    
    return (
      <View style={{ backgroundColor: colors.card }}>
        {/* TOP BANNER */}
        {!!community.image_url && (
          <Image source={{ uri: community.image_url }} style={styles.banner} />
        )}

        {/* HEADER */}
        <View style={[styles.headerBox, { backgroundColor: colors.card }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>
            {me?.username === community.created_by && (
              <Pressable 
                style={styles.settingsButton}
                onPress={() => router.push({
                  pathname: '/overview/community-settings',
                  params: { id: String(communityId) },
                })}
              >
                <Ionicons name="settings-outline" size={24} color={colors.text} />
              </Pressable>
            )}
          </View>
          <View style={styles.subInfoRow}>
            <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.subText, { color: colors.textSecondary }]}>
              {community.is_private ? 'Private' : 'Public'} · {community.member_count ?? 0} members
            </Text>
          </View>

          <View style={styles.btnRow}>
            {community.is_member ? (
              <>
                <Pressable style={[styles.joinedBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onLeavePress}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.text} />
                  <Text style={[styles.joinedText, { color: colors.text }]}>Joined</Text>
                </Pressable>
                <Pressable 
                  style={[styles.chatBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push({
                    pathname: '/overview/community-chat',
                    params: { id: String(communityId), name: community.name },
                  })}
                >
                  <Ionicons name="chatbubbles" size={20} color="#fff" />
                  <Text style={styles.chatText}>Chat</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={[styles.inviteBtn, { backgroundColor: colors.primary }]} onPress={onJoinPress}>
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.inviteText}>Join</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* POST INPUT - Only show for members */}
        {community.is_member && (
          <View style={[styles.postBox, { backgroundColor: colors.card }]}>
            <Image
              source={{ uri: me?.avatar || 'https://i.pravatar.cc/100' }}
              style={styles.avatar}
            />
            <Pressable
              style={[styles.postInput, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => router.push(`/overview/post?communityId=${communityId}`)}
            >
              <Text style={{ color: colors.textMuted }}>What&apos;s on your mind?</Text>
            </Pressable>
          </View>
        )}

        {/* Private community message for non-members */}
        {community.is_private && !community.is_member && (
          <View style={[styles.privateNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.privateNoticeText, { color: colors.textSecondary }]}>
              This is a private community. Join to see posts and participate in discussions.
            </Text>
          </View>
        )}

        <View style={[styles.separator, { backgroundColor: colors.surfaceVariant }]} />
      </View>
    );
  }, [community, me?.avatar, onJoinPress, onLeavePress, router, communityId, colors]);

  const renderItem = useCallback(({ item }: { item: CommunityPost }) => {
    return (
      <PostItem
        post={item}
        onCommentClick={(p) => {
          setSelectedPostId(p.id);
          setCommentsVisible(true);
        }}
        onLikeToggle={(p, liked) => onLikeToggle(p as any, liked)}
        initialIsLiked={false}
      />
    );
  }, [onLikeToggle]);


  if (loading && posts.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={[styles.container, { backgroundColor: colors.background }]}
        data={posts}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        onEndReachedThreshold={0.3}
        onEndReached={loadMore}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListFooterComponent={
          hasMore ? (
            <View style={{ paddingVertical: 16, backgroundColor: colors.background }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : <View style={{ height: 16 }} />
        }
      />
      {selectedPostId !== null && (
        <CommentsSheet
          visible={commentsVisible}
          onClose={() => setCommentsVisible(false)}
          communityId={communityId}
          postId={selectedPostId}
          me={meLite}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { width: '100%', height: 200, backgroundColor: '#ddd' },
  headerBox: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  communityName: { fontSize: 22, fontWeight: '700', flex: 1 },
  settingsButton: { padding: 4, marginLeft: 8 },
  subInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  subText: { marginLeft: 6, fontSize: 14 },
  btnRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
  joinedBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1,
  },
  joinedText: { fontSize: 15, marginLeft: 6 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8,
  },
  inviteText: { color: '#fff', marginLeft: 6, fontSize: 15 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8,
  },
  chatText: { color: '#fff', marginLeft: 6, fontSize: 15 },
  postBox: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ccc' },
  postInput: { flex: 1, borderWidth: 1, borderRadius: 25, paddingVertical: 10, paddingHorizontal: 16 },
  privateNotice: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    gap: 12, 
    marginHorizontal: 16, 
    marginVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  privateNoticeText: { 
    flex: 1, 
    fontSize: 14, 
    lineHeight: 20,
  },
  separator: { height: 7, width: '100%' },
});
