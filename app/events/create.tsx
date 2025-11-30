import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
   ActivityIndicator,
   Alert,
   Image,
   Platform,
   ScrollView,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import ApiService from "@/src/services/api";
import LocationService from "@/src/services/location";

const EVENT_CATEGORIES = ["Music", "Nightlife", "Food & Drink", "Workshop", "Meetup", "Outdoor", "Other"];

export default function CreateEventScreen() {
   const router = useRouter();
   const { user } = useAuth();
   const { colors } = useTheme();

   const [name, setName] = useState("");
   const [description, setDescription] = useState("");
   const [details, setDetails] = useState("");
   const [address, setAddress] = useState("");

   // date & time
   const [startDate, setStartDate] = useState<Date | null>(null);
   const [endDate, setEndDate] = useState<Date | null>(null);
   const [showStartPicker, setShowStartPicker] = useState(false);
   const [showEndPicker, setShowEndPicker] = useState(false);
   const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

   // pricing
   const [isFree, setIsFree] = useState(true);
   const [entranceFee, setEntranceFee] = useState("");
   const [hasPricingMenu, setHasPricingMenu] = useState(false);

   // category
   const [category, setCategory] = useState<string | null>(null);

   // location
   const [coords, setCoords] = useState<{
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
   } | null>(null);

   // image
   const [image, setImage] = useState<string | null>(null);

   const [uploading, setUploading] = useState(false);
   const [loading, setLoading] = useState(false);

   /* --------------------------- helpers --------------------------- */

   const formattedDateTime = (d: Date | null) => {
      if (!d) return "Select date & time";
      return `${d.toLocaleDateString("en-GB")}  •  ${d.toLocaleTimeString("en-US", {
         hour: "2-digit",
         minute: "2-digit",
      })}`;
   };

   const openImagePicker = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ImagePicker.MediaTypeOptions.Images,
         quality: 0.8,
      });

      if (!result.canceled) {
         setImage(result.assets[0].uri);
      }
   };

   const useCurrentLocation = async () => {
      try {
         const hasPerm = await LocationService.hasPermissions();
         if (!hasPerm) {
            const granted = await LocationService.requestPermissions();
            if (!granted) {
               Alert.alert("Location permission", "We need your permission to use your current location.");
               return;
            }
         }

         const loc = await LocationService.getCurrentLocation();
         if (loc) {
            const { latitude, longitude } = loc.coords;
            setCoords({
               latitude,
               longitude,
               latitudeDelta: 0.01,
               longitudeDelta: 0.01,
            });
         }
      } catch (err) {
         console.log("Get location error:", err);
         Alert.alert("Error", "Failed to get current location.");
      }
   };

   /* --------------------------- submit --------------------------- */

   const handleCreateEvent = async () => {
      if (!name || !address || !startDate || !endDate) {
         return Toast.show({
            type: "error",
            text1: "Missing fields",
            text2: "Please fill name, address, start & end time.",
         });
      }

      if (!user?.username) {
         return Toast.show({
            type: "error",
            text1: "Not logged in",
            text2: "You must be logged in to create events.",
         });
      }

      try {
         setLoading(true);

         let imageUrl: string | null = null;

         if (image) {
            setUploading(true);

            try {
               const uriParts = image.split(".");
               const fileType = uriParts[uriParts.length - 1];

               const file = {
                  uri: image,
                  name: `event_${Date.now()}.${fileType}`,
                  type: `image/${fileType}`,
               } as any;

               imageUrl = await ApiService.uploadEventImage(file);
            } catch (err) {
               console.log("Upload image error:", err);
               Toast.show({ type: "error", text1: "Upload failed" });
            } finally {
               setUploading(false);
            }
         }

         const eventData = {
            hosted_by: user.username,
            name,
            description,
            details: details || description,
            address,
            date_start: startDate!.toISOString(),
            date_end: endDate!.toISOString(),
            image_url: imageUrl,
            category: category || "Other",
            entrance_fee: isFree ? "Free" : entranceFee || "Paid",
            has_pricing_menu: hasPricingMenu,
            is_recurring: false,
            recurrence_pattern: null,
            latitude: coords?.latitude ?? null,
            longitude: coords?.longitude ?? null,
         };

         const created = await ApiService.createEvent(eventData);

         Toast.show({
            type: "success",
            text1: "Event created!",
            text2: created.name,
         });

         router.back();
      } catch (err: any) {
         console.error("Create event FE error:", err);
         Toast.show({
            type: "error",
            text1: "Error",
            text2: err?.response?.data?.message || "Failed to create event.",
         });
      } finally {
         setLoading(false);
      }
   };

   /* --------------------------- render --------------------------- */

   return (
      <SafeAreaView style={{ flex: 1 }}>
         <ScrollView
            style={{ flex: 1, backgroundColor: "#fdebcaff" }}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
         >
            <Text style={styles.title}>Create Event</Text>
            <Text style={styles.subtitle}>Share something cool with the community.</Text>

            {/* NAME */}
            <View style={styles.card}>
               <Text style={styles.label}>
                  Event name <Text style={{ color: "#F97316" }}>*</Text>
               </Text>
               <TextInput
                  placeholder="Ex: Sing & Slay Karaoke Night"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
               />

               {/* CATEGORY */}
               <Text style={[styles.label, { marginTop: 14 }]}>Category</Text>
               <View style={styles.chipRow}>
                  {EVENT_CATEGORIES.map((c) => {
                     const selected = category === c;
                     return (
                        <TouchableOpacity
                           key={c}
                           style={[styles.chip, selected && { backgroundColor: "#F97316" + "22" }]}
                           onPress={() => setCategory(selected ? null : c)}
                        >
                           <Text style={[styles.chipText, selected && { color: "#F97316", fontWeight: "700" }]}>
                              {c}
                           </Text>
                        </TouchableOpacity>
                     );
                  })}
               </View>

               {/* DESCRIPTION */}
               <Text style={[styles.label, { marginTop: 16 }]}>Short description</Text>
               <TextInput
                  placeholder="One or two lines to describe this event..."
                  value={description}
                  onChangeText={setDescription}
                  style={[styles.input, { height: 70 }]}
                  multiline
               />

               {/* DETAILS */}
               <Text style={[styles.label, { marginTop: 16 }]}>Details</Text>
               <TextInput
                  placeholder="Longer details, rules, schedule..."
                  value={details}
                  onChangeText={setDetails}
                  style={[styles.input, { height: 110 }]}
                  multiline
               />
            </View>

            {/* DATE & TIME */}
            <View style={styles.card}>
               <Text style={styles.sectionTitle}>Date & Time</Text>

               <Text style={styles.label}>
                  Start <Text style={{ color: "#F97316" }}>*</Text>
               </Text>
               <TouchableOpacity
                  style={styles.selectRow}
                  onPress={() => {
                     setPickerMode("date");
                     setShowStartPicker(true);
                  }}
               >
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text style={styles.selectText}>{formattedDateTime(startDate)}</Text>
               </TouchableOpacity>

               <Text style={[styles.label, { marginTop: 12 }]}>
                  End <Text style={{ color: "#F97316" }}>*</Text>
               </Text>
               <TouchableOpacity
                  style={styles.selectRow}
                  onPress={() => {
                     setPickerMode("date");
                     setShowEndPicker(true);
                  }}
               >
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text style={styles.selectText}>{formattedDateTime(endDate)}</Text>
               </TouchableOpacity>
            </View>

            {/* ADDRESS + LOCATION */}
            <View style={styles.card}>
               <Text style={styles.sectionTitle}>Location</Text>

               <Text style={styles.label}>
                  Address <Text style={{ color: "#F97316" }}>*</Text>
               </Text>
               <TextInput
                  placeholder="Ex: 61 Điện Ng. Thị Sĩ, Bắc Mỹ An, Đà Nẵng..."
                  value={address}
                  onChangeText={setAddress}
                  style={styles.input}
               />

               <TouchableOpacity style={styles.locationButton} onPress={useCurrentLocation}>
                  <Ionicons name="navigate-outline" size={18} color="#16A34A" />
                  <Text style={styles.locationButtonText}>Use my current location</Text>
               </TouchableOpacity>

               {coords && (
                  <View style={{ marginTop: 12 }}>
                     <Text style={styles.coordsText}>
                        Lat: {coords.latitude.toFixed(5)} | Lng: {coords.longitude.toFixed(5)}
                     </Text>

                     <MapView
                        style={styles.map}
                        initialRegion={coords}
                        region={coords}
                        onPress={(e) => {
                           const { latitude, longitude } = e.nativeEvent.coordinate;
                           setCoords({
                              latitude,
                              longitude,
                              latitudeDelta: 0.01,
                              longitudeDelta: 0.01,
                           });
                        }}
                     >
                        <Marker coordinate={coords} />
                     </MapView>

                     <Text style={styles.mapHint}>Tap on the map to adjust the marker.</Text>
                  </View>
               )}
            </View>

            {/* PRICING */}
            <View style={styles.card}>
               <Text style={styles.sectionTitle}>Pricing</Text>

               <View style={styles.toggleRow}>
                  <TouchableOpacity
                     style={[styles.toggleChip, isFree && { backgroundColor: "#16A34A" }]}
                     onPress={() => setIsFree(true)}
                  >
                     <Text style={[styles.toggleText, isFree && { color: "#fff", fontWeight: "700" }]}>Free</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={[styles.toggleChip, !isFree && { backgroundColor: "#FACC15" }]}
                     onPress={() => setIsFree(false)}
                  >
                     <Text style={[styles.toggleText, !isFree && { color: "#78350F", fontWeight: "700" }]}>Paid</Text>
                  </TouchableOpacity>
               </View>

               {!isFree && (
                  <>
                     <Text style={[styles.label, { marginTop: 10 }]}>Entrance fee</Text>
                     <TextInput
                        placeholder="Ex: 100,000 VND / person"
                        value={entranceFee}
                        onChangeText={setEntranceFee}
                        style={styles.input}
                     />
                  </>
               )}

               <TouchableOpacity style={styles.checkboxRow} onPress={() => setHasPricingMenu((p) => !p)}>
                  <View style={[styles.checkbox, hasPricingMenu && { backgroundColor: "#F97316" }]}>
                     {hasPricingMenu && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.checkboxLabel}>This event has a pricing menu</Text>
               </TouchableOpacity>
            </View>

            {/* IMAGE */}
            <View style={styles.card}>
               <Text style={styles.sectionTitle}>Cover Image</Text>

               <TouchableOpacity style={styles.imagePicker} onPress={openImagePicker}>
                  {image ? (
                     <Image source={{ uri: image }} style={{ width: "100%", height: "100%", borderRadius: 16 }} />
                  ) : (
                     <View style={{ alignItems: "center" }}>
                        <Ionicons name="image-outline" size={32} color="#9CA3AF" style={{ marginBottom: 8 }} />
                        <Text style={{ color: "#6B7280" }}>Tap to select an event banner</Text>
                     </View>
                  )}
               </TouchableOpacity>

               {uploading && (
                  <View style={styles.uploadRow}>
                     <ActivityIndicator size="small" />
                     <Text style={{ marginLeft: 8 }}>Uploading image...</Text>
                  </View>
               )}
            </View>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
               onPress={handleCreateEvent}
               disabled={loading}
               style={[styles.submitButton, { opacity: loading ? 0.7 : 1 }]}
            >
               {loading ? (
                  <ActivityIndicator color="#fff" />
               ) : (
                  <>
                     <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                     <Text style={styles.submitText}>Publish Event</Text>
                  </>
               )}
            </TouchableOpacity>
         </ScrollView>

         {/* DateTimePickers */}
         {(showStartPicker || showEndPicker) && (
            <DateTimePicker
               value={(showStartPicker ? startDate : endDate) || new Date()}
               mode={pickerMode}
               is24Hour={false}
               display={Platform.OS === "ios" ? "inline" : "default"}
               onChange={(event, selectedDate) => {
                  if (event.type === "dismissed") {
                     setShowStartPicker(false);
                     setShowEndPicker(false);
                     return;
                  }

                  const currentDate = selectedDate || new Date();

                  if (pickerMode === "date") {
                     // sau khi chọn date => chọn time luôn
                     setPickerMode("time");
                     if (showStartPicker) {
                        const base = startDate || new Date();
                        base.setFullYear(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                        setStartDate(new Date(base));
                     } else {
                        const base = endDate || new Date();
                        base.setFullYear(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                        setEndDate(new Date(base));
                     }
                  } else {
                     // time
                     if (showStartPicker) {
                        const base = startDate || new Date();
                        base.setHours(currentDate.getHours(), currentDate.getMinutes());
                        setStartDate(new Date(base));
                        setShowStartPicker(false);
                     } else {
                        const base = endDate || new Date();
                        base.setHours(currentDate.getHours(), currentDate.getMinutes());
                        setEndDate(new Date(base));
                        setShowEndPicker(false);
                     }
                     setPickerMode("date");
                  }
               }}
            />
         )}
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   title: {
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 4,
      color: "#111827",
   },
   subtitle: {
      fontSize: 13,
      color: "#6B7280",
      marginBottom: 12,
   },
   card: {
      backgroundColor: "#FFFFFF",
      borderRadius: 18,
      padding: 14,
      marginTop: 10,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      elevation: 2,
   },
   label: {
      fontSize: 13,
      color: "#6B7280",
      marginBottom: 6,
   },
   sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#111827",
      marginBottom: 10,
   },
   input: {
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
      color: "#111827",
      backgroundColor: "#F9FAFB",
   },
   chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
   },
   chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "#F3F4F6",
   },
   chipText: {
      fontSize: 12,
      color: "#4B5563",
   },
   selectRow: {
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#F9FAFB",
   },
   selectText: {
      marginLeft: 8,
      fontSize: 14,
      color: "#111827",
   },
   locationButton: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
   },
   locationButtonText: {
      marginLeft: 6,
      fontSize: 13,
      color: "#16A34A",
      fontWeight: "600",
   },
   coordsText: {
      fontSize: 12,
      color: "#6B7280",
      marginBottom: 6,
   },
   map: {
      width: "100%",
      height: 160,
      borderRadius: 16,
   },
   mapHint: {
      fontSize: 11,
      color: "#9CA3AF",
      marginTop: 4,
   },
   toggleRow: {
      flexDirection: "row",
      gap: 10,
   },
   toggleChip: {
      flex: 1,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      paddingVertical: 8,
      alignItems: "center",
      backgroundColor: "#F9FAFB",
   },
   toggleText: {
      fontSize: 14,
      color: "#4B5563",
   },
   checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
   },
   checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "#D1D5DB",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
      backgroundColor: "#fff",
   },
   checkboxLabel: {
      fontSize: 13,
      color: "#4B5563",
   },
   imagePicker: {
      marginTop: 6,
      height: 180,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      backgroundColor: "#F3F4F6",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
   },
   uploadRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
   },
   submitButton: {
      marginTop: 16,
      backgroundColor: "#F97316",
      borderRadius: 999,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 14,
   },
   submitText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
      marginLeft: 6,
   },
});
