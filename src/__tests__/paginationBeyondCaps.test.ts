import {
  EVENT_LIST_PAGE_SIZE,
  eventService,
  type EventListCursor
} from '@/services/eventService';
import { courtService, type CourtBookingCursor } from '@/services/courtService';
import { postService } from '@/services/postService';
import {
  notificationService,
  type NotificationCursor
} from '@/services/notificationService';

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
const mockAssertConfigured = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) }
  }
}));
jest.mock('@/lib/supabaseOnly', () => ({
  assertSupabaseConfigured: () => mockAssertConfigured()
}));
jest.mock('@/services/profileMapper', () => ({
  mapProfileRow: (row: { id: string }) => ({
    id: row.id,
    username: row.id,
    displayName: row.id,
    initials: row.id.slice(0, 2),
    bio: '',
    city: '',
    country: '',
    primarySport: 'Football',
    sports: ['Football'],
    skillLevel: 'Beginner',
    isOnline: false,
    badges: [],
    stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
  })
}));

interface QueryBuilder {
  select: jest.Mock;
  gte: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  or: jest.Mock;
  in: jest.Mock;
  limit: jest.Mock;
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
}

const queries: QueryBuilder[] = [];
function makeQuery(getData: () => unknown[]): QueryBuilder {
  const query: QueryBuilder = {
    select: jest.fn(),
    gte: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    or: jest.fn(),
    in: jest.fn(),
    limit: jest.fn(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: getData(), error: null }).then(resolve)
  };
  query.select.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  queries.push(query);
  return query;
}

let eventsData: unknown[] = [];
let attendeesData: unknown[] = [];
let bookingsData: unknown[] = [];
let commentsData: unknown[] = [];
let likesData: unknown[] = [];
let notificationsData: unknown[] = [];

mockFrom.mockImplementation((table: string) => {
  switch (table) {
    case 'sport_events': return makeQuery(() => eventsData);
    case 'event_attendees': return makeQuery(() => attendeesData);
    case 'court_bookings': return makeQuery(() => bookingsData);
    case 'post_comments': return makeQuery(() => commentsData);
    case 'likes': return makeQuery(() => likesData);
    case 'notifications': return makeQuery(() => notificationsData);
    default: return makeQuery(() => []);
  }
});

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const eventRow = (index: number) => ({
  id: uuid(index),
  title: `Event ${index}`,
  event_type: 'Pickup Game',
  sport: index % 2 ? 'Football' : 'Basketball',
  status: 'scheduled',
  visibility: 'public',
  description: `description ${index}`,
  cover_url: null,
  starts_at: new Date(Date.UTC(2026, 7, 10, 9, index)).toISOString(),
  ends_at: new Date(Date.UTC(2026, 7, 10, 10, index)).toISOString(),
  location_name: `Field ${index}`,
  city: 'Mumbai',
  latitude: 19.07,
  longitude: 72.87,
  max_players: 10,
  entry_fee_cents: 0,
  currency: 'INR',
  organizer_id: 'organizer',
  profiles: { id: 'organizer' }
});

const bookingRow = (index: number) => ({
  id: uuid(index),
  court_id: `court-${index % 3}`,
  user_id: 'me',
  starts_at: new Date(Date.UTC(2026, 8, 1, 9, index)).toISOString(),
  ends_at: new Date(Date.UTC(2026, 8, 1, 10, index)).toISOString(),
  status: 'confirmed',
  created_at: new Date(Date.UTC(2026, 7, 20)).toISOString(),
  updated_at: new Date(Date.UTC(2026, 7, 20)).toISOString(),
  cancelled_at: null,
  cancelled_by: null,
  cancellation_reason: null,
  price_cents: 5000,
  currency: 'INR',
  courts: {
    id: `court-${index % 3}`,
    name: `Court ${index % 3}`,
    sport: 'Basketball',
    city: 'Mumbai',
    hourly_price_cents: 5000,
    currency: 'INR',
    booking_window_days: 30,
    cancellation_notice_hours: 6,
    slot_duration_minutes: 60,
    booking_requires_approval: false,
    payment_policy: 'external'
  },
  profiles: { id: 'me' }
});

