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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import communityService from '@/src/services/communityService';
import { CommunityEvent } from '@/src/types';

export default function CommunityEventDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId: string; eventId: string }>();
  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const { colors } = useTheme();
  const { user } = useAuth();

  const [event, setEvent] = useState<CommunityEvent | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      const data = await communityService.getCommunityEvent(communityId, eventId, user?.username);
      setEvent(data);
      
      const parts = await communityService.getCommunityEventParticipants(communityId, eventId);
      setParticipants(parts);
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Error', 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [communityId, eventId, user?.username]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleRespond = async (status: 'going' | 'interested' | 'not_going') => {
    if (!user?.username) return;

    setResponding(true);
    try {
      await communityService.respondToCommunityEvent(communityId, eventId, status);
      // Reload event to get updated status
      await loadEvent();
      
      if (status === 'going') {
        Alert.alert('You\'re Going!', 'You have marked yourself as going to this event.');
      } else if (status === 'interested') {
        Alert.alert('Interested', 'You have marked yourself as interested in this event.');
      }
    } catch (error) {
      console.error('Error responding to event:', error);
      Alert.alert('Error', 'Failed to respond to event');
    } finally {
      setResponding(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Check out this event: ${event.name}\n\n${event.description || ''}`,
        title: event.name,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const goingCount = participants.filter(p => p.status === 'going').length;
  const interestedCount = participants.filter(p => p.status === 'interested').length;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Event not found</Text>
          <TouchableOpacity
            style={[styles.backButtonError, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isGoing = event.is_going;
  const isInterested = event.is_interested;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          {event.image_url ? (
            <Image source={{ uri: event.image_url }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: colors.primary }]}>
              <Ionicons name="calendar" size={64} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          
          {/* Back Button */}
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          {/* Share Button */}
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={[styles.content, { backgroundColor: colors.card }]}>
          {/* Date Badge */}
          <View style={[styles.dateBadge, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={[styles.dateBadgeText, { color: colors.primary }]}>
              {formatDate(event.start_time)}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{event.name}</Text>

          {/* Organizer */}
          {event.creator && (
            <TouchableOpacity
              style={styles.organizerRow}
              onPress={() => router.push(`/account/profile?username=${event.creator?.username}`)}
            >
              {event.creator.avatar ? (
                <Image source={{ uri: event.creator.avatar }} style={styles.organizerAvatar} />
              ) : (
                <View style={[styles.organizerAvatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                  <Ionicons name="person" size={16} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.organizerInfo}>
                <Text style={[styles.organizerLabel, { color: colors.textMuted }]}>Organized by</Text>
                <Text style={[styles.organizerName, { color: colors.text }]}>
                  {event.creator.name || event.creator.username}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isGoing 
                  ? { backgroundColor: colors.success || '#10B981' }
                  : { backgroundColor: colors.primary }
              ]}
              onPress={() => handleRespond(isGoing ? 'not_going' : 'going')}
              disabled={responding}
            >
              {responding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={isGoing ? "checkmark-circle" : "calendar"} size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>{isGoing ? 'Going ✓' : 'Going'}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButtonSecondary,
                isInterested 
                  ? { backgroundColor: colors.warning || '#F59E0B', borderColor: colors.warning || '#F59E0B' }
                  : { borderColor: colors.border }
              ]}
              onPress={() => handleRespond(isInterested ? 'not_going' : 'interested')}
              disabled={responding}
            >
              <Ionicons 
                name={isInterested ? "star" : "star-outline"} 
                size={20} 
                color={isInterested ? '#fff' : colors.text} 
              />
              <Text style={[styles.actionButtonSecondaryText, { color: isInterested ? '#fff' : colors.text }]}>
                {isInterested ? 'Interested ✓' : 'Interested'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success || '#10B981'} />
              <Text style={[styles.statNumber, { color: colors.text }]}>{goingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Going</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="star" size={20} color={colors.warning || '#F59E0B'} />
              <Text style={[styles.statNumber, { color: colors.text }]}>{interestedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Interested</Text>
            </View>
          </View>

          {/* Details Section */}
          <View style={styles.detailsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Event Details</Text>

            {/* Date & Time */}
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>
                  {formatDate(event.start_time)}
                </Text>
                <Text style={[styles.detailSubtitle, { color: colors.textMuted }]}>
                  {formatTime(event.start_time)}
                  {event.end_time && ` - ${formatTime(event.end_time)}`}
                </Text>
              </View>
            </View>

            {/* Location */}
            {event.location && (
              <View style={styles.detailRow}>
                <View style={[styles.detailIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="location-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailTitle, { color: colors.text }]}>{event.location}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.descriptionSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {event.description}
              </Text>
            </View>
          )}

          {/* Participants Preview */}
          {participants.length > 0 && (
            <View style={styles.participantsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Participants ({participants.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {participants.slice(0, 10).map((participant, index) => (
                  <TouchableOpacity
                    key={participant.id || index}
                    style={styles.participantItem}
                    onPress={() => router.push(`/account/profile?username=${participant.username}`)}
                  >
                    {participant.user?.avatar ? (
                      <Image source={{ uri: participant.user.avatar }} style={styles.participantAvatar} />
                    ) : (
                      <View style={[styles.participantAvatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                        <Ionicons name="person" size={20} color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={[styles.participantName, { color: colors.text }]} numberOfLines={1}>
                      {participant.user?.name || participant.username}
                    </Text>
                    <View style={[
                      styles.participantBadge,
                      { backgroundColor: participant.status === 'going' ? (colors.success || '#10B981') : (colors.warning || '#F59E0B') }
                    ]}>
                      <Text style={styles.participantBadgeText}>
                        {participant.status === 'going' ? 'Going' : 'Interested'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
  },
  backButtonError: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  coverContainer: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 400,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 12,
  },
  dateBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  organizerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  organizerInfo: {
    marginLeft: 12,
  },
  organizerLabel: {
    fontSize: 12,
  },
  organizerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  actionButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 14,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 16,
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  detailSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  participantsSection: {
    marginBottom: 20,
  },
  participantItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
  },
  participantName: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  participantBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  participantBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
});
