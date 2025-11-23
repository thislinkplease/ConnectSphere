import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Pressable, ScrollView, Dimensions, Alert } from 'react-native';
import { AntDesign, Feather, Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { formatCount, formatToVietnamTime } from '@/src/utils/date';
import type { Post } from '@/src/types';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface PostItemProps {
  post: Post;
  onEditClick?: (post: Post) => void;
  onDeleteClick?: (post: Post) => void;
  onCommentClick?: (post: Post) => void;
  onLikeToggle?: (post: Post, nextLiked: boolean) => void;
  initialIsLiked?: boolean;
  showFollowButton?: boolean;
  isFollowingAuthor?: boolean;
  onFollowClick?: (username: string) => void;
  showMoreMenu?: boolean;
}

// Video component for single media
function VideoPlayer({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls
      contentFit="cover"
    />
  );
}

export default function PostItem({
  post,
  onEditClick,
  onDeleteClick,
  onCommentClick,
  onLikeToggle,
  initialIsLiked,
  showFollowButton = false,
  isFollowingAuthor = false,
  onFollowClick = () => { },
  showMoreMenu = true,
}: PostItemProps) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState<boolean>(!!initialIsLiked);
  const [likeCount, setLikeCount] = useState<number>(post?.like_count ?? 0);

  useEffect(() => setIsLiked(!!initialIsLiked), [initialIsLiked, post?.id]);
  useEffect(() => setLikeCount(post?.like_count ?? 0), [post?.like_count, post?.id]);

  const caption = post?.content ?? '';
  const timeAgo = useMemo(() => formatToVietnamTime(post?.created_at), [post?.created_at]);

  const onLikePress = () => {
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    onLikeToggle?.(post, next);
  };

  const avatarUri = post?.authorAvatar;
  const displayName = post?.authorDisplayName || post?.author_username;
  const username = post?.author_username;
  const media = post?.post_media ?? [];

  const handleProfileNavigation = () => {
    if (username) {
      router.push({
        pathname: '/account/profile',
        params: { username },
      });
    }
  };

  return (
    <View style={styles.card}>

      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={handleProfileNavigation} hitSlop={8}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person-circle-outline" size={40} color="#999" />
            </View>
          )}
        </Pressable>

        <Pressable style={{ flex: 1 }} onPress={handleProfileNavigation}>
          <Text style={styles.username} numberOfLines={1}>
            {displayName}
            {post?.community_name ? (
              <Text style={styles.inCommunity}>  in &quot;{post.community_name}&quot;</Text>
            ) : null}
          </Text>
        </Pressable>

        {showMoreMenu && (
          <Pressable hitSlop={8} onPress={() => actionSheet(post, onEditClick, onDeleteClick)}>
            <Feather name="more-vertical" size={22} color="#111" />
          </Pressable>
        )}
      </View>

      {/* Media */}
      {media.length > 0 && (
        media.length === 1 ? (
          media[0].media_type === 'video' ? (
            <VideoPlayer uri={media[0].media_url} style={styles.singleMedia} />
          ) : (
            <Image
              source={{ uri: media[0].media_url }}
              style={styles.singleMedia}
              resizeMode="cover"
            />
          )
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 8 }}>
            {media.map((m, idx) =>
              m.media_type === 'video' ? (
                <VideoPlayer
                  key={m.id ?? idx}
                  uri={m.media_url}
                  style={styles.multiMedia}
                />
              ) : (
                <Image
                  key={m.id ?? idx}
                  source={{ uri: m.media_url }}
                  style={styles.multiMedia}
                  resizeMode="cover"
                />
              )
            )}
          </ScrollView>
        )
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable style={styles.action} onPress={onLikePress} hitSlop={8}>
          <AntDesign name={isLiked ? 'heart' : 'heart'} size={22} color={isLiked ? '#EF4444' : '#111'} />
          <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
        </Pressable>

        <Pressable style={[styles.action, { marginLeft: 16 }]} onPress={() => onCommentClick?.(post)} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={22} color="#111" />
          <Text style={styles.actionCount}>{formatCount(post?.comment_count ?? 0)}</Text>
        </Pressable>
      </View>

      {/* Caption */}
      {(caption?.length || timeAgo) ? (
        <View style={styles.captionWrap}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Pressable onPress={handleProfileNavigation}>
              <Text style={styles.captionUser}>{displayName} </Text>
            </Pressable>
            {!!caption && <Text style={styles.captionText} numberOfLines={2}>{caption}</Text>}
          </View>

          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

    </View>
  );
}

function actionSheet(
  post: Post,
  onEditClick?: (post: Post) => void,
  onDeleteClick?: (post: Post) => void
) {
  Alert.alert(
    'Post Options',
    'Choose an action',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Edit',
        onPress: () => onEditClick?.(post)
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDeleteClick?.(post)
      },
    ]
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#fff',
    marginBottom: 10, // Spacing between cards
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eee',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: '#050505', // Facebook black
  },
  inCommunity: {
    fontSize: 13,
    color: '#65676B', // Facebook gray
    fontWeight: '400',
  },
  timeAgo: {
    fontSize: 12,
    color: '#65676B',
    marginTop: 2,
  },

  captionWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  captionUser: { fontSize: 15, fontWeight: '600', color: '#050505' },
  captionText: { fontSize: 15, color: '#050505', lineHeight: 20 },

  singleMedia: {
    width: '100%',
    height: 400, // Taller for better visibility
    backgroundColor: '#f0f2f5',
  },
  multiMedia: {
    width: SCREEN_WIDTH * 0.8,
    height: 350,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#f0f2f5',
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Spread out like FB
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1, // Equal width buttons
    gap: 6,
    paddingVertical: 4,
  },
  actionCount: {
    fontSize: 14,
    color: '#65676B',
    fontWeight: '600',
  },

  divider: {
    height: 0, // Removed divider, using marginBottom on card instead
  },
});
