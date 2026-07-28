import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type { UserProfile } from '@/types/domain';

// All entity types that can be reported. 'group' and 'page' are community
// sub-types stored separately so moderators can distinguish them; the DB
// constraint also accepts 'community' for legacy rows.
export type ReportEntityType =
  | 'user'
  | 'post'
  | 'comment'
  | 'event'
  | 'community'
  | 'group'
  | 'page'
  | 'team_offer';

export type ReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export interface ModerationReport {
  id: string;
  reporter: UserProfile;
  entityType: ReportEntityType;
  entityId: string;
  reason: string;
  status: ReportStatus;
  resolution?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

/** Outcome returned by reportEntity so callers can distinguish success paths. */
export type ReportOutcome = 'submitted' | 'duplicate';

export const reportReasons = [
  'Spam',
  'Harassment',
  'Inappropriate content',
  'Fake profile',
  'Other'
] as const;

export type ReportReason = (typeof reportReasons)[number];

export const reportService = {
  /**
   * Submit a report for any supported entity type.
   *
   * Returns:
   *  - 'submitted'  — new report created.
   *  - 'duplicate'  — the current user already has an open report for this
   *                   entity; no new row is inserted.
   *
   * Throws on network/permission errors so callers can surface an error state.
   */
  async reportEntity(
    entityType: ReportEntityType,
    entityId: string,
    reason: string
  ): Promise<ReportOutcome> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to report content.');

    const reporterId = authData.user.id;

    // Check for existing open report before inserting (avoids a round-trip
    // error that would only surface as a DB constraint violation).
    const { count, error: checkError } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', reporterId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('status', 'open');

    if (checkError) throw checkError;
    if ((count ?? 0) > 0) return 'duplicate';

    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      entity_type: entityType,
      entity_id: entityId,
      reason,
      status: 'open'
    });

    // 23505 = unique_violation — treat as duplicate (race condition safety net)
    if (error) {
      if (error.code === '23505') return 'duplicate';
      throw error;
    }

    return 'submitted';
  },

  async listReports(status: ReportStatus | 'all' = 'open'): Promise<ModerationReport[]> {
    assertSupabaseConfigured();

    let request = supabase
      .from('reports')
      .select('*, reporter:reporter_id(*)')
      .order('created_at', { ascending: false })
      .limit(80);
    if (status !== 'all') request = request.eq('status', status);

    const { data, error } = await request;
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id as string,
      reporter: mapProfileRow((row as { reporter?: Record<string, unknown> | null }).reporter),
      entityType: row.entity_type as ReportEntityType,
      entityId: row.entity_id as string,
      reason: row.reason as string,
      status: row.status as ReportStatus,
      resolution: row.resolution as string | null,
      createdAt: row.created_at as string,
      reviewedAt: row.reviewed_at as string | null
    }));
  },

  async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    resolution?: string
  ): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to review reports.');

    const { error } = await supabase
      .from('reports')
      .update({
        status,
        resolution: resolution ?? null,
        reviewed_by: authData.user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', reportId);
    if (error) throw error;
  }
};
