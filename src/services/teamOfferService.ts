import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type {
  CompensationPeriod,
  Team,
  TeamManagerRole,
  TeamOffer,
  TeamOfferHistoryEntry,
  TeamOfferStatus
} from '@/types/domain';

type Relation<T> = T | T[] | null | undefined;

interface TeamRow {
  id: string;
  community_id?: string | null;
  name: string;
  sport: string;
  city?: string | null;
  created_by?: string | null;
}

interface OfferRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  team_id: string;
  sport: string;
  position: string;
  terms: string;
  compensation_amount?: number | string | null;
  compensation_currency?: string | null;
  compensation_period?: CompensationPeriod | null;
  start_date?: string | null;
  end_date?: string | null;
  expires_at: string;
  status: TeamOfferStatus;
  sent_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  withdrawn_at?: string | null;
  expired_at?: string | null;
  created_at: string;
  updated_at: string;
  team?: Relation<TeamRow>;
  sender?: Relation<Record<string, unknown>>;
  recipient?: Relation<Record<string, unknown>>;
}

export interface CreateTeamOfferInput {
  recipientId: string;
  teamId: string;
  sport: string;
  position: string;
  terms: string;
  compensationAmount?: number | null;
  compensationCurrency?: string | null;
  compensationPeriod?: CompensationPeriod | null;
  startDate?: string | null;
  endDate?: string | null;
  expiresAt: string;
  sendNow?: boolean;
}

const first = <T>(relation: Relation<T>): T | undefined =>
  Array.isArray(relation) ? relation[0] : relation ?? undefined;

const mapTeam = (
  row: TeamRow,
  manager?: { role?: TeamManagerRole; can_send_offers?: boolean }
): Team => ({
  id: row.id,
  communityId: row.community_id ?? null,
  name: row.name,
  sport: row.sport,
  city: row.city ?? null,
  createdBy: row.created_by ?? null,
  managerRole: manager?.role,
  canSendOffers: manager?.can_send_offers
});

const fallbackTeam = (row: OfferRow): TeamRow => ({
  id: row.team_id,
  name: 'Team',
  sport: row.sport
});