const commentRow = (index: number) => ({
  id: uuid(index),
  post_id: 'post-1',
  parent_id: null,
  author_id: `author-${index % 5}`,
  body: `comment ${index}`,
  created_at: new Date(Date.UTC(2026, 6, 1, 12, 0, index)).toISOString(),
  profiles: { id: `author-${index % 5}` }
});

const notificationKinds = [
  'event', 'invite', 'like', 'follow', 'mention', 'comment',
  'achievement', 'stat_verified'
] as const;

const notificationRow = (index: number) => ({
  id: uuid(index),
  kind: notificationKinds[index % notificationKinds.length],
  title: `Notification ${index}`,
  body: `body ${index}`,
  actor: {
    id: 'actor-1',
    display_name: 'Actor',
    username: 'actor1',
    avatar_url: null,
    primary_sport: 'Football',
    city: 'Mumbai',
    country: 'India',
    sports: ['Football'],
    skill_level: 'Intermediate',
    is_verified: false,
    is_hireable: false
  },
  is_read: false,
  read_at: null,
  created_at: new Date(Date.UTC(2026, 7, 1, 12, 0, index)).toISOString(),
  last_event_at: new Date(Date.UTC(2026, 7, 1, 12, 0, index)).toISOString(),
  entity_id: `entity-${index}`,
  entity_type: 'event',
  data: null
});

describe('event cursor pagination beyond the 40-event page cap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eventsData = [];
    attendeesData = [];
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'sport_events': return makeQuery(() => eventsData);
        case 'event_attendees': return makeQuery(() => attendeesData);
        default: return makeQuery(() => []);
      }
    });
  });

  it('walks 125 events in stable pages without gaps or duplicates', async () => {
    const all = Array.from({ length: 125 }, (_, index) => eventRow(index));
    let cursor: EventListCursor | undefined;
    let total = 0;
    let page = 0;
    while (true) {
      eventsData = all.slice(total, total + EVENT_LIST_PAGE_SIZE + 1);
      const result = await eventService.listEventsPage(cursor);
      total += result.events.length;
      page += 1;
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(page).toBe(Math.ceil(125 / EVENT_LIST_PAGE_SIZE));
    expect(total).toBe(125);
    expect(queries.every((query) => query.limit.mock.calls.every(
      (call) => call[0] === EVENT_LIST_PAGE_SIZE + 1
    ))).toBe(true);
  });

  it('returns the sentinel-dropped page and a cursor based on the last row', async () => {
    eventsData = Array.from({ length: EVENT_LIST_PAGE_SIZE + 1 }, (_, index) => eventRow(index));
    attendeesData = [
      { event_id: uuid(0) },
      { event_id: uuid(0) },
      { event_id: uuid(0) }
    ];

    const page = await eventService.listEventsPage();

    expect(page.events).toHaveLength(EVENT_LIST_PAGE_SIZE);
    expect(page.events[0].playerCount).toBe(3);
    expect(page.nextCursor).toEqual({
      startsAt: eventRow(EVENT_LIST_PAGE_SIZE - 1).starts_at,
      id: uuid(EVENT_LIST_PAGE_SIZE - 1)
    });
  });

  it('uses the (starts_at, id) tiebreak cursor for equal timestamps', async () => {
    const sameTimestamp = '2026-07-10T09:00:00.000Z';
    eventsData = Array.from({ length: EVENT_LIST_PAGE_SIZE + 1 }, (_, index) => ({
      ...eventRow(index),
      starts_at: sameTimestamp
    }));
    attendeesData = [];

    const first = await eventService.listEventsPage();
    expect(first.nextCursor).toEqual({ startsAt: sameTimestamp, id: uuid(EVENT_LIST_PAGE_SIZE - 1) });

    queries.length = 0;
    eventsData = Array.from({ length: 5 }, (_, index) => ({
      ...eventRow(EVENT_LIST_PAGE_SIZE + index),
      starts_at: sameTimestamp
    }));

    await eventService.listEventsPage(first.nextCursor ?? undefined);

    const orQuery = queries.find((query) => query.or.mock.calls.length > 0);
    expect(orQuery?.or).toHaveBeenCalledWith(
      `starts_at.gt.${sameTimestamp},and(starts_at.eq.${sameTimestamp},id.gt.${uuid(EVENT_LIST_PAGE_SIZE - 1)})`
    );
  });
});

