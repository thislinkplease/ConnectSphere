import { useAuth } from "@/src/context/AuthContext";
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
   const router = useRouter();

   const [users, setUsers] = useState<User[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedUser, setSelectedUser] = useState<User | null>(null);
   const mapRef = useRef<MapView>(null);

   // ---- Load visible users with locations ----
   const loadLocations = async () => {
      try {
         const data = await ApiService.getVisibleUsersLocation();
         setUsers(data || []);
      } catch (err) {
         console.log("map error:", err);
      } finally {
         setLoading(false);
      }
   };

   // First load + realtime polling
   useEffect(() => {
      loadLocations();

      const interval = setInterval(() => {
         loadLocations();
      }, 5000); // 5s 1 lần

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

         {/* Center on me */}
         <TouchableOpacity style={styles.centerButton} onPress={centerOnMe}>
            <Ionicons name="locate" size={26} color="#fff" />
         </TouchableOpacity>

         {/* Popup mini profile */}
         {selectedUser && (
            <View style={styles.popupContainer}>
               <Image
                  source={{ uri: selectedUser.avatar || selectedUser.backgroundImage }}
                  style={styles.popupAvatar}
               />

               <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.popupName} numberOfLines={1}>
                     {selectedUser.name}
                  </Text>
                  {!!selectedUser.city && !!selectedUser.country && (
                     <Text style={styles.popupCity} numberOfLines={1}>
                        {selectedUser.city}, {selectedUser.country}
                     </Text>
                  )}
                  {distanceKm !== null && <Text style={styles.popupDistance}>~{distanceKm.toFixed(1)} km away</Text>}

                  <View style={styles.popupButtonsRow}>
                     <TouchableOpacity
                        style={[styles.popupButton, styles.viewProfileButton]}
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
                  <Ionicons name="close" size={22} color="#333" />
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

   /* Center button */
   centerButton: {
      position: "absolute",
      bottom: 150,
      right: 25,
      backgroundColor: "#007AFF",
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
      backgroundColor: "#007AFF",
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
