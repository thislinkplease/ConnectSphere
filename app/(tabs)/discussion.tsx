import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, TextInput, RefreshControl, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Community } from '@/src/types';
import ApiService from '@/src/services/api';
import communityService from '@/src/services/communityService';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from "expo-router";

type TabType = 'my-communities' | 'discover';

export default function DiscussionScreen() {
  const router = useRouter();
  const { colors, isPro } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('my-communities');
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [discoverCommunities, setDiscoverCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load my communities
  const loadMyCommunities = useCallback(async () => {
    if (!user?.username) return;
    try {
      const data = await communityService.getUserJoinedCommunities(user.username, 50);
      setMyCommunities(data);
    } catch (error) {
      console.error('Error loading my communities:', error);
    }
  }, [user?.username]);

  // Load discover communities
  const loadDiscoverCommunities = useCallback(async () => {
    try {
      if (searchQuery.trim()) {
        const data = await ApiService.searchCommunities(searchQuery);
        setDiscoverCommunities(data);
      } else {
        const data = await ApiService.getSuggestedCommunities(20);
        setDiscoverCommunities(data);
      }
    } catch (error) {
      console.error('Error loading discover communities:', error);
    }
  }, [searchQuery]);

  // Load communities based on active tab
  const loadCommunities = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'my-communities') {
        await loadMyCommunities();
      } else {
        await loadDiscoverCommunities();
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadMyCommunities, loadDiscoverCommunities]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadCommunities();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [loadCommunities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCommunities();
    setRefreshing(false);
  }, [loadCommunities]);

  const handleCreateCommunity = useCallback(() => {
    if (!isPro) {
      Alert.alert(
        'PRO Feature',
        'Creating communities is a PRO feature. Upgrade to PRO to create your own community!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade to PRO',
            onPress: () => router.push('/account/payment-pro'),
          },
        ]
      );
      return;
    }
    
    // Navigate to create community screen
    router.push('/overview/create-community');
  }, [isPro, router]);

  const renderCommunityCard = ({ item }: { item: Community }) => (
    <TouchableOpacity 
      style={[styles.communityCard, { 
        backgroundColor: colors.card,
        shadowColor: colors.shadow,
        borderColor: colors.border,
      }]}
      onPress={() => 
        router.push({
          pathname: '/overview/community',
          params: { id: String(item.id) },
        })
      }
    >
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.communityImage} />
      )}
      <View style={styles.communityContent}>
        <Text style={[styles.communityName, { color: colors.text }]}>{item.name}</Text>
        {item.description && (
          <Text style={[styles.communityDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.communityFooter}>
          <View style={styles.memberCount}>
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.memberCountText, { color: colors.textSecondary }]}>
              {item.member_count} members
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const currentCommunities = activeTab === 'my-communities' ? myCommunities : discoverCommunities;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Communities</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'my-communities' && styles.activeTab,
            activeTab === 'my-communities' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setActiveTab('my-communities')}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'my-communities' ? colors.primary : colors.textMuted} 
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'my-communities' ? colors.primary : colors.textMuted },
            ]}
          >
            My Communities
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'discover' && styles.activeTab,
            activeTab === 'discover' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setActiveTab('discover')}
        >
          <Ionicons 
            name="compass" 
            size={20} 
            color={activeTab === 'discover' ? colors.primary : colors.textMuted} 
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'discover' ? colors.primary : colors.textMuted },
            ]}
          >
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar - only show in Discover tab */}
      {activeTab === 'discover' && (
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search communities"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        
      )}
      
      {/* Create Community Button - chỉ hiển thị khi đang ở tab Discover */}
{activeTab === 'discover' && (
  <TouchableOpacity
    style={[
      styles.createButton,
      {
        backgroundColor: isPro ? colors.primary : colors.border,
        borderColor: isPro ? colors.primary : colors.border,
      },
    ]}
    onPress={handleCreateCommunity}
  >
    <Ionicons name="add-circle-outline" size={20} color={isPro ? '#fff' : colors.textMuted} />
    <Text style={[styles.createButtonText, { color: isPro ? '#fff' : colors.textMuted }]}>
      {isPro ? 'Create Community' : 'Create Community (PRO)'}
    </Text>
  </TouchableOpacity>
)}


      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentCommunities}
          renderItem={renderCommunityCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.disabled} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {activeTab === 'my-communities' 
                  ? 'You haven\'t joined any communities yet' 
                  : 'No communities found'}
              </Text>
              {activeTab === 'my-communities' && (
                <TouchableOpacity
                  style={[styles.discoverButton, { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab('discover')}
                >
                  <Text style={styles.discoverButtonText}>Discover Communities</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: 12,
  },
  communityCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
  },
  communityImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#e0e0e0',
  },
  communityContent: {
    padding: 16,
  },
  communityName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  communityDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  communityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCountText: {
    fontSize: 14,
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  discoverButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  discoverButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
