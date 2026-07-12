import type { EventType, EventVisibility } from '@/types/domain';

export type EventCreateVisibility = Extract<EventVisibility, 'public' | 'followers' | 'invite'>;

export const eventTypes: EventType[] = ['Pickup Game', 'Tournament', 'Training', 'Friendly'];

export const eventVisibilityOptions: {
  label: string;
  value: EventCreateVisibility;
  description: string;
}[] = [
  {
    label: 'Public',
    value: 'public',
    description: 'Anyone can find and join.'
  },
  {
    label: 'Followers',
    value: 'followers',
    description: 'Only your followers can find and join.'
  },
  {
    label: 'Invite-only',
    value: 'invite',
    description: 'Only you can manage this until invites are added.'
  }
];

export const eventVisibilityLabel = (visibility: EventVisibility) => {
  switch (visibility) {
    case 'followers':
      return 'Followers';
    case 'group':
      return 'Group';
    case 'invite':
      return 'Invite-only';
    case 'public':
    default:
      return 'Public';
  }
};

export const eventPaymentNotice = 'Payment is settled with the organizer outside SPORTZ.';
