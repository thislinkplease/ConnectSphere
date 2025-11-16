import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import ApiService from '@/src/services/api';
import ImageService from '@/src/services/image';
import { User } from '@/src/types';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

export default function HangoutScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { colors } = useTheme();
  
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  const position = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swipe left - view profile
          forceSwipe('left');
        } else if (gesture.dx > SWIPE_THRESHOLD) {
          // Swipe right - next user
          forceSwipe('right');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  // Load online users available for hangout
  const loadOnlineUsers = useCallback(async () => {
    if (!currentUser?.username) return;
    
    try {
      setLoading(true);
      // Get users available for hangout
      const hangoutData = await ApiService.getOpenHangouts({
        limit: 50,
      });
      
      // Filter to only show online users and exclude current user
      const onlineUsers = hangoutData
        .map((h: any) => h.user || h)
        .filter((u: User) => 
          u.isOnline && 
          u.username !== currentUser.username
        );
      
      setUsers(onlineUsers);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading online users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username]);

  // Load current hangout status
  const loadHangoutStatus = useCallback(async () => {
    if (!currentUser?.username) return;
    
    try {
      const status = await ApiService.getHangoutStatus(currentUser.username);
      setIsAvailable(status.is_available || false);
    } catch (error) {
      console.error('Error loading hangout status:', error);
      setIsAvailable(false);
    }
  }, [currentUser?.username]);

  // Toggle hangout availability
  const toggleHangoutStatus = useCallback(async () => {
    if (!currentUser?.username || updatingStatus) return;
    
    try {
      setUpdatingStatus(true);
      const newStatus = !isAvailable;
      
      await ApiService.updateHangoutStatus(
        currentUser.username,
        newStatus,
        currentUser.currentActivity,
        currentUser.hangoutActivities
      );
      
      setIsAvailable(newStatus);
      
      Alert.alert(
        'Success',
        newStatus 
          ? 'You are now visible in Hangout. Others can see your profile!'
          : 'You are now hidden from Hangout. Others cannot see you.'
      );
      
      // Reload users if we just turned on availability
      if (newStatus) {
        loadOnlineUsers();
      }
    } catch (error) {
      console.error('Error updating hangout status:', error);
      Alert.alert('Error', 'Failed to update hangout status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  }, [currentUser, isAvailable, updatingStatus, loadOnlineUsers]);

  useEffect(() => {
    loadHangoutStatus();
    loadOnlineUsers();
  }, [loadHangoutStatus, loadOnlineUsers]);

  // Reload when coming back to this screen
  useFocusEffect(
    useCallback(() => {
      loadHangoutStatus();
      loadOnlineUsers();
    }, [loadHangoutStatus, loadOnlineUsers])
  );

  const forceSwipe = (direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = (direction: 'left' | 'right') => {
    const currentUserProfile = users[currentIndex];
    
    if (direction === 'left' && currentUserProfile?.username) {
      // Swipe left - view profile
      router.push(`/account/profile?username=${currentUserProfile.username}`);
    }
    
    // Move to next user (for both left and right swipes)
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(prevIndex => prevIndex + 1);
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const handleUploadBackground = async () => {
    if (!currentUser?.id) return;
    
    try {
      const image = await ImageService.pickImageFromGallery({
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });
      
      if (!image) return;

      if (!ImageService.validateImageSize(image, 10)) {
        Alert.alert('Error', 'Image size must be less than 10MB');
        return;
      }

      setUploadingBackground(true);

      const imageFile: any = {
        uri: image.uri,
        type: image.type || 'image/jpeg',
        name: image.name || 'background.jpg',
      };

      // Upload background image
      await ApiService.uploadBackgroundImage(currentUser.id, imageFile);
      Alert.alert('Success', 'Background image uploaded successfully! It will be visible to others in Hangout.');
      
      setUploadingBackground(false);
    } catch (error) {
      console.error('Error uploading background:', error);
      Alert.alert('Error', 'Failed to upload background image. Please try again.');
      setUploadingBackground(false);
    }
  };

  const renderCard = (user: User, index: number) => {
    if (index < currentIndex) {
      return null;
    }

    if (index === currentIndex) {
      const rotate = position.x.interpolate({
        inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        outputRange: ['-10deg', '0deg', '10deg'],
        extrapolate: 'clamp',
      });

      const opacity = position.x.interpolate({
        inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        outputRange: [0.5, 1, 0.5],
        extrapolate: 'clamp',
      });

      return (
        <Animated.View
          key={user.id}
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
              opacity,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Background Image */}
          {user.backgroundImage ? (
            <Image
              source={{ uri: user.backgroundImage }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : user.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cardImage, { backgroundColor: colors.border }]}>
              <Ionicons name="person" size={120} color="#ccc" />
            </View>
          )}

          {/* Gradient Overlay for better text visibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
            style={styles.gradient}
          >
            <View style={styles.cardInfo}>
              {/* Online indicator */}
              <View style={styles.onlineIndicator}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>

              {/* User Info */}
              <Text style={styles.userName}>
                {user.name}
                {user.age && `, ${user.age}`}
              </Text>
              
              {user.city && user.country && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color="#fff" />
                  <Text style={styles.locationText}>
                    {user.city}, {user.country}
                  </Text>
                </View>
              )}

              {user.bio && (
                <Text style={styles.bioText} numberOfLines={2}>
                  {user.bio}
                </Text>
              )}

              {/* Interests */}
              {user.interests && user.interests.length > 0 && (
                <View style={styles.interestsContainer}>
                  {user.interests.slice(0, 3).map((interest, idx) => (
                    <View key={idx} style={styles.interestTag}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                  {user.interests.length > 3 && (
                    <View style={styles.interestTag}>
                      <Text style={styles.interestText}>+{user.interests.length - 3}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Current Activity */}
              {user.currentActivity && (
                <View style={styles.activityRow}>
                  <Ionicons name="walk-outline" size={16} color="#fff" />
                  <Text style={styles.activityText}>{user.currentActivity}</Text>
                </View>
              )}
            </View>
          </LinearGradient>

          {/* Swipe Indicators */}
          <Animated.View
            style={[
              styles.swipeIndicator,
              styles.likeIndicator,
              {
                opacity: position.x.interpolate({
                  inputRange: [0, SWIPE_THRESHOLD / 2],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Text style={styles.swipeIndicatorText}>NEXT</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.swipeIndicator,
              styles.nopeIndicator,
              {
                opacity: position.x.interpolate({
                  inputRange: [-SWIPE_THRESHOLD / 2, 0],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Text style={styles.swipeIndicatorText}>PROFILE</Text>
          </Animated.View>
        </Animated.View>
      );
    }

    // Render cards behind current card with slight offset
    return (
      <View
        key={user.id}
        style={[
          styles.card,
          {
            top: 10 * (index - currentIndex),
            transform: [{ scale: 1 - 0.05 * (index - currentIndex) }],
          },
        ]}
      >
        {user.backgroundImage ? (
          <Image
            source={{ uri: user.backgroundImage }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : user.avatar ? (
          <Image
            source={{ uri: user.avatar }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: colors.border }]}>
            <Ionicons name="person" size={120} color="#ccc" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        />
      </View>
    );
  };

  const renderNoMoreCards = () => {
    return (
      <View style={styles.noMoreCards}>
        <Ionicons name="people-outline" size={80} color="#ccc" />
        <Text style={styles.noMoreCardsText}>No more users online</Text>
        <Text style={styles.noMoreCardsSubtext}>
          Check back later or try adjusting your filters
        </Text>
        <TouchableOpacity
          style={[styles.reloadButton, { backgroundColor: colors.primary }]}
          onPress={loadOnlineUsers}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.reloadButtonText}>Reload</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hang Out</Text>
          <TouchableOpacity onPress={() => router.push('/feed/notification')}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={styles.headerTitle}>Hang Out</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.statusToggle,
              { 
                backgroundColor: isAvailable ? colors.primary : colors.border,
                borderColor: isAvailable ? colors.primary : colors.border,
              }
            ]}
            onPress={toggleHangoutStatus}
            disabled={updatingStatus}
          >
            {updatingStatus ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons 
                  name={isAvailable ? "eye" : "eye-off"} 
                  size={18} 
                  color="#fff" 
                />
                <Text style={styles.statusToggleText}>
                  {isAvailable ? 'Visible' : 'Hidden'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadBackground}
            disabled={uploadingBackground}
          >
            {uploadingBackground ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="image-outline" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/feed/notification')}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Stack */}
      <View style={styles.cardContainer}>
        {currentIndex >= users.length ? (
          renderNoMoreCards()
        ) : (
          <>
            {users.map((user, index) => renderCard(user, index)).reverse()}
          </>
        )}
      </View>

      {/* Action Buttons */}
      {currentIndex < users.length && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.nopeButton]}
            onPress={() => forceSwipe('left')}
          >
            <Ionicons name="close" size={32} color="#FF6B6B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => forceSwipe('right')}
          >
            <Ionicons name="checkmark" size={32} color="#4ECDC4" />
          </TouchableOpacity>
        </View>
      )}

      {/* Instructions */}
      {users.length > 0 && currentIndex < users.length && (
        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>
            ✕ View profile • ✓ Next user
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusToggleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  uploadButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT - 250,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: 20,
  },
  cardInfo: {
    paddingBottom: 10,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  onlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 4,
  },
  bioText: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 22,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  interestTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  interestText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activityText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  swipeIndicator: {
    position: 'absolute',
    top: 50,
    padding: 12,
    borderWidth: 3,
    borderRadius: 8,
  },
  likeIndicator: {
    right: 40,
    borderColor: '#4ECDC4',
    transform: [{ rotate: '20deg' }],
  },
  nopeIndicator: {
    left: 40,
    borderColor: '#FF6B6B',
    transform: [{ rotate: '-20deg' }],
  },
  swipeIndicatorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingVertical: 20,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  nopeButton: {
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  likeButton: {
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  instructions: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  noMoreCards: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noMoreCardsText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
  },
  noMoreCardsSubtext: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  reloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
