// User related types
export interface User {
  id: string;
  username?: string;
  name: string;
  email: string;
  avatar?: string;
  country: string;
  city: string;
  flag?: string;
  status: 'Traveling' | 'Learning' | 'Chilling' | 'Open to Chat';
  languages: Language[];
  interests: string[];
  bio?: string;
  gender?: 'Male' | 'Female' | 'Other';
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
}

export interface Language {
  name: string;
  level: 'Native' | 'Fluent' | 'Intermediate' | 'Beginner';
}

// Event related types
export interface Event {
  id: string;
  name: string;
  image?: string;
  dateStart: string;
  dateEnd: string;
  address: string;
  distance?: number; // in km
  participants: User[];
  comments: Comment[];
  hostedBy: User;
  entranceFee?: string;
  pricingMenu?: string;
  schedule?: string;
  details?: string;
  isWeekly?: boolean;
  timeStart?: string;
  timeEnd?: string;
}

export interface Comment {
  id: string;
  userId: string;
  user: User;
  content: string;
  image?: string;
  timestamp: string;
  likes?: number;
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

// Chat related types
export interface Chat {
  id: string;
  type: 'event' | 'user' | 'group'|'dm';
  name?: string;
  participants?: User[];
  lastMessage?: Message;
  unreadCount?: number;
  eventId?: string;
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
  id: string;
  name: string;
  description?: string;
  image?: string;
  memberCount?: number;
  posts: Post[];
}

export interface Post {
  id: string;
  communityId: string;
  userId: string;
  user: User;
  content: string;
  image?: string;
  timestamp: string;
  likes: number;
  comments: Comment[];
}

// Notification related types
export interface Notification {
  id: string;
  userId: string;
  type: 'event' | 'message' | 'hangout' | 'connection' | 'like' | 'comment';
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
  gender?: 'Male' | 'Female';
  ageRange?: [number, number];
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
  username: string;
  name: string;
  country: string;
  city: string;
  gender?: 'Male' | 'Female' | 'Other';
}
