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
   const [searchQuery, setSearchQuery] = useState("");
   const [viewMode, setViewMode] = useState<"users" | "events">("users");
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [showFilters, setShowFilters] = useState(false);
   const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
   const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());

   // Filters
   const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
   const [selectedGender, setSelectedGender] = useState<"Male" | "Female" | null>(null);
   const [ageRange, setAgeRange] = useState<[number, number]>([18, 65]);

   const [events, setEvents] = useState<any[]>([]);

   const loadEvents = async () => {
      try {
         setLoading(true);
         const data = await ApiService.getEvents();
         setEvents(data);
      } catch (error) {
         console.log("Error loading events:", error);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      if (viewMode === "events") {
         loadEvents();
      }
   }, [viewMode]);

   useEffect(() => {
      // Request location permission on mount
      requestLocation();
   }, []);

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
      await loadUsers();
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

   const renderEventCard = ({ item }: { item: any }) => {
      const date = new Date(item.date_start);
      const day = date.getDate();
      const month = date.toLocaleString("en-US", { month: "short" });
      const timeStart = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      return (
         <TouchableOpacity style={styles.eventCard} onPress={() => router.push(`/events/event-detail?id=${item.id}`)}>
            {/* Banner */}
            <Image
               source={{ uri: item.image_url || "https://via.placeholder.com/400x250" }}
               style={styles.eventBanner}
            />

            {/* Time + distance badge */}
            <View style={styles.eventBadge}>
               <Ionicons name="time-outline" size={14} color="#0D8D43" />
               <Text style={styles.eventBadgeText}>{timeStart}</Text>

               {item.distance && (
                  <>
                     <Ionicons name="location-outline" size={14} color="#888" style={{ marginLeft: 6 }} />
                     <Text style={styles.eventDistance}>{item.distance.toFixed(1)} km</Text>
                  </>
               )}
            </View>

            {/* Bottom info */}
            <View style={styles.eventInfoBox}>
               {/* Date Column */}
               <View style={styles.eventDateCol}>
                  <Text style={styles.eventDay}>{day}</Text>
                  <Text style={styles.eventMonth}>{month}</Text>
               </View>

               {/* Content */}
               <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={styles.eventTitle}>
                     {item.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.eventAddress}>
                     {item.address}
                  </Text>

                  <Text style={[styles.eventFee, { color: item.entrance_fee === "Free" ? "#0A8F29" : "#D32F2F" }]}>
                     {item.entrance_fee || "Free"}
                  </Text>

                  {item.category && (
                     <View style={styles.eventTag}>
                        <Text style={styles.eventTagText}>{item.category}</Text>
                     </View>
                  )}
               </View>
            </View>
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

         <View style={[styles.viewModeToggle, { backgroundColor: colors.card }]}>
            <TouchableOpacity
               style={[
                  styles.viewModeButton,
                  viewMode === "users" && [styles.viewModeButtonActive, { backgroundColor: colors.primary }],
               ]}
               onPress={() => setViewMode("users")}
            >
               <Text style={[styles.viewModeText, viewMode === "users" && styles.viewModeTextActive]}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity
               style={[
                  styles.viewModeButton,
                  viewMode === "events" && [styles.viewModeButtonActive, { backgroundColor: colors.primary }],
               ]}
               onPress={() => setViewMode("events")}
            >
               <Text style={[styles.viewModeText, viewMode === "events" && styles.viewModeTextActive]}>All Events</Text>
            </TouchableOpacity>
         </View>

         {viewMode === "users" &&
            (loading && !refreshing ? (
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
                  ListEmptyComponent={
                     <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No users found</Text>
                     </View>
                  }
               />
            ))}

         {viewMode === "events" &&
            (loading ? (
               <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
               </View>
            ) : (
               <FlatList
                  data={events}
                  renderItem={renderEventCard}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerStyle={{ padding: 12 }}
                  showsVerticalScrollIndicator={false}
               />
            ))}

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

   //event card styles
   eventCard: {
      backgroundColor: "#fff",
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 20,
      elevation: 2,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 6,
   },

   eventBanner: {
      width: "100%",
      height: 170,
   },

   eventBadge: {
      position: "absolute",
      bottom: 14,
      left: 14,
      backgroundColor: "#fff",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      elevation: 3,
   },

   eventBadgeText: {
      fontWeight: "600",
      marginLeft: 4,
      fontSize: 13,
   },

   eventDistance: {
      marginLeft: 4,
      fontSize: 12,
      color: "#666",
   },

   eventInfoBox: {
      flexDirection: "row",
      padding: 16,
   },

   eventDateCol: {
      width: 48,
      alignItems: "center",
      marginRight: 10,
   },

   eventDay: {
      fontSize: 22,
      fontWeight: "700",
      color: "#222",
   },
   eventMonth: {
      fontSize: 14,
      color: "#888",
      marginTop: -2,
   },

   eventTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#222",
      marginBottom: 4,
   },
   eventAddress: {
      fontSize: 13,
      color: "#666",
      marginBottom: 6,
   },
   eventFee: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 3,
      marginLeft: 35,
   },

   eventTag: {
      backgroundColor: "#E6F6EE",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: "flex-start",
   },
   eventTagText: {
      fontSize: 12,
      color: "#0D8D43",
      fontWeight: "600",
   },
});
