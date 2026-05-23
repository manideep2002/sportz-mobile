import type {
  Comment,
  Community,
  Conversation,
  Court,
  Message,
  Post,
  SearchResult,
  SportEvent,
  SportzNotification,
  Story,
  UserProfile
} from '@/types/domain';

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
const daysFromNow = (days: number, hour = 18) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
};

export const currentUser: UserProfile = {
  id: 'user-marcus',
  username: 'marcusk',
  displayName: 'Marcus King',
  initials: 'MK',
  bio: 'Pro basketball player and football enthusiast. Always chasing the next game.',
  city: 'Bengaluru',
  country: 'IN',
  primarySport: 'Basketball',
  sports: ['Basketball', 'Football', 'Tennis'],
  position: 'Point Guard',
  skillLevel: 'Pro',
  isOnline: true,
  isHireable: true,
  badges: ['PRO'],
  stats: {
    followers: 847,
    following: 234,
    posts: 92,
    winRate: 92,
    games: 147,
    bestPoints: 34,
    avgRebounds: 8.2
  }
};

export const users: UserProfile[] = [
  currentUser,
  {
    id: 'user-arjun',
    username: 'arjunk',
    displayName: 'Arjun Kapoor',
    initials: 'AJ',
    bio: "Hooping since 07. Point guard for BLR Ballers. 34 pts is not my max.",
    city: 'Bengaluru',
    country: 'IN',
    primarySport: 'Basketball',
    sports: ['Basketball'],
    position: 'Point Guard',
    skillLevel: 'Advanced',
    isOnline: true,
    isHireable: true,
    badges: ['MVP'],
    stats: {
      followers: 2100,
      following: 347,
      posts: 132,
      winRate: 94,
      games: 219
    }
  },
  {
    id: 'user-sneha',
    username: 'snehar',
    displayName: 'Sneha Reddy',
    initials: 'SR',
    bio: 'Football midfielder, weekend tennis partner, recovery nerd.',
    city: 'Hyderabad',
    country: 'IN',
    primarySport: 'Football',
    sports: ['Football', 'Tennis'],
    position: 'Midfielder',
    skillLevel: 'Intermediate',
    isOnline: true,
    isHireable: true,
    badges: [],
    stats: {
      followers: 980,
      following: 301,
      posts: 64,
      winRate: 88,
      games: 102
    }
  },
  {
    id: 'user-vikram',
    username: 'vikrams',
    displayName: 'Vikram Singh',
    initials: 'VK',
    bio: 'Tennis all-rounder, verified coach, weekend competitor.',
    city: 'Bengaluru',
    country: 'IN',
    primarySport: 'Tennis',
    sports: ['Tennis', 'Badminton'],
    position: 'All-round',
    skillLevel: 'Pro',
    isOnline: false,
    isVerified: true,
    badges: ['Verified'],
    stats: {
      followers: 3400,
      following: 410,
      posts: 228,
      winRate: 97,
      games: 391
    }
  },
  {
    id: 'user-ravi',
    username: 'ravip',
    displayName: 'Ravi Patel',
    initials: 'RP',
    bio: 'Cricket opener and strength training regular.',
    city: 'Chennai',
    country: 'IN',
    primarySport: 'Cricket',
    sports: ['Cricket', 'Running'],
    position: 'Opener',
    skillLevel: 'Advanced',
    isOnline: false,
    badges: [],
    stats: {
      followers: 612,
      following: 188,
      posts: 41,
      winRate: 81,
      games: 88
    }
  }
];

export const stories: Story[] = users.slice(1).map((user, index) => ({
  id: `story-${user.id}`,
  user,
  seen: index === 2,
  createdAt: hoursAgo(index + 1)
}));

