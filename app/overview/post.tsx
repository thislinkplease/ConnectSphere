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

const { width } = Dimensions.get('window');

export default function PostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string }>();

  const communityId = useMemo(() => (params?.communityId ? Number(params.communityId) : null), [params?.communityId]);

  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState('followers');
  const [disableComments, setDisableComments] = useState(false);
  const [hideLikeCount, setHideLikeCount] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<LocalMediaFile[]>([]);

  const [meUsername, setMeUsername] = useState<string | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await ApiService.getCurrentUser();
        setMeUsername((me as any)?.username ?? null);
      } catch (e) {
        console.warn('getMe error', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!communityId || !meUsername) return;
    (async () => {
      try {
        setCheckingMembership(true);
        const c = await communityService.getCommunity(communityId, meUsername);
        setCommunity(c as any);
        // Check if user is a member
        setIsMember(c.is_member || false);
        
        // If not a member, show alert and go back
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
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async () => {
    try {
      if (!communityId) {
        Alert.alert('Thiếu thông tin', 'Không xác định được cộng đồng.');
        return;
      }
      if (!meUsername) {
        Alert.alert('Thiếu thông tin', 'Không xác định được người đăng.');
        return;
      }
      if (!caption && selectedMedia.length === 0) {
        Alert.alert('Thiếu nội dung', 'Hãy viết điều gì đó hoặc chọn một ảnh.');
        return;
      }

      // BE /communities/:id/posts chỉ nhận 1 file "image"
      const first = selectedMedia[0];

      await communityService.createCommunityPost(communityId, {
        authorUsername: meUsername,
        content: caption || undefined,
        image: first ? ({
          uri: first.uri,
          name: first.name,
          type: first.type,
        } as any) : undefined,
        audience,
        disableComments,
        hideLikeCount,
      });

      Alert.alert('Đã đăng', 'Bài viết đã được tạo trong cộng đồng.');
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Lỗi', 'Đăng bài không thành công.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Đăng bài vào {community?.name || 'Cộng đồng'}</Text>

      {/* Caption */}
      <TextInput
        style={styles.captionInput}
        placeholder="Viết gì đó..."
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
        <Text style={styles.addMediaText}>Thêm ảnh / video</Text>
      </Pressable>

      {/* Options */}
      <View style={{ marginTop: 24 }}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Tắt bình luận</Text>
          <Switch value={disableComments} onValueChange={setDisableComments} />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Ẩn số lượt thích</Text>
          <Switch value={hideLikeCount} onValueChange={setHideLikeCount} />
        </View>
      </View>

      <Button 
        mode="contained" 
        onPress={onSubmit} 
        style={styles.submitBtn}
        disabled={checkingMembership || !isMember}
      >
        {checkingMembership ? 'Checking...' : 'Đăng bài'}
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
    width: width * 0.6, height: 280, borderRadius: 10, marginRight: 12, backgroundColor: '#eee',
  },
  imageWrap: { position: 'relative' },
  removeBtn: { position: 'absolute', top: 8, right: 8 },
  addMediaBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 },
  addMediaText: { fontSize: 15, fontWeight: '500' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  optionLabel: { fontSize: 16, color: '#111' },
  submitBtn: { marginTop: 24, borderRadius: 25, paddingVertical: 4 },
});
