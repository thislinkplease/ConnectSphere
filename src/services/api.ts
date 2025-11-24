import axios, { AxiosInstance } from "axios";
import {
   Chat,
   Community,
   ConnectionFilters,
   Event,
   LoginCredentials,
   Message,
   Notification,
   Post,
   QuickMessage,
   SignupData,
   User,
} from "../types";

// Base API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.example.com";

// Request deduplication cache
interface PendingRequest {
   promise: Promise<any>;
   timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest>();
const REQUEST_CACHE_DURATION = 1000; // 1 second cache for pending requests

// Helper function to map server user response to client User type
function mapServerUserToClient(serverUser: any): User {
   return {
      ...serverUser,
      // Map snake_case -> camelCase
      backgroundImage: serverUser.background_image ?? serverUser.backgroundImage,
      followersCount: serverUser.followers ?? serverUser.followersCount ?? 0,
      followingCount: serverUser.following ?? serverUser.followingCount ?? 0,
      postsCount: serverUser.posts ?? serverUser.postsCount ?? 0,
      isPro: serverUser.is_premium ?? serverUser.isPro ?? false,

      // IMPORTANT: map online status
      isOnline: serverUser.is_online ?? serverUser.isOnline ?? false,
   };
}

class ApiService {
   public client: AxiosInstance;

   constructor() {
      this.client = axios.create({
         baseURL: API_BASE_URL,
         timeout: 10000,
         headers: {
            "Content-Type": "application/json",
         },
      });

      // Add request interceptor for logging and deduplication
      this.client.interceptors.request.use(
         (config) => {
            return config;
         },
         (error) => {
            console.error("API Request Error:", error);
            return Promise.reject(error);
         }
      );

      // Add response interceptor for error handling
      this.client.interceptors.response.use(
         (response) => {
            return response;
         },
         async (error) => {
            const originalRequest = error.config;

            if (error.response) {
               // Server responded with error
               console.error("API Response Error:", error.response.status, error.response.data);

               // If 401 Unauthorized, user might need to re-login
               if (error.response.status === 401 && !originalRequest._retry) {
                  console.warn("Unauthorized - Token may be expired");
                  // Don't retry, let the app handle re-login
               }
            } else if (error.request) {
               // Request made but no response - possibly network issue
               console.error("API No Response:", error.message);

               // Retry once for network errors
               if (!originalRequest._retry) {
                  originalRequest._retry = true;
                  try {
                     return this.client(originalRequest);
                  } catch (retryError) {
                     console.error("Retry failed:", retryError);
                  }
               }
            } else {
               // Error in request setup
               console.error("API Request Setup Error:", error.message);
            }
            return Promise.reject(error);
         }
      );
   }

   setAuthToken(token: string) {
      this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
   }

   removeAuthToken() {
      delete this.client.defaults.headers.common["Authorization"];
   }

   // Helper method to deduplicate GET requests
   public async deduplicatedGet<T>(url: string, params?: any): Promise<T> {
      // Only deduplicate GET requests (safe for read operations)
      const cacheKey = `GET:${url}:${JSON.stringify(params || {})}`;
      const now = Date.now();

      // Check if there's a pending request for the same endpoint
      const pending = pendingRequests.get(cacheKey);
      if (pending && now - pending.timestamp < REQUEST_CACHE_DURATION) {
         return pending.promise;
      }

      // Create new request
      const promise = this.client
         .get(url, { params })
         .then((response) => {
            // Clean up from pending requests after completion
            pendingRequests.delete(cacheKey);
            return response.data;
         })
         .catch((error) => {
            // Clean up from pending requests on error
            pendingRequests.delete(cacheKey);
            throw error;
         });

      // Store pending request
      pendingRequests.set(cacheKey, { promise, timestamp: now });

      return promise;
   }

   // Auth endpoints
   async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
      const response = await this.client.post("/auth/login", credentials);
      return {
         ...response.data,
         user: mapServerUserToClient(response.data.user),
      };
   }

   async signup(data: SignupData): Promise<{ user: User; token: string }> {
      const response = await this.client.post("/auth/signup", data);
      return {
         ...response.data,
         user: mapServerUserToClient(response.data.user),
      };
   }

