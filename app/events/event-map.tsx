import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";

const GOOGLE_MAPS_API_KEY = "YOUR_API_KEY_HERE";

export default function EventMapScreen() {
   const router = useRouter();
   const { lat, lng, name, address } = useLocalSearchParams();

   const eventLat = Number(lat);
   const eventLng = Number(lng);

   const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);

   useEffect(() => {
      (async () => {
         let { status } = await Location.requestForegroundPermissionsAsync();
         if (status !== "granted") return;

         let loc = await Location.getCurrentPositionAsync({});
         setUserLoc({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
         });
      })();
   }, []);

   const openInMaps = () => {
      const label = encodeURIComponent(name as string);
      const fullAddress = encodeURIComponent(address as string);

      const url =
         Platform.OS === "ios"
            ? `http://maps.apple.com/?ll=${eventLat},${eventLng}&q=${label}`
            : `https://www.google.com/maps/search/?api=1&query=${eventLat},${eventLng}`;

      Linking.openURL(url);
   };

   return (
      <View style={{ flex: 1 }}>
         {/* Back Button */}
         <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111" />
         </TouchableOpacity>

         {/* Open in Google/Apple Maps */}
         <TouchableOpacity style={styles.openMapsBtn} onPress={openInMaps}>
            <Ionicons name="location-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 6 }}>Open in Maps</Text>
         </TouchableOpacity>

         <MapView
            style={{ flex: 1 }}
            initialRegion={{
               latitude: eventLat,
               longitude: eventLng,
               latitudeDelta: 0.01,
               longitudeDelta: 0.01,
            }}
         >
            {/* Event marker */}
            <Marker
               coordinate={{ latitude: eventLat, longitude: eventLng }}
               title={name as string}
               description={address as string}
            />

            {/* User marker */}
            {userLoc && <Marker coordinate={userLoc} pinColor="blue" title="Your location" />}

            {/* Draw polyline route */}
            {userLoc && (
               <MapViewDirections
                  origin={userLoc}
                  destination={{ latitude: eventLat, longitude: eventLng }}
                  apikey={GOOGLE_MAPS_API_KEY}
                  strokeWidth={4}
                  strokeColor="#1D4ED8"
               />
            )}
         </MapView>
      </View>
   );
}

const styles = StyleSheet.create({
   backBtn: {
      position: "absolute",
      top: 40,
      left: 16,
      backgroundColor: "#FFFFFFEE",
      padding: 10,
      borderRadius: 40,
      zIndex: 20,
   },
   openMapsBtn: {
      position: "absolute",
     
      bottom: 50,
      right: 15,
      flexDirection: "row",
      backgroundColor: "#f0b70dff",
      paddingHorizontal: 24,
      paddingVertical: 19,
      borderRadius: 40,
      zIndex: 20,
      fontWeight: "600",
      alignItems: "center",
   },
});
