import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import ApiService from "@/src/services/api";
import { User } from "@/src/types";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function HangoutMapScreen() {
   const { user: currentUser } = useAuth();
   const { colors } = useTheme();
   const router = useRouter();

   const [users, setUsers] = useState<User[]>([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [selectedUser, setSelectedUser] = useState<User | null>(null);
   const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
   const mapRef = useRef<MapView>(null);

   // ---- Load visible users with locations ----
   const loadLocations = async (showRefreshing = false) => {
      try {
         if (showRefreshing) setRefreshing(true);
         const data = await ApiService.getVisibleUsersLocation();
         setUsers(data || []);
         setLastUpdated(new Date());
      } catch (err) {
         console.log("map error:", err);
      } finally {
         setLoading(false);
         if (showRefreshing) setRefreshing(false);
      }
   };

   // First load + realtime polling (increased to 60s to reduce API calls)
   useEffect(() => {
      loadLocations();

      // Reduced polling frequency from 5s to 60s to optimize API usage
      // Users can manually refresh if needed with the refresh button
      const interval = setInterval(() => {
         loadLocations();
      }, 60000); // 60s (1 minute) to significantly reduce API calls

      return () => clearInterval(interval);
   }, []);

   // Find "me" in the list (if I'm visible) or fallback to currentUser.location
   const myLocation = useMemo(() => {
      const meFromList = users.find((u) => u.username === currentUser?.username);
      if (meFromList?.location) return meFromList.location;
      if (currentUser?.location) return currentUser.location;
      return null;
   }, [users, currentUser]);

   // Helper: Haversine distance in km
   const distanceKm = useMemo(() => {
      if (!myLocation || !selectedUser?.location) return null;

      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371; // Earth radius in km

      const dLat = toRad(selectedUser.location.latitude - myLocation.latitude);
      const dLon = toRad(selectedUser.location.longitude - myLocation.longitude);

      const a =
         Math.sin(dLat / 2) * Math.sin(dLat / 2) +
         Math.cos(toRad(myLocation.latitude)) *
            Math.cos(toRad(selectedUser.location.latitude)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
   }, [myLocation, selectedUser]);

   const centerOnMe = () => {
      if (!myLocation) {
         Alert.alert("Location", "Không tìm thấy vị trí của bạn.");
         return;
      }

      mapRef.current?.animateToRegion(
         {
            latitude: myLocation.latitude,
            longitude: myLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
         },
         600
      );
   };

   const openRoute = (user: User) => {
      if (!user.location) return;

      const lat = user.location.latitude;
      const lng = user.location.longitude;

      // Google Maps URL
      const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

      // Apple Maps (iOS)
      const appleUrl = `maps://?daddr=${lat},${lng}`;

      const url = Platform.OS === "ios" ? appleUrl : googleUrl;

      Linking.openURL(url).catch(() => {
         // Fallback nếu Apple Maps không mở được
         Linking.openURL(googleUrl).catch(() => {
            Alert.alert("Error", "Không mở được ứng dụng bản đồ.");
         });
      });
   };

   const handleViewProfile = (user: User) => {
      if (!user.username) return;
      router.push(`/account/profile?username=${user.username}`);
   };

   if (loading) {
      return (
         <View style={styles.center}>
            <ActivityIndicator size="large" />
         </View>
      );
   }

   return (
      <View style={{ flex: 1 }}>
         <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
               latitude: myLocation?.latitude || 10.762622,
               longitude: myLocation?.longitude || 106.660172,
               latitudeDelta: 0.05,
               longitudeDelta: 0.05,
            }}
         >
            {users.map((u) =>
               u.location ? (
                  <Marker
                     key={u.username || String(u.id)}
                     coordinate={{
                        latitude: u.location.latitude,
                        longitude: u.location.longitude,
                     }}
                     onPress={() => setSelectedUser(u)}
                  >
                     <View style={styles.markerContainer}>
                        <View style={styles.onlineRing}>
                           <Image source={{ uri: u.avatar || u.backgroundImage }} style={styles.markerImage} />
                        </View>
                        <Text style={styles.markerName} numberOfLines={1}>
                           {u.name}
                        </Text>
                     </View>
                  </Marker>
               ) : null
            )}
         </MapView>

         {/* Refresh button */}
         <TouchableOpacity 
            style={[styles.refreshButton, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => loadLocations(true)}
            disabled={refreshing}
         >
            {refreshing ? (
               <ActivityIndicator size="small" color={colors.primary} />
            ) : (
               <Ionicons name="refresh" size={22} color={colors.primary} />
            )}
         </TouchableOpacity>

         {/* Last updated time */}
         {lastUpdated && !loading && (
            <View style={[styles.lastUpdatedContainer, { backgroundColor: colors.card }]}>
               <Text style={[styles.lastUpdatedText, { color: colors.textMuted }]}>
                  Updated: {lastUpdated.toLocaleTimeString()}
               </Text>
            </View>
         )}

         {/* Center on me */}
         <TouchableOpacity style={[styles.centerButton, { backgroundColor: colors.primary }]} onPress={centerOnMe}>
            <Ionicons name="locate" size={26} color="#fff" />
         </TouchableOpacity>

         {/* Popup mini profile */}
         {selectedUser && (
            <View style={[styles.popupContainer, { backgroundColor: colors.card }]}>
               <Image
                  source={{ uri: selectedUser.avatar || selectedUser.backgroundImage }}
                  style={styles.popupAvatar}
               />

               <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.popupName, { color: colors.text }]} numberOfLines={1}>
                     {selectedUser.name}
                  </Text>
                  {!!selectedUser.city && !!selectedUser.country && (
                     <Text style={[styles.popupCity, { color: colors.textSecondary }]} numberOfLines={1}>
                        {selectedUser.city}, {selectedUser.country}
                     </Text>
                  )}
                  {distanceKm !== null && <Text style={[styles.popupDistance, { color: colors.textMuted }]}>~{distanceKm.toFixed(1)} km away</Text>}

                  <View style={styles.popupButtonsRow}>
                     <TouchableOpacity
                        style={[styles.popupButton, { backgroundColor: colors.primary }]}
                        onPress={() => handleViewProfile(selectedUser)}
                     >
                        <Ionicons name="person-circle-outline" size={18} color="#fff" />
                        <Text style={styles.popupButtonText}>View profile</Text>
                     </TouchableOpacity>

                     <TouchableOpacity
                        style={[styles.popupButton, styles.routeButton]}
                        onPress={() => openRoute(selectedUser)}
                     >
                        <Ionicons name="navigate" size={18} color="#fff" />
                        <Text style={styles.popupButtonText}>Route</Text>
                     </TouchableOpacity>
                  </View>
               </View>

               <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.popupClose}>
                  <Ionicons name="close" size={22} color={colors.text} />
               </TouchableOpacity>
            </View>
         )}
      </View>
   );
}