   async createProfile(data: any): Promise<User> {
      const response = await this.client.post("/users/create-profile", data);
      return mapServerUserToClient(response.data);
   }

   async logout(): Promise<void> {
      await this.client.post("/auth/logout");
   }

   // User endpoints
   async getCurrentUser(): Promise<User> {
      const response = await this.client.get("/users/me");
      return mapServerUserToClient(response.data);
   }

   async getUserByUsername(username: string): Promise<User> {
      const data = await this.deduplicatedGet(`/users/username/${username}`);
      return mapServerUserToClient(data);
   }

   async updateUser(userId: string, data: Partial<User>): Promise<User> {
      const response = await this.client.put(`/users/${userId}`, data);
      return mapServerUserToClient(response.data);
   }

   async uploadAvatar(userId: string, image: any): Promise<{ avatarUrl: string }> {
      const formData = new FormData();
      formData.append("avatar", image);
      const response = await this.client.post(`/users/${userId}/avatar`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
   }

   async uploadBackgroundImage(userId: string, image: any): Promise<{ backgroundImageUrl: string }> {
      const formData = new FormData();
      formData.append("background_image", image);
      const response = await this.client.post(`/users/${userId}/background-image`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
   }

   async sendMessageWithImage(
      conversationId: string,
      senderUsername: string,
      content: string,
      image?: any
   ): Promise<void> {
      const formData = new FormData();
      formData.append("sender_username", senderUsername);
      formData.append("content", content);
      if (image) {
         formData.append("image", image);
      }
      await this.client.post(`/messages/conversations/${conversationId}/messages`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
   }

   async getUsers(filters?: ConnectionFilters): Promise<User[]> {
      const data: any[] = await this.deduplicatedGet("/users", filters);
      return (data || []).map(mapServerUserToClient);
   }

   async getUserById(userId: string): Promise<User> {
      const data = await this.deduplicatedGet(`/users/${userId}`);
      return mapServerUserToClient(data);
   }

   async searchUsers(query: string): Promise<User[]> {
      const data: any[] = await this.deduplicatedGet("/users/search", { q: query });
      return (data || []).map(mapServerUserToClient);
   }

   async followUser(username: string, followerUsername: string): Promise<void> {
      await this.client.post(`/users/${username}/follow`, { followerUsername });
   }

   async unfollowUser(username: string, followerUsername: string): Promise<void> {
      await this.client.delete(`/users/${username}/follow`, { data: { followerUsername } });
   }

   async isFollowing(username: string, followerUsername: string): Promise<boolean> {
      try {
         const response = await this.client.get(`/users/${username}/following/${followerUsername}`);
         return response.data.isFollowing || false;
      } catch (error) {
         console.error("Error checking follow status:", error);
         return false;
      }
   }

   async getFollowers(username: string): Promise<User[]> {
      try {
         const response = await this.client.get(`/users/${username}/followers`);
         return (response.data || []).map((u: any) =>
            mapServerUserToClient({
               id: String(u.id || u.username),
               username: u.username || "",
               name: u.name || u.username || "",
               email: u.email || `${u.username}@example.com`,
               avatar: u.avatar || "",
               country: u.country || "",
               city: u.city || "",
               status: u.status || "Chilling",
               languages: u.languages || [],
               interests: u.interests || [],
               bio: u.bio,
               gender: u.gender,
               age: u.age,
               flag: u.flag,
               followers: u.followers,
               following: u.following,
               posts: u.posts,
            })
         );
      } catch (error) {
         console.error("Error getting followers:", error);
         return [];
      }
   }

   async getFollowing(username: string): Promise<User[]> {
      try {
         const response = await this.client.get(`/users/${username}/following`);
         return (response.data || []).map((u: any) =>
            mapServerUserToClient({
               id: String(u.id || u.username),
               username: u.username || "",
               name: u.name || u.username || "",
               email: u.email || `${u.username}@example.com`,
               avatar: u.avatar || "",
               country: u.country || "",
               city: u.city || "",
               status: u.status || "Chilling",
               languages: u.languages || [],
               interests: u.interests || [],
               bio: u.bio,
               gender: u.gender,
               age: u.age,
               flag: u.flag,
               followers: u.followers,
               following: u.following,
               posts: u.posts,
            })
         );
      } catch (error) {
         console.error("Error getting following:", error);
         return [];
      }
   }

   async areMutualFollowers(username1: string, username2: string): Promise<boolean> {
      try {
         const [user1FollowsUser2, user2FollowsUser1] = await Promise.all([
            this.isFollowing(username2, username1), // username1 follows username2
            this.isFollowing(username1, username2), // username2 follows username1
         ]);
         return user1FollowsUser2 && user2FollowsUser1;
      } catch (error) {
         console.error("Error checking mutual follow status:", error);
         return false;
      }
   }

   // Create or get existing direct conversation with otherUsername
   async createOrGetDirectConversation(
      currentUsername: string,
      otherUsername: string
   ): Promise<{ id: string | number }> {
      const response = await this.client.post("/messages/conversations", {
         type: "dm",
         created_by: currentUsername,
         members: [otherUsername],
      });
      // Server có thể trả { reused: true, id, ... } hoặc { id, ... }
      const data = response.data;
      return { id: data.id };
   }
   async updateHangoutStatus(
      username: string,
      isAvailable: boolean,
      currentActivity?: string,
      activities?: string[]
   ): Promise<any> {
      const res = await this.client.put(`/hangouts/status`, {
         username,
         is_available: isAvailable,
         current_activity: currentActivity,
         activities,
      });
      return res.data;
   }

   async getProfileCompletion(username: string): Promise<any> {
      return this.deduplicatedGet(`/users/${username}/profile-completion`);
   }

   // Event endpoints
   async getEvents(filters?: any): Promise<Event[]> {
      const response = await this.client.get("/events", { params: filters });
      return response.data;
   }

   async getMyEvents(username: string, type: "participating" | "created" = "participating"): Promise<Event[]> {
      const response = await this.client.get(`/events/user/${username}/${type}`);
      return response.data;
   }

   async getEventById(eventId: string, viewer?: string): Promise<Event> {
      const response = await this.client.get(`/events/${eventId}`, { params: { viewer } });
      return response.data;
   }

   async joinEvent(eventId: string, username: string, status: "going" | "interested" = "going"): Promise<void> {
      await this.client.post(`/events/${eventId}/participate`, { username, status });
   }

   async leaveEvent(eventId: string): Promise<void> {
      await this.client.delete(`/events/${eventId}/leave`);
   }

   async addEventComment(eventId: string, authorUsername: string, content: string, image?: any): Promise<void> {
      const formData = new FormData();
      formData.append("author_username", authorUsername);
      formData.append("content", content);
      if (image) {
         formData.append("image", image);
      }
      await this.client.post(`/events/${eventId}/comments`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
   }

   async searchEvents(query: string): Promise<Event[]> {
      const response = await this.client.get("/events/search", { params: { q: query } });
      return response.data;
   }

   async inviteToEvent(eventId: string, inviterUsername: string, inviteeUsernames: string[]): Promise<void> {
      await this.client.post(`/events/${eventId}/invite`, {
         inviter_username: inviterUsername,
         invitee_usernames: inviteeUsernames,
      });
   }

   // Hangout endpoints
   async getOpenHangouts(params?: {
      languages?: string[];
      distance_km?: number;
      user_lat?: number;
      user_lng?: number;
      limit?: number;
   }): Promise<User[]> {
      const users = await this.deduplicatedGet(`/hangouts`, {
         languages: params?.languages?.join(","),
         distance_km: params?.distance_km,
         user_lat: params?.user_lat,
         user_lng: params?.user_lng,
         limit: params?.limit,
      });

      // Map server user data to client format, ensuring we have an array
      if (!users || !Array.isArray(users)) {
         console.warn("getOpenHangouts: Invalid response, expected array:", users);
         return [];
      }

      // Debug: Log raw server response

      if (users.length > 0) {
      }

      const mappedUsers = users.map((user: any) => mapServerUserToClient(user));

      // Debug: Log mapped response
      if (mappedUsers.length > 0) {
      }

      return mappedUsers;
   }

   async getMyHangouts(username: string): Promise<any[]> {
      return this.deduplicatedGet(`/hangouts/user/${encodeURIComponent(username)}/joined`);
   }

   async getHangoutStatus(username: string): Promise<{
      username: string;
      is_available: boolean;
      current_activity?: string;
      activities?: string[];
   }> {
      return this.deduplicatedGet(`/hangouts/status/${encodeURIComponent(username)}`);
   }

   async createHangout(data: any): Promise<any> {
      const response = await this.client.post("/hangouts", data);
      return response.data;
   }

   async joinHangout(hangoutId: string, username: string): Promise<void> {
      await this.client.post(`/hangouts/${hangoutId}/join`, { username });
   }

   // Chat endpoints
   async getConversations(username: string): Promise<Chat[]> {
      const raw: any = await this.deduplicatedGet("/messages/conversations", { user: username });

      return (raw || []).map((c: any) => {
         // Map participants from server response
         let participants: User[] = (c.participants || []).map((p: any) =>
            mapServerUserToClient({
               id: String(p.id || p.username),
               username: p.username || "",
               name: p.name || p.username || "",
               email: p.email || `${p.username}@example.com`,
               avatar: p.avatar || "",
               country: p.country || "",
               city: p.city || "",
               status: p.status || "Chilling",
               languages: p.languages || [],
               interests: p.interests || [],
               bio: p.bio,
               gender: p.gender,
               age: p.age,
               flag: p.flag,
               followers: p.followers,
               following: p.following,
               posts: p.posts,
            })
         );

         const lastRaw = c.last_message;
         const lastMessage = lastRaw
            ? {
                 id: String(lastRaw.id),
                 chatId: String(lastRaw.conversation_id ?? c.id),
                 senderId: lastRaw.sender_username,
                 sender: mapServerUserToClient({
                    id: lastRaw.sender?.id ?? lastRaw.sender_username,
                    username: lastRaw.sender?.username ?? lastRaw.sender_username,
                    name: lastRaw.sender?.name ?? lastRaw.sender_username,
                    avatar: lastRaw.sender?.avatar ?? "",
                    email: (lastRaw.sender?.username || "unknown") + "@example.com",
                    country: lastRaw.sender?.country || "",
                    city: lastRaw.sender?.city || "",
                    status: lastRaw.sender?.status || "Chilling",
                    languages: lastRaw.sender?.languages || [],
                    interests: lastRaw.sender?.interests || [],
                    followers: lastRaw.sender?.followers,
                    following: lastRaw.sender?.following,
                    posts: lastRaw.sender?.posts,
                 }),
                 content: lastRaw.content || "",
                 image: lastRaw.message_media?.[0]?.media_url,
                 timestamp: lastRaw.created_at,
                 read: lastRaw.is_read || false,
              }
            : undefined;

         // map dm -> user to match client type
         const mappedType: "event" | "user" | "group" | "community" =
            c.type === "group" ? "group" : c.type === "event" ? "event" : c.type === "community" ? "community" : "user";

         // For DM conversations, use other_participant from server if available
         if (mappedType === "user" && c.other_participant) {
            const otherUser = mapServerUserToClient({
               id: String(c.other_participant.id || c.other_participant.username),
               username: c.other_participant.username || "",
               name: c.other_participant.name || c.other_participant.username || "",
               email: c.other_participant.email || `${c.other_participant.username}@example.com`,
               avatar: c.other_participant.avatar || "",
               country: c.other_participant.country || "",
               city: c.other_participant.city || "",
               status: c.other_participant.status || "Chilling",
               languages: c.other_participant.languages || [],
               interests: c.other_participant.interests || [],
               bio: c.other_participant.bio,
               gender: c.other_participant.gender,
               age: c.other_participant.age,
               flag: c.other_participant.flag,
               followers: c.other_participant.followers,
               following: c.other_participant.following,
               posts: c.other_participant.posts,
            });

            // Current user
            const currentUser = mapServerUserToClient({
               id: username,
               username,
               name: username,
               email: `${username}@example.com`,
               avatar: "",
               country: "",
               city: "",
               status: "Chilling",
               languages: [],
               interests: [],
            });

            participants = [currentUser, otherUser];
         } else if (mappedType === "user") {
            // Fallback: rebuild participants for DM if other_participant not available
            const usernames = new Set(participants.map((p) => p.username).filter(Boolean));
            // Add current user if missing
            if (username && !usernames.has(username)) {
               participants.push(
                  mapServerUserToClient({
                     id: username,
                     username,
                     name: username,
                     email: `${username}@example.com`,
                     avatar: "",
                     country: "",
                     city: "",
                     status: "Chilling",
                     languages: [],
                     interests: [],
                  })
               );
               usernames.add(username);
            }
            // Add other user from lastMessage.sender if different from current user
            if (
               lastMessage?.sender?.username &&
               lastMessage.sender.username !== username &&
               !usernames.has(lastMessage.sender.username)
            ) {
               participants.push(lastMessage.sender);
               usernames.add(lastMessage.sender.username);
            }
         }

         return {
            id: String(c.id),
            type: mappedType,
            name: c.title || undefined,
            participants,
            lastMessage,
            unreadCount: c.unread_count ?? 0,
            eventId: undefined,
         } as Chat;
      });
   }

   async getConversation(conversationId: string): Promise<Chat> {
      const c: any = await this.deduplicatedGet(`/messages/conversations/${conversationId}`);
      return {
         id: String(c.id),
         type: c.type === "group" ? "group" : c.type === "event" ? "event" : "user",
         name: c.title || undefined,
         participants: (c.participants || []).map((p: any) =>
            mapServerUserToClient({
               id: String(p.id || p.username),
               username: p.username || "",
               name: p.name || p.username || "",
               email: p.email || `${p.username}@example.com`,
               avatar: p.avatar || "",
               country: p.country || "",
               city: p.city || "",
               status: p.status || "Chilling",
               languages: p.languages || [],
               interests: p.interests || [],
               bio: p.bio,
               gender: p.gender,
               age: p.age,
               flag: p.flag,
               followers: p.followers,
               following: p.following,
               posts: p.posts,
            })
         ),
      };
   }

   async getChatMessages(conversationId: string): Promise<Message[]> {
      const response = await this.client.get(`/messages/conversations/${conversationId}/messages`);
      return response.data.map((m: any) => ({
         id: String(m.id),
         chatId: String(m.conversation_id ?? conversationId),
         senderId: m.sender_username ?? m.sender?.username,
         sender: mapServerUserToClient({
            id: m.sender?.id ?? m.sender_username,
            username: m.sender?.username ?? m.sender_username,
            name: m.sender?.name ?? m.sender_username,
            email: m.sender?.email ?? `${m.sender_username}@example.com`,
            avatar: m.sender?.avatar ?? "",
            country: m.sender?.country ?? "",
            city: m.sender?.city ?? "",
            status: m.sender?.status ?? "Chilling",
            languages: m.sender?.languages ?? [],
            interests: m.sender?.interests ?? [],
            bio: m.sender?.bio,
            gender: m.sender?.gender,
            age: m.sender?.age,
         }),
         content: m.content ?? "",
         image: m.message_media?.[0]?.media_url ?? m.image,
         timestamp: m.created_at ?? m.timestamp,
         read: m.is_read ?? m.read ?? false,
      }));
   }

   async sendMessage(
      conversationId: string,
      senderUsername: string,
      content: string,
      replyToMessageId?: string
   ): Promise<void> {
      await this.client.post(`/messages/conversations/${conversationId}/messages`, {
         sender_username: senderUsername,
         content,
         reply_to_message_id: replyToMessageId,
      });
   }

   async createConversation(type: "dm" | "group", createdBy: string, members: string[], title?: string): Promise<Chat> {
      const response = await this.client.post("/messages/conversations", {
         type,
         created_by: createdBy,
         members,
         title,
      });
      return response.data;
   }

   async markMessagesAsRead(conversationId: string, username: string, upToMessageId?: number | string): Promise<void> {
      const body: any = { username };
      if (upToMessageId !== undefined && upToMessageId !== null && `${upToMessageId}` !== "") {
         body.up_to_message_id = Number(upToMessageId);
      }
      await this.client.post(`/messages/conversations/${conversationId}/read`, body);
   }

   async markAllMessagesAsRead(conversationId: string, username: string): Promise<void> {
      await this.client.post(`/messages/conversations/${conversationId}/read`, { username });
   }

   // Quick messages
   async getQuickMessages(username: string): Promise<QuickMessage[]> {
      const response = await this.client.get("/quick-messages", { params: { username } });
      return response.data;
   }

   async createQuickMessage(username: string, shortcut: string, message: string): Promise<QuickMessage> {
      const response = await this.client.post("/quick-messages", { username, shortcut, message });
      return response.data;
   }

   async updateQuickMessage(id: string, username: string, shortcut: string, message: string): Promise<QuickMessage> {
      const response = await this.client.put(`/quick-messages/${id}`, { username, shortcut, message });
      return response.data;
   }

   async deleteQuickMessage(id: string): Promise<void> {
      await this.client.delete(`/quick-messages/${id}`);
   }

   async expandQuickMessage(username: string, shortcut: string): Promise<QuickMessage | null> {
      try {
         const response = await this.client.get("/quick-messages/expand", {
            params: { username, shortcut },
         });
         return response.data;
      } catch {
         return null;
      }
   }

   // Pro subscription endpoints
   async createPaymentIntent(
      username: string,
      amount: number = 1
   ): Promise<{ clientSecret: string; paymentIntentId: string }> {
      const response = await this.client.post("/payments/create-payment-intent", {
         username,
         amount,
      });
      return response.data;
   }

   async activateProSubscription(username: string, paymentIntentId?: string): Promise<void> {
      await this.client.post("/payments/subscribe", {
         username,
         plan_type: "pro",
         payment_method: paymentIntentId ? "stripe" : "test",
         payment_intent_id: paymentIntentId,
      });
   }

   async deactivateProSubscription(username: string): Promise<void> {
      await this.client.post("/payments/cancel", { username });
   }

   async getProStatus(username: string): Promise<{ isPro: boolean; expiresAt?: string }> {
      try {
         const subscription: any = await this.deduplicatedGet("/payments/subscription", { username });
         return {
            isPro: subscription?.plan_type === "pro" && subscription?.status === "active",
            expiresAt: subscription?.end_date,
         };
      } catch (error) {
         console.error("Error getting pro status:", error);
         return { isPro: false };
      }
   }

   async updateCommunity(communityId: string, data: any): Promise<Community> {
      const response = await this.client.put(`/communities/${communityId}`, data);
      return response.data;
   }

   async deleteCommunity(communityId: string): Promise<void> {
      await this.client.delete(`/communities/${communityId}`);
   }

   // Community Member Management
   async getCommunityMembers(communityId: string): Promise<any[]> {
      const response = await this.client.get(`/communities/${communityId}/members`);
      return response.data.map((m: any) => ({
         ...m,
         user: m.user ? mapServerUserToClient(m.user) : null,
      }));
   }

   async getJoinRequests(communityId: string): Promise<any[]> {
      const response = await this.client.get(`/communities/${communityId}/join_requests`);
      return response.data.map((r: any) => ({
         ...r,
         user: r.user ? mapServerUserToClient(r.user) : null,
      }));
   }

   async approveJoinRequest(communityId: string, username: string): Promise<void> {
      await this.client.post(`/communities/${communityId}/join_requests/${username}/approve`);
   }

   async rejectJoinRequest(communityId: string, username: string): Promise<void> {
      await this.client.post(`/communities/${communityId}/join_requests/${username}/reject`);
   }

   async updateMemberRole(
      communityId: string,
      username: string,
      role: "admin" | "moderator" | "member"
   ): Promise<void> {
      await this.client.put(`/communities/${communityId}/members/${username}/role`, { role });
   }

   async kickMember(communityId: string, username: string): Promise<void> {
      await this.client.delete(`/communities/${communityId}/members/${username}`);
   }

   async banMember(communityId: string, username: string): Promise<void> {
      await this.client.post(`/communities/${communityId}/members/${username}/ban`);
   }
   async getCommunities(query?: string, limit?: number): Promise<Community[]> {
      const response = await this.client.get("/communities", { params: { q: query, limit } });
      return response.data;
   }

   async getSuggestedCommunities(limit?: number): Promise<Community[]> {
      const response = await this.client.get("/communities/suggested", { params: { limit } });
      return response.data;
   }

   async searchCommunities(query: string): Promise<Community[]> {
      const response = await this.client.get("/communities", { params: { q: query } });
      return response.data;
   }

   async joinCommunity(communityId: string, username: string): Promise<void> {
      await this.client.post(`/communities/${communityId}/join`, { username });
   }

   async leaveCommunity(communityId: string, username: string): Promise<void> {
      await this.client.delete(`/communities/${communityId}/leave`, { data: { username } });
   }

   async createPost(communityId: string, authorUsername: string, content: string, image?: any): Promise<Post> {
      const formData = new FormData();
      formData.append("author_username", authorUsername);
      formData.append("content", content);
      if (image) {
         formData.append("image", image);
      }
      const response = await this.client.post(`/communities/${communityId}/posts`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
   }

   async likePost(communityId: string, postId: string, username: string): Promise<void> {
      await this.client.post(`/communities/${communityId}/posts/${postId}/like`, { username });
   }

   async unlikePost(communityId: string, postId: string, username: string): Promise<void> {
      await this.client.delete(`/communities/${communityId}/posts/${postId}/like`, { data: { username } });
   }

   async addPostComment(
      communityId: string,
      postId: string,
      authorUsername: string,
      content: string,
      parentId?: string
   ): Promise<void> {
      await this.client.post(`/communities/${communityId}/posts/${postId}/comments`, {
         author_username: authorUsername,
         content,
         parent_id: parentId,
      });
   }

   async getPendingPosts(communityId: string): Promise<Post[]> {
      const response = await this.client.get(`/communities/${communityId}/posts/pending`);
      return response.data.map((p: any) => ({
         ...p,
         author: p.author_display_name
            ? {
                 username: p.author_username,
                 name: p.author_display_name,
                 avatar: p.author_avatar,
              }
            : undefined,
      }));
   }

   async approvePost(communityId: string, postId: string): Promise<void> {
      await this.client.post(`/communities/${communityId}/posts/${postId}/approve`);
   }

   async rejectPost(communityId: string, postId: string): Promise<void> {
      await this.client.post(`/communities/${communityId}/posts/${postId}/reject`);
   }

   // Notification endpoints
   async getNotifications(username: string, limit?: number, unreadOnly?: boolean): Promise<Notification[]> {
      const response = await this.client.get("/notifications", {
         params: { username, limit, unread_only: unreadOnly },
      });
      return response.data;
   }

   async getUnreadNotificationCount(username: string): Promise<number> {
      const response = await this.client.get("/notifications/unread-count", { params: { username } });
      return response.data.unread_count || 0;
   }

   async markNotificationAsRead(username: string, notificationIds?: number[]): Promise<void> {
      await this.client.put("/notifications/mark-read", {
         username,
         notification_ids: notificationIds,
         all: !notificationIds,
      });
   }

   async markAllNotificationsAsRead(username: string): Promise<void> {
      await this.client.put("/notifications/mark-read", {
         username,
         all: true,
      });
   }

   // Get that user location
   async updateUserLocation(username: string, latitude: number, longitude: number) {
      return this.client.put("/hangouts/location", {
         username,
         latitude,
         longitude,
      });
   }

   // Get all users location
   async getVisibleUsersLocation(): Promise<User[]> {
      const data: any[] = await this.deduplicatedGet(`/hangouts/locations`);
      return (data || []).map((u) => mapServerUserToClient(u));
   }

   // Lưu swipe
   async saveSwipe(swiper: string, target: string, direction: "right" | "left") {
      return this.client.post("/hangouts/swipe", {
         swiper,
         target,
         direction,
      });
   }

   // Lấy danh sách user mình đã vuốt phải
   async getRightSwipes(username: string): Promise<string[]> {
      const res = await this.client.get("/hangouts/swipe/right", {
         params: { username },
      });
      return res.data;
   } 

   // xóa swipe đã lướt phải
   async deleteRightSwipe(swiper: string, target: string) {
      return this.client.delete("/hangouts/swipe", {
         data: { swiper, target },
      });
   }
}

export default new ApiService();