export const posts: Post[] = [
  {
    id: 'post-arjun-34',
    author: users[1],
    kind: 'stats',
    sport: 'Basketball',
    body: "Dropped 34 pts at Lalbagh courts last night. Looking for 2 more players for our team this weekend. React if you are in.",
    mediaKind: 'court-card',
    statsLine: '34 PTS - 8 REB - 5 AST',
    likedByMe: true,
    likes: 128,
    comments: 24,
    shares: 8,
    createdAt: hoursAgo(2)
  },
  {
    id: 'post-sneha-thread',
    author: users[2],
    kind: 'thread',
    sport: 'Tennis',
    body: 'Doubles partner needed for weekend tournament at KGA. Rating 4.0+. DM me.',
    eventTeaser: {
      dateLabel: 'Sat, Apr 26',
      timeLabel: '7:00 AM',
      slotsLabel: '1 left'
    },
    mediaKind: 'none',
    likedByMe: false,
    likes: 47,
    comments: 12,
    shares: 3,
    createdAt: hoursAgo(5)
  },
  {
    id: 'post-basa-camp',
    author: {
      ...users[1],
      id: 'page-basa',
      displayName: 'Bengaluru Athletes Academy',
      initials: 'BA',
      username: 'basa'
    },
    kind: 'post',
    sport: 'Multi-sport',
    body: 'Summer Training Camp 2026 registrations are open. Early athlete pricing is live for the first 100 players.',
    mediaKind: 'none',
    likedByMe: false,
    likes: 213,
    comments: 47,
    shares: 20,
    createdAt: hoursAgo(6)
  }
];

export const comments: Comment[] = [
  {
    id: 'comment-sneha-1',
    postId: 'post-arjun-34',
    author: users[2],
    body: 'Legendary game. Count me in for the weekend.',
    likes: 8,
    createdAt: hoursAgo(1)
  },
  {
    id: 'comment-vikram-1',
    postId: 'post-arjun-34',
    author: users[3],
    body: '34 pts! Carry energy. I am in for the weekend game.',
    likes: 6,
    createdAt: hoursAgo(1.8)
  }
];

export const events: SportEvent[] = [
  {
    id: 'event-pickup-basketball',
    title: '5v5 Pickup Basketball',
    sport: 'Basketball',
    status: 'live',
    description: 'Casual 5v5 pickup game. All skill levels welcome. Bring your own shoes. Court is booked until 8:30 PM.',
    startsAt: daysFromNow(0, 18),
    endsAt: daysFromNow(0, 20),
    locationName: 'Koramangala Indoor Courts',
    city: 'Bengaluru',
    latitude: 12.9352,
    longitude: 77.6245,
    maxPlayers: 10,
    playerCount: 7,
    entryFeeLabel: 'Free',
    organizer: users[1],
    attendees: [users[1], users[2], users[3], users[4], currentUser]
  },
  {
    id: 'event-football-league',
    title: 'Weekend League Match',
    sport: 'Football',
    status: 'open',
    description: 'Friendly league match with rolling substitutions and team captains selected on arrival.',
    startsAt: daysFromNow(0, 19),
    endsAt: daysFromNow(0, 21),
    locationName: 'Cubbon Park Ground',
    city: 'Bengaluru',
    latitude: 12.9763,
    longitude: 77.5929,
    maxPlayers: 14,
    playerCount: 11,
    entryFeeLabel: 'INR 150',
    organizer: users[2],
    attendees: [users[1], users[2], users[3]]
  },
  {
    id: 'event-tennis-doubles',
    title: 'Tennis Doubles',
    sport: 'Tennis',
    status: 'open',
    description: 'Intermediate doubles ladder, three sets, BYO racket.',
    startsAt: daysFromNow(2, 7),
    endsAt: daysFromNow(2, 9),
    locationName: 'KGA Tennis Courts',
    city: 'Bengaluru',
    latitude: 12.9507,
    longitude: 77.6408,
    maxPlayers: 4,
    playerCount: 2,
    entryFeeLabel: 'INR 300',
    organizer: users[3],
    attendees: [users[2], users[3]]
  }
];

