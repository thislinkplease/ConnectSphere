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
  Alert,
  ScrollView,
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
    } catch (e: any) {
      if (e.message === 'REQUIRES_REQUEST') {
        Alert.alert(
          'Request Sent',
          'This community requires approval. Your join request has been sent to the admins.',
          [{ text: 'OK' }]
        );
      } else {
        console.error(e);
        Alert.alert('Error', 'Failed to join community.');
      }
    }
  }, [communityId, me?.username]);

  const onLeavePress = useCallback(async () => {
    if (!communityId || !me?.username || !community) return;

    // Check if owner
    if (community.created_by === me.username) {
      Alert.alert(
        'Cannot Leave Community',
        'You are the owner of this community. You cannot leave it. If you wish to delete the community, please go to Settings.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Leave Community',
      'Are you sure you want to leave this community?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.leaveCommunity(communityId, me.username!);
              setCommunity((prev) => prev ? { ...prev, is_member: false, member_count: Math.max(0, (prev.member_count ?? 0) - 1) } : prev);
              // Clear posts when leaving since user can no longer see them
              setPosts([]);
              setHasMore(false);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to leave community.');
            }
          }
        }
      ]
    );
  }, [communityId, me?.username, community]);

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

    return (
      <View style={{ backgroundColor: colors.card }}>
        {/* TOP BANNER - Full Width 16:9 */}
        <View style={styles.bannerContainer}>
          {community.image_url ? (
            <Image source={{ uri: community.image_url }} style={styles.banner} resizeMode="cover" />
          ) : (
            <View style={[styles.banner, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="people" size={64} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          {/* Back Button Overlay */}
          <Pressable style={styles.backButtonOverlay} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* HEADER INFO */}
        <View style={[styles.headerBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>

          <View style={styles.subInfoRow}>
            <Ionicons name={community.is_private ? "lock-closed" : "globe"} size={14} color={colors.textSecondary} />
            <Text style={[styles.subText, { color: colors.textSecondary }]}>
              {community.is_private ? 'Private group' : 'Public group'} · {formatCount(community.member_count ?? 0)} members
            </Text>
          </View>

          {/* ACTION BAR */}
          <View style={styles.actionBar}>
            {community.is_member ? (
              <>
                <Pressable style={[styles.actionBtn, styles.joinedBtn, { borderColor: colors.border }]} onPress={onLeavePress}>
                  <Text style={[styles.btnText, { color: colors.text }]}>Joined</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.text} />
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/overview/post?communityId=${communityId}`)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={[styles.btnText, { color: '#fff' }]}>Invite</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={onJoinPress}>
                <Text style={[styles.btnText, { color: '#fff', fontWeight: '600' }]}>Join Group</Text>
              </Pressable>
            )}

            {/* Manage / Settings */}
            {me?.username === community.created_by && (
              <Pressable
                style={[styles.iconBtn, { backgroundColor: colors.surface }]}
                onPress={() => router.push({
                  pathname: '/overview/community-settings',
                  params: { id: String(communityId) },
                })}
              >
                <Ionicons name="shield-checkmark" size={20} color={colors.text} />
              </Pressable>
            )}

            {/* Chat Button */}
            {community.is_member && (
              <Pressable
                style={[styles.iconBtn, { backgroundColor: colors.surface }]}
                onPress={() => router.push({
                  pathname: '/overview/community-chat',
                  params: { id: String(communityId), name: community.name },
                })}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color={colors.text} />
              </Pressable>
            )}
          </View>
        </View>

        {/* TABS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
          {['Discussion', 'Featured', 'People', 'Events', 'Media', 'Files'].map((tab) => (
            <Pressable key={tab} style={[styles.tabItem, tab === 'Discussion' && styles.activeTabItem]}>
              <Text style={[styles.tabText, { color: tab === 'Discussion' ? colors.primary : colors.textSecondary }]}>{tab}</Text>
              {tab === 'Discussion' && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
            </Pressable>
          ))}
        </ScrollView>

        {/* COMPOSER (Only for members) */}
        {community.is_member && (
          <View style={[styles.composerBox, { backgroundColor: colors.card }]}>
            {me?.avatar ? (
              <Image source={{ uri: me.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
            )}
            <Pressable
              style={[styles.composerInput, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/overview/post?communityId=${communityId}`)}
            >
              <Text style={{ color: colors.textMuted }}>Write something...</Text>
            </Pressable>
            <Ionicons name="images-outline" size={24} color={colors.primary} style={{ marginLeft: 8 }} />
          </View>
        )}

        {/* Private Notice */}
        {community.is_private && !community.is_member && (
          <View style={[styles.privateNotice, { backgroundColor: colors.surface }]}>
            <View style={styles.lockIconCircle}>
              <Ionicons name="lock-closed" size={24} color={colors.text} />
            </View>
            <Text style={[styles.privateTitle, { color: colors.text }]}>This group is private</Text>
            <Text style={[styles.privateDesc, { color: colors.textSecondary }]}>
              Join this group to view or participate in discussions.
            </Text>
          </View>
        )}

        <View style={[styles.separator, { backgroundColor: colors.surfaceVariant }]} />
      </View>
    );
  }, [community, me?.avatar, onJoinPress, onLeavePress, router, communityId, colors, me?.username]);

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
  bannerContainer: { width: '100%', height: 220, position: 'relative' },
  banner: { width: '100%', height: '100%' },
  backButtonOverlay: {
    position: 'absolute', top: 40, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerBox: { padding: 16, paddingBottom: 8 },
  communityName: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  subInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 6 },
  subText: { fontSize: 14, fontWeight: '500' },

  actionBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8,
    gap: 6,
  },
  joinedBtn: { borderWidth: 1, backgroundColor: 'transparent' },
  btnText: { fontSize: 15, fontWeight: '600' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },

  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 24,
    position: 'relative',
  },
  activeTabItem: {},
  tabText: { fontSize: 15, fontWeight: '600' },
  activeIndicator: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
    borderTopLeftRadius: 3, borderTopRightRadius: 3,
  },

  composerBox: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  composerInput: {
    flex: 1, borderRadius: 20,
    paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'transparent', // Subtle look
  },

  privateNotice: {
    alignItems: 'center', padding: 32,
    gap: 12,
  },
  lockIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center',
  },
  privateTitle: { fontSize: 18, fontWeight: '700' },
  privateDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

  separator: { height: 8, width: '100%' },
});

function formatCount(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
