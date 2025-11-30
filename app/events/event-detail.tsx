// FINAL EVENT DETAIL UI – CLEAN & PREMIUM

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
   ActivityIndicator,
   Alert,
   Image,
   Keyboard,
   ScrollView,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   TouchableWithoutFeedback,
   View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import ApiService from "@/src/services/api";
import { Event } from "@/src/types";

export default function EventDetailScreen() {
   const router = useRouter();
   const { user } = useAuth();
   const { id } = useLocalSearchParams();
   const eventId = Array.isArray(id) ? id[0] : id;

   const [event, setEvent] = useState<Event | null>(null);
   const [loading, setLoading] = useState(true);
   const [viewerStatus, setViewerStatus] = useState<string | null>(null);
   const [joining, setJoining] = useState(false);
   const [comment, setComment] = useState("");
   const [sendingComment, setSendingComment] = useState(false);
   const [showActions, setShowActions] = useState(false);
   const [showEditModal, setShowEditModal] = useState(false);

   const [editAddress, setEditAddress] = useState("");
   const [editName, setEditName] = useState("");
   const [editDescription, setEditDescription] = useState("");

   const [editStart, setEditStart] = useState("");
   const [editEnd, setEditEnd] = useState("");

   function toUTCString(localDateString: string) {
      const d = new Date(localDateString);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
   }
   function toLocalString(d: string) {
      const date = new Date(d);
      return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
   }

   /* ---------------- LOAD EVENT ---------------- */
   const loadEvent = useCallback(async () => {
      if (!eventId) return;
      try {
         setLoading(true);
         const data = await ApiService.getEventById(String(eventId), user?.username);
         setEvent(data);
         setViewerStatus((data as any)?.viewer_status);
      } catch (e) {
         Alert.alert("Error", "Failed to load event.");
      } finally {
         setLoading(false);
      }
   }, [eventId, user?.username]);

   useEffect(() => {
      loadEvent();
   }, [loadEvent]);

   //update event
   const updateEvent = async () => {
      try {
         await ApiService.updateEvent(String(eventId), {
            username: user?.username,
            address: editAddress,
            date_start: toUTCString(editStart),
            date_end: toUTCString(editEnd),
         });

         setShowEditModal(false);
         loadEvent();
      } catch {
         Alert.alert("Error", "Failed to update event");
      }
   };
   useEffect(() => {
      if (event) {
         setEditAddress(event.address);
         setEditStart(event.date_start);
         setEditEnd(event.date_end);
      }
   }, [event]);

   const deleteEvent = async () => {
      Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
         { text: "Cancel", style: "cancel" },
         {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
               try {
                  await ApiService.deleteEvent(eventId, user?.username || "");
                  setShowActions(false);
                  router.back(); // quay về sau khi xoá
               } catch (err) {
                  Alert.alert("Error", "Failed to delete event");
               }
            },
         },
      ]);
   };

   /* ---------------- ACTIONS ---------------- */
   const join = async (status: "interested") => {
      if (!eventId || !user?.username) return;
      try {
         setJoining(true);
         await ApiService.joinEvent(String(eventId), user.username, status);
         setViewerStatus(status);
      } finally {
         setJoining(false);
      }
   };

   const sendComment = async () => {
      if (!comment.trim() || !user?.username) return;
      try {
         setSendingComment(true);
         await ApiService.addEventComment(String(eventId), user.username, comment.trim());
         setComment("");
         loadEvent();
      } finally {
         setSendingComment(false);
      }
   };

   if (loading || !event) {
      return (
         <View style={styles.center}>
            <ActivityIndicator size="large" />
         </View>
      );
   }

   /* ---------------- FORMAT ---------------- */
   const start = toLocalString(event.date_start);
   const end = toLocalString(event.date_end);

   const dateRange = `${start.toLocaleDateString("en-GB")} → ${end.toLocaleDateString("en-GB")}`;
   const timeRange = `${start.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
   })} - ${end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

   const hasLocation = event.latitude !== null && event.longitude !== null;
   const interestedCount = (event as any).interested_count ?? 0;

   /* -------------------------------------------------------------------------- */

   return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fcf4e3ff" }}>
         {/* === OVERLAYS HERE === */}
         {showActions && (
            <View style={[styles.actionSheet, { zIndex: 1000, elevation: 1000 }]}>
               <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                     setShowActions(false);
                     setShowEditModal(true);
                  }}
               >
                  <Text style={styles.actionText}>Edit event</Text>
               </TouchableOpacity>

               <TouchableOpacity style={styles.actionBtnDanger} onPress={deleteEvent}>
                  <Text style={styles.actionTextDanger}>Delete event</Text>
               </TouchableOpacity>

               <TouchableOpacity style={styles.actionCancel} onPress={() => setShowActions(false)}>
                  <Text style={styles.actionText}>Cancel</Text>
               </TouchableOpacity>
            </View>
         )}

         {showEditModal && (
            <TouchableWithoutFeedback
               onPress={() => Keyboard.dismiss}
               style={[styles.modalOverlay, { zIndex: 1000, elevation: 1000 }]}
            >
               <View style={styles.modalBox}>
                  <Text style={styles.modalTitle}>Edit Event</Text>
                  <TextInput
                     style={styles.input}
                     placeholder="Event name"
                     value={editName}
                     onChangeText={setEditName}
                  />

                  <TextInput
                     style={styles.input}
                     placeholder="Description"
                     value={editDescription}
                     onChangeText={setEditDescription}
                  />

                  <TextInput
                     style={styles.input}
                     placeholder="Address"
                     value={editAddress}
                     onChangeText={setEditAddress}
                  />

                  <TextInput
                     style={styles.input}
                     placeholder="Start date (YYYY-MM-DD HH:mm)"
                     value={editStart}
                     onChangeText={setEditStart}
                  />

                  <TextInput
                     style={styles.input}
                     placeholder="End date (YYYY-MM-DD HH:mm)"
                     value={editEnd}
                     onChangeText={setEditEnd}
                  />

                  <TouchableOpacity style={styles.updateBtn} onPress={updateEvent}>
                     <Text style={styles.updateText}>Save changes</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                     <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
               </View>
            </TouchableWithoutFeedback>
         )}
         <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* ───────────────────────────── Banner ───────────────────────────── */}
            <View style={styles.bannerContainer}>
               <Image source={{ uri: event.image_url || "" }} style={styles.banner} />

               <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                  <Ionicons name="arrow-back" size={22} color="#111" />
               </TouchableOpacity>
            </View>

            {/* ───────────────────────────── Title Block ───────────────────────────── */}
            <View style={styles.titleBlock}>
               <Text style={styles.eventName}>{event.name}</Text>
               <Text style={styles.address}>{event.description}</Text>
               <View style={styles.categoryChip}>
                  <Text style={styles.categoryText}>{event.category}</Text>
               </View>

               <View style={{ position: "absolute", right: 16, top: 16 }}>
                  {event.hosted_by === user?.username && (
                     <TouchableOpacity onPress={() => setShowActions(true)}>
                        <Ionicons name="ellipsis-horizontal" size={24} color="#111" />
                     </TouchableOpacity>
                  )}
               </View>

               <View style={styles.infoRow}>
                  <Info icon="calendar-outline" text={dateRange} />
                  <Info icon="time-outline" text={timeRange} />
               </View>
            </View>

            {/* ───────────────────────────── White Card ───────────────────────────── */}
            <View style={styles.card}>
               {/* JOIN BUTTONS */}
               <View style={styles.rowBetween}>
                  <JoinButton
                     title={viewerStatus ? "Interested ✓" : "Interested"}
                     onPress={() => join("interested")}
                     active={viewerStatus === "interested"}
                     disabled={joining}
                  />

                  <JoinButton title="Invite friends" green onPress={() => Alert.alert("Coming soon")} />
               </View>

               {/* FEES */}
               <View style={styles.feeRow}>
                  <Fee label="Entrance fee" value={event.entrance_fee || "Free"} />
                  <View style={styles.feeDivider} />
                  <Fee label="Pricing menu" value={event.has_pricing_menu ? "Yes" : "No"} />
               </View>

               {/* HOST */}
               <Section title="Hosted by">
                  <View style={styles.hostRow}>
                     <View style={styles.hostAvatar}>
                        <Ionicons name="person-outline" size={22} color="#fff" />
                     </View>
                     <View>
                        <Text style={styles.hostName}>{event.hosted_by}</Text>
                        <Text style={styles.hostSub}>Organizer</Text>
                     </View>
                  </View>
               </Section>
               <Section title="Participants">
                  <View style={{ marginTop: 10 }}>
                     <Text style={{ color: "#16A34A", marginTop: 4, fontSize: 14 }}>
                        👍 Interested: {interestedCount}
                     </Text>
                  </View>
               </Section>

               {/* DETAILS */}
               <Section title="Event details">
                  <Info icon="calendar-outline" text={dateRange} large />
                  <Info icon="location-outline" text={event.address} large />
                  <Info icon="time-outline" text={timeRange} large />

                  <TouchableOpacity
                     onPress={() =>
                        router.push(
                           `/events/event-map?lat=${event.latitude}&lng=${event.longitude}&name=${encodeURIComponent(
                              event.name
                           )}&address=${encodeURIComponent(event.address)}`
                        )
                     }
                  >
                     <MapView
                        style={styles.map}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        pitchEnabled={false}
                        rotateEnabled={false}
                        initialRegion={{
                           latitude: event.latitude!,
                           longitude: event.longitude!,
                           latitudeDelta: 0.01,
                           longitudeDelta: 0.01,
                        }}
                     >
                        <Marker coordinate={{ latitude: event.latitude!, longitude: event.longitude! }} />
                     </MapView>
                  </TouchableOpacity>
               </Section>

               {/* DESCRIPTION */}
               <Section title="Details">
                  <Text style={styles.detailsText}>
                     {event.details || event.description || "No additional details."}
                  </Text>
               </Section>

               {/* COMMENTS */}
               <Section title={`Comments ${event.comment_count || 0}`}>
                  {event.comment_count === 0 && (
                     <View style={styles.noCommentsBox}>
                        <Ionicons name="chatbubble-ellipses-outline" size={55} color="#D1D5DB" />
                        <Text style={styles.noCommentsTitle}>No comments yet</Text>
                     </View>
                  )}
                  {event.comments && event.comments.length > 0 && (
                     <View style={{ marginTop: 10 }}>
                        {event.comments.map((c: any) => (
                           <View key={c.id} style={styles.commentItem}>
                              <View style={styles.commentAvatar}>
                                 <Ionicons name="person-outline" size={18} color="#fff" />
                              </View>

                              <View style={{ flex: 1 }}>
                                 <Text style={styles.commentAuthor}>{c.author_username}</Text>
                                 <Text style={styles.commentContent}>{c.content}</Text>
                                 <Text style={styles.commentTime}>{new Date(c.created_at).toLocaleString()}</Text>
                              </View>
                           </View>
                        ))}
                     </View>
                  )}

                  {/* COMMENT INPUT */}
                  <View style={styles.commentRow}>
                     <View style={styles.commentInputBox}>
                        <Ionicons name="chatbubble-outline" size={18} color="#9CA3AF" />
                        <TextInput
                           style={styles.commentInput}
                           placeholder="Write a comment..."
                           value={comment}
                           onChangeText={setComment}
                        />
                     </View>

                     <TouchableOpacity
                        disabled={!comment.trim() || sendingComment}
                        onPress={sendComment}
                        style={styles.sendBtn}
                     >
                        {sendingComment ? (
                           <ActivityIndicator size="small" color="#fff" />
                        ) : (
                           <Ionicons name="send" size={16} color="#fff" />
                        )}
                     </TouchableOpacity>
                  </View>
               </Section>
            </View>
         </ScrollView>
      </SafeAreaView>
   );
}

/* ---------------- Reusable Components ---------------- */

const Info = ({ icon, text, large }: any) => (
   <View style={[styles.infoItem, large && { marginTop: 6 }]}>
      <Ionicons name={icon} size={large ? 20 : 16} color="#F97316" />
      <Text style={styles.infoText}>{text}</Text>
   </View>
);

const JoinButton = ({ title, onPress, active, disabled, green }: any) => (
   <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.joinBtn, active && { backgroundColor: "#FDBA74" }, green && { backgroundColor: "#16A34A" }]}
   >
      <Text style={[styles.joinBtnText, green && { color: "#fff" }]}>{title}</Text>
   </TouchableOpacity>
);

const Fee = ({ label, value }: any) => (
   <View style={styles.feeItem}>
      <Text style={styles.feeLabel}>{label}</Text>
      <Text style={[styles.feeValue, value === "Free" && { color: "#16A34A" }]}>{value}</Text>
   </View>
);

const Section = ({ title, children }: any) => (
   <View style={{ marginTop: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
   </View>
);

const styles = StyleSheet.create({
   center: { flex: 1, justifyContent: "center", alignItems: "center" },

   /* Banner */
   bannerContainer: { width: "100%", height: 260, backgroundColor: "#000", borderRadius: 22 },
   banner: { width: "100%", height: "100%", borderRadius: 22 },
   backBtn: {
      position: "absolute",
      top: 30,
      left: 16,
      backgroundColor: "#FFFFFFEE",
      padding: 8,
      borderRadius: 40,
      elevation: 4,
   },

   /* Title Block */
   titleBlock: { paddingTop: 16, paddingHorizontal: 16 },
   eventName: { fontSize: 24, fontWeight: "800", color: "#111" },
   address: { fontSize: 15, marginTop: 4, color: "#6B7280" },

   infoRow: { flexDirection: "row", marginTop: 12, gap: 14 },
   infoItem: { flexDirection: "row", alignItems: "center" },
   infoText: { marginLeft: 6, fontSize: 14, color: "#444" },

   /* Card */
   card: {
      marginTop: 20,
      marginHorizontal: 12,
      padding: 16,
      backgroundColor: "#fff",
      borderRadius: 18,
      elevation: 2,
   },

   rowBetween: { flexDirection: "row", gap: 12 },

   joinBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderRadius: 999,
      backgroundColor: "#FFEDD5",
   },
   joinBtnText: { fontSize: 14, fontWeight: "700", color: "#C2410C" },

   /* Fees */
   feeRow: {
      marginTop: 16,
      padding: 12,
      borderRadius: 12,
      backgroundColor: "#F9FAFB",
      flexDirection: "row",
      alignItems: "center",
   },
   feeDivider: { width: 1, height: 28, backgroundColor: "#E5E7EB" },
   feeItem: { flex: 1, alignItems: "center" },
   feeLabel: { fontSize: 12, color: "#6B7280" },
   feeValue: { fontSize: 15, fontWeight: "700", marginTop: 2 },

   /* Host */
   hostRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
   hostAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#F97316",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
   },
   hostName: { fontSize: 15, fontWeight: "700", color: "#111" },
   hostSub: { fontSize: 12, color: "#9CA3AF" },

   /* Map */
   map: { width: "100%", height: 160, marginTop: 10, borderRadius: 14 },

   /* Description */
   detailsText: { fontSize: 14, lineHeight: 20, color: "#4B5563" },

   /* Comments */
   noCommentsBox: { alignItems: "center", marginTop: 8 },
   noCommentsTitle: { marginTop: 6, fontSize: 14, color: "#6B7280" },

   commentRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
   commentInputBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      backgroundColor: "#F3F4F6",
      borderRadius: 999,
   },
   commentInput: { flex: 1, marginLeft: 8, padding: 15 },

   sendBtn: {
      marginLeft: 12,
      width: 40,
      height: 40,
      backgroundColor: "#F97316",
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
   },

   /* Section */
   sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
   commentItem: {
      flexDirection: "row",
      marginBottom: 12,
      padding: 10,
      backgroundColor: "#F3F4F6",
      borderRadius: 12,
   },

   commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#F97316",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
   },

   commentAuthor: {
      fontSize: 14,
      fontWeight: "700",
      color: "#111",
   },

   commentContent: {
      fontSize: 14,
      marginTop: 2,
      color: "#374151",
   },

   commentTime: {
      marginTop: 4,
      fontSize: 11,
      color: "#9CA3AF",
   },
   categoryChip: {
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 14,
      backgroundColor: "#25fa2115",
      borderRadius: 999,
      marginTop: 10,
      borderWidth: 1,
      borderColor: "#33860633",
   },

   categoryText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#04c631ff",
   },
   actionSheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "#fff",
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      elevation: 10,
   },

   actionBtn: {
      paddingVertical: 14,
   },

   actionBtnDanger: {
      paddingVertical: 14,
   },

   actionText: {
      fontSize: 16,
      textAlign: "center",
      color: "#111",
   },

   actionTextDanger: {
      fontSize: 16,
      textAlign: "center",
      color: "#DC2626",
      fontWeight: "700",
   },

   actionCancel: {
      paddingVertical: 14,
      marginTop: 6,
      borderTopWidth: 1,
      borderColor: "#E5E7EB",
   },
   modalOverlay: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      zIndex: 999,
   },

   modalBox: {
      width: "100%",
      backgroundColor: "#fff",
      borderRadius: 16,
      padding: 20,
      elevation: 10,
   },

   modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: "#111",
      marginBottom: 16,
      textAlign: "center",
   },

   input: {
      width: "100%",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderRadius: 10,
      backgroundColor: "#F9FAFB",
      fontSize: 14,
      marginBottom: 16,
   },

   updateBtn: {
      backgroundColor: "#F97316",
      paddingVertical: 12,
      borderRadius: 10,
      marginTop: 4,
   },

   updateText: {
      textAlign: "center",
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
   },

   cancelText: {
      marginTop: 14,
      textAlign: "center",
      color: "#6B7280",
      fontSize: 14,
   },
});
