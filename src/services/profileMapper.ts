import type { ProfileStats, UserProfile } from '@/types/domain';

const emptyStats: ProfileStats = {
  followers: 0,
  following: 0,
  posts: 0,
  winRate: 0,
  games: 0
};

export const initialsForName = (name?: string | null) =>
  (name?.trim() || 'Athlete')
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function mapProfileRow(
  row: Record<string, any> | null | undefined,
  counts: Partial<ProfileStats> = {}
): UserProfile {
  const displayName = row?.display_name ?? 'Athlete';

  return {
    id: row?.id ?? '',
    username: row?.username ?? 'athlete',
    displayName,
    initials: initialsForName(displayName),
    avatarUrl: row?.avatar_url ?? null,
    coverUrl: row?.cover_url ?? null,
    bio: row?.bio ?? '',
    city: row?.city ?? '',
    country: row?.country ?? 'IN',
    primarySport: row?.primary_sport ?? 'Basketball',
    sports: Array.isArray(row?.sports) && row.sports.length ? row.sports : [row?.primary_sport ?? 'Basketball'],
    position: row?.position ?? undefined,
    skillLevel: row?.skill_level ?? 'Intermediate',
    isOnline: false,
    isVerified: Boolean(row?.is_verified),
    isHireable: Boolean(row?.is_hireable),
    badges: [],
    stats: {
      ...emptyStats,
      ...counts
    }
  };
}
