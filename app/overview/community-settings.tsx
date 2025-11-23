import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import communityService from '@/src/services/communityService';
import type { Community, CommunityJoinRequest } from '@/src/types';

type TabType = 'settings' | 'members' | 'posts' | 'requests';

interface MemberWithUser {
  username: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  user?: {
    username: string;
    name: string;
    avatar?: string;
    bio?: string;
  } | null;
}

export default function CommunitySettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const communityId = Number(params.id);
  const { colors } = useTheme();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [requiresPostApproval, setRequiresPostApproval] = useState(false);
  const [requiresMemberApproval, setRequiresMemberApproval] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCommunity = useCallback(async () => {
    try {
      const data = await communityService.getCommunity(communityId, user?.username);
      setCommunity(data);
      setName(data.name);
      setDescription(data.description || '');
      setIsPrivate(data.is_private || false);
      setRequiresPostApproval(data.requires_post_approval || false);
      setRequiresMemberApproval(data.requires_member_approval || false);

      // Check if current user is admin
      if (user?.username) {
        const role = await communityService.getMemberRole(communityId, user.username);
        setIsAdmin(role === 'admin' || role === 'moderator');
      }
    } catch (error) {
      console.error('Error loading community:', error);
      Alert.alert('Error', 'Failed to load community');
    } finally {
      setLoading(false);
    }
  }, [communityId, user?.username]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await communityService.getCommunityMembers(communityId);
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  }, [communityId]);

  const loadPosts = useCallback(async () => {
    try {
      const data = await communityService.getCommunityPosts(communityId, {
        limit: 50,
        viewer: user?.username
      });
      setPosts(data);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  }, [communityId, user?.username]);

  const loadJoinRequests = useCallback(async () => {
    if (!user?.username || !isAdmin) return;
    try {
      const data = await communityService.getJoinRequests(communityId, user.username);
      setJoinRequests(data);
    } catch (error) {
      console.error('Error loading join requests:', error);
    }
  }, [communityId, user?.username, isAdmin]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    if (activeTab === 'members') {
      loadMembers();
    } else if (activeTab === 'posts') {
      loadPosts();
    } else if (activeTab === 'requests') {
      loadJoinRequests();
    }
  }, [activeTab, loadMembers, loadPosts, loadJoinRequests]);

  const handleSaveSettings = async () => {
    if (!user?.username || !isAdmin) return;

    setSaving(true);
    try {
      await communityService.updateCommunity(communityId, {
        actor: user.username,
        name: name.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
        requires_post_approval: requiresPostApproval,
        requires_member_approval: requiresMemberApproval,
      });

      Alert.alert('Success', 'Community settings updated');
      loadCommunity();
    } catch (error) {
      console.error('Error updating community:', error);
      Alert.alert('Error', 'Failed to update community settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeCover = async () => {
    if (!user?.username || !isAdmin) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const image = {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.fileName || `cover_${Date.now()}.jpg`,
        };

        setSaving(true);
        await communityService.uploadCommunityCover(communityId, user.username, image as any);
        Alert.alert('Success', 'Cover image updated');
        loadCommunity();
        setSaving(false);
      }
    } catch (error) {
      console.error('Error uploading cover:', error);
      Alert.alert('Error', 'Failed to upload cover image');
      setSaving(false);
    }
  };

  const handleChangeAvatar = async () => {
    if (!user?.username || !isAdmin) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const image = {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.fileName || `avatar_${Date.now()}.jpg`,
        };

        setSaving(true);
        await communityService.uploadCommunityAvatar(communityId, user.username, image as any);
        Alert.alert('Success', 'Community avatar updated');
        loadCommunity();
        setSaving(false);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload avatar');
      setSaving(false);
    }
  };

  const handleChangeMemberRole = async (member: MemberWithUser, newRole: 'admin' | 'moderator' | 'member') => {
    if (!user?.username || !isAdmin) return;

    try {
      await communityService.updateMemberRole(communityId, member.username, newRole, user.username);
      Alert.alert('Success', `${member.user?.name || member.username} is now a ${newRole}`);
      loadMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      Alert.alert('Error', 'Failed to update member role');
    }
  };

  const handleKickMember = async (member: MemberWithUser) => {
    if (!user?.username || !isAdmin) return;

    Alert.alert(
      'Kick Member',
      `Are you sure you want to kick ${member.user?.name || member.username} from the community?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.kickMember(communityId, member.username, user.username);
              Alert.alert('Success', 'Member kicked from community');
              loadMembers();
            } catch (error) {
              console.error('Error kicking member:', error);
              Alert.alert('Error', 'Failed to kick member');
            }
          },
        },
      ]
    );
  };

  const handleDeletePost = async (post: any) => {
    if (!user?.username || !isAdmin) return;

    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.deleteCommunityPost(communityId, post.id, user.username);
              Alert.alert('Success', 'Post deleted successfully');
              loadPosts();
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleReviewRequest = async (request: CommunityJoinRequest, action: 'approve' | 'reject') => {
    if (!user?.username || !isAdmin) return;

    try {
      await communityService.reviewJoinRequest(communityId, request.id, action, user.username);
      Alert.alert('Success', `Request ${action === 'approve' ? 'approved' : 'rejected'}`);
      loadJoinRequests();
      if (action === 'approve') {
        loadMembers();
      }
    } catch (error) {
      console.error('Error reviewing request:', error);
      Alert.alert('Error', 'Failed to review request');
    }
  };

  const renderMember = ({ item }: { item: MemberWithUser }) => (
    <View style={[styles.memberItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.memberInfo}>
        {item.user?.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.memberAvatar} />
        ) : (
          <View style={[styles.memberAvatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="person" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.memberDetails}>
          <Text style={[styles.memberName, { color: colors.text }]}>{item.user?.name || item.username}</Text>
          <View style={styles.memberRoleContainer}>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
              <Text style={styles.roleText}>{item.role}</Text>
            </View>
          </View>
        </View>
      </View>
      {isAdmin && item.username !== user?.username && item.username !== community?.created_by && (
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Manage Member',
              `What would you like to do with ${item.user?.name || item.username}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                ...(item.role !== 'admin' ? [{ text: 'Make Admin', onPress: () => handleChangeMemberRole(item, 'admin') }] : []),
                ...(item.role !== 'moderator' ? [{ text: 'Make Moderator', onPress: () => handleChangeMemberRole(item, 'moderator') }] : []),
                ...(item.role !== 'member' ? [{ text: 'Demote to Member', onPress: () => handleChangeMemberRole(item, 'member') }] : []),
                { text: 'Kick', style: 'destructive', onPress: () => handleKickMember(item) },
              ]
            );
          }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPost = ({ item }: { item: any }) => (
    <View style={[styles.postItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.postHeader}>
        <View style={styles.postAuthor}>
          <Text style={[styles.postAuthorName, { color: colors.text }]}>
            {item.authorDisplayName || item.author_username}
          </Text>
          <Text style={[styles.postDate, { color: colors.textMuted }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDeletePost(item)}>
          <Ionicons name="trash-outline" size={20} color={colors.error || '#EF4444'} />
        </TouchableOpacity>
      </View>
      {item.content && (
        <Text style={[styles.postContent, { color: colors.text }]} numberOfLines={3}>
          {item.content}
        </Text>
      )}
      {item.post_media && item.post_media.length > 0 && (
        <Image
          source={{ uri: item.post_media[0].media_url }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.postStats}>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={16} color={colors.textMuted} />
          <Text style={[styles.statText, { color: colors.textMuted }]}>
            {item.like_count || 0}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="chatbubble" size={16} color={colors.textMuted} />
          <Text style={[styles.statText, { color: colors.textMuted }]}>
            {item.comment_count || 0}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderJoinRequest = ({ item }: { item: CommunityJoinRequest }) => (
    <View style={[styles.requestItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.memberInfo}>
        {item.users?.avatar ? (
          <Image source={{ uri: item.users.avatar }} style={styles.memberAvatar} />
        ) : (
          <View style={[styles.memberAvatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="person" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.memberDetails}>
          <Text style={[styles.memberName, { color: colors.text }]}>{item.users?.name || item.username}</Text>
          {item.users?.bio && (
            <Text style={[styles.memberBio, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.users.bio}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.approveButton, { backgroundColor: colors.primary }]}
          onPress={() => handleReviewRequest(item, 'approve')}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rejectButton, { backgroundColor: colors.error || '#EF4444' }]}
          onPress={() => handleReviewRequest(item, 'reject')}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={colors.disabled} />
          <Text style={[styles.errorText, { color: colors.textMuted }]}>
            Only admins can access community settings
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Community Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View
        style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && [styles.activeTabText, { color: colors.primary }]]}>
            Settings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('members')}
        >
          <Text style={[styles.tabText, activeTab === 'members' && [styles.activeTabText, { color: colors.primary }]]}>
            Members
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && [styles.activeTabText, { color: colors.primary }]]}>
            Posts
          </Text>
        </TouchableOpacity>
        {isPrivate && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && [styles.activeTabText, { color: colors.primary }]]}>
              Requests {joinRequests.length > 0 && `(${joinRequests.length})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {activeTab === 'settings' && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Cover Image */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Cover Image</Text>
            <TouchableOpacity
              style={[styles.coverImageContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleChangeCover}
            >
              {community?.image_url ? (
                <Image source={{ uri: community.image_url }} style={styles.coverImage} />
              ) : (
                <View style={styles.coverImagePlaceholder}>
                  <Ionicons name="image-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Tap to change cover</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Community Name */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Community Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Community name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Community description"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>

          {/* Privacy */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Private Community</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Only members can see posts.
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={isPrivate ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Member Approval */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Require Member Approval</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Admins must approve new members.
                </Text>
              </View>
              <Switch
                value={requiresMemberApproval}
                onValueChange={setRequiresMemberApproval}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={requiresMemberApproval ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Post Approval */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Require Post Approval</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Admins must approve posts from members.
                </Text>
              </View>
              <Switch
                value={requiresPostApproval}
                onValueChange={setRequiresPostApproval}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={requiresPostApproval ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSaveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {activeTab === 'members' && (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item) => item.username}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.disabled} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No members yet</Text>
            </View>
          }
        />
      )}

      {activeTab === 'posts' && (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={colors.disabled} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts yet</Text>
            </View>
          }
        />
      )}

      {activeTab === 'requests' && (
        <FlatList
          data={joinRequests}
          renderItem={renderJoinRequest}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-outline" size={64} color={colors.disabled} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No pending requests</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'admin':
      return '#EF4444';
    case 'moderator':
      return '#F59E0B';
    default:
      return '#10B981';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {},
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  coverImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    marginTop: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberDetails: {
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
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
  },
  memberBio: {
    fontSize: 13,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  postItem: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  postAuthor: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  postDate: {
    fontSize: 12,
  },
  postContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
  },
});
