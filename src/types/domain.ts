export type ID = string;

export type Sport = string;

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';

export type Gender = 'Female' | 'Male' | 'Non-binary' | 'Prefer not to say';

export interface UserProfile {
  id: ID;
  username: string;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio: string;
  city: string;
  country: string;
  primarySport: Sport;
  sports: Sport[];
  position?: string;
  skillLevel: SkillLevel;
  isOnline: boolean;
  isVerified?: boolean;
  isHireable?: boolean;
  isPrivate?: boolean;
  isAdmin?: boolean;
  badges: string[];
  stats: ProfileStats;
}

export interface ProfileStats {
  followers: number;
  following: number;
  posts: number;
  winRate: number;
  games: number;
  bestPoints?: number;
  avgRebounds?: number;
}

export interface Story {
  id: ID;
  user: Pick<UserProfile, 'id' | 'displayName' | 'initials' | 'avatarUrl' | 'skillLevel'>;
  mediaUrl?: string | null;
  body?: string | null;
  seen: boolean;
  createdAt: string;
}

export type PostKind = 'post' | 'thread' | 'stats' | 'highlight';

export interface Post {
  id: ID;
  author: UserProfile;
  kind: PostKind;
  sport: Sport;
  body: string;
  mediaUrl?: string | null;
  mediaKind?: 'image' | 'video' | 'court-card' | 'none';
  statsLine?: string;
  visibility?: 'public' | 'followers' | 'group';
  eventTeaser?: EventTeaser;
  likedByMe: boolean;
  savedByMe: boolean;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
}

export interface Comment {
  id: ID;
  postId: ID;
  parentCommentId?: ID | null;
  author: UserProfile;
  body: string;
  likes: number;
  likedByMe?: boolean;
  createdAt: string;
}

export type EventStatus = 'open' | 'full' | 'live' | 'cancelled' | 'completed';

export interface EventTeaser {
  dateLabel: string;
  timeLabel: string;
  slotsLabel: string;
}

export interface SportEvent {
  id: ID;
  title: string;
  sport: Sport;
  status: EventStatus;
  description: string;
  coverUrl?: string | null;
  startsAt: string;
  endsAt: string;
  locationName: string;
  city: string;
  latitude: number;
  longitude: number;
  maxPlayers: number;
  playerCount: number;
  entryFeeLabel: string;
  organizer: UserProfile;
  attendees: UserProfile[];
}

export interface Court {
  id: ID;
  name: string;
  sport: Sport;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  surface: string;
  rating: number;
  hourlyPrice: number;
  currency: 'INR' | 'USD';
  availableNow: boolean;
  availabilityLabel: string;
}

export interface CourtBooking {
  id: ID;
  court: Court;
  user: UserProfile;
  startsAt: string;
  endsAt: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface Conversation {
  id: ID;
  title: string;
  participants: UserProfile[];
  isGroup: boolean;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  pinned?: boolean;
  communityId?: ID;
}

export interface Message {
  id: ID;
  conversationId: ID;
  senderId: ID;
  body: string;
  createdAt: string;
  readBy: ID[];
  pending?: boolean;
}

export interface EventMessage {
  id: ID;
  eventId: ID;
  sender: UserProfile;
  body: string;
  createdAt: string;
}

export type NotificationKind =
  | 'like'
  | 'comment'
  | 'follow'
  | 'follow_request'
  | 'event'
  | 'message'
  | 'invite'
  | 'achievement';

export interface SportzNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  actor?: UserProfile;
  read: boolean;
  createdAt: string;
  ctaLabel?: string;
  entityId?: ID;
  entityType?: 'post' | 'event' | 'conversation' | 'profile' | 'group' | 'page';
}

export interface Community {
  id: ID;
  type: 'group' | 'page';
  name: string;
  slug: string;
  description: string;
  sport: Sport;
  city: string;
  memberCount: number;
  followerCount?: number;
  isAdmin?: boolean;
  isMember?: boolean;
  isVerified?: boolean;
  latestPost?: string;
}

export interface SearchResult {
  id: ID;
  type: 'player' | 'event' | 'group' | 'page' | 'court';
  title: string;
  subtitle: string;
  skillLevel?: SkillLevel;
}
