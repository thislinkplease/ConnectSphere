import axios, { AxiosInstance } from 'axios';
import {
  User,
  Event,
  Hangout,
  Chat,
  Message,
  Community,
  Post,
  Notification,
  QuickMessage,
  LoginCredentials,
  SignupData,
  ConnectionFilters,
} from '../types';

// Base API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.example.com';


class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
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
          console.error('API Response Error:', error.response.status, error.response.data);
          
          // If 401 Unauthorized, user might need to re-login
          if (error.response.status === 401 && !originalRequest._retry) {
            console.warn('Unauthorized - Token may be expired');
            // Don't retry, let the app handle re-login
          }
        } else if (error.request) {
          // Request made but no response - possibly network issue
          console.error('API No Response:', error.message);
          
          // Retry once for network errors
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            try {
              console.log('Retrying request...');
              return this.client(originalRequest);
            } catch (retryError) {
              console.error('Retry failed:', retryError);
            }
          }
        } else {
          // Error in request setup
          console.error('API Request Setup Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    const response = await this.client.post('/auth/login', credentials);
    return response.data;
  }

  async signup(data: SignupData): Promise<{ user: User; token: string }> {
    const response = await this.client.post('/auth/signup', data);
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }

  // User endpoints
  async getCurrentUser(): Promise<User> {
    const response = await this.client.get('/users/me');
    return response.data;
  }

  async getUserByUsername(username: string): Promise<User> {
    const response = await this.client.get(`/users/username/${username}`);
    return response.data;
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const response = await this.client.put(`/users/${userId}`, data);
    return response.data;
  }

  async uploadAvatar(userId: string, image: any): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', image);
    const response = await this.client.post(`/users/${userId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async sendMessageWithImage(conversationId: string, senderUsername: string, content: string, image?: any): Promise<void> {
    const formData = new FormData();
    formData.append('sender_username', senderUsername);
    formData.append('content', content);
    if (image) {
      formData.append('image', image);
    }
    await this.client.post(`/messages/conversations/${conversationId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async getUsers(filters?: ConnectionFilters): Promise<User[]> {
    const response = await this.client.get('/users', { params: filters });
    return response.data;
  }

  async getUserById(userId: string): Promise<User> {
    const response = await this.client.get(`/users/${userId}`);
    return response.data;
  }

  async searchUsers(query: string): Promise<User[]> {
    const response = await this.client.get('/users/search', { params: { q: query } });
    return response.data;
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
      console.error('Error checking follow status:', error);
      return false;
    }
  }
   // Create or get existing direct conversation with otherUsername
  async createOrGetDirectConversation(currentUsername: string, otherUsername: string): Promise<{ id: string | number }> {
    const response = await this.client.post('/messages/conversations', {
      type: 'dm',
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
    const response = await this.client.get(`/users/${username}/profile-completion`);
    return response.data;
  }

  // Event endpoints
  async getEvents(filters?: any): Promise<Event[]> {
    const response = await this.client.get('/events', { params: filters });
    return response.data;
  }

  async getMyEvents(username: string, type: 'participating' | 'created' = 'participating'): Promise<Event[]> {
    const response = await this.client.get(`/events/user/${username}/${type}`);
    return response.data;
  }

  async getEventById(eventId: string, viewer?: string): Promise<Event> {
    const response = await this.client.get(`/events/${eventId}`, { params: { viewer } });
    return response.data;
  }

  async joinEvent(eventId: string, username: string, status: 'going' | 'interested' = 'going'): Promise<void> {
    await this.client.post(`/events/${eventId}/participate`, { username, status });
  }

  async leaveEvent(eventId: string): Promise<void> {
    await this.client.delete(`/events/${eventId}/leave`);
  }

  async addEventComment(eventId: string, authorUsername: string, content: string, image?: any): Promise<void> {
    const formData = new FormData();
    formData.append('author_username', authorUsername);
    formData.append('content', content);
    if (image) {
      formData.append('image', image);
    }
    await this.client.post(`/events/${eventId}/comments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async searchEvents(query: string): Promise<Event[]> {
    const response = await this.client.get('/events/search', { params: { q: query } });
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
  }): Promise<any[]> {
    const res = await this.client.get(`/hangouts`, {
      params: {
        languages: params?.languages?.join(","),
        distance_km: params?.distance_km,
        user_lat: params?.user_lat,
        user_lng: params?.user_lng,
        limit: params?.limit,
      },
    });
    return res.data;
  }

  async getMyHangouts(username: string): Promise<any[]> {
  
    const res = await this.client.get(`/hangouts/user/${encodeURIComponent(username)}/joined`);
    return res.data;
  }

  async getHangoutStatus(username: string): Promise<{
    username: string;
    is_available: boolean;
    current_activity?: string;
    activities?: string[];
  }> {
    const res = await this.client.get(`/hangouts/status/${encodeURIComponent(username)}`);
    return res.data;
  }

  async createHangout(data: any): Promise<any> {
    const response = await this.client.post('/hangouts', data);
    return response.data;
  }

  async joinHangout(hangoutId: string, username: string): Promise<void> {
    await this.client.post(`/hangouts/${hangoutId}/join`, { username });
  }

  // Chat endpoints
 async getConversations(username: string): Promise<Chat[]> {
    const response = await this.client.get('/messages/conversations', { params: { user: username } });
    const raw = response.data;

    return (raw || []).map((c: any) => {
      const last = c.last_message
        ? {
            id: String(c.last_message.id),
            chatId: String(c.last_message.conversation_id ?? c.id),
            senderId: c.last_message.sender_username,
            sender: {
              id: c.last_message.sender?.id ?? c.last_message.sender_username,
              username: c.last_message.sender?.username ?? c.last_message.sender_username,
              name: c.last_message.sender?.name ?? c.last_message.sender_username,
              avatar: c.last_message.sender?.avatar ?? '',
              // Các field khác có thể bổ sung sau nếu cần
              email: (c.last_message.sender?.username || 'unknown') + '@example.com',
              country: '',
              city: '',
              status: 'Chilling',
              languages: [],
              interests: [],
            },
            content: c.last_message.content || '',
            image: c.last_message.message_media?.[0]?.media_url,
            timestamp: c.last_message.created_at, 
            read: false,
          }
        : undefined;

      return {
        id: String(c.id),
        type: c.type === 'dm' ? 'user' : c.type === 'group' ? 'group' : (c.type || 'user'),
        name: c.title || undefined,
        participants: [], 
        lastMessage: last,
        unreadCount: c.unread_count ?? 0,
        eventId: undefined,
      } as Chat;
    });
  }

async getConversation(conversationId: string): Promise<Chat> {
  const response = await this.client.get(`/messages/conversations/${conversationId}`);
  const c = response.data;
  return {
    id: String(c.id),
    type: c.type === 'dm' ? 'user' : c.type === 'group' ? 'group' : c.type,
    name: c.title || undefined,
    participants: (c.participants || []).map((p: any) => ({
      id: p.id,
      username: p.username,
      name: p.name,
      avatar: p.avatar,
    })),
  };
}

async getChatMessages(conversationId: string): Promise<Message[]> {
  const response = await this.client.get(`/messages/conversations/${conversationId}/messages`);
  return response.data.map((m: any) => ({
    id: String(m.id),
    chatId: String(m.chatId),
    senderId: m.senderId,
    sender: {
      id: m.sender?.id,
      username: m.sender?.username,
      name: m.sender?.name,
      avatar: m.sender?.avatar,
    },
    content: m.content,
    image: m.image,
    timestamp: m.timestamp,
    read: m.read ?? false,
  }));
}

  async sendMessage(conversationId: string, senderUsername: string, content: string, replyToMessageId?: string): Promise<void> {
    await this.client.post(`/messages/conversations/${conversationId}/messages`, {
      sender_username: senderUsername,
      content,
      reply_to_message_id: replyToMessageId,
    });
  }

  async createConversation(type: 'dm' | 'group', createdBy: string, members: string[], title?: string): Promise<Chat> {
    const response = await this.client.post('/messages/conversations', {
      type,
      created_by: createdBy,
      members,
      title,
    });
    return response.data;
  }

  async markMessagesAsRead(conversationId: string, username: string, upToMessageId: number): Promise<void> {
    await this.client.post(`/messages/conversations/${conversationId}/read`, {
      username,
      up_to_message_id: upToMessageId,
    });
  }

  // Quick messages
  async getQuickMessages(username: string): Promise<QuickMessage[]> {
    const response = await this.client.get('/quick-messages', { params: { username } });
    return response.data;
  }

  async createQuickMessage(username: string, shortcut: string, message: string): Promise<QuickMessage> {
    const response = await this.client.post('/quick-messages', { username, shortcut, message });
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
      const response = await this.client.get('/quick-messages/expand', {
        params: { username, shortcut },
      });
      return response.data;
    } catch {
      return null;
    }
  }

  // Community/Discussion endpoints
  async getCommunities(query?: string, limit?: number): Promise<Community[]> {
    const response = await this.client.get('/communities', { params: { q: query, limit } });
    return response.data;
  }

  async getSuggestedCommunities(limit?: number): Promise<Community[]> {
    const response = await this.client.get('/communities/suggested', { params: { limit } });
    return response.data;
  }

  async searchCommunities(query: string): Promise<Community[]> {
    const response = await this.client.get('/communities', { params: { q: query } });
    return response.data;
  }

  async joinCommunity(communityId: string, username: string): Promise<void> {
    await this.client.post(`/communities/${communityId}/join`, { username });
  }

  async leaveCommunity(communityId: string, username: string): Promise<void> {
    await this.client.delete(`/communities/${communityId}/leave`, { data: { username } });
  }

  async getCommunityPosts(communityId: string): Promise<Post[]> {
    const response = await this.client.get(`/communities/${communityId}/posts`);
    return response.data;
  }

  async createPost(communityId: string, authorUsername: string, content: string, image?: any): Promise<Post> {
    const formData = new FormData();
    formData.append('author_username', authorUsername);
    formData.append('content', content);
    if (image) {
      formData.append('image', image);
    }
    const response = await this.client.post(`/communities/${communityId}/posts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async likePost(communityId: string, postId: string, username: string): Promise<void> {
    await this.client.post(`/communities/${communityId}/posts/${postId}/like`, { username });
  }

  async unlikePost(communityId: string, postId: string, username: string): Promise<void> {
    await this.client.delete(`/communities/${communityId}/posts/${postId}/like`, { data: { username } });
  }

  async addPostComment(communityId: string, postId: string, authorUsername: string, content: string, parentId?: string): Promise<void> {
    await this.client.post(`/communities/${communityId}/posts/${postId}/comments`, {
      author_username: authorUsername,
      content,
      parent_id: parentId,
    });
  }

  // Notification endpoints
  async getNotifications(username: string, limit?: number, unreadOnly?: boolean): Promise<Notification[]> {
    const response = await this.client.get('/notifications', {
      params: { username, limit, unread_only: unreadOnly },
    });
    return response.data;
  }

  async getUnreadNotificationCount(username: string): Promise<number> {
    const response = await this.client.get('/notifications/unread-count', { params: { username } });
    return response.data.unread_count || 0;
  }

  async markNotificationAsRead(username: string, notificationIds?: number[]): Promise<void> {
    await this.client.put('/notifications/mark-read', {
      username,
      notification_ids: notificationIds,
      all: !notificationIds,
    });
  }

  async markAllNotificationsAsRead(username: string): Promise<void> {
    await this.client.put('/notifications/mark-read', {
      username,
      all: true,
    });
  }
}

export default new ApiService();