const styles = StyleSheet.create({
   center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
   },

   /* Marker */
   markerContainer: {
      alignItems: "center",
   },
   onlineRing: {
      width: 46,
      height: 46,
      borderRadius: 26,
      borderWidth: 3,
      borderColor: "#4cd137", // Online ring
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#fff",
   },
   markerImage: {
      width: 40,
      height: 40,
      borderRadius: 23,
   },
   markerName: {
      marginTop: 2,
      backgroundColor: "rgba(0,0,0,0.5)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      color: "#fff",
      fontSize: 11,
      maxWidth: 80,
      textAlign: "center",
   },

   /* Refresh button */
   refreshButton: {
      position: "absolute",
      top: 60,
      right: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
   },
   
   /* Last updated */
   lastUpdatedContainer: {
      position: "absolute",
      top: 116,
      right: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
   },
   lastUpdatedText: {
      fontSize: 11,
      fontWeight: "500",
   },

   /* Center button */
   centerButton: {
      position: "absolute",
      bottom: 150,
      right: 25,
      // backgroundColor applied dynamically via inline style using colors.primary
      width: 60,
      height: 60,
      borderRadius: 50,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.5,
      shadowOffset: { width: 1, height: 3 },
      elevation: 5,
   },

   /* Popup */
   popupContainer: {
      position: "absolute",
      bottom: 40,
      left: 20,
      right: 20,
      backgroundColor: "#fff",
      padding: 12,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      elevation: 8,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 3 },
   },
   popupAvatar: {
      width: 55,
      height: 55,
      borderRadius: 27,
   },
   popupName: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#333",
   },
   popupCity: {
      fontSize: 13,
      color: "#666",
      marginTop: 2,
   },
   popupDistance: {
      fontSize: 12,
      color: "#999",
      marginTop: 2,
   },
   popupClose: {
      position: "absolute",
      right: 10,
      top: 10,
      padding: 4,
   },
   popupButtonsRow: {
      flexDirection: "row",
      marginTop: 8,
      gap: 8,
   },
   popupButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
   },
   viewProfileButton: {
      // backgroundColor applied dynamically via inline style using colors.primary
   },
   routeButton: {
      backgroundColor: "#34C759",
   },
   popupButtonText: {
      color: "#fff",
      fontSize: 13,
      marginLeft: 4,
      fontWeight: "600",
   },
});
