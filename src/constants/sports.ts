import type { Sport } from '@/types/domain';

export const allSports: Sport[] = [
  'Cricket',
  'Football',
  'Kabaddi',
  'Badminton',
  'Hockey',
  'Athletics',
  'Running',
  'Basketball',
  'Volleyball',
  'Tennis',
  'Table Tennis',
  'Swimming',
  'Cycling'
];

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

export const postSports: Sport[] = allSports;
export const sportChipFilters = sportsFilters;
