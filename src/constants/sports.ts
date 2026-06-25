import type { Sport } from '@/types/domain';

export const sportsFilters = [
  'All',
  'Basketball',
  'Football',
  'Cricket',
  'Badminton',
  'Tennis',
  'Volleyball',
  'Table Tennis',
  'Kabaddi'
] as const;

export const postSports: Sport[] = sportsFilters.filter((sport) => sport !== 'All');
