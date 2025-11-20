import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, TextInput, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Community } from '@/src/types';
import ApiService from '@/src/services/api';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from "expo-router";

export default function DiscussionScreen() {
  const router = useRouter();
  const { colors, isPro } = useTheme();
  const { user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCommunities = useCallback(async () => {
    try {
      setLoading(true);
      if (searchQuery.trim()) {
        const data = await ApiService.searchCommunities(searchQuery);
        setCommunities(data);
      } else {
        const data = await ApiService.getSuggestedCommunities(20);
        setCommunities(data);
      }
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>OverView</Text>
      </View>

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

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Suggested Communities</Text>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={communities}
          renderItem={renderCommunityCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.disabled} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No communities yet</Text>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
