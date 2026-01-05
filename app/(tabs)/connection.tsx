import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import ApiService from "@/src/services/api";
import LocationService from "@/src/services/location";
import { ConnectionFilters, User } from "@/src/types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
   ActivityIndicator,
   Alert,
   FlatList,
   Image,
   Modal,
   RefreshControl,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ConnectionScreen() {
   const router = useRouter();
   const { user: currentUser } = useAuth();
   const { colors } = useTheme();
   const [users, setUsers] = useState<User[]>([]);
   const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
   const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
   const [searchQuery, setSearchQuery] = useState("");
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [showFilters, setShowFilters] = useState(false);
   const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
   const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());

   // Filters
   const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
   const [selectedGender, setSelectedGender] = useState<"Male" | "Female" | null>(null);
   const [ageRange, setAgeRange] = useState<[number, number]>([18, 65]);

   useEffect(() => {
      // Request location permission on mount
      requestLocation();
      // Load following users to exclude from suggestions
      loadFollowingUsers();
   }, []);

   // Load users that current user is following
   const loadFollowingUsers = async () => {
      if (!currentUser?.username) return;
      try {
         const following = await ApiService.getFollowing(currentUser.username);
         const followingSet = new Set(following.map((u: User) => u.id));
         setFollowingUsers(followingSet);
      } catch (error) {
         console.log("Error loading following users:", error);
      }
   };

   // Smart friend suggestions:
   // 1. Prioritize users with common interests
   // 2. Exclude users already following
   const loadSuggestedUsers = useCallback(async () => {
      if (!currentUser?.username) return;
      
      try {
         // Get users (API limits results, no need for client-side pagination)
         const allUsers = await ApiService.getUsers();
         
         // Filter out current user and users already following
         let candidates = allUsers.filter((u: User) => {
            // Exclude current user
            if (u.username === currentUser.username) return false;
            // Exclude users already following
            if (followingUsers.has(u.id)) return false;
            return true;
         });

         // Score each user based on common interests
         const scoredUsers = candidates.map((user: User) => {
            const currentInterests = currentUser.interests || [];
            const userInterests = user.interests || [];
            const commonInterests = currentInterests.filter(
               (interest: string) => userInterests.includes(interest)
            );
            // Score = number of common interests
            return { user, score: commonInterests.length };
         });

         // Sort by score (highest first = most common interests) and take top 10
         scoredUsers.sort((a, b) => b.score - a.score);
         const topSuggestions = scoredUsers.slice(0, 10).map(s => s.user);

         setSuggestedUsers(topSuggestions);
      } catch (error) {
         console.log("Error loading suggested users:", error);
      }
   }, [currentUser, followingUsers]);

   // Load suggestions when dependencies are ready
   useEffect(() => {
      if (currentUser?.username) {
         loadSuggestedUsers();
      }
   }, [currentUser?.username, followingUsers, loadSuggestedUsers]);

   const requestLocation = async () => {
      const hasPermission = await LocationService.hasPermissions();
      if (!hasPermission) {
         const granted = await LocationService.requestPermissions();
         if (!granted) {
            Alert.alert(
               "Location Permission",
               "Location permission is needed to show nearby users. You can still use the app without it.",
               [{ text: "OK" }]
            );
            return;
         }
      }

      const location = await LocationService.getCurrentLocation();
      if (location) {
         setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
         });
      }
   };

   const loadUsers = useCallback(async () => {
      try {
         setLoading(true);
         
         // Build filter object to pass to API
         const filters: ConnectionFilters = {};
         if (selectedGender) {
            filters.gender = selectedGender;
         }
         // Only add age filters if they differ from defaults (18-65)
         if (ageRange && (ageRange[0] > 18 || ageRange[1] < 65)) {
            filters.minAge = ageRange[0];
            filters.maxAge = ageRange[1];
         }
         
         if (searchQuery.trim()) {
            // Search with filters
            const data = await ApiService.searchUsers(searchQuery, filters);
            setUsers(data);
         } else {
            // Get all users with filters
            const data = await ApiService.getUsers(filters);
            setUsers(data);
         }
      } catch (error) {
         console.error("Error loading users:", error);
      } finally {
         setLoading(false);
      }
   }, [searchQuery, selectedGender, ageRange]);

   // Apply client-side filters (distance only, since gender and age are handled by API)
   useEffect(() => {
      let result = [...users];

      // Filter by distance (must be done client-side as it requires location calculation)
      if (selectedDistance && currentLocation) {
         result = result.filter((user) => {
            if (!user.location) return false;
            const distance = LocationService.calculateDistance(
               currentLocation.latitude,
               currentLocation.longitude,
               user.location.latitude,
               user.location.longitude
            );
            return distance <= selectedDistance;
         });
      }

      // Sort by distance if location is available
      if (currentLocation) {
         result = LocationService.sortByDistance(result, currentLocation.latitude, currentLocation.longitude);
      }

      setFilteredUsers(result);
   }, [users, selectedDistance, currentLocation]);

   useEffect(() => {
      const timeoutId = setTimeout(() => {
         loadUsers();
      }, 300); // Debounce search

      return () => clearTimeout(timeoutId);
   }, [loadUsers]);

   const onRefresh = useCallback(async () => {
      setRefreshing(true);
      // Refresh users and following list; suggestions auto-update when followingUsers changes
      await Promise.all([loadUsers(), loadFollowingUsers()]);
      setRefreshing(false);
   }, [loadUsers]);

   const handleFollowToggle = async (user: User, event: any) => {
      event.stopPropagation(); // Prevent navigation to profile

      if (!currentUser?.username || !user.username) return;

      const isFollowing = followingUsers.has(user.id);

      try {
         if (isFollowing) {
            await ApiService.unfollowUser(user.username, currentUser.username);
            setFollowingUsers((prev) => {
               const next = new Set(prev);
               next.delete(user.id);
               return next;
            });
         } else {
            await ApiService.followUser(user.username, currentUser.username);
            setFollowingUsers((prev) => new Set(prev).add(user.id));
         }
      } catch (error) {
         console.error("Error toggling follow:", error);
         Alert.alert("Error", "Failed to update follow status");
      }
   };

   const renderUserCard = ({ item }: { item: User & { distance?: number } }) => {
      const isFollowing = followingUsers.has(item.id);

      return (
         <TouchableOpacity style={styles.userCard} onPress={() => {
            if (item.username === currentUser?.username) {
               router.push("/account");
            } else {
               router.push(`/account/profile?username=${item.username}`);
            }
         }}
         >
            <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
            <View style={styles.userContent}>
               <View style={styles.userHeader}>
                  <Text style={styles.userName}>{item.name}</Text>
                  {item.isAvailableToHangout && (
                     <View style={styles.availableBadge}>
                        <View style={styles.availableDot} />
                        <Text style={styles.availableText}>Available</Text>
                     </View>
                  )}
               </View>

               <View style={styles.userLocationRow}>
                  <Text style={styles.userFlag}>{item.flag}</Text>
                  <Text style={styles.userLocation}>
                     {item.city}, {item.country}
                  </Text>
                  {item.distance !== undefined && (
                     <Text style={[styles.distanceText, { color: colors.primary }]}>
                        • {LocationService.formatDistance(item.distance)}
                     </Text>
                  )}
               </View>

               <View style={styles.userInfo}>
                  {item.age && item.gender && (
                     <View style={styles.userInfoItem}>
                        <Ionicons name="person-outline" size={14} color="#666" />
                        <Text style={styles.userInfoText}>
                           {item.gender}, {item.age}
                        </Text>
                     </View>
                  )}
                  <View style={styles.userInfoItem}>
                     <Ionicons name="chatbubble-outline" size={14} color="#666" />
                     <Text style={styles.userInfoText}>
                        {(item.languages ?? [])
                           .map((l) => l.name)
                           .slice(0, 2)
                           .join(", ") || "—"}
                     </Text>
                  </View>
               </View>

               {item.interests && item.interests.length > 0 && (
                  <View style={styles.interestsRow}>
                     {item.interests.slice(0, 3).map((interest, index) => (
                        <View key={index} style={styles.interestTag}>
                           <Text style={styles.interestText}>{interest}</Text>
                        </View>
                     ))}
                  </View>
               )}
            </View>

            {/* Follow Button */}
            <TouchableOpacity
               style={[
                  styles.followButton,
                  isFollowing && [
                     styles.followingButton,
                     { backgroundColor: colors.primary, borderColor: colors.primary },
                  ],
                  !isFollowing && { borderColor: colors.primary },
               ]}
               onPress={(e) => handleFollowToggle(item, e)}
            >
               <Ionicons
                  name={isFollowing ? "checkmark" : "person-add-outline"}
                  size={18}
                  color={isFollowing ? "#fff" : colors.primary}
               />
            </TouchableOpacity>
         </TouchableOpacity>
      );
   };

   // Render suggestion card for horizontal scroll
   const renderSuggestionCard = ({ item }: { item: User }) => {
      const isFollowing = followingUsers.has(item.id);

      return (
         <TouchableOpacity 
            style={styles.suggestionCard}
            onPress={() => {
               if (item.username === currentUser?.username) {
                  router.push("/account");
               } else {
                  router.push(`/account/profile?username=${item.username}`);
               }
            }}
         >
            <Image source={{ uri: item.avatar }} style={styles.suggestionAvatar} />
            <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.suggestionLocation} numberOfLines={1}>
               {item.city ? `${item.city}` : ''}
            </Text>
            <TouchableOpacity
               style={[
                  styles.suggestionFollowButton,
                  isFollowing && { backgroundColor: colors.primary },
                  !isFollowing && { borderColor: colors.primary, borderWidth: 1.5 },
               ]}
               onPress={(e) => handleFollowToggle(item, e)}
            >
               <Ionicons
                  name={isFollowing ? "checkmark" : "person-add-outline"}
                  size={16}
                  color={isFollowing ? "#fff" : colors.primary}
               />
            </TouchableOpacity>
         </TouchableOpacity>
      );
   };

   return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
         <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={styles.headerTitle}>Connection</Text>
         </View>

         <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
               style={styles.searchInput}
               placeholder="Search users..."
               value={searchQuery}
               onChangeText={setSearchQuery}
               placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
               <Ionicons name="options-outline" size={24} color={colors.primary} />
               {(selectedDistance || selectedGender) && <View style={styles.filterBadge} />}
            </TouchableOpacity>
         </View>

         {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
               <ActivityIndicator size="large" color={colors.primary} />
            </View>
         ) : (
            <FlatList
               data={filteredUsers}
               renderItem={renderUserCard}
               keyExtractor={(item) => item.id}
               contentContainerStyle={styles.listContent}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
               ListHeaderComponent={
                  suggestedUsers.length > 0 ? (
                     <View style={styles.suggestionsContainer}>
                        <View style={styles.suggestionsHeader}>
                           <Text style={[styles.suggestionsTitle, { color: colors.text }]}>Suggestions</Text>
                           <Text style={[styles.suggestionsSubtitle, { color: colors.textMuted }]}>People you may know</Text>
                        </View>
                        <FlatList
                           data={suggestedUsers}
                           renderItem={renderSuggestionCard}
                           keyExtractor={(item) => `suggestion-${item.id}`}
                           horizontal
                           showsHorizontalScrollIndicator={false}
                           contentContainerStyle={styles.suggestionsList}
                        />
                     </View>
                  ) : null
               }
               ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                     <Ionicons name="people-outline" size={64} color="#ccc" />
                     <Text style={styles.emptyText}>No users found</Text>
                  </View>
               }
            />
         )}

         {/* Filter Modal */}
         <Modal
            visible={showFilters}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowFilters(false)}
         >
            <View style={styles.modalOverlay}>
               <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                  <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                     <Text style={styles.modalTitle}>Filters</Text>
                     <TouchableOpacity onPress={() => setShowFilters(false)}>
                        <Ionicons name="close" size={28} color="#666" />
                     </TouchableOpacity>
                  </View>

                  <View style={[styles.filterSection, { borderBottomColor: colors.border }]}>
                     <Text style={styles.filterLabel}>Gender</Text>
                     <View style={styles.filterOptions}>
                        {(["Male", "Female"] as const).map((gender) => (
                           <TouchableOpacity
                              key={gender}
                              style={[
                                 styles.filterOption,
                                 { borderColor: colors.border },
                                 selectedGender === gender && [
                                    styles.filterOptionActive,
                                    { borderColor: colors.primary, backgroundColor: colors.primary + "20" },
                                 ],
                              ]}
                              onPress={() => setSelectedGender(selectedGender === gender ? null : gender)}
                           >
                              <Text
                                 style={[
                                    styles.filterOptionText,
                                    selectedGender === gender && [
                                       styles.filterOptionTextActive,
                                       { color: colors.primary },
                                    ],
                                 ]}
                              >
                                 {gender}
                              </Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                  </View>

                  <View style={styles.filterActions}>
                     <TouchableOpacity
                        style={[styles.clearButton, { borderColor: colors.primary }]}
                        onPress={() => {
                           setSelectedDistance(null);
                           setSelectedGender(null);
                           setAgeRange([18, 65]);
                        }}
                     >
                        <Text style={[styles.clearButtonText, { color: colors.primary }]}>Clear All</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={[styles.applyButton, { backgroundColor: colors.primary }]}
                        onPress={() => setShowFilters(false)}
                     >
                        <Text style={styles.applyButtonText}>Apply Filters</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         </Modal>
         <View style={{ height: 5 }} />
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
      fontWeight: "bold",
      color: "#333",
   },
   searchContainer: {
      flexDirection: "row",
      alignItems: "center",
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
      color: "#333",
   },
   viewModeToggle: {
      flexDirection: "row",
      padding: 12,
      gap: 8,
   },
   viewModeButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 8,
      backgroundColor: "#f5f5f5",
   },
   viewModeButtonActive: {},
   viewModeText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#666",
   },
   viewModeTextActive: {
      color: "#fff",
   },
   listContent: {
      padding: 12,
   },
   userCard: {
      backgroundColor: "#fff",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: "row",
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
   },
   userAvatar: {
      width: 70,
      height: 70,
      borderRadius: 35,
      marginRight: 14,
   },
   userContent: {
      flex: 1,
   },
   userHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
   },
   userName: {
      fontSize: 18,
      fontWeight: "600",
      color: "#333",
   },
   availableBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#E8F5E9",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
   },
   availableDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#4CAF50",
      marginRight: 4,
   },
   availableText: {
      fontSize: 11,
      color: "#4CAF50",
      fontWeight: "600",
   },
   userLocationRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
   },
   userFlag: {
      fontSize: 16,
      marginRight: 6,
   },
   userLocation: {
      fontSize: 14,
      color: "#666",
   },
   userInfo: {
      marginBottom: 8,
   },
   userInfoItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
   },
   userInfoText: {
      fontSize: 13,
      color: "#666",
      marginLeft: 6,
   },
   interestsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
   },
   interestTag: {
      backgroundColor: "#f0f0f0",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
   },
   interestText: {
      fontSize: 12,
      color: "#666",
   },
   followButton: {
      position: "absolute",
      top: 16,
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#fff",
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
   },
   followingButton: {},
   emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
   },
   emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: "#999",
      marginTop: 16,
   },
   loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
   },
   filterButton: {
      padding: 8,
      position: "relative",
   },
   filterBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#FF3B30",
   },
   distanceText: {
      fontSize: 13,
      marginLeft: 8,
      fontWeight: "600",
   },
   modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
   },
   modalContent: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: 40,
      maxHeight: "80%",
   },
   modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
   },
   modalTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: "#333",
   },
   filterSection: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
   },
   filterLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: "#333",
      marginBottom: 12,
   },
   filterOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
   },
   filterOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 2,
   },
   filterOptionActive: {},
   filterOptionText: {
      fontSize: 14,
      color: "#666",
      fontWeight: "500",
   },
   filterOptionTextActive: {
      fontWeight: "600",
   },
   filterActions: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 20,
   },
   clearButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: "center",
   },
   clearButtonText: {
      fontSize: 16,
      fontWeight: "600",
   },
   applyButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
   },
   applyButtonText: {
      fontSize: 16,
      color: "#fff",
      fontWeight: "600",
   },

   // Suggestion card styles
   suggestionsContainer: {
      marginBottom: 16,
   },
   suggestionsHeader: {
      paddingHorizontal: 4,
      marginBottom: 12,
   },
   suggestionsTitle: {
      fontSize: 18,
      fontWeight: "700",
   },
   suggestionsSubtitle: {
      fontSize: 13,
      marginTop: 2,
   },
   suggestionsList: {
      paddingRight: 12,
   },
   suggestionCard: {
      backgroundColor: "#fff",
      borderRadius: 12,
      padding: 12,
      marginRight: 12,
      width: 120,
      alignItems: "center",
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
   },
   suggestionAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      marginBottom: 8,
   },
   suggestionName: {
      fontSize: 14,
      fontWeight: "600",
      color: "#333",
      textAlign: "center",
   },
   suggestionLocation: {
      fontSize: 11,
      color: "#666",
      textAlign: "center",
      marginBottom: 8,
   },
   suggestionFollowButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#fff",
      justifyContent: "center",
      alignItems: "center",
   },
});