describe('court booking cursor pagination beyond the 100-booking cap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bookingsData = [];
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'court_bookings': return makeQuery(() => bookingsData);
        default: return makeQuery(() => []);
      }
    });
  });

  it('walks 220 of my bookings in stable pages without gaps or duplicates', async () => {
    const all = Array.from({ length: 220 }, (_, index) => bookingRow(index));
    let cursor: CourtBookingCursor | undefined;
    let collected: { id: string }[] = [];
    let page = 0;
    while (true) {
      bookingsData = all.slice(collected.length, collected.length + 101);
      const result = await courtService.listMyBookings(cursor);
      collected.push(...result.bookings);
      page += 1;
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(page).toBe(3);
    expect(collected).toHaveLength(220);
    expect(new Set(collected.map((booking) => booking.id)).size).toBe(220);
    expect(collected[0].id).toBe(uuid(0));
    expect(collected[219].id).toBe(uuid(219));
    expect(mockGetUser).toHaveBeenCalled();
    const bookingsQueries = queries.filter((query) =>
      query.eq.mock.calls.some((call) => call[0] === 'user_id')
    );
    expect(bookingsQueries[0].eq).toHaveBeenCalledWith('user_id', 'me');
    expect(bookingsQueries.some((query) => query.or.mock.calls.length > 0)).toBe(true);
  });

  it('walks 205 admin bookings for a specific court with the cursor filter', async () => {
    const all = Array.from({ length: 205 }, (_, index) => bookingRow(index));
    let cursor: CourtBookingCursor | undefined;
    let total = 0;
    while (true) {
      bookingsData = all.slice(total, total + 101);
      const result = await courtService.listAdminCourtBookings('court-1', cursor);
      total += result.bookings.length;
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(total).toBe(205);
    const adminQueries = queries.filter((query) =>
      query.eq.mock.calls.some((call) => call[0] === 'court_id')
    );
    expect(adminQueries.length).toBeGreaterThan(1);
    for (const query of adminQueries) {
      expect(query.eq).toHaveBeenCalledWith('court_id', 'court-1');
      expect(query.limit).toHaveBeenCalledWith(101);
    }
    expect(adminQueries.some((query) => query.or.mock.calls.length > 0)).toBe(true);
  });
});

describe('comment cursor pagination for large threads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    commentsData = [];
    likesData = [];
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'post_comments': return makeQuery(() => commentsData);
        case 'likes': return makeQuery(() => likesData);
        default: return makeQuery(() => []);
      }
    });
  });

  it('walks a 250-comment thread in stable pages without gaps or duplicates', async () => {
    const all = Array.from({ length: 250 }, (_, index) => commentRow(index));
    let cursor: { createdAt: string; id: string } | undefined;
    let collected: string[] = [];
    let page = 0;
    while (true) {
      commentsData = all.slice(collected.length, collected.length + 51);
      const result = await postService.listComments('post-1', cursor);
      collected.push(...result.comments.map((comment) => comment.id));
      page += 1;
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(page).toBe(5);
    expect(collected).toHaveLength(250);
    expect(new Set(collected).size).toBe(250);
    expect(collected[0]).toBe(uuid(0));
    expect(collected[249]).toBe(uuid(249));
    expect(queries.some((query) => query.or.mock.calls.length > 0)).toBe(true);
  });

  it('applies the created_at/id tiebreak cursor and loads engagement per page', async () => {
    commentsData = Array.from({ length: 51 }, (_, index) => commentRow(index));
    likesData = [{ entity_id: uuid(0), user_id: 'me' }, { entity_id: uuid(0), user_id: 'other' }];

    const page = await postService.listComments('post-1');

    expect(page.comments).toHaveLength(50);
    expect(page.comments[0].likes).toBe(2);
    expect(page.comments[0].likedByMe).toBe(true);
    expect(page.nextCursor).toEqual({
      createdAt: commentRow(49).created_at,
      id: uuid(49)
    });

    queries.length = 0;
    commentsData = Array.from({ length: 2 }, (_, index) => commentRow(50 + index));
    likesData = [];
    await postService.listComments('post-1', page.nextCursor ?? undefined);

    const commentQuery = queries.find((query) => query.or.mock.calls.length > 0);
    expect(commentQuery?.or).toHaveBeenCalledWith(
      `created_at.gt.${commentRow(49).created_at},and(created_at.eq.${commentRow(49).created_at},id.gt.${uuid(49)})`
    );
    const likesQuery = queries.find((query) =>
      query.eq.mock.calls.some((call) => call[0] === 'entity_type')
    );
    expect(likesQuery?.eq).toHaveBeenCalledWith('entity_type', 'comment');
    expect(likesQuery?.in).toHaveBeenCalledWith('entity_id', [uuid(50), uuid(51)]);
  });
});

