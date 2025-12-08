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
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ApiService from '@/src/services/api';
import communityService, { CommunityPost } from '@/src/services/communityService';
import type { Community, User, UserLite, CommunityEvent } from '@/src/types';
import PostItem from '@/components/posts/post_item';
import CommentsSheet from '@/components/posts/comments_sheet';
import { useTheme } from '@/src/context/ThemeContext';
import { postService } from '@/src/services/postService';
import WebSocketService from '@/src/services/websocket';

type TabType = 'Discussion' | 'People' | 'Events' | 'Details';

export default function CommunityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const communityId = useMemo(() => Number(id), [id]);
  const { colors } = useTheme();

  const [me, setMe] = useState<User | null>(null);
  const [community, setCommunity] = useState<(Community & { is_member?: boolean; membership_status?: 'pending' | 'approved' | null }) | null>(null);
  const cover = community?.cover_image || community?.image_url;
  const [myRole, setMyRole] = useState<'admin' | 'moderator' | 'member' | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('Discussion');

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const [owner, setOwner] = useState<User | null>(null);

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

  // Load members when People tab is active
  const loadMembers = useCallback(async () => {
    try {
      const data = await communityService.getCommunityMembers(communityId);

      const order: Record<'admin' | 'moderator' | 'member', number> = {
        admin: 1,
        moderator: 2,
        member: 3,
      };
      const sorted = [...data].sort((a, b) => {
        return order[a.role as keyof typeof order] - order[b.role as keyof typeof order];
      });

      setMembers(sorted);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  }, [communityId]);

  // Load events when Events tab is active
  const loadEvents = useCallback(async () => {
    if (!communityId) return;
    try {
      setLoadingEvents(true);
      const data = await communityService.getCommunityEvents(communityId, me?.username);
      setEvents(data);
    } catch (e) {
      console.error('load events error', e);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [communityId, me?.username]);

  useEffect(() => {
    if (activeTab === 'People') {
      loadMembers();
    } else if (activeTab === 'Events') {
      loadEvents();
    }
  }, [activeTab, loadMembers, loadEvents]);

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

  useEffect(() => {
    if (!communityId) return;
    (async () => {
      try {
        setLoading(true);
        const viewer = me?.username;

        if (me?.username) {
          const role = await communityService.getMemberRole(communityId, me.username);
          setMyRole(role);
        }

        const c = await communityService.getCommunity(communityId, viewer);
        setCommunity(c);

        if (c?.created_by) {
          try {
            const ownerData = await ApiService.getUserByUsername(c.created_by);
            setOwner(ownerData);
          } catch (e) {
            console.warn("Failed to fetch owner info", e);
          }
        }

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
      
      // Check if community requires approval - if so, set pending status
      const requiresApproval = community?.requires_member_approval || community?.is_private;
      if (requiresApproval) {
        setCommunity((prev) => prev ? { ...prev, membership_status: 'pending' } : prev);
        Alert.alert(
          'Request Sent',
          'This community requires approval. Your join request has been sent to the admins.',
          [{ text: 'OK' }]
        );
      } else {
        setCommunity((prev) => prev ? { ...prev, is_member: true, membership_status: 'approved', member_count: (prev.member_count ?? 0) + 1 } : prev);
        
        // IMPROVED: Notify WebSocket server about community join to ensure conversation is ready
        if (WebSocketService.isConnected()) {
          WebSocketService.notifyCommunityJoined(communityId, me.username);
        }
      }
    } catch (e: any) {
      if (e.message === 'REQUIRES_REQUEST') {
        setCommunity((prev) => prev ? { ...prev, membership_status: 'pending' } : prev);
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
  }, [communityId, me?.username, community]);

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
              setCommunity((prev) => prev ? { ...prev, is_member: false, membership_status: null, member_count: Math.max(0, (prev.member_count ?? 0) - 1) } : prev);
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

  // Cancel pending join request
  const onCancelRequest = useCallback(async () => {
    if (!communityId || !me?.username) return;

    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel your join request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.leaveCommunity(communityId, me.username!);
              setCommunity((prev) => prev ? { ...prev, membership_status: null } : prev);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to cancel request.');
            }
          }
        }
      ]
    );
  }, [communityId, me?.username]);

  const onLikeToggle = useCallback(
    async (post: CommunityPost, nextLiked: boolean) => {
      if (!me?.username) return;

      try {
        if (nextLiked) {
          const res = await postService.like(post.id);

          setPosts(prev =>
            prev.map(p =>
              p.id === post.id
                ? {
                    ...p,
                    like_count: res?.like_count ?? (p.like_count || 0) + 1,
                  }
                : p
            )
          );
        } else {
          const res = await postService.unlike(post.id);

          setPosts(prev =>
            prev.map(p =>
              p.id === post.id
                ? {
                    ...p,
                    like_count: res?.like_count ?? Math.max(0, (p.like_count || 0) - 1),
                  }
                : p
            )
          );
        }
      } catch (e) {
        console.error(e);
      }
    },
    [me?.username]
  );

  const renderHeader = useMemo(() => {
    if (!community) return null;

    // Helper to render People tab content
    const renderPeopleContent = () => (
      <View style={[styles.tabContentContainer, { backgroundColor: colors.background }]}>
        {members.length === 0 ? (
          <View style={styles.emptyTabContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTabText, { color: colors.textMuted }]}>No members yet</Text>
          </View>
        ) : (
          members.map((member) => (
            <TouchableOpacity 
              key={member.username} 
              style={[styles.memberItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              onPress={() => router.push(`/account/profile?username=${member.username}`)}
            >
              {member.user?.avatar ? (
                <Image source={{ uri: member.user.avatar }} style={styles.memberAvatar} />
              ) : (
                <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder, { backgroundColor: colors.border }]}>
                  <Ionicons name="person" size={24} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {member.user?.name || member.username}
                </Text>
                <View style={styles.memberRoleContainer}>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role) }]}>
                    <Text style={styles.roleText}>{member.role}</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </View>
    );

    // Helper to render Details tab content
    const renderDetailsContent = () => (
      <View style={[styles.tabContentContainer, { backgroundColor: colors.background, padding: 16 }]}>
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>About this community</Text>
          <Text style={[styles.detailsText, { color: colors.textSecondary }]}>
            {community.description || community.bio || 'No description available'}
          </Text>
          
          <View style={[styles.detailsDivider, { backgroundColor: colors.border }]} />
          
          <Text style={[styles.detailsSubtitle, { color: colors.text }]}>Community Info</Text>
          <View style={styles.detailsRow}>
            <Ionicons name={community.is_private ? "lock-closed" : "globe"} size={18} color={colors.textSecondary} />
            <Text style={[styles.detailsRowText, { color: colors.textSecondary }]}>
              {community.is_private ? 'Private group' : 'Public group'}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Ionicons name="people" size={18} color={colors.textSecondary} />
            <Text style={[styles.detailsRowText, { color: colors.textSecondary }]}>
              {community.member_count ?? 0} members
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Ionicons name="calendar" size={18} color={colors.textSecondary} />
            <Text style={[styles.detailsRowText, { color: colors.textSecondary }]}>
              Created {new Date(community.created_at).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={[styles.detailsDivider, { backgroundColor: colors.border }]} />
          
          <Text style={[styles.detailsSubtitle, { color: colors.text }]}>Owner</Text>
          <TouchableOpacity 
            style={styles.ownerRow}
            onPress={() => router.push(`/account/profile?username=${community.created_by}`)}
          >
            <View style={styles.ownerRow}>
              {owner?.avatar ? (
                <Image source={{ uri: owner.avatar }} style={styles.ownerAvatar} />
              ) : (
                <View style={[styles.ownerAvatar, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={20} color={colors.textMuted} />
                </View>
              )}

              <Text style={[styles.ownerName, { color: colors.text }]}>
                {owner?.name || community.created_by}
              </Text>

              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );

    // Helper function to format event date
    const formatEventDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatEventTime = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    // Helper to render Events tab content  
    const renderEventsContent = () => (
      <View style={[styles.tabContentContainer, { backgroundColor: colors.background, padding: 16 }]}>
        {/* Create Event Button - only for members */}
        {(myRole === 'admin' || myRole === 'moderator') && (
          <TouchableOpacity
            style={[styles.createEventButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push({
              pathname: '/overview/create-community-event',
              params: { communityId: String(communityId), communityName: community.name },
            })}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.createEventButtonText}>Create Event</Text>
          </TouchableOpacity>
        )}

        {loadingEvents ? (
          <View style={styles.emptyTabContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyTabContainer}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTabText, { color: colors.textMuted }]}>No events scheduled</Text>
            <Text style={[styles.emptyTabSubtext, { color: colors.textMuted }]}>
              {community.is_member 
                ? 'Be the first to create an event!' 
                : 'Join this community to create events'}
            </Text>
          </View>
        ) : (
          <View>
            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({
                  pathname: '/overview/community-event-detail',
                  params: { communityId: String(communityId), eventId: String(event.id) },
                })}
              >
                {event.image_url && (
                  <Image source={{ uri: event.image_url }} style={styles.eventImage} />
                )}
                <View style={styles.eventContent}>
                  <View style={[styles.eventDateBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="calendar" size={14} color={colors.primary} />
                    <Text style={[styles.eventDateText, { color: colors.primary }]}>
                      {formatEventDate(event.start_time)} • {formatEventTime(event.start_time)}
                    </Text>
                  </View>
                  <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>
                    {event.name}
                  </Text>
                  {event.location && (
                    <View style={styles.eventLocationRow}>
                      <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.eventLocation, { color: colors.textMuted }]} numberOfLines={1}>
                        {event.location}
                      </Text>
                    </View>
                  )}
                  <View style={styles.eventStatsRow}>
                    <View style={styles.eventStatItem}>
                      <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.eventStatText, { color: colors.textMuted }]}>
                        {event.participant_count || 0} going
                      </Text>
                    </View>
                    {event.is_going && (
                      <View style={[styles.goingBadge, { backgroundColor: colors.success || '#10B981' }]}>
                        <Text style={styles.goingBadgeText}>Going ✓</Text>
                      </View>
                    )}
                    {event.is_interested && !event.is_going && (
                      <View style={[styles.goingBadge, { backgroundColor: colors.warning || '#F59E0B' }]}>
                        <Text style={styles.goingBadgeText}>Interested</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );

    return (
      <View style={{ backgroundColor: colors.card }}>
        {/* TOP BANNER - Full Width 16:9 */}
        <View style={styles.bannerContainer}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.banner} />
          ) : (
            <View style={[styles.banner, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="people" size={64} color="rgba(255,255,255,0.5)" />
            </View>
          )}
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
              </>
            ) : community.membership_status === 'pending' ? (
              <Pressable style={[styles.actionBtn, styles.pendingBtn, { borderColor: colors.warning, backgroundColor: colors.highlight }]} onPress={onCancelRequest}>
                <Ionicons name="time-outline" size={18} color={colors.warning} style={{ marginRight: 6 }} />
                <Text style={[styles.btnText, { color: colors.warning }]}>Pending Approval</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={onJoinPress}>
                <Text style={[styles.btnText, { color: '#fff', fontWeight: '600' }]}>Join Group</Text>
              </Pressable>
            )}

            {/* Manage / Settings */}
            {myRole === 'admin' || myRole === 'moderator' || me?.username === community.created_by ? (
                <Pressable
                  style={[styles.iconBtn, { backgroundColor: colors.surface }]}
                  onPress={() => router.push({
                    pathname: '/overview/community-settings',
                    params: { id: String(communityId) },
                  })}
                >
                  <Ionicons name="shield-checkmark" size={20} color={colors.text} />
                </Pressable>
            ) : null}
                   

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
          {(['Discussion', 'People', 'Events', 'Details'] as TabType[]).map((tab) => (
            <Pressable 
              key={tab} 
              style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>{tab}</Text>
              {activeTab === tab && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
            </Pressable>
          ))}
        </ScrollView>

        {/* COMPOSER (Only for members on Discussion tab) */}
        {community.is_member && activeTab === 'Discussion' && (
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
        {community.is_private && !community.is_member && activeTab === 'Discussion' && (
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

        {/* Tab Content */}
        {activeTab === 'People' && renderPeopleContent()}
        {activeTab === 'Events' && renderEventsContent()}
        {activeTab === 'Details' && renderDetailsContent()}

        {activeTab === 'Discussion' && <View style={[styles.separator, { backgroundColor: colors.surfaceVariant }]} />}
      </View>
    );
  }, [community, me?.avatar, onJoinPress, onLeavePress, onCancelRequest, router, communityId, colors, me?.username, activeTab, members, events, loadingEvents]);

  const renderItem = useCallback(({ item }: { item: CommunityPost }) => {
    return (
      <PostItem
        post={item}
        meUsername={me?.username ?? "user"}

        onEditClick={(p) => {
          router.push(`/overview/post?edit=1&postId=${p.id}`); 
        }}

        onDeleteClick={async (p) => {
          Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await postService.delete(p.id, me?.username!);

                    setPosts((prev) => prev.filter((x) => x.id !== p.id));

                    Alert.alert("Success", "Post deleted.");
                  } catch (err) {
                    console.error(err);
                    Alert.alert("Error", "Failed to delete post.");
                  }
                }
              }
            ]
          );
        }}

        onCommentClick={(p) => {
          setSelectedPostId(p.id);
          setCommentsVisible(true);
        }}

        onLikeToggle={(p, liked) => onLikeToggle(p as any, liked)}
        initialIsLiked={item.isLikedByViewer ?? false}
      />
    );
  }, [onLikeToggle, me?.username]);



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
        data={activeTab === 'Discussion' ? posts : []}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        onEndReachedThreshold={0.3}
        onEndReached={activeTab === 'Discussion' ? loadMore : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListFooterComponent={
          activeTab === 'Discussion' && hasMore ? (
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
  joinedBtn: { 
    borderWidth: 1, 
    backgroundColor: 'transparent',
    flex: 1
  },
  pendingBtn: {
    borderWidth: 1,
    flex: 1
  },
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
    paddingHorizontal: 8,
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

  // Tab Content Styles
  tabContentContainer: {
    minHeight: 200,
  },
  emptyTabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTabText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyTabSubtext: {
    fontSize: 14,
    marginTop: 4,
  },

  // Member List Styles
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },

  // Details Tab Styles
  detailsCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsDivider: {
    height: 1,
    marginVertical: 16,
  },
  detailsSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  detailsRowText: {
    fontSize: 14,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ownerName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },

  // Event Tab Styles
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  createEventButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  eventCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  eventImage: {
    width: '100%',
    height: 140,
  },
  eventContent: {
    padding: 14,
  },
  eventDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    gap: 4,
  },
  eventDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  eventLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  eventLocation: {
    fontSize: 13,
    flex: 1,
  },
  eventStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventStatText: {
    fontSize: 13,
  },
  goingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

function formatCount(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Role badge colors - intentionally fixed colors for consistent role identification
const ROLE_COLORS = {
  admin: '#EF4444',     // Red for admin
  moderator: '#F59E0B', // Orange/amber for moderator
  member: '#10B981',    // Green for member
} as const;

function getRoleColor(role: string): string {
  switch (role) {
    case 'admin':
      return ROLE_COLORS.admin;
    case 'moderator':
      return ROLE_COLORS.moderator;
    default:
      return ROLE_COLORS.member;
  }
}
