import { User, Event, Hangout, Chat, Community, Notification } from '../types';

// Mock Users
export const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'https://i.pravatar.cc/150?img=1',
    country: 'United States',
    city: 'New York',
    flag: '🇺🇸',
    status: 'Open to Chat',
    languages: [
      { name: 'English', level: 'Native' },
      { name: 'Vietnamese', level: 'Beginner' },
    ],
    interests: ['Language exchange', 'Coffee', 'Travel'],
    bio: 'Love meeting new people and learning languages!',
    gender: 'Male',
    age: 28,
    memberSince: '2023-01-15',
    followersCount: 125,
    isAvailableToHangout: true,
    hangoutActivities: ['drink-tea-coffee', 'exchange-languages'],
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
    },
  },
  {
    id: '2',
    name: 'Sarah Smith',
    email: 'sarah@example.com',
    avatar: 'https://i.pravatar.cc/150?img=5',
    country: 'Vietnam',
    city: 'Ho Chi Minh City',
    flag: '🇻🇳',
    status: 'Traveling',
    languages: [
      { name: 'Vietnamese', level: 'Native' },
      { name: 'English', level: 'Fluent' },
    ],
    interests: ['Travel', 'Food', 'Photography'],
    bio: 'Explorer and foodie',
    gender: 'Female',
    age: 25,
    memberSince: '2023-06-20',
    followersCount: 89,
    isAvailableToHangout: true,
    hangoutActivities: ['get-food', 'explore-area', 'tourist-attractions'],
    location: {
      latitude: 10.8231,
      longitude: 106.6297,
    },
  },
  {
    id: '3',
    name: 'Michael Chen',
    email: 'michael@example.com',
    avatar: 'https://i.pravatar.cc/150?img=12',
    country: 'China',
    city: 'Shanghai',
    flag: '🇨🇳',
    status: 'Learning',
    languages: [
      { name: 'Chinese', level: 'Native' },
      { name: 'English', level: 'Intermediate' },
    ],
    interests: ['Technology', 'Hiking', 'Movies'],
    gender: 'Male',
    age: 30,
    memberSince: '2022-11-10',
    followersCount: 203,
    isAvailableToHangout: false,
    location: {
      latitude: 31.2304,
      longitude: 121.4737,
    },
  },
];

// Mock Events
export const MOCK_EVENTS: Event[] = [
  {
    id: 'e1',
    name: 'Garden by Bottega 5 - Connect, Share & Chill! - Friday Night (weekly event)',
    image: 'https://picsum.photos/400/250?random=1',
    dateStart: '2025-11-07',
    dateEnd: '2025-11-07',
    address: '123 Nguyen Hue St, District 1, Ho Chi Minh City',
    distance: 2.5,
    participants: [MOCK_USERS[0], MOCK_USERS[1]],
    comments: [],
    hostedBy: MOCK_USERS[0],
    entranceFee: 'Free',
    pricingMenu: 'No',
    schedule: 'Weekly',
    details: 'Join us for a relaxed evening of networking and socializing! Meet new people, share stories, and enjoy good company in a beautiful garden setting.',
    isWeekly: true,
    timeStart: '07:30 PM',
    timeEnd: '11:30 PM',
  },
  {
    id: 'e2',
    name: 'Language Exchange Meetup',
    image: 'https://picsum.photos/400/250?random=2',
    dateStart: '2025-11-10',
    dateEnd: '2025-11-10',
    address: '45 Le Loi St, District 1, Ho Chi Minh City',
    distance: 1.2,
    participants: [MOCK_USERS[1], MOCK_USERS[2]],
    comments: [],
    hostedBy: MOCK_USERS[1],
    entranceFee: '50,000 VND',
    pricingMenu: 'Yes',
    details: 'Practice your language skills with native speakers in a friendly environment.',
    timeStart: '06:00 PM',
    timeEnd: '09:00 PM',
  },
  {
    id: 'e3',
    name: 'Weekend Hiking Adventure',
    image: 'https://picsum.photos/400/250?random=3',
    dateStart: '2025-11-15',
    dateEnd: '2025-11-15',
    address: 'Cu Chi District, Ho Chi Minh City',
    distance: 25.8,
    participants: [MOCK_USERS[2]],
    comments: [],
    hostedBy: MOCK_USERS[2],
    entranceFee: 'Free',
    details: 'Join us for a refreshing hike through beautiful trails!',
    timeStart: '07:00 AM',
    timeEnd: '02:00 PM',
  },
];

// Mock Hangouts
export const MOCK_HANGOUTS: Hangout[] = [
  {
    id: 'h1',
    users: [MOCK_USERS[0], MOCK_USERS[1]],
    createdAt: '2025-11-05T14:30:00Z',
    locations: [
      {
        userId: '1',
        location: { latitude: 40.7128, longitude: -74.0060 },
      },
      {
        userId: '2',
        location: { latitude: 10.8231, longitude: 106.6297 },
      },
    ],
    chatId: 'c1',
  },
];

// Mock Chats
export const MOCK_CHATS: Chat[] = [
  {
    id: 'c1',
    type: 'user',
    participants: [MOCK_USERS[0], MOCK_USERS[1]],
    lastMessage: {
      id: 'm1',
      chatId: 'c1',
      senderId: '1',
      sender: MOCK_USERS[0],
      content: 'Hey! How are you?',
      timestamp: '2025-11-08T10:30:00Z',
      read: true,
    },
    unreadCount: 0,
  },
  {
    id: 'c2',
    type: 'event',
    name: 'Garden by Bottega 5 - Chat',
    participants: [MOCK_USERS[0], MOCK_USERS[1]],
    lastMessage: {
      id: 'm2',
      chatId: 'c2',
      senderId: '2',
      sender: MOCK_USERS[1],
      content: 'See you tonight!',
      timestamp: '2025-11-08T09:15:00Z',
      read: false,
    },
    unreadCount: 2,
    eventId: 'e1',
  },
];

// Mock Communities
export const MOCK_COMMUNITIES: Community[] = [
  {
    id: 1,
    name: 'Language Learners',
    description: 'A community for people learning new languages',
    image_url: 'https://picsum.photos/300/200?random=11',
    created_by: 'admin',
    member_count: 1240,
    post_count: 45,
    is_private: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Travel Enthusiasts',
    description: 'Share your travel experiences and tips',
    image_url: 'https://picsum.photos/300/200?random=12',
    created_by: 'admin',
    member_count: 856,
    post_count: 32,
    is_private: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Foodies of HCMC',
    description: 'Discover the best food spots in Ho Chi Minh City',
    image_url: 'https://picsum.photos/300/200?random=13',
    created_by: 'admin',
    member_count: 2103,
    post_count: 89,
    is_private: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
];

// Mock Notifications
export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    userId: '1',
    type: 'event',
    title: 'New Event Invitation',
    message: 'Sarah invited you to Language Exchange Meetup',
    timestamp: '2025-11-08T08:00:00Z',
    read: false,
    data: { eventId: 'e2' },
  },
  {
    id: 'n2',
    userId: '1',
    type: 'message',
    title: 'New Message',
    message: 'Michael sent you a message',
    timestamp: '2025-11-07T18:30:00Z',
    read: true,
    data: { chatId: 'c1' },
  },
  {
    id: 'n3',
    userId: '1',
    type: 'hangout',
    title: 'Hangout Request',
    message: 'Sarah wants to hang out for coffee',
    timestamp: '2025-11-07T12:00:00Z',
    read: true,
  },
];

// Mock current user
export const MOCK_CURRENT_USER = MOCK_USERS[0];
