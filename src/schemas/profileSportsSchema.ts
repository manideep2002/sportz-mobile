import { z } from 'zod';

import { allSports } from '@/constants/sports';
import type { Sport } from '@/types/domain';

export const isProfileSport = (value: unknown): value is Sport =>
  typeof value === 'string' && allSports.includes(value as Sport);

export const profileSportSchema = z.custom<Sport>(
  isProfileSport,
  { message: 'Select a valid sport.' }
);

export const selectedProfileSportsSchema = z
  .array(profileSportSchema)
  .min(1, 'Select at least one sport.')
  .max(allSports.length, 'Too many sports selected.')
  .superRefine((sports, context) => {
    if (new Set(sports).size !== sports.length) {
      context.addIssue({ code: 'custom', message: 'Each sport can only be selected once.' });
    }
  });

export interface ProfileSportsSelection {
  primarySport: Sport;
  sports: Sport[];
}

export function normalizeProfileSportsSelection(
  primarySport: Sport,
  selectedSports: readonly Sport[]
): ProfileSportsSelection {
  const parsedPrimary = profileSportSchema.parse(primarySport);
  const uniqueSports = Array.from(new Set([parsedPrimary, ...selectedSports]));
  const sports = selectedProfileSportsSchema.parse(uniqueSports);

  return { primarySport: parsedPrimary, sports };
}

export function toggleProfileSport(
  selection: ProfileSportsSelection,
  sport: Sport
): ProfileSportsSelection {
  profileSportSchema.parse(sport);

  if (sport === selection.primarySport) return selection;

  const sports = selection.sports.includes(sport)
    ? selection.sports.filter((selectedSport) => selectedSport !== sport)
    : [...selection.sports, sport];

  return normalizeProfileSportsSelection(selection.primarySport, sports);
}

export function changePrimaryProfileSport(
  selection: ProfileSportsSelection,
  primarySport: Sport
): ProfileSportsSelection {
  return normalizeProfileSportsSelection(primarySport, selection.sports);
}
