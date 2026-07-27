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

export type TeamManagerRole = 'owner' | 'manager' | 'coach' | 'recruiter';
export type TeamRosterRole = 'player' | 'captain' | 'reserve';

export interface Team {
  id: ID;
  communityId?: ID | null;
  name: string;
  sport: Sport;
  city?: string | null;
  createdBy?: ID | null;
  managerRole?: TeamManagerRole;
  canSendOffers?: boolean;
}

export type TeamOfferStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired';

export type CompensationPeriod = 'one_time' | 'match' | 'week' | 'month' | 'season' | 'year';

export interface TeamOffer {
  id: ID;
  sender: UserProfile;
  recipient: UserProfile;
  team: Team;
  sport: Sport;
  position: string;
  terms: string;
  compensationAmount?: number | null;
  compensationCurrency?: string | null;
  compensationPeriod?: CompensationPeriod | null;
  startDate?: string | null;
  endDate?: string | null;
  expiresAt: string;
  status: TeamOfferStatus;
  sentAt?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  withdrawnAt?: string | null;
  expiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamOfferHistoryEntry {
  id: ID;
  offerId: ID;
  actor?: UserProfile;
  fromStatus?: TeamOfferStatus | null;
  toStatus: TeamOfferStatus;
  event: string;
  createdAt: string;
}

export type StructuredSport = 'basketball' | 'football' | 'cricket';
export type MatchOutcome = 'win' | 'loss' | 'draw' | 'no_result';
export type StatVerificationStatus = 'self_reported' | 'pending' | 'verified' | 'rejected';

export interface AthleteSeason {
  id: ID;
  athleteId: ID;
  sport: StructuredSport;
  label: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
}

export interface SportStatDefinition {
  id: ID;
  sport: StructuredSport;
  key: string;
  label: string;
  valueType: 'integer' | 'decimal';
  unit?: string | null;
  aggregation: 'sum' | 'average' | 'maximum' | 'minimum';
  required: boolean;
  minimum?: number | null;
  maximum?: number | null;
  displayOrder: number;
}

export interface AthleteMatchStat {
  definitionId: ID;
  key: string;
  label: string;
  unit?: string | null;
  value: number;
}

export interface AthleteMatch {
  id: ID;
  athleteId: ID;
  seasonId: ID;
  sport: StructuredSport;
  playedOn: string;
  teamName: string;
  opponentName: string;
  teamScore?: number | null;
  opponentScore?: number | null;
  outcome: MatchOutcome;
  verificationStatus: StatVerificationStatus;
  verificationSource?: string | null;
  stats: AthleteMatchStat[];
  createdAt: string;
}

export interface AthleteStatMetric {
  key: string;
  label: string;
  unit?: string | null;
  aggregation: SportStatDefinition['aggregation'];
  matchCount: number;
  value: number;
  personalBest: number;
}

export interface AthleteAchievement {
  id: ID;
  title: string;
  description: string;
  badge: string;
  progress: number;
  awardedAt: string;
}

export interface AthleteStatSummary {
  athleteId: ID;
  sport: StructuredSport;
  season?: AthleteSeason;
  matchCount: number;
  wins: number;
  winRate: number;
  verifiedMatchCount: number;
  metrics: AthleteStatMetric[];
  achievements: AthleteAchievement[];
}

export interface ProfileStats {
  followers: number;
  following: number;
  posts: number;
  winRate: number;
  games: number;
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
  communityId?: ID | null;
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
  locationLabel?: string | null;
  mentionedUserIds?: ID[];
  mentionedUsers?: UserProfile[];
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
  communityId?: ID | null;
}

export type EventInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export interface EventInvitation {
  id: ID;
  eventId: ID;
  status: EventInvitationStatus;
  expiresAt: string;
  invitee?: UserProfile;
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
  | 'security'
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
  entityType?: 'post' | 'event' | 'conversation' | 'profile' | 'group' | 'page' | 'court_booking' | 'team_offer' | 'security_event';
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
  rules?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  avatarPath?: string | null;
  coverPath?: string | null;
  joinApprovalRequired?: boolean;
  postingPermission?: CommunityPostingPermission;
  archivedAt?: string | null;
  isArchived?: boolean;
  isAdmin?: boolean;
  isOwner?: boolean;
  isMember?: boolean;
  canPost?: boolean;
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
export type CommunityPostingPermission = 'members' | 'admins';

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

export interface CommunityAdminAuditEntry {
  id: ID;
  communityId?: ID | null;
  actorId?: ID | null;
  action:
    | 'created'
    | 'settings_updated'
    | 'branding_updated'
    | 'branding_removed'
    | 'member_promoted'
    | 'member_demoted'
    | 'member_removed'
    | 'ownership_transferred'
    | 'content_removed'
    | 'archived'
    | 'deleted';
  targetUserId?: ID | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SearchResult {
  id: ID;
  type: 'player' | 'event' | 'group' | 'page' | 'court';
  title: string;
  subtitle: string;
  skillLevel?: SkillLevel;
}
