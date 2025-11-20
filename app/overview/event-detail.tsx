import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@/src/utils/date';
import { useAuth } from '@/src/context/AuthContext';
import ApiService from '@/src/services/api';
import ImageService from '@/src/services/image';
import { Event } from '@/src/types';

export default function EventDetailScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [commentImage, setCommentImage] = useState<any>(null);
  const [isInterested, setIsInterested] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setLoading(true);
        const data = await ApiService.getEventById(eventId, user?.username);
        setEvent(data);
        
        // Check if user is participating
        if (user?.username && data.participants) {
          const userParticipation = data.participants.find(p => p.username === user.username);
          if (userParticipation) {
            // User is in the participants list
            setIsJoined(true);
            setIsInterested(true);
          }
        }
      } catch (error) {
        console.error('Error loading event:', error);
        Alert.alert('Error', 'Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, user?.username]);

  const handleJoinEvent = async () => {
    if (!user?.username || !event) return;
    
    try {
      if (isJoined) {
        await ApiService.leaveEvent(event.id);
        setIsJoined(false);
        setIsInterested(false);
      } else {
        const status = isInterested ? 'going' : 'interested';
        await ApiService.joinEvent(event.id, user.username, status);
        if (!isInterested) {
          setIsInterested(true);
        } else {
          setIsJoined(true);
        }
      }
    } catch (error) {
      console.error('Error joining/leaving event:', error);
      Alert.alert('Error', 'Failed to update event status');
    }
  };

  const handleAddComment = async () => {
    if (!user?.username || !event || !comment.trim()) return;

    try {
      setSubmittingComment(true);
      
      // If there's an image, convert it to proper format for upload
      const imageFile = commentImage ? {
        uri: commentImage.uri,
        type: commentImage.type,
        name: commentImage.name,
      } : undefined;
      
      await ApiService.addEventComment(event.id, user.username, comment.trim(), imageFile);
      setComment('');
      setCommentImage(null);
      
      // Reload event to get updated comments
      const updatedEvent = await ApiService.getEventById(eventId, user.username);
      setEvent(updatedEvent);
      Alert.alert('Success', 'Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handlePickImage = async () => {
    const image = await ImageService.pickImageFromGallery({
      allowsEditing: true,
      quality: 0.8,
    });

    if (image) {
      if (!ImageService.validateImageSize(image, 5)) {
        Alert.alert('Error', 'Image size must be less than 5MB');
        return;
      }
      setCommentImage(image);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Event Details' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Event Not Found' }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Event not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: event.name,
          headerTitleStyle: { fontSize: 16 },
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView>
          {/* Event Image */}
          {event.image && (
            <Image source={{ uri: event.image }} style={styles.eventImage} />
          )}

          {/* Event Header */}
          <View style={styles.headerSection}>
            <Text style={styles.eventName}>{event.name}</Text>
            
            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubbles-outline" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="person-add-outline" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>Invite Friends</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.joinButton, isInterested && styles.joinButtonActive]}
                onPress={handleJoinEvent}
              >
                <Ionicons 
                  name={isInterested ? "checkmark-circle" : "add-circle-outline"} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.joinButtonText}>
                  {isInterested ? 'Interested' : 'Join Event'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Event Details */}
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Ionicons name="pricetag-outline" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Entrance Fee</Text>
                <Text style={styles.detailValue}>{event.entranceFee || 'Free'}</Text>
              </View>
            </View>

            {event.pricingMenu && (
              <View style={styles.detailRow}>
                <Ionicons name="restaurant-outline" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Pricing Menu</Text>
                  <Text style={styles.detailValue}>{event.pricingMenu}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Hosted by</Text>
                <Text style={styles.detailValue}>{event.hostedBy.name}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{formatDate(event.dateStart)}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>{event.address}</Text>
              </View>
            </View>

            {event.schedule && (
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Schedule</Text>
                  <Text style={styles.detailValue}>
                    {event.schedule} {event.timeStart} - {event.timeEnd}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Participants */}
          <View style={styles.participantsSection}>
            <Text style={styles.sectionTitle}>
              Participants ({event.participants.length})
            </Text>
            <View style={styles.participantsList}>
              {event.participants.map((participant) => (
                <TouchableOpacity key={participant.id} style={styles.participantItem}>
                  <Image 
                    source={{ uri: participant.avatar }} 
                    style={styles.participantAvatar} 
                  />
                </TouchableOpacity>
              ))}
              {/* Add more participants indicator */}
              <TouchableOpacity style={styles.moreParticipants}>
                <Ionicons name="add" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Event Details */}
          {event.details && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Details</Text>
              <Text style={styles.descriptionText}>{event.details}</Text>
            </View>
          )}

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>
              Comments ({event.comments?.length || 0})
            </Text>
            
            {/* Comment Input */}
            <View style={styles.commentInputContainer}>
              <Image 
                source={{ uri: user?.avatar || 'https://via.placeholder.com/40' }} 
                style={styles.commentAvatar} 
              />
              <View style={styles.commentInputWrapper}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="What's on your mind?"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />
                {commentImage && (
                  <View style={styles.commentImagePreview}>
                    <Image source={{ uri: commentImage.uri }} style={styles.commentImage} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={() => setCommentImage(null)}
                    >
                      <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.commentActions}>
                  <TouchableOpacity 
                    style={styles.imageButton}
                    onPress={handlePickImage}
                  >
                    <Ionicons name="image-outline" size={20} color="#666" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.postButton, (comment.length > 0 || commentImage) && styles.postButtonActive]}
                    disabled={(comment.length === 0 && !commentImage) || submittingComment}
                    onPress={handleAddComment}
                  >
                    {submittingComment ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <Text style={[styles.postButtonText, (comment.length > 0 || commentImage) && styles.postButtonTextActive]}>
                        Post
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Comments List */}
            {event.comments && event.comments.length > 0 ? (
              event.comments.map((commentItem) => (
                <View key={commentItem.id} style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    <Ionicons name="person-circle-outline" size={40} color="#999" />
                  </View>
                  <View style={styles.commentContent}>
                    <Text style={styles.commentAuthor}>{commentItem.author_username}</Text>
                    <Text style={styles.commentText}>{commentItem.content}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noComments}>No comments yet. Be the first to comment!</Text>
            )}
          </View>
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
  eventImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#e0e0e0',
  },
  headerSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    lineHeight: 28,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  joinButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    gap: 6,
  },
  joinButtonActive: {
    backgroundColor: '#4CAF50',
  },
  joinButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  detailsSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  participantsSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantItem: {
    marginBottom: 8,
  },
  participantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreParticipants: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  commentsSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  commentInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentInputWrapper: {
    flex: 1,
  },
  commentInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    minHeight: 40,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageButton: {
    padding: 8,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  postButtonActive: {
    backgroundColor: '#007AFF',
  },
  postButtonText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  postButtonTextActive: {
    color: '#fff',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noComments: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentImagePreview: {
    position: 'relative',
    marginBottom: 8,
  },
  commentImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});
