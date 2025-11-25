import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Image, Pressable, StyleSheet, Alert, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Switch } from 'react-native-paper';
import { AntDesign } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ApiService from '@/src/services/api';
import communityService from '@/src/services/communityService';
import type { LocalMediaFile, Community } from '@/src/types';
import { postService } from '@/src/services/postService';

const { width } = Dimensions.get('window');

export default function PostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    communityId?: string;
    edit?: string;
    postId?: string;
  }>();

  const isEditMode = params.edit === "1";
  const postId = params.postId;
  const [isLoadedEditPost, setIsLoadedEditPost] = useState(false);

  const communityId = useMemo(() => (params?.communityId ? Number(params.communityId) : null), [params?.communityId]);

  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState('followers');
  const [disableComments, setDisableComments] = useState(false);
  const [hideLikeCount, setHideLikeCount] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<LocalMediaFile[]>([]);
  const [editCommunityId, setEditCommunityId] = useState<number | null>(null);

  const [meUsername, setMeUsername] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const me = await ApiService.getCurrentUser();
        setMeUsername(me?.username ?? null);
      } catch (e) {
        console.warn("Failed to load current user:", e);
      }
    })();
  }, []);

  const [community, setCommunity] = useState<Community | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    if (!isEditMode || !postId || !meUsername) return;

    (async () => {
      try {
        const post = await postService.getById(Number(postId), meUsername);

        setCaption(post.content ?? "");

        const converted = post.post_media.map(m => ({
          id: m.id,
          uri: m.media_url,
          type: m.media_type === "video" ? "video/mp4" : "image/jpeg",
          name: `old_${m.id}`,
        }));

        setSelectedMedia(converted as any);
        setEditCommunityId(post.community_id ?? null);
        setIsLoadedEditPost(true);
      } catch (error) {
        console.error("Load edit post failed:", error);
        Alert.alert("Error", "Cannot load the post to edit.");
        router.back();
      }
    })();
  }, [isEditMode, postId, meUsername]);


  useEffect(() => {
    if (!communityId || !meUsername) return;
    (async () => {
      try {
        setCheckingMembership(true);
        const c = await communityService.getCommunity(communityId, meUsername);
        setCommunity(c as any);
        setIsMember(c.is_member || false);

        try {
          const role = await communityService.getMemberRole(communityId, meUsername);
          setIsAdmin(role === "admin" || role === "moderator");
        } catch (e) {
          console.warn("Failed to load member role:", e);
        }

        if (!c.is_member) {
          Alert.alert(
            'Not a Member',
            'You must be a member of this community to create posts.',
            [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]
          );
        }
      } catch (e) {
        console.warn(e);
        Alert.alert('Error', 'Failed to load community information.');
        router.back();
      } finally {
        setCheckingMembership(false);
      }
    })();
  }, [communityId, meUsername, router]);

  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!result.canceled) {
      const picked = (result.assets || []).map((a, idx) => ({
        uri: a.uri,
        name: a.fileName || `media_${Date.now()}_${idx}`,
        type: a.mimeType || 'image/jpeg',
      })) as LocalMediaFile[];
      setSelectedMedia((prev) => [...prev, ...picked]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async () => {
    try {
      if (!meUsername) {
        Alert.alert("Error", "Cannot identify user.");
        return;
      }
      if (isSubmitting) return; 
      setIsSubmitting(true);

      const status = community?.requires_post_approval ? "pending" : "approved";

      // =============== EDIT MODE ===============
      if (isEditMode && postId) {
        const oldMedia = selectedMedia.filter(m => m.id);
        const newMedia = selectedMedia.filter(m => !m.id);

        await postService.update(Number(postId), {
          author_username: meUsername,
          content: caption,
          audience,
          disable_comments: disableComments,
          hide_like_count: hideLikeCount,
          community_id: editCommunityId, 
          status: status,
        });

        const fullPost = await postService.getById(Number(postId), meUsername);
        const originalMedia = fullPost.post_media.map(m => m.id);

        for (const originalId of originalMedia) {
          const stillExist = oldMedia.find(m => m.id === originalId);
          if (!stillExist) {
            await postService.removeMedia(Number(postId), originalId, meUsername);
          }
        }

        if (newMedia.length > 0) {
          await postService.uploadMedia(Number(postId), newMedia as any);
        }

        Alert.alert("Success", "The post has been updated.");

        router.back();
        return;
      }

      // =============== CREATE MODE ===============
      if (!communityId) {
        Alert.alert("Error", "Missing communityId.");
        return;
      }

      if (!caption && selectedMedia.length === 0) {
        Alert.alert("Missing content", "Please write something or select a photo/video.");
        return;
      }

      const created = await postService.create({
        author_username: meUsername,
        content: caption,
        audience,
        disable_comments: disableComments,
        hide_like_count: hideLikeCount,
        community_id: Number(communityId),
        status: status,
      });

      if (selectedMedia.length > 0) {
        await postService.uploadMedia(created.id, selectedMedia as any);
      }

      if (community?.requires_post_approval && !isAdmin) {
        Alert.alert("Pending Approval", "Your post is awaiting admin review.");
      } else {
        Alert.alert("Success", "Your post has been shared successfully!");
      }

      router.back();
      
    } catch (error) {
      setIsSubmitting(false);
      console.error(error);
      Alert.alert("Error", "Unable to process the request.");
    }
  };


  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Post to {community?.name || 'Community'}</Text>

      {/* Caption */}
      <TextInput
        style={styles.captionInput}
        placeholder="Write something..."
        placeholderTextColor="#999"
        multiline
        value={caption}
        onChangeText={setCaption}
      />

      {/* Preview media */}
      {selectedMedia.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {selectedMedia.map((m, idx) => (
            <View key={idx} style={styles.imageWrap}>
              <Image source={{ uri: m.uri }} style={styles.previewImage} />
              <Pressable style={styles.removeBtn} onPress={() => handleRemoveImage(idx)}>
                <AntDesign name="close-circle" size={20} color="#f87171" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Pressable onPress={handlePickMedia} style={styles.addMediaBtn}>
        <AntDesign name="plus-circle" size={22} />
        <Text style={styles.addMediaText}>Add photo / video</Text>
      </Pressable>

      <Button
        mode="contained"
        onPress={onSubmit}
        disabled={isSubmitting}
        style={styles.submitBtn}
      >
        {isSubmitting
          ? (isEditMode ? "Saving..." : "Posting...")
          : (isEditMode ? "Save Changes" : "Share Post")
        }
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 12 },
  captionInput: {
    minHeight: 120,
    borderWidth: 1, borderColor: '#eee', borderRadius: 12,
    padding: 12, fontSize: 15, color: '#111',
  },
  previewImage: {
    width: width * 0.85, height: 280, borderRadius: 10, marginRight: 12, backgroundColor: '#eee',
  },
  imageWrap: { position: 'relative' },
  removeBtn: { position: 'absolute', top: 8, right: 23 },
  addMediaBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 },
  addMediaText: { fontSize: 15, fontWeight: '500' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  optionLabel: { fontSize: 16, color: '#111' },
  submitBtn: { marginTop: 24, borderRadius: 25, paddingVertical: 4, backgroundColor: '#038dffff' },
});
