import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import communityService from '@/src/services/communityService';
import ImageService from '@/src/services/image';

export default function CreateCommunityScreen() {
  const router = useRouter();
  const { colors, isPro } = useTheme();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [coverImage, setCoverImage] = useState<{ uri: string; type: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is PRO, if not, redirect them
    if (!isPro) {
      Alert.alert(
        'PRO Feature',
        'Creating communities requires a PRO subscription. Upgrade to PRO to create your own community!',
        [
          { text: 'Cancel', onPress: () => router.back(), style: 'cancel' },
          {
            text: 'Upgrade to PRO',
            onPress: () => {
              router.back();
              router.push('/account/payment-pro');
            },
          },
        ]
      );
    }
  }, [isPro, router]);

  const handlePickCoverImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setCoverImage({
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.fileName || `cover_${Date.now()}.jpg`,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Community name is required');
      return;
    }

    if (!user?.username) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);

    try {
      // Create the community
      const community = await communityService.createCommunity({
        created_by: user.username,
        name: name.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
      });

      // Upload cover image if provided
      if (coverImage && community.id) {
        try {
          await communityService.uploadCommunityCover(
            community.id,
            user.username,
            coverImage as any
          );
        } catch (err) {
          console.warn('Failed to upload cover image:', err);
          // Continue anyway, community was created
        }
      }

      Alert.alert('Success', 'Community created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
            router.push({
              pathname: '/overview/community',
              params: { id: String(community.id) },
            });
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating community:', error);
      
      if (error.message === 'PRO_REQUIRED') {
        Alert.alert(
          'PRO Required',
          'Creating communities requires a PRO subscription.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upgrade to PRO',
              onPress: () => {
                router.back();
                router.push('/account/payment-pro');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to create community. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isPro) {
    return null; // Alert will show and redirect
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Community</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cover Image */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Cover Image (Optional)</Text>
          <TouchableOpacity
            style={[styles.coverImageContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handlePickCoverImage}
          >
            {coverImage ? (
              <Image source={{ uri: coverImage.uri }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverImagePlaceholder}>
                <Ionicons name="image-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.coverImageText, { color: colors.textMuted }]}>Tap to add cover image</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Community Name */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Community Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter community name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Description (Optional)</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="Describe your community..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        {/* Privacy Setting */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={[styles.label, { color: colors.text }]}>Private Community</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Members must request to join and be approved by admins
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

        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            As the creator, you will be the admin of this community. You can add other admins and manage members.
          </Text>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={handleCreate}
          disabled={loading || !name.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Community</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
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
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
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
  coverImageText: {
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
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 12,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