export const courts: Court[] = [
  {
    id: 'court-koramangala-indoor',
    name: 'Koramangala Indoor',
    sport: 'Basketball',
    city: 'Bengaluru',
    latitude: 12.9352,
    longitude: 77.6245,
    distanceKm: 1.2,
    surface: 'Synthetic floor',
    rating: 4.8,
    hourlyPrice: 400,
    currency: 'INR',
    availableNow: true,
    availabilityLabel: 'Available'
  },
  {
    id: 'court-kga-tennis',
    name: 'KGA Tennis Courts',
    sport: 'Tennis',
    city: 'Bengaluru',
    latitude: 12.9507,
    longitude: 77.6408,
    distanceKm: 2.8,
    surface: 'Clay surface',
    rating: 4.9,
    hourlyPrice: 600,
    currency: 'INR',
    availableNow: true,
    availabilityLabel: 'Available'
  },
  {
    id: 'court-cubbon-turf',
    name: 'Cubbon Park Turf',
    sport: 'Football',
    city: 'Bengaluru',
    latitude: 12.9763,
    longitude: 77.5929,
    distanceKm: 3.2,
    surface: 'Astroturf',
    rating: 4.7,
    hourlyPrice: 800,
    currency: 'INR',
    availableNow: false,
    availabilityLabel: 'Booked until 8 PM'
  }
];

export const communities: Community[] = [
  {
    id: 'group-blr-ballers',
    type: 'group',
    name: 'BLR Ballers',
    slug: 'blr-ballers',
    description: "Bengaluru's premier basketball community. Pickup games every weekend, tournaments monthly.",
    sport: 'Basketball',
    city: 'Bengaluru',
    memberCount: 342,
    isAdmin: true,
    latestPost: 'Weekend game is live tonight at 6:30 PM.'
  },
  {
    id: 'group-tennis-bengaluru',
    type: 'group',
    name: 'Tennis Bengaluru',
    slug: 'tennis-bengaluru',
    description: 'Court bookings, ladders, and friendly doubles partners.',
    sport: 'Tennis',
    city: 'Bengaluru',
    memberCount: 128
  },
  {
    id: 'page-basa',
    type: 'page',
    name: 'Bengaluru Athletes Academy',
    slug: 'basa',
    description: 'Developing the next generation of Bengaluru athletes.',
    sport: 'Multi-sport',
    city: 'Bengaluru',
    memberCount: 0,
    followerCount: 4800,
    isVerified: true,
    latestPost: 'Summer Training Camp 2026 registrations are open.'
  }
];

export const conversations: Conversation[] = [
  {
    id: 'conversation-arjun',
    title: 'Arjun Kapoor',
    participants: [currentUser, users[1]],
    isGroup: false,
    lastMessage: 'You in for the game tonight?',
    lastMessageAt: hoursAgo(0.05),
    unreadCount: 3,
    pinned: true
  },
  {
    id: 'conversation-sneha',
    title: 'Sneha Reddy',
    participants: [currentUser, users[2]],
    isGroup: false,
    lastMessage: 'Count me in for Saturday!',
    lastMessageAt: hoursAgo(0.25),
    unreadCount: 1
  },
  {
    id: 'conversation-blr',
    title: 'BLR Ballers',
    participants: [currentUser, users[1], users[2], users[3]],
    isGroup: true,
    lastMessage: 'Arjun: See you all at 6.',
    lastMessageAt: hoursAgo(1),
    unreadCount: 0
  },
  {
    id: 'conversation-vikram',
    title: 'Vikram Singh',
    participants: [currentUser, users[3]],
    isGroup: false,
    lastMessage: 'You: Sounds good mate.',
    lastMessageAt: hoursAgo(3),
    unreadCount: 0
  }
];