export const mapTeamOfferRow = (row: OfferRow): TeamOffer => ({
  id: row.id,
  sender: mapProfileRow(first(row.sender) ?? { id: row.sender_id }),
  recipient: mapProfileRow(first(row.recipient) ?? { id: row.recipient_id }),
  team: mapTeam(first(row.team) ?? fallbackTeam(row)),
  sport: row.sport,
  position: row.position,
  terms: row.terms,
  compensationAmount:
    row.compensation_amount === null || row.compensation_amount === undefined
      ? null
      : Number(row.compensation_amount),
  compensationCurrency: row.compensation_currency ?? null,
  compensationPeriod: row.compensation_period ?? null,
  startDate: row.start_date ?? null,
  endDate: row.end_date ?? null,
  expiresAt: row.expires_at,
  status: row.status,
  sentAt: row.sent_at ?? null,
  acceptedAt: row.accepted_at ?? null,
  declinedAt: row.declined_at ?? null,
  withdrawnAt: row.withdrawn_at ?? null,
  expiredAt: row.expired_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const OFFER_SELECT = '*, team:team_id(*), sender:sender_id(*), recipient:recipient_id(*)';

const assertOfferInput = (input: CreateTeamOfferInput) => {
  if (!input.teamId) throw new Error('Choose a team.');
  if (!input.position.trim()) throw new Error('Enter a position or role.');
  if (!input.terms.trim()) throw new Error('Enter the offer terms.');
  if (!input.sport.trim()) throw new Error('Choose a sport.');
  if (new Date(input.expiresAt).getTime() <= Date.now()) {
    throw new Error('Offer expiry must be in the future.');
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new Error('End date cannot be before start date.');
  }
  if (input.compensationAmount != null && input.compensationAmount < 0) {
    throw new Error('Compensation cannot be negative.');
  }
};

export const OFFER_TRANSITIONS: Readonly<Record<TeamOfferStatus, readonly TeamOfferStatus[]>> = {
  draft: ['sent', 'withdrawn'],
  sent: ['accepted', 'declined', 'withdrawn', 'expired'],
  accepted: [],
  declined: [],
  withdrawn: [],
  expired: []
};

export const canTransitionOffer = (from: TeamOfferStatus, to: TeamOfferStatus) =>
  OFFER_TRANSITIONS[from].includes(to);

export const teamOfferService = {
  async listManagedTeams(): Promise<Team[]> {
    assertSupabaseConfigured();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return [];

    const { data, error } = await supabase
      .from('team_managers')
      .select('role, can_send_offers, team:team_id(*)')
      .eq('user_id', authData.user.id)
      .eq('can_send_offers', true);
    if (error) throw error;

    return (data ?? []).flatMap((raw) => {
      const row = raw as unknown as {
        role: TeamManagerRole;
        can_send_offers: boolean;
        team: Relation<TeamRow>;
      };
      const team = first(row.team);
      return team ? [mapTeam(team, row)] : [];
    });
  },

  async listOffers(direction: 'incoming' | 'outgoing'): Promise<TeamOffer[]> {
    assertSupabaseConfigured();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return [];

    let request = supabase
      .from('team_offers')
      .select(OFFER_SELECT)
      .order('created_at', { ascending: false });
    request = direction === 'incoming'
      ? request.eq('recipient_id', authData.user.id)
      : request.eq('sender_id', authData.user.id);

    const { data, error } = await request;
    if (error) throw error;
    return (data ?? []).map((row) => mapTeamOfferRow(row as unknown as OfferRow));
  },

  async getOffer(offerId: string): Promise<TeamOffer> {
    assertSupabaseConfigured();
    const { data, error } = await supabase
      .from('team_offers')
      .select(OFFER_SELECT)
      .eq('id', offerId)
      .single();
    if (error) throw error;
    return mapTeamOfferRow(data as unknown as OfferRow);
  },

  async listHistory(offerId: string): Promise<TeamOfferHistoryEntry[]> {
    assertSupabaseConfigured();
    const { data, error } = await supabase
      .from('team_offer_history')
      .select('*, actor:actor_id(*)')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((raw) => {
      const row = raw as {
        id: string;
        offer_id: string;
        actor?: Relation<Record<string, unknown>>;
        from_status?: TeamOfferStatus | null;
        to_status: TeamOfferStatus;
        event: string;
        created_at: string;
      };
      const actor = first(row.actor);
      return {
        id: row.id,
        offerId: row.offer_id,
        actor: actor ? mapProfileRow(actor) : undefined,
        fromStatus: row.from_status ?? null,
        toStatus: row.to_status,
        event: row.event,
        createdAt: row.created_at
      };
    });
  },

  async createOffer(input: CreateTeamOfferInput): Promise<TeamOffer> {
    assertSupabaseConfigured();
    assertOfferInput(input);
    const { data, error } = await supabase.rpc('create_team_offer', {
      target_recipient_id: input.recipientId,
      target_team_id: input.teamId,
      target_sport: input.sport,
      target_position: input.position.trim(),
      target_terms: input.terms.trim(),
      target_compensation_amount: input.compensationAmount ?? null,
      target_compensation_currency: input.compensationCurrency?.trim().toUpperCase() || null,
      target_compensation_period: input.compensationPeriod ?? null,
      target_start_date: input.startDate || null,
      target_end_date: input.endDate || null,
      target_expires_at: input.expiresAt,
      send_now: input.sendNow ?? true
    });
    if (error) throw error;
    return this.getOffer((data as unknown as OfferRow).id);
  },

  async sendOffer(offerId: string): Promise<TeamOffer> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('send_team_offer', { target_offer_id: offerId });
    if (error) throw error;
    return this.getOffer((data as unknown as OfferRow).id);
  },

  async respondToOffer(offerId: string, accept: boolean): Promise<TeamOffer> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('respond_team_offer', {
      target_offer_id: offerId,
      accept_offer: accept
    });
    if (error) throw error;
    return this.getOffer((data as unknown as OfferRow).id);
  },

  async withdrawOffer(offerId: string): Promise<TeamOffer> {
    assertSupabaseConfigured();
    const { data, error } = await supabase.rpc('withdraw_team_offer', {
      target_offer_id: offerId
    });
    if (error) throw error;
    return this.getOffer((data as unknown as OfferRow).id);
  }
};

