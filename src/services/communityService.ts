import { Community, ImageFile, Post, PostMedia } from "../types";
import ApiService from "./api";

export interface CommunityWithMembership extends Community {
   is_member?: boolean;
   membership_status?: "pending" | "approved" | null;
}

export type CommunityPost = Post & {
   community_id?: number;
   community_name?: string;
   author_avatar?: string | null;
   author_display_name?: string | null;
   post_media: PostMedia[];
   isLikedByViewer?: boolean;
};

export interface CommunityPostsParams {
   limit?: number;
   before?: string;
   viewer?: string;
}

const communityService = {
   // --------- COMMUNITY LIST / DISCOVER ----------

   async getCommunities(query?: string, limit?: number): Promise<Community[]> {
      return ApiService.deduplicatedGet<Community[]>("/communities", {
         q: query,
         limit,
      });
   },

   async getSuggestedCommunities(limit?: number): Promise<Community[]> {
      return ApiService.deduplicatedGet<Community[]>("/communities/suggested", {
         limit,
      });
   },

   async searchCommunities(query: string): Promise<Community[]> {
      return ApiService.deduplicatedGet<Community[]>("/communities", {
         q: query,
      });
   },

   // --------- COMMUNITY CRUD ----------

   async getCommunity(communityId: number | string, viewerUsername?: string): Promise<CommunityWithMembership> {
      const params: any = {};
      if (viewerUsername) params.viewer = viewerUsername;

      const data = await ApiService.deduplicatedGet<CommunityWithMembership>(`/communities/${communityId}`, params);

      return data;
   },

   async createCommunity(payload: {
      created_by: string;
      name: string;
      description?: string;
      image_url?: string;
      is_private?: boolean;
   }): Promise<Community> {
      try {
         const res = await ApiService.client.post("/communities", payload);
         return res.data;
      } catch (error: any) {
         // Check if error is due to non-Pro user
         if (error.response?.data?.requiresPro) {
            throw new Error("PRO_REQUIRED");
         }
         throw error;
      }
   },

   async updateCommunity(
      communityId: number | string,
      payload: {
         actor?: string; // Deprecated, handled by token
         name?: string;
         description?: string;
         image_url?: string;
         is_private?: boolean;
         requires_post_approval?: boolean;
         requires_member_approval?: boolean;
      }
   ): Promise<Community> {
      return ApiService.updateCommunity(String(communityId), payload);
   },

   async deleteCommunity(
      communityId: number | string,
      actor?: string // Deprecated
   ): Promise<void> {
      return ApiService.deleteCommunity(String(communityId));
   },

   // --------- MEMBERSHIP ----------

   async joinCommunity(
      communityId: number | string,
      username: string // Deprecated, handled by token
   ): Promise<void> {
      try {
         await ApiService.client.post(`/communities/${communityId}/join`);
      } catch (error: any) {
         // Check if error is due to private community
         if (error.response?.data?.requiresRequest) {
            throw new Error("REQUIRES_REQUEST");
         }
         throw error;
      }
   },

   async leaveCommunity(
      communityId: number | string,
      username: string // Deprecated
   ): Promise<void> {
      await ApiService.client.delete(`/communities/${communityId}/join`);
   },

   async getCommunityMembers(communityId: number | string, limit?: number): Promise<any[]> {
      return ApiService.getCommunityMembers(String(communityId));
   },

   async getMemberRole(
      communityId: number | string,
      username: string
   ): Promise<"admin" | "moderator" | "member" | null> {
      try {
         const members = await this.getCommunityMembers(communityId);
         const member = members.find((m: any) => m.username === username);
         return member ? member.role : null;
      } catch {
         return null;
      }
   },

   async getUserJoinedCommunities(username: string, limit?: number): Promise<Community[]> {
      const res = await ApiService.client.get(`/communities/user/${encodeURIComponent(username)}/joined`, {
         params: { limit },
      });
      return res.data || [];
   },

   // --------- POSTS ----------

   async getCommunityPosts(communityId: number | string, params?: CommunityPostsParams): Promise<CommunityPost[]> {
      const res = await ApiService.client.get(`/communities/${communityId}/posts`, {
         params: {
            limit: params?.limit,
            before: params?.before,
            viewer: params?.viewer,
         },
      });
      const rawPosts = res.data || [];

      // Map server field names to client field names
      return rawPosts.map((post: any) => ({
         ...post,
         authorAvatar: post.author_avatar || post.authorAvatar,
         authorDisplayName: post.author_display_name || post.authorDisplayName,
      }));
   },

   async createCommunityPost(
      communityId: number | string,
      data: {
         authorUsername: string; // Deprecated
         content?: string;
         image?: any;
         audience?: string;
         disableComments?: boolean;
         hideLikeCount?: boolean;
      }
   ): Promise<CommunityPost> {
      const formData = new FormData();
      // author_username is now handled by token, but keep for compatibility if needed?
      // Server uses req.user.username.

      if (data.content !== undefined && data.content !== null) {
         formData.append("content", data.content);
      }
      if (data.audience) {
         formData.append("audience", data.audience);
      }
      if (typeof data.disableComments === "boolean") {
         formData.append("disable_comments", String(data.disableComments));
      }
      if (typeof data.hideLikeCount === "boolean") {
         formData.append("hide_like_count", String(data.hideLikeCount));
      }
      if (data.image) {
         formData.append("image", data.image);
      }

      const res = await ApiService.client.post(`/communities/${communityId}/posts`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
   },

   async deleteCommunityPost(
      communityId: number | string,
      postId: number | string,
      actor?: string // Deprecated
   ): Promise<void> {
      await ApiService.client.delete(`/communities/${communityId}/posts/${postId}`);
   },

   // --------- POST LIKES ----------

   async likePost(
      communityId: number | string,
      postId: number | string,
      username?: string // Deprecated
   ): Promise<void> {
      await ApiService.client.post(`/communities/${communityId}/posts/${postId}/like`);
   },

   async unlikePost(
      communityId: number | string,
      postId: number | string,
      username?: string // Deprecated
   ): Promise<void> {
      await ApiService.client.delete(`/communities/${communityId}/posts/${postId}/like`);
   },

   // --------- POST COMMENTS ----------

   async addPostComment(
      communityId: number | string,
      postId: number | string,
      authorUsername: string,
      content: string,
      parentId?: number | null
   ): Promise<any> {
      try {
         const res = await ApiService.client.post(`/communities/${communityId}/posts/${postId}/comments`, {
            author_username: authorUsername,
            content,
            parent_id: parentId ?? null,
         });

         return res.data;
      } catch (error: any) {
         throw error;
      }
   },

   async getPostComments(
      communityId: number | string,
      postId: number | string,
      parentId?: number | null
   ): Promise<any[]> {
      const params: any = {};
      if (parentId !== undefined) {
         // BE: parent_id=null => comment gốc; parent_id=<id> => reply
         params.parent_id = parentId === null ? "null" : String(parentId);
      }
      const res = await ApiService.client.get(`/communities/${communityId}/posts/${postId}/comments`, { params });
      return res.data || [];
   },

   async getAllPostComments(communityId: number, postId: number) {
      const res = await ApiService.client.get(`/communities/${communityId}/posts/${postId}/comments/all`);
      return res.data;
   },

   async deletePostComment(
      communityId: number | string,
      postId: number | string,
      commentId: number | string,
      actor: string
   ): Promise<void> {
      await ApiService.client.delete(`/communities/${communityId}/posts/${postId}/comments/${commentId}`, {
         data: { actor },
      });
   },

   async editPostComment(
      communityId: number | string,
      postId: number | string,
      commentId: number | string,
      content: string,
      actor: string
   ): Promise<any> {
      const res = await ApiService.client.patch(`/communities/${communityId}/posts/${postId}/comments/${commentId}`, {
         actor,
         content,
      });
      return res.data;
   },

   // --------- ADMIN MANAGEMENT ----------

   async updateMemberRole(
      communityId: number | string,
      username: string,
      role: "admin" | "moderator" | "member",
      actor?: string // Deprecated
   ): Promise<any> {
      return ApiService.updateMemberRole(String(communityId), username, role);
   },

   async kickMember(
      communityId: number | string,
      username: string,
      actor?: string // Deprecated
   ): Promise<void> {
      return ApiService.kickMember(String(communityId), username);
   },

   async banMember(communityId: number | string, username: string): Promise<void> {
      return ApiService.banMember(String(communityId), username);
   },

   async uploadCommunityAvatar(communityId: number | string, actor: string, imageFile: any): Promise<Community> {
      const formData = new FormData();
      formData.append("avatar", imageFile);
      formData.append("actor", actor);

      const res = await ApiService.client.post(`/communities/${communityId}/avatar`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
   },

   async uploadCommunityCover(
      communityId: number | string,
      actor: string, // Deprecated
      imageFile: any
   ): Promise<Community> {
      const formData = new FormData();
      formData.append("cover", imageFile);
      formData.append("actor", actor);

      const res = await ApiService.client.post(`/communities/${communityId}/cover`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
   },

   // --------- JOIN REQUEST MANAGEMENT ----------

   async requestToJoin(
      communityId: number | string,
      username: string // Deprecated
   ): Promise<any> {
      // Reuse joinCommunity logic which handles request
      return this.joinCommunity(communityId, username);
   },

   async getJoinRequests(
      communityId: number | string,
      actor?: string, // Deprecated
      status: "pending" | "approved" | "rejected" = "pending"
   ): Promise<any[]> {
      return ApiService.getJoinRequests(String(communityId));
   },

   async reviewJoinRequest(communityId: number | string, username: string, action: "approve" | "reject") {
      if (action === "approve") {
         return ApiService.client.post(`/communities/${communityId}/join_requests/${username}/approve`);
      } else {
         return ApiService.client.post(`/communities/${communityId}/join_requests/${username}/reject`);
      }
   },

   // --------- POST APPROVAL ----------
   async getPendingPosts(communityId: number | string): Promise<CommunityPost[]> {
      const res = await ApiService.client.get(`/communities/${communityId}/posts/pending`);
      const raw = res.data || [];
      return raw.map((post: any) => ({
         ...post,
         authorAvatar: post.author_avatar || post.authorAvatar,
         authorDisplayName: post.author_display_name || post.authorDisplayName,
      }));
   },

   async approvePost(communityId: number | string, postId: number | string): Promise<void> {
      return ApiService.approvePost(String(communityId), String(postId));
   },

   async rejectPost(communityId: number | string, postId: number | string): Promise<void> {
      return ApiService.rejectPost(String(communityId), String(postId));
   },

   // --------- COMMUNITY EVENTS ----------

   async getCommunityEvents(communityId: number | string, viewer?: string): Promise<any[]> {
      try {
         const res = await ApiService.client.get(`/communities/${communityId}/events`, {
            params: { viewer },
         });
         return res.data || [];
      } catch (error) {
         console.error("Error getting community events:", error);
         return [];
      }
   },

   async getCommunityEvent(communityId: number | string, eventId: number | string, viewer?: string): Promise<any> {
      const res = await ApiService.client.get(`/communities/${communityId}/events/${eventId}`, {
         params: { viewer },
      });
      return res.data;
   },

   async createCommunityEvent(
      communityId: number | string,
      data: {
         name: string;
         description?: string;
         location?: string;
         start_time: string;
         end_time?: string;
         image?: ImageFile;
      }
   ): Promise<any> {
      const formData = new FormData();
      formData.append("name", data.name);
      if (data.description) formData.append("description", data.description);
      if (data.location) formData.append("location", data.location);
      formData.append("start_time", data.start_time);
      if (data.end_time) formData.append("end_time", data.end_time);
      if (data.image) formData.append("image", data.image as any);

      const res = await ApiService.client.post(`/communities/${communityId}/events`, formData, {
         headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
   },

   async updateCommunityEvent(
      communityId: number | string,
      eventId: number | string,
      data: {
         name?: string;
         description?: string;
         location?: string;
         start_time?: string;
         end_time?: string;
      }
   ): Promise<any> {
      const res = await ApiService.client.put(`/communities/${communityId}/events/${eventId}`, data);
      return res.data;
   },

   async deleteCommunityEvent(communityId: number | string, eventId: number | string): Promise<void> {
      await ApiService.client.delete(`/communities/${communityId}/events/${eventId}`);
   },

   async respondToCommunityEvent(
      communityId: number | string,
      eventId: number | string,
      status: "going" | "interested" | "not_going"
   ): Promise<any> {
      const res = await ApiService.client.post(`/communities/${communityId}/events/${eventId}/respond`, { status });
      return res.data;
   },

   async getCommunityEventParticipants(
      communityId: number | string,
      eventId: number | string,
      status?: "going" | "interested"
   ): Promise<any[]> {
      const res = await ApiService.client.get(`/communities/${communityId}/events/${eventId}/participants`, {
         params: { status },
      });
      return res.data || [];
   },
};

export default communityService;
export { communityService };
