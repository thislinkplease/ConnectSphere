import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import ApiService from "@/src/services/api";
import ImageService from "@/src/services/image";
import { User } from "@/src/types";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
   ActivityIndicator,
   Alert,
   Animated,
   Dimensions,
   Image,
   PanResponder,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
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

   // Use refs to store current state for panResponder closure
   const usersRef = useRef<User[]>([]);
   const currentIndexRef = useRef(0);

   const position = useRef(new Animated.ValueXY()).current;
   const panResponder = useRef(
      PanResponder.create({
         onStartShouldSetPanResponder: () => true,
         onPanResponderMove: (_, gesture) => {
            position.setValue({ x: gesture.dx, y: gesture.dy });
         },
         onPanResponderRelease: (_, gesture) => {
            if (gesture.dx < -SWIPE_THRESHOLD) {
               // Swipe left - next user
               forceSwipe("left");
            } else if (gesture.dx > SWIPE_THRESHOLD) {
               // Swipe right - view profile
               forceSwipe("right");
            } else {
               resetPosition();
            }
         },
      })
   ).current;

   // Load online users available for hangout
   const loadOnlineUsers = useCallback(async () => {
      if (!currentUser?.username) {
         return;
      }

      try {
         setLoading(true);

         // Get users available for hangout
         const hangoutData = await ApiService.getOpenHangouts({
            limit: 50,
         });

         // Debug: Log first user to see structure
         if (hangoutData.length > 0) {
         }

         // Filter to only show online users and exclude current user
         // The server already filters for is_available and is_online
         // ALSO filter out any users without a username (data integrity check)
         const onlineUsers = hangoutData.filter((u: User) => {
            // Skip users without username
            if (!u.username) {
               return false;
            }

            // Skip current user
            const isNotCurrentUser = u.username !== currentUser.username;
            if (!isNotCurrentUser) {
               return false;
            }

            return true;
         });

         // Debug: Log filtered users

         if (onlineUsers.length > 0) {
         }

         setUsers(onlineUsers);
         setCurrentIndex(0);
         // Update refs for panResponder closure
         usersRef.current = onlineUsers;
         currentIndexRef.current = 0;
      } catch (err) {
         Alert.alert("Error", "Failed to load users. Please try again.");
         setUsers([]);
         // Update refs for panResponder closure
         usersRef.current = [];
         currentIndexRef.current = 0;
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
         setIsAvailable(false);
      }
   }, [currentUser?.username]);

   // Toggle hangout availability
   const toggleHangoutStatus = useCallback(async () => {
      if (!currentUser?.username || updatingStatus) return;

      try {
         setUpdatingStatus(true);
         const newStatus = !isAvailable;

         // Cập nhật trạng thái visible/hidden lên server
         await ApiService.updateHangoutStatus(
            currentUser.username,
            newStatus,
            currentUser.currentActivity,
            currentUser.hangoutActivities
         );

         // Cập nhật UI
         setIsAvailable(newStatus);

         // ─────────────────────────────────────────────
         // Nếu user bật Visible → lấy location và upload
         // ─────────────────────────────────────────────
         if (newStatus) {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== "granted") {
               Alert.alert("Permission required", "Allow location access to appear on the map.");
               return;
            }

            // Lấy location hiện tại
            const loc = await Location.getCurrentPositionAsync({});

            // Gửi vị trí lên server
            await ApiService.updateUserLocation(currentUser.username, loc.coords.latitude, loc.coords.longitude);
         }

         // Reload danh sách users khi bật visible
         if (newStatus) {
            loadOnlineUsers();
         }
      } catch (error) {
         Alert.alert("Error", "Failed to update hangout status. Please try again.");
      } finally {
         setUpdatingStatus(false);
      }
   }, [currentUser, isAvailable, updatingStatus, loadOnlineUsers]);

   useEffect(() => {
      // Auto-enable hangout visibility on first visit
      const initializeHangoutVisibility = async () => {
         if (!currentUser?.username) return;

         try {
            const status = await ApiService.getHangoutStatus(currentUser.username);

            // Set the current visibility state
            setIsAvailable(status.is_available || false);

            // If user has never set status before OR is not available, suggest enabling
            if (!status.is_available) {
               // Don't auto-enable, let user decide but show a helpful message
               setTimeout(() => {
                  Alert.alert(
                     "Enable Hangout Visibility? 👋",
                     "Turn on visibility to discover other users nearby and let them see you! You can toggle this anytime.",
                     [
                        { text: "Not Now", style: "cancel" },
                        {
                           text: "Enable",
                           onPress: async () => {
                              if (!currentUser?.username) {
                                 Alert.alert("Error", "User not found");
                                 return;
                              }
                              try {
                                 await ApiService.updateHangoutStatus(
                                    currentUser.username, // đã thu hẹp
                                    true,
                                    currentUser.currentActivity || "", // fallback chuỗi rỗng
                                    currentUser.hangoutActivities || [] // fallback mảng rỗng
                                 );
                                 setIsAvailable(true);
                                 loadOnlineUsers(); // Reload to see available users
                              } catch (error) {}
                           },
                        },
                     ]
                  );
               }, 1000); // Delay to avoid showing immediately
            }
         } catch (error) {}
      };

      initializeHangoutVisibility();
      loadOnlineUsers();

      // Set up periodic refresh every 30 seconds to get latest available users
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentUser?.username, loadOnlineUsers]);

   // Sync refs whenever state changes
   useEffect(() => {
      usersRef.current = users;
      currentIndexRef.current = currentIndex;
   }, [users, currentIndex]);

   // Reload when coming back to this screen
   useFocusEffect(
      useCallback(() => {
         loadHangoutStatus();
         loadOnlineUsers();
      }, [loadHangoutStatus, loadOnlineUsers])
   );

   const handleRightSwipe = async (target?: User) => {
      if (!currentUser?.username || !target?.username) return;

      try {
         // Lưu swipe "right" lên server
         await ApiService.saveSwipe(currentUser.username, target.username, "right");
      } catch (err) {
         console.log("save swipe error:", err);
         // Không cần alert, tránh làm phiền user
      }
   };

   const forceSwipe = (direction: "left" | "right") => {
      const x = direction === "right" ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;
      Animated.timing(position, {
         toValue: { x, y: 0 },
         duration: 250,
         useNativeDriver: false,
      }).start(() => onSwipeComplete(direction));
   };

   const onSwipeComplete = async (direction: "left" | "right") => {
      const currentUserProfile = usersRef.current[currentIndexRef.current];

      if (direction === "right") {
         console.log(">>> SWIPED RIGHT USER:", currentUserProfile);
         // Lưu swipe right
         await handleRightSwipe(currentUserProfile);

         // Swipe right: Navigate to profile
         if (currentUserProfile?.username) {
            router.push(`/account/profile?username=${currentUserProfile.username}`);
         } else {
            Alert.alert(
               "Profile Unavailable",
               "This user's profile is temporarily unavailable. Please try the next user.",
               [{ text: "OK" }]
            );
         }

         // Không tăng index – user có thể back lại
         position.setValue({ x: 0, y: 0 });
      } else {
         // Swipe left: NEXT
         position.setValue({ x: 0, y: 0 });
         setCurrentIndex((prevIndex) => {
            const newIndex = prevIndex + 1;
            currentIndexRef.current = newIndex;
            return newIndex;
         });
      }
   };

   const resetPosition = () => {
      Animated.spring(position, {
         toValue: { x: 0, y: 0 },
         useNativeDriver: false,
      }).start();
   };

   const handleUploadBackground = async () => {
      if (!currentUser?.id) {
         Alert.alert("Error", "Please log in to upload background image");
         return;
      }

      try {
         const image = await ImageService.pickImageFromGallery({
            allowsEditing: true,
            aspect: [9, 16], // Portrait aspect ratio for hangout cards
            quality: 0.8,
         });

         if (!image) {
            return;
         }

         if (!ImageService.validateImageSize(image, 10)) {
            Alert.alert("Error", "Image size must be less than 10MB");
            return;
         }

         setUploadingBackground(true);

         const imageFile: any = {
            uri: image.uri,
            type: image.type || "image/jpeg",
            name: image.name || `background_${Date.now()}.jpg`,
         };

         // Upload background image
         const result = await ApiService.uploadBackgroundImage(currentUser.id, imageFile);

         Alert.alert(
            "Success",
            "Background image uploaded successfully! It will be visible to others in Hangout when you turn on visibility."
         );

         // Refresh user data to get new background image
         if (currentUser.username) {
            const updatedUser = await ApiService.getUserByUsername(currentUser.username);
         }
      } catch (error) {
         Alert.alert("Error", "Failed to upload background image. Please try again.");
      } finally {
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
            outputRange: ["-10deg", "0deg", "10deg"],
            extrapolate: "clamp",
         });

         const opacity = position.x.interpolate({
            inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
            outputRange: [0.5, 1, 0.5],
            extrapolate: "clamp",
         });

         return (
            <Animated.View
               key={user.id}
               style={[
                  styles.card,
                  {
                     transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
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
                     onError={(e) => {}}
                  />
               ) : user.avatar ? (
                  <Image
                     source={{ uri: user.avatar }}
                     style={styles.cardImage}
                     resizeMode="cover"
                     onError={(e) => {}}
                  />
               ) : (
                  <View style={[styles.cardImage, { backgroundColor: colors.border }]}>
                     <Ionicons name="person" size={120} color="#ccc" />
                  </View>
               )}

               {/* Gradient Overlay for better text visibility */}
               <LinearGradient colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]} style={styles.gradient}>
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
                           extrapolate: "clamp",
                        }),
                     },
                  ]}
               >
                  <Text style={styles.swipeIndicatorText}>PROFILE</Text>
               </Animated.View>

               <Animated.View
                  style={[
                     styles.swipeIndicator,
                     styles.nopeIndicator,
                     {
                        opacity: position.x.interpolate({
                           inputRange: [-SWIPE_THRESHOLD / 2, 0],
                           outputRange: [1, 0],
                           extrapolate: "clamp",
                        }),
                     },
                  ]}
               >
                  <Text style={styles.swipeIndicatorText}>NEXT</Text>
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
               <Image source={{ uri: user.backgroundImage }} style={styles.cardImage} resizeMode="cover" />
            ) : user.avatar ? (
               <Image source={{ uri: user.avatar }} style={styles.cardImage} resizeMode="cover" />
            ) : (
               <View style={[styles.cardImage, { backgroundColor: colors.border }]}>
                  <Ionicons name="person" size={120} color="#ccc" />
               </View>
            )}
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]} style={styles.gradient} />
         </View>
      );
   };

   const renderNoMoreCards = () => {
      return (
         <View style={styles.noMoreCards}>
            <Ionicons name="people-outline" size={80} color="#ccc" />
            <Text style={styles.noMoreCardsText}>
               {isAvailable ? "No more users available" : "Turn on visibility to see others"}
            </Text>
            <Text style={styles.noMoreCardsSubtext}>
               {isAvailable
                  ? "Check back later or invite friends to join"
                  : "You need to be visible to discover other users nearby"}
            </Text>
            {!isAvailable && (
               <TouchableOpacity
                  style={[styles.reloadButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={toggleHangoutStatus}
               >
                  <Ionicons name="eye" size={20} color="#fff" />
                  <Text style={styles.reloadButtonText}>Turn On Visibility</Text>
               </TouchableOpacity>
            )}
            <TouchableOpacity
               style={[
                  styles.reloadButton,
                  {
                     backgroundColor: isAvailable ? colors.primary : colors.border,
                     marginTop: 12,
                  },
               ]}
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
               <TouchableOpacity onPress={() => router.push("/overview/notification")}>
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
            <View style={styles.headerRight}>
               <TouchableOpacity
                  style={[
                     styles.statusToggle,
                     {
                        backgroundColor: isAvailable ? colors.primary : colors.border,
                        borderColor: isAvailable ? colors.primary : colors.border,
                     },
                  ]}
                  onPress={toggleHangoutStatus}
                  disabled={updatingStatus}
               >
                  {updatingStatus ? (
                     <ActivityIndicator size="small" color="#fff" />
                  ) : (
                     <>
                        <Ionicons name={isAvailable ? "eye" : "eye-off"} size={18} color="#fff" />
                        <Text style={styles.statusToggleText}>{isAvailable ? "Visible" : "Hidden"}</Text>
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

               {isAvailable && (
                  <TouchableOpacity onPress={() => router.push("/hangout/hangout-map")}>
                     <Ionicons name="map-outline" size={26} color={colors.primary} />
                  </TouchableOpacity>
               )}
               <TouchableOpacity onPress={() => router.push("/hangout/liked-users")}>
                  <Ionicons name="heart-outline" size={26} color="#ff3366" />
               </TouchableOpacity>

               <TouchableOpacity onPress={() => router.push("/overview/notification")}>
                  <Ionicons name="notifications-outline" size={24} color="#333" />
               </TouchableOpacity>
            </View>
         </View>

         {/* Card Stack */}
         <View style={styles.cardContainer}>
            {currentIndex >= users.length ? (
               renderNoMoreCards()
            ) : (
               <>{users.map((user, index) => renderCard(user, index)).reverse()}</>
            )}
         </View>

         {/* Instructions */}
         {users.length > 0 && currentIndex < users.length && (
            <View style={styles.instructions}>
               <Text style={styles.instructionsText}>Next user • View profile</Text>
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
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
   },
   headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#333",
   },
   headerSubtitle: {
      fontSize: 12,
      color: "#666",
      marginTop: 2,
   },
   headerRight: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
   },
   statusToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
   },
   statusToggleText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
   },
   uploadButton: {
      padding: 4,
   },
   loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
   },
   cardContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
   },
   card: {
      position: "absolute",
      width: SCREEN_WIDTH - 40,
      height: SCREEN_HEIGHT - 250,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#fff",
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
   },
   cardImage: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
   },
   gradient: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "50%",
      justifyContent: "flex-end",
      padding: 20,
   },
   cardInfo: {
      paddingBottom: 10,
   },
   onlineIndicator: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
   },
   onlineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#4CAF50",
      marginRight: 6,
   },
   onlineText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
   },
   userName: {
      fontSize: 32,
      fontWeight: "bold",
      color: "#fff",
      marginBottom: 8,
   },
   locationRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
   },
   locationText: {
      color: "#fff",
      fontSize: 16,
      marginLeft: 4,
   },
   bioText: {
      color: "#fff",
      fontSize: 15,
      marginBottom: 12,
      lineHeight: 22,
   },
   interestsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
   },
   interestTag: {
      backgroundColor: "rgba(255, 255, 255, 0.25)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.4)",
   },
   interestText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "500",
   },
   activityRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
   },
   activityText: {
      color: "#fff",
      fontSize: 14,
      marginLeft: 4,
      fontStyle: "italic",
   },
   swipeIndicator: {
      position: "absolute",
      top: 50,
      padding: 12,
      borderWidth: 3,
      borderRadius: 8,
   },
   likeIndicator: {
      right: 40,
      borderColor: "#4ECDC4",
      transform: [{ rotate: "20deg" }],
   },
   nopeIndicator: {
      left: 40,
      borderColor: "#FF6B6B",
      transform: [{ rotate: "-20deg" }],
   },
   swipeIndicatorText: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#fff",
   },
   actionButtons: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 40,
      paddingVertical: 20,
   },
   actionButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#fff",
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
   },
   nopeButton: {
      borderWidth: 2,
      borderColor: "#FF6B6B",
   },
   likeButton: {
      borderWidth: 2,
      borderColor: "#4ECDC4",
   },
   instructions: {
      paddingHorizontal: 20,
      paddingBottom: 10,
      alignItems: "center",
   },
   instructionsText: {
      fontSize: 13,
      color: "#666",
      textAlign: "center",
   },
   noMoreCards: {
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
   },
   noMoreCardsText: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#666",
      marginTop: 20,
      marginBottom: 8,
   },
   noMoreCardsSubtext: {
      fontSize: 15,
      color: "#999",
      textAlign: "center",
      marginBottom: 24,
   },
   reloadButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
   },
   reloadButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
   },
});
