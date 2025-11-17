// app/events/event-detail.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
   ActivityIndicator,
   Alert,
   Image,
   ScrollView,
   StyleSheet,
   Text,
   TextInput,
   TouchableOpacity,
   View,
} from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import ApiService from "@/src/services/api";
import { Event } from "@/src/types";

export default function EventDetailScreen() {
   const router = useRouter();
   const { colors } = useTheme();
   const { user } = useAuth();
   const { id } = useLocalSearchParams();

   const eventId = Array.isArray(id) ? id[0] : id;

   const [event, setEvent] = useState<Event | null>(null);
   const [loading, setLoading] = useState(true);
   const [joining, setJoining] = useState(false);
   const [viewerStatus, setViewerStatus] = useState<string | null>(null);
   const [commentText, setCommentText] = useState("");
   const [sendingComment, setSendingComment] = useState(false);

   const loadEvent = useCallback(async () => {
      if (!eventId) return;
      try {
         setLoading(true);
         const data = await ApiService.getEventById(String(eventId), user?.username);
         setEvent(data);
         // backend trả viewer_status (xem router.get("/:id"))
         // @ts-ignore
         setViewerStatus((data as any).viewer_status ?? null);
      } catch (error) {
         console.error("Error loading event detail:", error);
         Alert.alert("Error", "Failed to load event.");
      } finally {
         setLoading(false);
      }
   }, [eventId, user?.username]);

   useEffect(() => {
      loadEvent();
   }, [loadEvent]);

   const handleJoin = async (status: "going" | "interested") => {
      if (!eventId || !user?.username) return;
      try {
         setJoining(true);
         await ApiService.joinEvent(String(eventId), user.username, status);
         setViewerStatus(status);
         Alert.alert("Success", status === "going" ? "You are going!" : "Marked as interested");
      } catch (e) {
         console.error("Error joining event:", e);
         Alert.alert("Error", "Failed to update your participation.");
      } finally {
         setJoining(false);
      }
   };

   const handleSendComment = async () => {
      if (!eventId || !user?.username) return;
      if (!commentText.trim()) return;

      try {
         setSendingComment(true);
         await ApiService.addEventComment(String(eventId), user.username, commentText.trim());
         setCommentText("");
         Alert.alert("Comment added", "Your comment has been posted.");
         // nếu muốn reload comment_count / comments thì gọi lại loadEvent()
         loadEvent();
      } catch (e) {
         console.error("Error sending comment:", e);
         Alert.alert("Error", "Failed to send comment.");
      } finally {
         setSendingComment(false);
      }
   };

   if (!eventId) {
      return (
         <View style={styles.center}>
            <Text>No event id provided.</Text>
         </View>
      );
   }

   if (loading || !event) {
      return (
         <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
         </View>
      );
   }

   const startDate = new Date(event.dateStart);
   const endDate = new Date(event.dateEnd);
   const formattedDateRange = `${startDate.toLocaleDateString("en-GB")} - ${endDate.toLocaleDateString("en-GB")}`;
   const timeStart = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
   const timeEnd = endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

   const isRecurring = (event as any).is_recurring;
   const hasPricingMenu = (event as any).has_pricing_menu;

   // tạo list các ngày lặp lại (demo 4 ngày, cách nhau 1 tuần)
   const recurringDates: Date[] = [];
   if (isRecurring) {
      for (let i = 0; i < 4; i++) {
         const d = new Date(startDate);
         d.setDate(startDate.getDate() + i * 7);
         recurringDates.push(d);
      }
   }

   const isInterested = viewerStatus === "interested";
   const isGoing = viewerStatus === "going";

   return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
         <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Banner */}
            <View>
               <Image source={{ uri: event.image_url || "https://via.placeholder.com/600x300" }} style={styles.banner} />

               {/* Back button */}
               <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                  <Ionicons name="arrow-back" size={24} color="#000" />
               </TouchableOpacity>

               {/* Play / share icon (placeholder) */}
               <TouchableOpacity style={styles.playButton}>
                  <Ionicons name="play-circle" size={32} color="#fff" />
               </TouchableOpacity>

               {/* Repeated Event badge */}
               {isRecurring && (
                  <View style={styles.recurringBadge}>
                     <Text style={styles.recurringText}>Repeated Event</Text>
                  </View>
               )}
            </View>

            {/* Content */}
            <View style={styles.contentBox}>
               {/* Title */}
               <Text style={styles.title} numberOfLines={3}>
                  {event.name}
               </Text>

               {/* Category chip
               <View style={styles.categoryRow}>
                  <View style={styles.categoryChip}>
                     <Text style={styles.categoryText}>{event.category || "Music"}</Text>
                  </View>
               </View> */}

               {/* Buttons: Interested / Invite friends */}
               <View style={styles.actionRow}>
                  <TouchableOpacity
                     style={[styles.actionButton, { backgroundColor: isInterested || isGoing ? "#F57C00" : "#FFE0B2" }]}
                     disabled={joining}
                     onPress={() => handleJoin("interested")}
                  >
                     <Text style={[styles.actionButtonText, { color: isInterested || isGoing ? "#fff" : "#E65100" }]}>
                        {isInterested || isGoing ? "Interested ✓" : "Interested"}
                     </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                     style={[styles.actionButton, { backgroundColor: "#2E7D32" }]}
                     onPress={() => Alert.alert("Invite", "Invite friends feature coming soon")}
                  >
                     <Text style={[styles.actionButtonText, { color: "#fff" }]}>Invite friends</Text>
                  </TouchableOpacity>
               </View>

               {/* Recurring dates scroller */}
               {isRecurring && recurringDates.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recurringScroll}>
                     {recurringDates.map((d, idx) => {
                        const isActive = idx === 0;
                        return (
                           <View key={idx} style={[styles.datePill, isActive && styles.datePillActive]}>
                              <Text style={[styles.datePillDay, isActive && styles.datePillDayActive]}>
                                 {d.toLocaleDateString("en-US", { weekday: "short" })}
                              </Text>
                              <Text style={[styles.datePillDate, isActive && styles.datePillDateActive]}>
                                 {d.getDate()} {d.toLocaleString("en-US", { month: "short" })}
                              </Text>
                              <View style={styles.datePillTimeRow}>
                                 <Ionicons name="time-outline" size={12} color={isActive ? "#fff" : "#777"} />
                                 <Text style={[styles.datePillTime, isActive && styles.datePillTimeActive]}>
                                    {timeStart}
                                 </Text>
                              </View>
                           </View>
                        );
                     })}
                  </ScrollView>
               )}

               {/* Entrance & Pricing */}
               <View style={styles.feeRow}>
                  <View style={styles.feeItem}>
                     <Ionicons name="wallet-outline" size={18} color="#777" />
                     <Text style={styles.feeLabel}>Entrance fee</Text>
                     <Text style={styles.feeValue}>{event.entranceFee || "Free"}</Text>
                  </View>
                  <View style={styles.feeDivider} />
                  <View style={styles.feeItem}>
                     <Ionicons name="list-outline" size={18} color="#777" />
                     <Text style={styles.feeLabel}>Pricing menu</Text>
                     <Text style={styles.feeValue}>{hasPricingMenu ? "Yes" : "No"}</Text>
                  </View>
               </View>

               {/* Hosted by */}
               <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                     <Text style={styles.sectionTitle}>Hosted by</Text>
                  </View>

                  <View style={styles.hostRow}>
                     <View style={styles.hostAvatar}>
                        <Ionicons name="person-outline" size={24} color="#fff" />
                     </View>
                     <Text style={styles.hostName}>{event.hosted_by}</Text>
                  </View>
               </View>

               {/* Participants */}
               <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                     <Text style={styles.sectionTitle}>Participants {(event as any).participant_count || 0}</Text>
                     <TouchableOpacity>
                        <Ionicons name="chevron-forward" size={18} color="#777" />
                     </TouchableOpacity>
                  </View>
               </View>

               {/* Date, Address, Time */}
               <View style={styles.section}>
                  <View style={styles.detailRow}>
                     <Ionicons name="calendar-outline" size={20} color="#0D8D43" />
                     <Text style={styles.detailText}>{formattedDateRange}</Text>
                  </View>

                  <View style={styles.detailRow}>
                     <Ionicons name="location-outline" size={20} color="#0D8D43" />
                     <Text style={styles.detailText}>{event.address}</Text>
                  </View>

                  <View style={styles.detailRow}>
                     <Ionicons name="time-outline" size={20} color="#0D8D43" />
                     <Text style={styles.detailText}>
                        {isRecurring ? "Weekly " : ""}
                        {timeStart} - {timeEnd}
                     </Text>
                  </View>
               </View>

               {/* Details */}
               <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Details</Text>
                  <Text style={styles.detailsText}>
                     {event.details || event.description || "No additional details for this event yet."}
                  </Text>
               </View>

               {/* Comments section */}
               <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Comments {(event as any).comment_count || 0}</Text>

                  {(event as any).comment_count === 0 && (
                     <View style={styles.noCommentsBox}>
                        <Ionicons name="chatbubble-ellipses-outline" size={70} color="#ccc" />
                        <Text style={styles.noCommentsTitle}>No comments yet</Text>
                        <Text style={styles.noCommentsSubtitle}>Leave a comment if you are interested</Text>
                     </View>
                  )}

                  {/* Comment input */}
                  <View style={styles.commentRow}>
                     <View style={styles.commentInputWrapper}>
                        <Ionicons
                           name="chatbubble-outline"
                           size={18}
                           color="#999"
                           style={{ marginLeft: 8, marginRight: 4 }}
                        />
                        <TextInput
                           placeholder="What's on your mind?"
                           placeholderTextColor="#aaa"
                           value={commentText}
                           onChangeText={setCommentText}
                           style={styles.commentInput}
                        />
                     </View>
                     <TouchableOpacity
                        style={styles.commentSend}
                        onPress={handleSendComment}
                        disabled={sendingComment || !commentText.trim()}
                     >
                        {sendingComment ? (
                           <ActivityIndicator size="small" color="#fff" />
                        ) : (
                           <Ionicons name="send" size={20} color="#fff" />
                        )}
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         </ScrollView>
      </View>
   );
}

