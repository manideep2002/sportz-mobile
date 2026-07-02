import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import { mapProfileRow } from '@/services/profileMapper';
import type { UserProfile } from '@/types/domain';

export type ReportEntityType = 'user' | 'post' | 'comment' | 'event' | 'community';
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

export const reportReasons = [
  'Spam',
  'Harassment',
  'Inappropriate content',
  'Fake profile',
  'Other'
] as const;

export const reportService = {
  async reportEntity(entityType: ReportEntityType, entityId: string, reason: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to report content.');

    const { error } = await supabase.from('reports').insert({
      reporter_id: authData.user.id,
      entity_type: entityType,
      entity_id: entityId,
      reason
    });
    if (error) throw error;
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
      reporter: mapProfileRow((row as { reporter?: Record<string, any> | null }).reporter),
      entityType: row.entity_type as ReportEntityType,
      entityId: row.entity_id as string,
      reason: row.reason as string,
      status: row.status as ReportStatus,
      resolution: row.resolution as string | null,
      createdAt: row.created_at as string,
      reviewedAt: row.reviewed_at as string | null
    }));
  },

  async updateReportStatus(reportId: string, status: ReportStatus, resolution?: string): Promise<void> {
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
