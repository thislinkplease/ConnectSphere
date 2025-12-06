// User related types
export interface User {
   id: string;
   username?: string;
   name: string;
   email: string;
   avatar?: string;
   backgroundImage?: string;
   country: string;
   city: string;
   flag?: string;
   status: "Traveling" | "Learning" | "Chilling" | "Open to Chat";
   languages: Language[];
   interests: string[];
   bio?: string;
   gender?: "Male" | "Female" | "Other";
   age?: number;
   memberSince?: string;
   followersCount?: number;
   followingCount?: number;
   postsCount?: number;
   isPro?: boolean;
   specialties?: {
      from?: string;
      interests?: string[];
      countriesLived?: string[];
      countriesVisited?: string[];
   };
   isAvailableToHangout?: boolean;
   hangoutActivities?: string[];
   currentActivity?: string;
   location?: {
      latitude: number;
      longitude: number;
   };
   isOnline?: boolean;
   distance?: number; // Distance in kilometers from current user
}

export interface Language {
   name: string;
   level: "Native" | "Fluent" | "Intermediate" | "Beginner";
}

// Event related types
export interface Event {
   id: string;
   name: string;
   image_url?: string;
   image?: string; // For backward compatibility with mock data
   dateStart: string;
   dateEnd: string;
   address: string;
   distance?: number; // in km
   participants: User[];
   comments: Comment[];
   hosted_by?: string;
   hostedBy?: User; // For backward compatibility with mock data
   entranceFee?: string;
   pricingMenu?: string;
   schedule?: string;
   details?: string;
   isWeekly?: boolean;
   timeStart?: string;
   timeEnd?: string;
   description?: string;
   category?: string;
}

// Community Event types (Facebook-style events for communities)
export interface CommunityEvent {
   id: number;
   community_id: number;
   name: string;
   description?: string;
   image_url?: string;
   location?: string;
   start_time: string;
   end_time?: string;
   created_by: string;
   created_at: string;
   updated_at?: string;
   participant_count?: number;
   is_going?: boolean;
   is_interested?: boolean;
   creator?: {
      username: string;
      name?: string;
      avatar?: string;
   };
}

export interface CommunityEventParticipant {
   id: number;
   event_id: number;
   username: string;
   status: 'going' | 'interested';
   created_at: string;
   user?: {
      username: string;
      name?: string;
      avatar?: string;
   };
}


// Hangout related types
export interface Hangout {
   id: string;
   users: User[];
   createdAt: string;
   locations: {
      userId: string;
      location: {
         latitude: number;
         longitude: number;
      };
   }[];
   chatId: string;
}

export interface HangoutActivity {
   id: string;
   label: string;
   icon?: string;
}

// Image file type for uploads
export interface ImageFile {
   uri: string;
   type: string;
   name: string;
}

// Chat related types
export interface Chat {
  id: string;
  type: 'event' | 'user' | 'group' | 'dm' | 'community';
  name?: string;
  participants?: User[];
  lastMessage?: Message;
  unreadCount?: number;
  eventId?: string;
  communityId?: number;
  communityAvatar?: string;

}

export interface Message {
   id: string;
   chatId: string;
   senderId: string;
   sender: User;
   content: string;
   image?: string;
   timestamp: string;
   read: boolean;
}

export interface QuickMessage {
   id: string;
   shortcut: string; // e.g., "/x"
   message: string; // e.g., "Xin chào"
}

// Community/Discussion related types
export interface Community {
  id: number;
  name: string;
  description?: string | null;
  bio?: string | null;
  image_url?: string | null;
  cover_image?: string | null;

  created_by: string;

  member_count: number;
  post_count: number;
  is_private: boolean;
  requires_post_approval?: boolean;
  requires_member_approval?: boolean;

  chat_conversation_id?: number | null;

  created_at: string;
  updated_at: string;
}

export interface CommunityMember {
  id: number;
  community_id: number;
  username: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  user?: User;
}

export interface CommunityJoinRequest {
  id: number;
  community_id: number;
  username: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface PostMedia {
  id: number;
  post_id: number;
  media_url: string;
  media_type: "image" | "video";
  position: number;
  created_at: string;
}

export interface Post {
  id: number;
  author_username: string;
  content?: string | null;
  status?: string | null;
  audience: "public" | "followers" | "close_friends" | "private";
  disable_comments: boolean;
  hide_like_count: boolean;
  like_count: number;
  comment_count: number;
  post_media: PostMedia[];
  community_id?: number | null;
  community_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  authorAvatar?: string;
  authorDisplayName?: string;
}

export interface Comment {
  id: number;
  post_id: number;
  author_username: string;
  content: string;
  parent_id: number | null;
  created_at: string;
};

export interface UserLite {
  username: string;
  avatar?: string | null;
  name?: string | null;
}

export interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  communityId: number;
  postId: number;
  me?: UserLite | null;
}

export interface LocalMediaFile {
  id: number;
  uri: string;
  type: string;
  name: string;
}

// Notification related types
export interface Notification {
   id: string;
   userId: string;
   type: "event" | "message" | "hangout" | "connection" | "like" | "comment";
   title: string;
   message: string;
   timestamp: string;
   read: boolean;
   data?: any;
}

// Filter types
export interface HangoutFilters {
   languages: string[];
   distance: string[];
}

export interface ConnectionFilters {
   gender?: "Male" | "Female";
   ageRange?: [number, number];
   minAge?: number;
   maxAge?: number;
   distance?: number;
}

export interface EventFilters {
   distance?: number;
   date?: string;
}

// Auth types
export interface AuthState {
   isAuthenticated: boolean;
   user: User | null;
   token: string | null;
}

export interface LoginCredentials {
   email: string;
   password: string;
}

export interface SignupData extends LoginCredentials {
  id: string;
  username: string;
  name: string;
  country: string;
  city: string;
  gender?: 'Male' | 'Female' | 'Other';
}