/* ------------------------------- Styles ---------------------------------- */

const styles = StyleSheet.create({
   container: {
      flex: 1,
   },
   scrollContent: {
      paddingBottom: 24,
   },
   center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
   },
   banner: {
      width: "100%",
      height: 260,
   },
   backButton: {
      position: "absolute",
      top: 50,
      left: 16,
      backgroundColor: "#fff",
      borderRadius: 24,
      padding: 8,
      elevation: 4,
   },
   playButton: {
      position: "absolute",
      top: 50,
      right: 16,
   },
   recurringBadge: {
      position: "absolute",
      bottom: 12,
      alignSelf: "center",
      backgroundColor: "#fff",
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      elevation: 3,
   },
   recurringText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#444",
   },
   contentBox: {
      marginTop: -12,
      paddingHorizontal: 16,
   },
   title: {
      fontSize: 20,
      fontWeight: "700",
      color: "#222",
      marginBottom: 8,
   },
   categoryRow: {
      flexDirection: "row",
      marginBottom: 12,
   },
   categoryChip: {
      backgroundColor: "#E6F6EE",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
   },
   categoryText: {
      fontSize: 13,
      color: "#0D8D43",
      fontWeight: "600",
   },
   actionRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 12,
   },
   actionButton: {
      flex: 1,
      borderRadius: 24,
      paddingVertical: 10,
      alignItems: "center",
   },
   actionButtonText: {
      fontSize: 15,
      fontWeight: "700",
   },
   recurringScroll: {
      marginBottom: 10,
   },
   datePill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: "#F5F5F5",
      marginRight: 10,
      alignItems: "flex-start",
   },
   datePillActive: {
      backgroundColor: "#0D8D43",
   },
   datePillDay: {
      fontSize: 11,
      fontWeight: "600",
      color: "#555",
   },
   datePillDayActive: {
      color: "#fff",
   },
   datePillDate: {
      fontSize: 14,
      fontWeight: "700",
      color: "#333",
   },
   datePillDateActive: {
      color: "#fff",
   },
   datePillTimeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
   },
   datePillTime: {
      fontSize: 11,
      color: "#777",
      marginLeft: 4,
   },
   datePillTimeActive: {
      color: "#fff",
   },
   feeRow: {
      flexDirection: "row",
      backgroundColor: "#F9FAFB",
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: 4,
   },
   feeItem: {
      flex: 1,
      alignItems: "center",
   },
   feeLabel: {
      fontSize: 12,
      color: "#777",
      marginTop: 2,
   },
   feeValue: {
      fontSize: 14,
      fontWeight: "600",
      marginTop: 2,
   },
   feeDivider: {
      width: 1,
      height: 32,
      backgroundColor: "#E0E0E0",
   },
   section: {
      marginTop: 18,
   },
   sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
   },
   sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#222",
   },
   hostRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
   },
   hostAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#FFB74D",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
   },
   hostName: {
      fontSize: 14,
      fontWeight: "600",
      color: "#333",
   },
   detailRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
   },
   detailText: {
      marginLeft: 10,
      fontSize: 14,
      color: "#444",
   },
   detailsText: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: "#444",
   },
   noCommentsBox: {
      alignItems: "center",
      marginTop: 16,
      marginBottom: 6,
   },
   noCommentsTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#555",
      marginTop: 8,
   },
   noCommentsSubtitle: {
      fontSize: 13,
      color: "#777",
      marginTop: 4,
      textAlign: "center",
   },
   commentRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
   },
   commentInputWrapper: {
      flex: 1,
      backgroundColor: "#F3F4F6",
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
   },
   commentInput: {
      flex: 1,
      paddingVertical: 8,
      paddingRight: 8,
      fontSize: 14,
      color: "#333",
   },
   commentSend: {
      marginLeft: 8,
      backgroundColor: "#FF7A00",
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
   },
});
