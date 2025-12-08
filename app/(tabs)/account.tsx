import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useRouter } from 'expo-router';
import ApiService from '@/src/services/api';
import { useFocusEffect } from '@react-navigation/native';

export default function AccountScreen() {
  const router = useRouter();
  const { user: authUser, logout, refreshUser } = useAuth();
  const { colors } = useTheme();
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfileData = useCallback(async () => {
    if (!authUser?.username) return;
    try {
      // Load profile completion
      const completionData = await ApiService.getProfileCompletion(authUser.username);
      setProfileCompletion(completionData.completion_percentage || 0);

      // Refresh user data from server (this fetches the latest data without updating)
      try {
        await refreshUser();
      } catch (userError) {
        console.error('Error loading user data:', userError);
      }
    } catch (error) {
      console.error('Error loading profile completion:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.username]); // Removed refreshUser from dependencies to prevent infinite loop

  // Load data only on initial mount
  useEffect(() => {
    loadProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once on mount

  // Reload data when returning to this tab
  useFocusEffect(
    useCallback(() => {
      // Only reload if the tab is focused (screen is active)
      loadProfileData();
      return () => {}; // Cleanup function
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authUser?.username]) // Only depend on username, not the whole function
  );

  // Use the user from auth context which will be updated
  const user = authUser;

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderInfoRow = (icon: string, label: string, value: string, onPress?: () => void) => (
    <TouchableOpacity style={[styles.infoRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} disabled={!onPress}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon as any} size={20} color={colors.textSecondary} />
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <View style={styles.infoRowRight}>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
        {onPress && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
      </View>
    </TouchableOpacity>
  );

  const dynamicStyles = {
    container: {
      ...styles.container,
      backgroundColor: colors.background,
    },
    statusBadge: {
      ...styles.statusBadge,
      backgroundColor: colors.primary + '20',
    },
    statusText: {
      ...styles.statusText,
      color: colors.primary,
    },
    editProfileButton: {
      ...styles.editProfileButton,
      borderColor: colors.primary,
    },
    editProfileText: {
      ...styles.editProfileText,
      color: colors.primary,
    },
    progressBar: {
      ...styles.progressBar,
      backgroundColor: colors.primary,
    },
    interestTag: {
      ...styles.interestTag,
      backgroundColor: colors.primary + '20',
    },
    interestText: {
      ...styles.interestText,
      color: colors.primary,
    },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={["top"]}>
      <ScrollView>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={60} color="#999" />
            </View>
          )}
          <View style={styles.nameContainer}>
            <Text style={styles.profileName}>{user.name}</Text>
            {user.isPro && (
              <View style={styles.proBadge}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.proText}>PRO</Text>
              </View>
            )}
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.flag}>{user.flag || '🌍'}</Text>
            <Text style={styles.location}>
              {user.city}, {user.country}
            </Text>
          </View>
          
          <View style={dynamicStyles.statusBadge}>
            <Text style={dynamicStyles.statusText}>{user.status}</Text>
          </View>

          <TouchableOpacity 
            style={dynamicStyles.editProfileButton}
            onPress={() => router.push('/account/edit-profile')}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={dynamicStyles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Completion */}
        {!loading && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Your Profile: {profileCompletion}% completed</Text>
              <TouchableOpacity>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[dynamicStyles.progressBar, { width: `${profileCompletion}%` }]} />
            </View>
            <Text style={styles.progressHint}>Complete your profile to get more connections</Text>
          </View>
        )}

        {/* About Section */}
        {user.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        )}

        {/* Languages Section */}
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
            <TouchableOpacity 
              style={styles.summaryItem}
              onPress={() => router.push(`/account/followers-list?username=${user.username}&type=followers`)}
            >
              <Text style={styles.summaryValue}>{user.followersCount || 0}</Text>
              <Text style={styles.summaryLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.summaryItem}
              onPress={() => router.push(`/account/followers-list?username=${user.username}&type=following`)}
            >
              <Text style={styles.summaryValue}>{user.followingCount || 0}</Text>
              <Text style={styles.summaryLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{user.age || 'N/A'}</Text>
              <Text style={styles.summaryLabel}>Age</Text>
            </View>
          </View>
        </View>

        {/* Interests */}
        {user.interests && user.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {user.interests.map((interest, index) => (
                <View key={index} style={dynamicStyles.interestTag}>
                  <Text style={dynamicStyles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          {renderInfoRow('notifications-outline', 'Notifications', '', () => router.push('/account/settings'))}
          {renderInfoRow('settings-outline', 'Manage Account', '', () => router.push('/account/settings'))}
          {renderInfoRow('card-outline', 'Payment & Pro Features', '', () => router.push('/account/payment-pro'))}
          {renderInfoRow('information-circle-outline', 'About', '', () => Alert.alert('Flat Sphere', 'Version 1.0.0\n\nA social networking app to connect with people around the world.'))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity 
          style={styles.signOutButton} 
          onPress={async () => {
            setLoggingOut(true);
            try {
              await logout();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setLoggingOut(false);
            }
          }}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  placeholderAvatar: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  proText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  flag: {
    fontSize: 20,
    marginRight: 8,
  },
  location: {
    fontSize: 16,
    color: '#666',
  },
  statusBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  editProfileText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  progressSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressHint: {
    fontSize: 13,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  languageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageName: {
    fontSize: 15,
    color: '#333',
  },
  languageLevel: {
    fontSize: 15,
    color: '#666',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 13,
    color: '#007AFF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  infoRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 15,
    color: '#666',
    marginRight: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  signOutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    height: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
