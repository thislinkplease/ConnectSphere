import React, { useState } from 'react';
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
  Platform,
  Modal, 
  TouchableWithoutFeedback
} from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format, addHours } from 'date-fns';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import communityService from '@/src/services/communityService';
import { ImageFile } from '@/src/types';

export default function CreateCommunityEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId: string; communityName?: string }>();
  const communityId = Number(params.communityId);
  const communityName = params.communityName || 'Community';
  const { colors } = useTheme();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  
  // Use Date objects for date/time
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hasEndDate, setHasEndDate] = useState(false);
  
  // Picker visibility states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  const [coverImage, setCoverImage] = useState<ImageFile | null>(null);
  const [loading, setLoading] = useState(false);

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
          name: asset.fileName || `event_${Date.now()}.jpg`,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const onStartDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowStartDatePicker(false);

    if (selectedDate) {
      // Preserve the time from the current startDate
      const newDate = new Date(selectedDate);
      newDate.setHours(startDate.getHours(), startDate.getMinutes());
      setStartDate(newDate);
    }
  };

  const onStartTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowStartTimePicker(false);
    if (selectedDate) {
      // Preserve the date from the current startDate
      const newDate = new Date(startDate);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setStartDate(newDate);
    }
  };

  const onEndDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      if (endDate) {
        newDate.setHours(endDate.getHours(), endDate.getMinutes());
      } else {
        // Use addHours for safe time arithmetic (handles midnight/DST)
        const defaultEndTime = addHours(startDate, 2);
        newDate.setHours(defaultEndTime.getHours(), defaultEndTime.getMinutes());
      }
      setEndDate(newDate);
    }
  };

  const onEndTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndTimePicker(false);
    if (selectedDate && endDate) {
      const newDate = new Date(endDate);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setEndDate(newDate);
    }
  };

  const toggleEndDate = () => {
    if (hasEndDate) {
      setHasEndDate(false);
      setEndDate(null);
    } else {
      setHasEndDate(true);
      // Default end date is 2 hours after start using addHours for safe time arithmetic
      const defaultEnd = addHours(startDate, 2);
      setEndDate(defaultEnd);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Event name is required');
      return;
    }

    if (!user?.username) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    // Validate start date is in the future
    if (startDate <= new Date()) {
      Alert.alert('Warning', 'Start date should be in the future. Proceeding anyway.');
    }

    // Validate end date is after start date
    if (endDate && endDate <= startDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setLoading(true);

    try {
      await communityService.createCommunityEvent(communityId, {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        start_time: startDate.toISOString(),
        end_time: endDate ? endDate.toISOString() : undefined,
        image: coverImage || undefined,
      });

      Alert.alert('Success', 'Event created successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: unknown) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayDate = (date: Date) => {
    return format(date, 'EEE, MMM d, yyyy');
  };

  const formatDisplayTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Event</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Community Info */}
        <View style={[styles.communityInfo, { backgroundColor: colors.surface }]}>
          <Ionicons name="people" size={20} color={colors.primary} />
          <Text style={[styles.communityName, { color: colors.text }]}>{communityName}</Text>
        </View>

        {/* Cover Image */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Event Cover (Optional)</Text>
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

        {/* Event Name */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Event Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter event name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
        </View>

        {/* Start Date & Time */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Start Date & Time *</Text>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={[styles.dateTimeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={[styles.dateTimeText, { color: colors.text }]}>
                {formatDisplayDate(startDate)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateTimeButton, styles.timeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={[styles.dateTimeText, { color: colors.text }]}>
                {formatDisplayTime(startDate)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* End Date Toggle */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.toggleRow} 
            onPress={toggleEndDate}
          >
            <View style={styles.toggleLeft}>
              <Ionicons 
                name={hasEndDate ? "checkbox" : "square-outline"} 
                size={24} 
                color={hasEndDate ? colors.primary : colors.textMuted} 
              />
              <Text style={[styles.toggleText, { color: colors.text }]}>Add end date & time</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* End Date & Time (if enabled) */}
        {hasEndDate && endDate && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>End Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={[styles.dateTimeText, { color: colors.text }]}>
                  {formatDisplayDate(endDate)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateTimeButton, styles.timeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={[styles.dateTimeText, { color: colors.text }]}>
                  {formatDisplayTime(endDate)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Location */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Location (Optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter event location or online link"
            placeholderTextColor={colors.textMuted}
            value={location}
            onChangeText={setLocation}
            maxLength={200}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Description (Optional)</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="Tell people what this event is about..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={1000}
          />
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[
            styles.createButton, 
            { backgroundColor: colors.primary },
            (loading || !name.trim()) && styles.createButtonDisabled
          ]}
          onPress={handleCreate}
          disabled={loading || !name.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="calendar" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Event</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date/Time Pickers */}
      <DateTimePickerModal
        isVisible={showStartDatePicker}
        mode="date"
        date={startDate}
        minimumDate={new Date()}
        onConfirm={(selected) => {
          const newDate = new Date(selected);
          newDate.setHours(startDate.getHours(), startDate.getMinutes());
          setStartDate(newDate);
          setShowStartDatePicker(false);
        }}
        onCancel={() => setShowStartDatePicker(false)}
        pickerContainerStyleIOS={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />

      <DateTimePickerModal
        isVisible={showStartTimePicker}
        mode="time"
        date={startDate}
        onConfirm={(selected) => {
          const now = new Date();

          const newDate = new Date(startDate);
          newDate.setHours(selected.getHours(), selected.getMinutes());

          if (newDate < now) {
            Alert.alert("Invalid time", "Start time must be in the future.");
            return;
          }

          setStartDate(newDate);
          setShowStartTimePicker(false);
        }}
        onCancel={() => setShowStartTimePicker(false)}
        pickerContainerStyleIOS={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />

      <DateTimePickerModal
        isVisible={showEndDatePicker}
        mode="date"
        date={endDate ?? addHours(startDate, 2)}
        minimumDate={startDate}
        onConfirm={(selected) => {
          const base = endDate ?? addHours(startDate, 2);
          const newDate = new Date(selected);
          newDate.setHours(base.getHours(), base.getMinutes());
          setEndDate(newDate);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
        pickerContainerStyleIOS={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />

      <DateTimePickerModal
        isVisible={showEndTimePicker}
        mode="time"
        date={endDate ?? addHours(startDate, 2)}
        onConfirm={(selected) => {
          const base = endDate ?? addHours(startDate, 2);
          const newDate = new Date(base);
          newDate.setHours(selected.getHours(), selected.getMinutes());
          setEndDate(newDate);
          setShowEndTimePicker(false);
        }}
        onCancel={() => setShowEndTimePicker(false)}
        pickerContainerStyleIOS={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
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
  communityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  communityName: {
    fontSize: 15,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
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
    height: 180,
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
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  timeButton: {
    flex: 0.6,
  },
  dateTimeText: {
    fontSize: 15,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleText: {
    fontSize: 15,
  },
  createButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 32,
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
