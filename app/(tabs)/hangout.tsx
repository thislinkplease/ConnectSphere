import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Switch, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import ApiService from '@/src/services/api';
import { HANGOUT_ACTIVITIES } from '@/src/constants/options';

export default function HangoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [isAvailable, setIsAvailable] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [currentActivity, setCurrentActivity] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'open' | 'my'>('open');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [openHangouts, setOpenHangouts] = useState<any[]>([]);
  const [myHangouts, setMyHangouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load hangout status
  useEffect(() => {
    const loadHangoutStatus = async () => {
      if (!user?.username) return;
      try {
        const data = await ApiService.getHangoutStatus(user.username);
        setIsAvailable(data.is_available || false);
        setCurrentActivity(data.current_activity || '');
        setSelectedActivities(data.activities || []);
      } catch (error) {
        console.error('Error loading hangout status:', error);
      }
    };

    loadHangoutStatus();
  }, [user?.username]);

  // Load hangouts based on active tab
  const loadHangouts = useCallback(async () => {
    if (!user?.username) return;
    
    try {
      setLoading(true);
      if (activeTab === 'open') {
        const data = await ApiService.getOpenHangouts();
        setOpenHangouts(data);
      } else {
        const data = await ApiService.getMyHangouts(user.username);
        setMyHangouts(data);
      }
    } catch (error) {
      console.error('Error loading hangouts:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.username]);

  useEffect(() => {
    loadHangouts();
  }, [loadHangouts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHangouts();
    setRefreshing(false);
  }, [loadHangouts]);

  const handleToggleAvailability = async (value: boolean) => {
    if (!user?.username) return;
    
    setIsAvailable(value);
    try {
      await ApiService.updateHangoutStatus(
        user.username,
        value,
        currentActivity,
        selectedActivities
      );
    } catch (error) {
      console.error('Error updating hangout status:', error);
      Alert.alert('Error', 'Failed to update hangout status');
      setIsAvailable(!value); // Revert on error
    }
  };

  const handleToggleActivity = (activityId: string) => {
    setSelectedActivities(prev => {
      if (prev.includes(activityId)) {
        return prev.filter(id => id !== activityId);
      } else {
        return [...prev, activityId];
      }
    });
  };

  const handleSaveActivities = async () => {
    if (!user?.username) return;
    
    try {
      const newActivity = selectedActivities.length > 0 ? selectedActivities[0] : '';
      await ApiService.updateHangoutStatus(
        user.username,
        isAvailable,
        newActivity,
        selectedActivities
      );
      setCurrentActivity(newActivity);
      setShowActivityModal(false);
    } catch (error) {
      console.error('Error saving activities:', error);
      Alert.alert('Error', 'Failed to save activities');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={styles.headerTitle}>Hang Out</Text>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => router.push('/notification')}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        {/* Availability Toggle Section */}
        <View style={[styles.availabilitySection, { backgroundColor: colors.card }]}>
          <View style={styles.availabilityRow}>
            <View style={styles.availabilityText}>
              <Text style={styles.availabilityLabel}>Available to hang out now</Text>
              {isAvailable && selectedActivities.length > 0 && (
                <Text style={styles.goingToText}>
                  Going to: {selectedActivities.slice(0, 2).map(id => 
                    HANGOUT_ACTIVITIES.find(a => a.id === id)?.label || id
                  ).join(', ')}
                  {selectedActivities.length > 2 && ` +${selectedActivities.length - 2} more`}
                </Text>
              )}
            </View>
            <Switch
              value={isAvailable}
              onValueChange={handleToggleAvailability}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
              thumbColor={isAvailable ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          {isAvailable && (
            <TouchableOpacity
              style={styles.editStatusButton}
              onPress={() => setShowActivityModal(true)}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <Text style={[styles.editStatusText, { color: colors.primary }]}>Edit Status</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sliding Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'open' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
            onPress={() => setActiveTab('open')}
          >
            <Text style={[styles.tabText, activeTab === 'open' && [styles.activeTabText, { color: colors.primary }]]}>
              Open Hangouts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabText, activeTab === 'my' && [styles.activeTabText, { color: colors.primary }]]}>
              My Hangouts
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : activeTab === 'open' ? (
          <FlatList
            data={openHangouts}
            renderItem={({ item }) => (
              <View style={styles.hangoutCard}>
                <Text style={styles.hangoutTitle}>{item.title || 'Hangout'}</Text>
                <Text style={styles.hangoutDetails}>{item.description}</Text>
              </View>
            )}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.tabContent}>
                <Text style={styles.placeholderText}>Open hangouts will appear here</Text>
                <Text style={styles.placeholderSubtext}>
                  Filter by languages and distance to find people available to hang out
                </Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={myHangouts}
            renderItem={({ item }) => (
              <View style={styles.hangoutCard}>
                <Text style={styles.hangoutTitle}>Connection</Text>
                <Text style={styles.hangoutDetails}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            )}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.tabContent}>
                <Text style={styles.placeholderText}>Your past hangouts will appear here</Text>
                <Text style={styles.placeholderSubtext}>
                  Connect with people you&apos;ve hung out with before
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Activity Selection Modal */}
      <Modal
        visible={showActivityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActivityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={styles.modalTitle}>Select Activities</Text>
              <TouchableOpacity onPress={() => setShowActivityModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {HANGOUT_ACTIVITIES.map((activity) => (
                <TouchableOpacity
                  key={activity.id}
                  style={[styles.activityOption, { borderBottomColor: colors.border }]}
                  onPress={() => handleToggleActivity(activity.id)}
                >
                  <Text style={styles.activityLabel}>{activity.label}</Text>
                  <View style={[styles.checkbox, { borderColor: colors.primary }]}>
                    {selectedActivities.includes(activity.id) && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSaveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveActivities}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  availabilitySection: {
    padding: 16,
    marginBottom: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityText: {
    flex: 1,
    marginRight: 12,
  },
  availabilityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  goingToText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  editStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  editStatusText: {
    fontSize: 15,
    marginLeft: 6,
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  tabContent: {
    padding: 20,
    alignItems: 'center',
    marginTop: 40,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  hangoutCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  hangoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  hangoutDetails: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    maxHeight: 400,
  },
  activityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  activityLabel: {
    fontSize: 16,
    color: '#333',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveButton: {
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
