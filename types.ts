
export interface User {
  id: string;
  email: string;
  username?: string; // Optional until setup
  displayName?: string;
  bio?: string;
  avatarUrl?: string; // New field for profile pic
  collegeId?: string; // Optional until setup
  createdAt: number;
  following: string[]; // array of userIds
  followers: string[]; // array of userIds
  isAdmin: boolean;
  acceptedChats: string[]; // array of userIds
  blockedUsers?: string[]; // array of userIds
  isBanned?: boolean;
  suspendedUntil?: number;
  fcmToken?: string;
}

export interface Report {
  id: string;
  confessionId: string;
  reporterId: string;
  reason: string;
  timestamp: number;
  status: 'pending' | 'resolved' | 'dismissed';
  resolvedBy?: string;
}

export interface College {
  id: string;
  name: string;
  location?: string; // e.g. "Mumbai, MH"
}

export interface CollegeRequest {
  id: string;
  name: string;
  location: string;
  requestedBy: string; // userId
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export interface Confession {
  id: string;
  firebaseKey?: string; // The real database key, useful if id field differs
  userId: string;
  username: string; // denormalized for easier display
  userAvatar?: string; // denormalized for display
  content: string;
  collegeId: string;
  likes: string[]; // array of userIds who liked
  timestamp: number;
  isAnonymous: boolean;
  hidden?: boolean; // New field for soft delete/hide system
  visibility?: 'campus' | 'open'; // New field for dual feeds
}

export interface Comment {
  id: string;
  confessionId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  read: boolean;
}

export interface Notification {
  id: string;
  userId: string; // Recipient
  type: 'like' | 'comment' | 'follow' | 'system';
  actorId: string; // User who performed action (or 'system')
  actorName: string;
  actorAvatar?: string;
  entityId?: string; // Confession ID or Comment ID
  content?: string; // Snippet of comment or post
  read: boolean;
  timestamp: number;
}

export enum AppView {
  AUTH = 'AUTH',
  SETUP_USERNAME = 'SETUP_USERNAME',
  SETUP_COLLEGE = 'SETUP_COLLEGE',
  SETUP_AVATAR = 'SETUP_AVATAR',
  HOME = 'HOME',
  SEARCH = 'SEARCH',
  POST = 'POST',
  MESSAGES = 'MESSAGES',
  PROFILE = 'PROFILE',
  ADMIN = 'ADMIN',
  CHAT_DETAIL = 'CHAT_DETAIL',
  USER_PROFILE = 'USER_PROFILE', // Viewing someone else
  NOTIFICATIONS = 'NOTIFICATIONS'
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}
