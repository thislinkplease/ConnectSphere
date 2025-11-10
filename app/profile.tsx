import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import ApiService from '@/src/services/api';
import { User } from '@/src/types';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user: currentUser } = useAuth();
  const userId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const data = await ApiService.getUserById(userId);
        setUser(data);
        
        // Check if current user is following this user
        if (currentUser?.username && data.username) {
          const following = await ApiService.isFollowing(data.username, currentUser.username);
          setIsFollowing(following);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        Alert.alert('Error', 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId, currentUser?.username]);

    const handleMessage = async () => {
      if (!user?.username || !currentUser?.username) return;

      try {
        const conv = await ApiService.createOrGetDirectConversation(
          currentUser.username,
          user.username
        );
        router.push(`/chat?id=${conv.id}`);
      } catch (error) {
        console.error('Error creating/getting DM conversation:', error);
        Alert.alert('Error', 'Failed to open chat');
      }
    };

  const handleFollow = async () => {
    if (!user?.username || !currentUser?.username) return;
    
    try {
      if (isFollowing) {
        await ApiService.unfollowUser(user.username, currentUser.username);
        setIsFollowing(false);
        // Update follower count
        setUser(prev => prev ? { ...prev, followersCount: (prev.followersCount || 1) - 1 } : null);
      } else {
        await ApiService.followUser(user.username, currentUser.username);
        setIsFollowing(true);
        // Update follower count
        setUser(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : null);
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Profile Not Found' }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: user.name,
          headerRight: () => (
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView>
          {/* Profile Header */}
          <View style={styles.headerSection}>
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
            <Text style={styles.name}>{user.name}</Text>
            
            <View style={styles.locationRow}>
              <Text style={styles.flag}>{user.flag}</Text>
              <Text style={styles.location}>
                {user.city}, {user.country}
              </Text>
            </View>

            {user.isAvailableToHangout && (
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>Available to hang out</Text>
              </View>
            )}

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{user.status}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleMessage}>
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.secondaryButton, isFollowing && styles.secondaryButtonActive]}
                onPress={handleFollow}
              >
                <Ionicons 
                  name={isFollowing ? "checkmark" : "person-add-outline"} 
                  size={20} 
                  color={isFollowing ? "#fff" : "#007AFF"} 
                />
                <Text style={[styles.secondaryButtonText, isFollowing && styles.secondaryButtonTextActive]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* About Section */}
          {user.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{user.bio}</Text>
            </View>
          )}

          {/* Languages */}
          {user.languages && user.languages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Languages</Text>
              {user.languages.map((lang, index) => (
                <View key={index} style={styles.languageRow}>
                  <Text style={styles.languageName}>{lang.name}</Text>
                  <Text style={styles.languageLevel}>{lang.level}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Gender</Text>
                <Text style={styles.summaryValue}>{user.gender || 'N/A'}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Age</Text>
                <Text style={styles.summaryValue}>{user.age || 'N/A'}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Followers</Text>
                <Text style={styles.summaryValue}>{user.followersCount || 0}</Text>
              </View>
            </View>
          </View>

          {/* Interests */}
          {user.interests && user.interests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.interestsContainer}>
                {user.interests.map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Hangout Activities */}
          {user.hangoutActivities && user.hangoutActivities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hangout Activities</Text>
              <View style={styles.activitiesContainer}>
                {user.hangoutActivities.map((activity, index) => (
                  <View key={index} style={styles.activityTag}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.activityText}>
                      {activity.replace(/-/g, ' ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Specialties */}
          {user.specialties && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specialties</Text>
              
              {user.specialties.from && (
                <View style={styles.specialtyRow}>
                  <Text style={styles.specialtyLabel}>From</Text>
                  <Text style={styles.specialtyValue}>{user.specialties.from}</Text>
                </View>
              )}
              
              {user.specialties.interests && user.specialties.interests.length > 0 && (
                <View style={styles.specialtyRow}>
                  <Text style={styles.specialtyLabel}>Interests</Text>
                  <Text style={styles.specialtyValue}>
                    {user.specialties.interests.join(', ')}
                  </Text>
                </View>
              )}
              
              {user.specialties.countriesLived && user.specialties.countriesLived.length > 0 && (
                <View style={styles.specialtyRow}>
                  <Text style={styles.specialtyLabel}>Countries Lived</Text>
                  <Text style={styles.specialtyValue}>
                    {user.specialties.countriesLived.join(', ')}
                  </Text>
                </View>
              )}
              
              {user.specialties.countriesVisited && user.specialties.countriesVisited.length > 0 && (
                <View style={styles.specialtyRow}>
                  <Text style={styles.specialtyLabel}>Countries Visited</Text>
                  <Text style={styles.specialtyValue}>
                    {user.specialties.countriesVisited.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  headerSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  flag: {
    fontSize: 24,
    marginRight: 8,
  },
  location: {
    fontSize: 16,
    color: '#666',
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  availableText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    gap: 8,
  },
  secondaryButtonActive: {
    backgroundColor: '#007AFF',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  secondaryButtonTextActive: {
    color: '#fff',
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
  bioText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  languageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageName: {
    fontSize: 16,
    color: '#333',
  },
  languageLevel: {
    fontSize: 16,
    color: '#666',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  activitiesContainer: {
    gap: 8,
  },
  activityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  activityText: {
    fontSize: 14,
    color: '#4CAF50',
    textTransform: 'capitalize',
  },
  specialtyRow: {
    marginBottom: 12,
  },
  specialtyLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  specialtyValue: {
    fontSize: 15,
    color: '#333',
  },
  footer: {
    height: 40,
  },
});
