import { Post } from "../types";
import ApiService from "./api";
import communityService from "./communityService";

class PostService {
 
  // LIST COMMUNITIES
  async getCommunities(query?: string, limit?: number) {
    return communityService.getCommunities(query, limit);
  }

  // CREATE POST (text)
  async create(data: {
    author_username: string;
    content?: string;
    audience?: string;
    disable_comments?: boolean;
    hide_like_count?: boolean;
    community_id?: number | null;
    status?: string | null;
  }) {
    const res = await ApiService.client.post("/posts", data);
    return res.data;
  }

  // CREATE POST WITH MEDIA
  async createWithMedia (data: {
    author_username: string;
    content?: string;
    audience?: string;
    disable_comments?: boolean;
    hide_like_count?: boolean;
    community_id?: number | null;
    status?: string | null;
    media?: {
      uri: string;
      name?: string;
      type?: string;
    }[];
  }) {
    const formData = new FormData();

    formData.append("author_username", data.author_username);
    formData.append("content", data.content || "");
    formData.append("audience", data.audience || "followers");
    formData.append("disable_comments", String(!!data.disable_comments));
    formData.append("hide_like_count", String(!!data.hide_like_count));

    if (data.community_id !== undefined && data.community_id !== null) {
      formData.append("community_id", String(data.community_id));
    }

    if (data.status) {
      formData.append("status", data.status);
    }

    if (data.media && data.media.length > 0) {
      data.media.forEach((file, index) => {
        const fileName = file.name || `media_${Date.now()}_${index}`;
        const mimeType = file.type || "image/jpeg";

        formData.append("media", {
          uri: file.uri,
          name: fileName,
          type: mimeType,
        } as any);
      });
    }

    const response = await ApiService.client.post("/posts", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  }

  // UPDATE POST
  async update(
    postId: number,
    data: {
      author_username: string;
      content?: string;
      audience?: string;
      disable_comments?: boolean;
      hide_like_count?: boolean;
      community_id?: number | null;
      status?: string | null
    }
  ) {
    const res = await ApiService.client.put(`/posts/${postId}`, data);
    return res.data;
  }

  // DELETE POST
  async delete(postId: number, author_username: string) {
    await ApiService.client.delete(`/posts/${postId}`, {
      data: { author_username },
    });
  }

  // UPLOAD MEDIA (multi)
  async uploadMedia(postId: number, files: any[]) {
    const form = new FormData();

    files.forEach((file) => {
      form.append("media", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    });

    const res = await ApiService.client.post(`/posts/${postId}/media`, form, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  }

  // DELETE SINGLE MEDIA
  async removeMedia(postId: number, mediaId: number, author_username: string) {
    const res = await ApiService.client.delete(
      `/posts/${postId}/media/${mediaId}`,
      { data: { author_username } }
    );
    return res.data;
  }

  // GET FEED
  async list(limit = 20, before?: string) {
    return ApiService.deduplicatedGet("/posts", { limit, before });
  }

  // GET BY ID
  async getById(postId: number, viewer?: string): Promise<Post> {
    const params = viewer ? { viewer } : undefined;
    return ApiService.deduplicatedGet<Post>(`/posts/${postId}`, params);
  }

  // GET POSTS BY USER
  async listByUser(username: string) {
    return ApiService.deduplicatedGet(`/posts/user/${username}`);
  }

  async like(postId: number) {
    const res = await ApiService.client.post(`/posts/${postId}/like`, {});
    return res.data; // { post_id, like_count }
  }

  async unlike(postId: number) {
    const res = await ApiService.client.delete(`/posts/${postId}/like`);
    return res.data; // { post_id, like_count }
  }

  // GET LIKES
  async getLikes(postId: number) {
    return ApiService.deduplicatedGet(`/posts/${postId}/likes`);
  }
}

export const postService = new PostService();