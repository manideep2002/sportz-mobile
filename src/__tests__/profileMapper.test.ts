import { initialsForName, mapProfileRow } from '@/services/profileMapper';

describe('initialsForName', () => {
  it('derives two-letter initials from a full name', () => {
    expect(initialsForName('Marcus King')).toBe('MK');
  });

  it('takes the first two parts only', () => {
    expect(initialsForName('Arjun Dev Sharma')).toBe('AD');
  });

  it('uppercases the result', () => {
    expect(initialsForName('priya nair')).toBe('PN');
  });

  it('handles a single name', () => {
    expect(initialsForName('Nike')).toBe('N');
  });

  it('falls back to a single initial for the fallback word "Athlete"', () => {
    // "Athlete" is a single word, so only one initial is available.
    expect(initialsForName('')).toBe('A');
    expect(initialsForName(null)).toBe('A');
    expect(initialsForName(undefined)).toBe('A');
  });
});

describe('mapProfileRow', () => {
  it('maps a well-formed DB row to a UserProfile', () => {
    const row = {
      id: 'user-1',
      username: 'marcusk',
      display_name: 'Marcus King',
      avatar_url: 'https://example.com/avatar.jpg',
      cover_url: null,
      bio: 'Baller',
      city: 'Bengaluru',
      country: 'IN',
      primary_sport: 'Basketball',
      sports: ['Basketball', 'Football'],
      position: 'SG',
      skill_level: 'Advanced',
      is_verified: true,
      is_hireable: false,
      is_admin: true
    };

    const profile = mapProfileRow(row, { followers: 120, following: 45, posts: 30 });

    expect(profile.id).toBe('user-1');
    expect(profile.username).toBe('marcusk');
    expect(profile.displayName).toBe('Marcus King');
    expect(profile.initials).toBe('MK');
    expect(profile.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(profile.bio).toBe('Baller');
    expect(profile.city).toBe('Bengaluru');
    expect(profile.primarySport).toBe('Basketball');
    expect(profile.sports).toEqual(['Basketball', 'Football']);
    expect(profile.skillLevel).toBe('Advanced');
    expect(profile.isVerified).toBe(true);
    expect(profile.isHireable).toBe(false);
    expect(profile.isAdmin).toBe(true);
    expect(profile.stats.followers).toBe(120);
    expect(profile.stats.following).toBe(45);
    expect(profile.stats.posts).toBe(30);
  });

  it('applies safe defaults for missing fields', () => {
    const profile = mapProfileRow(null);

    expect(profile.id).toBe('');
    expect(profile.username).toBe('athlete');
    expect(profile.displayName).toBe('Athlete');
    // "Athlete" is a single word, so only one initial is available
    expect(profile.initials).toBe('A');
    expect(profile.country).toBe('IN');
    expect(profile.primarySport).toBe('Basketball');
    expect(profile.sports).toEqual(['Basketball']);
    expect(profile.skillLevel).toBe('Intermediate');
    expect(profile.isVerified).toBe(false);
    expect(profile.isHireable).toBe(false);
    expect(profile.stats.followers).toBe(0);
  });

  it('uses primary_sport as the sole sport when sports array is empty', () => {
    const profile = mapProfileRow({ primary_sport: 'Cricket', sports: [] });
    expect(profile.sports).toEqual(['Cricket']);
  });

  it('merges provided counts onto empty stat defaults', () => {
    const profile = mapProfileRow({}, { followers: 999 });
    expect(profile.stats.followers).toBe(999);
    expect(profile.stats.following).toBe(0);
  });
});
