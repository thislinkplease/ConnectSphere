import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import ApiService from '@/src/services/api';
import ImageService from '@/src/services/image';
import { User } from '@/src/types';

const HANGOUT_ACTIVITIES = [
  'coffee-chat',
  'grab-a-drink',
  'explore-the-city',
  'outdoor-activities',
  'cultural-activities',
  'sports',
  'party',
  'restaurant',
  'shopping',
  'museum',
  'concert',
  'hiking',
];

const STATUS_OPTIONS = ['Traveling', 'Learning', 'Chilling', 'Open to Chat'] as const;

export default function EditProfileScreen() {
  const router = useRouter();
  const { user: currentUser, updateUser: updateAuthUser } = useAuth();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [country, setCountry] = useState(currentUser?.country || '');
  const [status, setStatus] = useState<typeof STATUS_OPTIONS[number]>(currentUser?.status || 'Open to Chat');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [selectedActivities, setSelectedActivities] = useState<string[]>(currentUser?.hangoutActivities || []);
  const [interests, setInterests] = useState<string[]>(currentUser?.interests || []);
  const [newInterest, setNewInterest] = useState('');
  const [languages, setLanguages] = useState(currentUser?.languages || []);
  const [newLanguage, setNewLanguage] = useState({ name: '', level: 'Intermediate' as const });
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | undefined>(currentUser?.gender);
  const [age, setAge] = useState(currentUser?.age?.toString() || '');

  const handleAvatarPick = async () => {
    try {
      const image = await ImageService.pickImageFromGallery({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!image) return;

      if (!ImageService.validateImageSize(image, 5)) {
        Alert.alert('Error', 'Image size must be less than 5MB');
        return;
      }

      setUploading(true);

      // Create file object for upload
      const imageFile: any = {
        uri: image.uri,
        type: image.type,
        name: image.name,
      };

      // Upload avatar
      if (currentUser?.id) {
        const result = await ApiService.uploadAvatar(currentUser.id, imageFile);
        setAvatar(result.avatarUrl);
        Alert.alert('Success', 'Avatar updated successfully!');
      }

      setUploading(false);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload avatar');
      setUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const image = await ImageService.takePhoto({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!image) return;

      if (!ImageService.validateImageSize(image, 5)) {
        Alert.alert('Error', 'Image size must be less than 5MB');
        return;
      }

      setUploading(true);

      const imageFile: any = {
        uri: image.uri,
        type: image.type,
        name: image.name,
      };

      if (currentUser?.id) {
        const result = await ApiService.uploadAvatar(currentUser.id, imageFile);
        setAvatar(result.avatarUrl);
        Alert.alert('Success', 'Avatar updated successfully!');
      }

      setUploading(false);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
      setUploading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Update Avatar',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handleAvatarPick },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const toggleActivity = (activity: string) => {
    setSelectedActivities(prev => 
      prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    );
  };

  const addInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const addLanguage = () => {
    if (newLanguage.name.trim() && !languages.find(l => l.name === newLanguage.name)) {
      setLanguages([...languages, { name: newLanguage.name.trim(), level: newLanguage.level }]);
      setNewLanguage({ name: '', level: 'Intermediate' });
    }
  };

  const removeLanguage = (languageName: string) => {
    setLanguages(languages.filter(l => l.name !== languageName));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (!city.trim() || !country.trim()) {
      Alert.alert('Error', 'City and country are required');
      return;
    }

    setLoading(true);

    try {
      // Fetch the latest user data to get the correct ID
      const freshUser = currentUser?.username 
        ? await ApiService.getUserByUsername(currentUser.username)
        : null;

      if (!freshUser?.id) {
        Alert.alert('Error', 'Unable to update profile. Please try logging in again.');
        return;
      }

      const updatedUser: Partial<User> = {
        name,
        bio,
        city,
        country,
        status,
        avatar,
        hangoutActivities: selectedActivities,
        interests,
        languages,
        gender,
        age: age ? parseInt(age) : undefined,
      };

      const result = await ApiService.updateUser(freshUser.id, updatedUser);
      
      // Update auth context
      if (updateAuthUser) {
        updateAuthUser(result);
      }

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      
      // Handle specific error cases
      if (error?.response?.status === 500) {
        Alert.alert(
          'Error', 
          'Unable to update profile. Your session may have expired. Please try logging in again.',
          [
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else if (error?.response?.status === 404) {
        Alert.alert(
          'Error', 
          'User not found. Please try logging in again.',
          [
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerRight: () => (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView style={styles.scrollView}>
          {/* Avatar Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Photo</Text>
            <TouchableOpacity style={styles.avatarContainer} onPress={showImageOptions}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={[styles.avatar, { borderColor: colors.primary }]} />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                  <Ionicons name="person" size={60} color={colors.textMuted} />
                </View>
              )}
              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>Tap to change photo</Text>
          </View>

          {/* Basic Info Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>City *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={city}
                onChangeText={setCity}
                placeholder="Enter your city"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Country *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={country}
                onChangeText={setCountry}
                placeholder="Enter your country"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Gender</Text>
              <View style={styles.genderContainer}>
                {(['Male', 'Female', 'Other'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderButton,
                      { borderColor: colors.border },
                      gender === g && [styles.genderButtonActive, { borderColor: colors.primary, backgroundColor: colors.highlight }]
                    ]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      { color: colors.text },
                      gender === g && [styles.genderButtonTextActive, { color: colors.primary }]
                    ]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Age</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={age}
                onChangeText={setAge}
                placeholder="Enter your age"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Status Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
            <View style={styles.statusContainer}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusButton,
                    { borderColor: colors.border },
                    status === s && [styles.statusButtonActive, { borderColor: colors.primary, backgroundColor: colors.highlight }]
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[
                    styles.statusButtonText,
                    { color: colors.text },
                    status === s && [styles.statusButtonTextActive, { color: colors.primary }]
                  ]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Languages Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Languages</Text>
            {languages.map((lang, index) => (
              <View key={index} style={[styles.languageItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.languageInfo}>
                  <Text style={[styles.languageName, { color: colors.text }]}>{lang.name}</Text>
                  <Text style={[styles.languageLevel, { color: colors.textSecondary }]}>{lang.level}</Text>
                </View>
                <TouchableOpacity onPress={() => removeLanguage(lang.name)}>
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            
            <View style={styles.addLanguageContainer}>
              <TextInput
                style={[styles.input, styles.addLanguageInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={newLanguage.name}
                onChangeText={(text) => setNewLanguage({ ...newLanguage, name: text })}
                placeholder="Language name"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addLanguage}
              >
                <Ionicons name="add-circle" size={32} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interests Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Interests</Text>
            <View style={styles.interestsContainer}>
              {interests.map((interest, index) => (
                <View key={index} style={[styles.interestTag, { backgroundColor: colors.highlight, borderColor: colors.primary }]}>
                  <Text style={[styles.interestText, { color: colors.primary }]}>{interest}</Text>
                  <TouchableOpacity onPress={() => removeInterest(interest)}>
                    <Ionicons name="close" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            
            <View style={styles.addInterestContainer}>
              <TextInput
                style={[styles.input, styles.addInterestInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={newInterest}
                onChangeText={setNewInterest}
                placeholder="Add an interest"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={addInterest}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addInterest}
              >
                <Ionicons name="add-circle" size={32} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hangout Activities Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Hangout Activities</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Select activities you&apos;d like to do</Text>
            <View style={styles.activitiesContainer}>
              {HANGOUT_ACTIVITIES.map((activity) => (
                <TouchableOpacity
                  key={activity}
                  style={[
                    styles.activityButton,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    selectedActivities.includes(activity) && [styles.activityButtonActive, { borderColor: colors.primary, backgroundColor: colors.highlight }]
                  ]}
                  onPress={() => toggleActivity(activity)}
                >
                  <Text style={[
                    styles.activityButtonText,
                    { color: colors.text },
                    selectedActivities.includes(activity) && [styles.activityButtonTextActive, { color: colors.primary }]
                  ]}>
                    {activity.replace(/-/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.footer} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  placeholderAvatar: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  genderButtonText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  genderButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  statusButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  statusButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  languageLevel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  addLanguageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  addLanguageInput: {
    flex: 1,
  },
  addButton: {
    padding: 4,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  interestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  interestText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  addInterestContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addInterestInput: {
    flex: 1,
  },
  activitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  activityButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  activityButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  activityButtonTextActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  footer: {
    height: 40,
  },
});