describe('notification category filters applied server-side before the cursor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationsData = [];
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null });
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'notifications': return makeQuery(() => notificationsData);
        default: return makeQuery(() => []);
      }
    });
  });

  it('walks 95 notifications and applies the category filter on every later page', async () => {
    const all = Array.from({ length: 95 }, (_, index) => notificationRow(index));
    let cursor: NotificationCursor | undefined;
    let total = 0;
    let page = 0;
    while (true) {
      notificationsData = all.slice(total, total + 41);
      const result = await notificationService.listNotificationsPage('Events', cursor);
      total += result.notifications.length;
      page += 1;
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }

    expect(page).toBe(3);
    expect(total).toBe(95);

    const filteredQueries = queries.filter((query) => query.in.mock.calls.length > 0);
    expect(filteredQueries).toHaveLength(3);
    for (const query of filteredQueries) {
      expect(query.in).toHaveBeenCalledWith('kind', ['event', 'invite']);
    }

    const laterPageQuery = queries.find((query) =>
      query.in.mock.calls.length > 0 && query.or.mock.calls.length > 0
    );
    expect(laterPageQuery).toBeDefined();
    expect(laterPageQuery?.in.mock.invocationCallOrder[0])
      .toBeLessThan(laterPageQuery!.or.mock.invocationCallOrder[0]);
  });

  it('builds the triple (last_event_at, created_at, id) cursor from the last row', async () => {
    notificationsData = Array.from({ length: 41 }, (_, index) => notificationRow(index));

    const page = await notificationService.listNotificationsPage('Events');

    expect(page.notifications).toHaveLength(40);
    expect(page.nextCursor).toEqual({
      lastEventAt: notificationRow(39).last_event_at,
      createdAt: notificationRow(39).created_at,
      id: uuid(39)
    });

    queries.length = 0;
    notificationsData = [notificationRow(40)];
    await notificationService.listNotificationsPage('Events', page.nextCursor ?? undefined);

    const laterQuery = queries[queries.length - 1];
    expect(laterQuery.or).toHaveBeenCalledWith(
      `last_event_at.lt.${notificationRow(39).last_event_at},and(last_event_at.eq.${notificationRow(39).last_event_at},created_at.lt.${notificationRow(39).created_at}),and(last_event_at.eq.${notificationRow(39).last_event_at},created_at.eq.${notificationRow(39).created_at},id.lt.${uuid(39)})`
    );
  });

  it('does not apply a kind filter for the All category', async () => {
    notificationsData = Array.from({ length: 41 }, (_, index) => notificationRow(index));

    const page = await notificationService.listNotificationsPage('All');

    expect(page.notifications).toHaveLength(40);
    const allQuery = queries[queries.length - 1];
    expect(allQuery.in).not.toHaveBeenCalled();
  });

  it('never surfaces non-matching kinds from a later page', async () => {
    const pageOne = Array.from({ length: 41 }, (_, index) => ({
      ...notificationRow(index),
      kind: index % 2 ? 'invite' : 'event'
    }));
    const laterOnly = [
      { ...notificationRow(50), kind: 'event' },
      { ...notificationRow(51), kind: 'invite' },
      { ...notificationRow(52), kind: 'event' }
    ];
    notificationsData = pageOne;

    const first = await notificationService.listNotificationsPage('Events');
    notificationsData = laterOnly;
    const second = await notificationService.listNotificationsPage('Events', first.nextCursor ?? undefined);

    const allNotifications = [...first.notifications, ...second.notifications];
    expect(allNotifications.every((notification) =>
      notification.kind === 'event' || notification.kind === 'invite'
    )).toBe(true);
    expect(second.nextCursor).toBeNull();
  });
});