export const messages: Message[] = [
  {
    id: 'message-1',
    conversationId: 'conversation-arjun',
    senderId: users[1].id,
    body: 'Hey Marcus! You playing tonight?',
    createdAt: hoursAgo(0.4),
    readBy: [users[1].id, currentUser.id]
  },
  {
    id: 'message-2',
    conversationId: 'conversation-arjun',
    senderId: currentUser.id,
    body: 'Yeah definitely. What time?',
    createdAt: hoursAgo(0.35),
    readBy: [currentUser.id, users[1].id]
  },
  {
    id: 'message-3',
    conversationId: 'conversation-arjun',
    senderId: users[1].id,
    body: '6:30 PM at Koramangala indoor. We need a point guard badly.',
    createdAt: hoursAgo(0.2),
    readBy: [users[1].id]
  },
  {
    id: 'message-4',
    conversationId: 'conversation-arjun',
    senderId: currentUser.id,
    body: 'Count me in. I will bring Vikram too.',
    createdAt: hoursAgo(0.1),
    readBy: [currentUser.id]
  },
  {
    id: 'message-sneha-1',
    conversationId: 'conversation-sneha',
    senderId: users[2].id,
    body: 'Are you free for a mixed doubles session Saturday morning?',
    createdAt: hoursAgo(0.5),
    readBy: [users[2].id, currentUser.id]
  },
  {
    id: 'message-sneha-2',
    conversationId: 'conversation-sneha',
    senderId: currentUser.id,
    body: 'Count me in for Saturday!',
    createdAt: hoursAgo(0.25),
    readBy: [currentUser.id, users[2].id]
  },
  {
    id: 'message-blr-1',
    conversationId: 'conversation-blr',
    senderId: users[1].id,
    body: 'See you all at 6.',
    createdAt: hoursAgo(1.1),
    readBy: [users[1].id, currentUser.id, users[2].id, users[3].id]
  },
  {
    id: 'message-blr-2',
    conversationId: 'conversation-blr',
    senderId: currentUser.id,
    body: 'I will bring an extra ball.',
    createdAt: hoursAgo(1),
    readBy: [currentUser.id, users[1].id]
  },
  {
    id: 'message-blr-3',
    conversationId: 'conversation-blr',
    senderId: users[2].id,
    body: 'Court 3 is booked.',
    createdAt: hoursAgo(0.95),
    readBy: [users[2].id, currentUser.id]
  },
  {
    id: 'message-vikram-1',
    conversationId: 'conversation-vikram',
    senderId: users[3].id,
    body: 'Can you cover the 7 PM tennis slot tomorrow?',
    createdAt: hoursAgo(4),
    readBy: [users[3].id, currentUser.id]
  },
  {
    id: 'message-vikram-2',
    conversationId: 'conversation-vikram',
    senderId: currentUser.id,
    body: 'Sounds good mate.',
    createdAt: hoursAgo(3),
    readBy: [currentUser.id]
  }
];

export const notifications: SportzNotification[] = [
  {
    id: 'notification-like',
    kind: 'comment',
    title: 'New comment',
    body: 'Arjun Kapoor liked your post and commented on your game recap.',
    actor: users[1],
    read: false,
    createdAt: hoursAgo(0.03)
  },
  {
    id: 'notification-event',
    kind: 'event',
    title: 'Event starts soon',
    body: '5v5 Pickup Basketball starts in 1 hour at Koramangala Indoor Courts.',
    read: false,
    createdAt: hoursAgo(0.5),
    ctaLabel: 'View Event',
    entityId: 'event-pickup-basketball'
  },
  {
    id: 'notification-follow',
    kind: 'follow',
    title: 'New follower',
    body: 'Sneha Reddy started following you.',
    actor: users[2],
    read: false,
    createdAt: hoursAgo(1),
    ctaLabel: 'Follow back'
  },
  {
    id: 'notification-achievement',
    kind: 'achievement',
    title: 'Achievement earned',
    body: 'You earned the 30-day training streak achievement.',
    read: true,
    createdAt: hoursAgo(48)
  }
];

export const searchResults: SearchResult[] = [
  ...users.slice(1).map((user) => ({
    id: user.id,
    type: 'player' as const,
    title: user.displayName,
    subtitle: `${user.primarySport} - ${user.city}`
  })),
  ...events.map((event) => ({
    id: event.id,
    type: 'event' as const,
    title: event.title,
    subtitle: `${event.sport} - ${event.locationName}`
  })),
  ...communities.map((community) => ({
    id: community.id,
    type: community.type,
    title: community.name,
    subtitle: `${community.sport} - ${community.city}`
  }))
];

export const sportsFilters = ['All', 'Basketball', 'Football', 'Tennis', 'Cricket', 'Badminton'] as const;
