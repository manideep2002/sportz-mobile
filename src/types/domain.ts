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
  /** Indicates whether the story media is a video or a static image. Defaults to 'image' when absent. */
  mediaKind?: 'image' | 'video';
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
  mediaPlaceholder?: string | null;
  mediaStoragePath?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
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
export type EventType = 'Pickup Game' | 'Tournament' | 'Training' | 'Friendly';
export type EventVisibility = 'public' | 'followers' | 'group' | 'invite';
export type EventParticipationStatus = 'none' | 'going' | 'interested' | 'declined' | 'waitlisted';

export interface EventTeaser {
  dateLabel: string;
  timeLabel: string;
  slotsLabel: string;
}

export interface SportEvent {
  id: ID;
  title: string;
  eventType: EventType;
  sport: Sport;
  status: EventStatus;
  visibility: EventVisibility;
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
  entryFeeCents: number;
  currency: string;
  entryFeeLabel: string;
  organizer: UserProfile;
  attendees: UserProfile[];
}

export interface Court {
  id: ID;
  name: string;
  sport: Sport;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  surface: string;
  rating: number;
  hourlyPrice: number;
  currency: 'INR' | 'USD';
  openNow: boolean;
  futureBookable: boolean;
  availabilityLabel: string;
  timezone: string;
  slotDurationMinutes: number;
  bookingWindowDays: number;
  cancellationNoticeHours: number;
  bookingRequiresApproval: boolean;
  paymentPolicy: 'external' | 'not_required';
}

export interface CourtAvailabilitySlot {
  startsAt: string;
  endsAt: string;
  slotDurationMinutes: number;
  price: number;
  currency: Court['currency'];
}

export interface CourtBooking {
  id: ID;
  court: Court;
  user: UserProfile;
  startsAt: string;
  endsAt: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  price: number;
  currency: Court['currency'];
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  canCancel: boolean;
  cancellationDeadline: string;
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
  muted?: boolean;
  currentUserRole?: ChatParticipantRole;
  participantRoles?: Record<ID, ChatParticipantRole>;
  communityId?: ID;
}

export type ChatParticipantRole = 'owner' | 'admin' | 'member';

export interface Message {
  id: ID;
  conversationId: ID;
  senderId: ID;
  body: string;
  createdAt: string;
  readBy: ID[];
  pending?: boolean;
  editedAt?: string | null;
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
  | 'mention'
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
  actorIds?: ID[];
  actorCount?: number;
  read: boolean;
  createdAt: string;
  lastEventAt?: string;
  ctaLabel?: string;
  entityId?: ID;
  entityType?: 'post' | 'event' | 'conversation' | 'profile' | 'group' | 'page' | 'court_booking';
  data?: Record<string, unknown>;
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
  isPrivate?: boolean;
  isAdmin?: boolean;
  isMember?: boolean;
  canViewContent?: boolean;
  canManageMembers?: boolean;
  membershipRole?: CommunityMemberRole | null;
  membershipStatus?: CommunityMembershipStatus;
  pendingInviteId?: ID;
  pendingRequestId?: ID;
  isVerified?: boolean;
  latestPost?: string;
}

export type CommunityMemberRole = 'owner' | 'admin' | 'member' | 'follower';

export type CommunityMembershipStatus = 'none' | 'joined' | 'admin' | 'owner' | 'invited' | 'requested';

export interface CommunityMember {
  userId: ID;
  role: CommunityMemberRole;
  joinedAt: string;
  profile: UserProfile;
}

export interface CommunityInvite {
  id: ID;
  community: Community;
  inviter?: UserProfile;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

export interface CommunityJoinRequest {
  id: ID;
  communityId: ID;
  requester: UserProfile;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  createdAt: string;
}

export interface SearchResult {
  id: ID;
  type: 'player' | 'event' | 'group' | 'page' | 'court';
  title: string;
  subtitle: string;
  skillLevel?: SkillLevel;
}
