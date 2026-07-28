import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';
import type { ReportEntityType, ReportStatus } from '@/services/reportService';

// ─── Types ─────────────────────────────────────────────────────────────────

export type EnforcementAction = 'dismissed' | 'removed_content' | 'restricted_account';

export interface AuditLogEntry {
  id: string;
  reportId: string;
  moderatorId: string;
  action: EnforcementAction;
  reason: string;
  createdAt: string;
}

export interface ReportDetail {
  id: string;
  reporterId: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: string;
  status: ReportStatus;
  resolution: string | null;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  auditLog: AuditLogEntry[];
}

export interface EntityPreview {
  id?: string;
  body?: string | null;
  authorId?: string;
  mediaUrl?: string | null;
  mediaKind?: string | null;
  kind?: string;
  visibility?: string;
  removedByModerator?: boolean;
  createdAt?: string;
  // user/profile fields
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  isRestricted?: boolean;
}

export interface ReporterProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

// ─── Service ───────────────────────────────────────────────────────────────

export const moderationService = {
  /**
   * Fetch full report detail with audit trail.
   */
  async getReportDetail(reportId: string): Promise<ReportDetail> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.rpc('moderate_get_report_detail', {
      p_report_id: reportId
    });
    if (error) throw new Error(error.message);

    const result = data as {
      report: Record<string, unknown>;
      auditLog: Record<string, unknown>[];
    };

    const r = result.report;
    return {
      id: r.id as string,
      reporterId: r.reporter_id as string,
      entityType: r.entity_type as ReportEntityType,
      entityId: r.entity_id as string,
      reason: r.reason as string,
      status: r.status as ReportStatus,
      resolution: (r.resolution as string | null) ?? null,
      createdAt: r.created_at as string,
      reviewedBy: (r.reviewed_by as string | null) ?? null,
      reviewedAt: (r.reviewed_at as string | null) ?? null,
      auditLog: (result.auditLog ?? []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        reportId: a.report_id as string,
        moderatorId: a.moderator_id as string,
        action: a.action as EnforcementAction,
        reason: a.reason as string,
        createdAt: a.created_at as string
      }))
    };
  },

  /**
   * Fetch a lightweight preview of the reported entity.
   */
  async getEntityPreview(
    entityType: ReportEntityType,
    entityId: string
  ): Promise<EntityPreview> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.rpc('moderate_get_entity_preview', {
      p_entity_type: entityType,
      p_entity_id: entityId
    });
    if (error) throw new Error(error.message);

    const raw = (data ?? {}) as Record<string, unknown>;

    return {
      id: raw.id as string | undefined,
      body: raw.body as string | null | undefined,
      authorId: raw.author_id as string | undefined,
      mediaUrl: raw.media_url as string | null | undefined,
      mediaKind: raw.media_kind as string | null | undefined,
      kind: raw.kind as string | undefined,
      visibility: raw.visibility as string | undefined,
      removedByModerator: raw.removed_by_moderator as boolean | undefined,
      createdAt: raw.created_at as string | undefined,
      username: raw.username as string | undefined,
      displayName: raw.display_name as string | undefined,
      avatarUrl: raw.avatar_url as string | null | undefined,
      isRestricted: raw.is_restricted as boolean | undefined
    };
  },

  /**
   * Fetch reporter profile info.
   */
  async getReporterProfile(reporterId: string): Promise<ReporterProfile> {
    assertSupabaseConfigured();

    const { data, error } = await supabase.rpc('moderate_get_reporter_profile', {
      p_reporter_id: reporterId
    });
    if (error) throw new Error(error.message);

    const raw = (data ?? {}) as Record<string, unknown>;
    return {
      id: raw.id as string,
      username: raw.username as string,
      displayName: raw.display_name as string,
      avatarUrl: (raw.avatar_url as string | null) ?? null
    };
  },

  /**
   * Dismiss a report without taking enforcement action.
   * Returns an error message string or null on success.
   */
  async dismissReport(
    reportId: string,
    reason: string
  ): Promise<{ error?: string }> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('moderate_dismiss_report', {
      p_report_id: reportId,
      p_reason: reason
    });

    if (error) {
      return { error: mapRpcError(error) };
    }
    return {};
  },

  /**
   * Remove reported content (post or comment).
   * Returns an error message string or null on success.
   */
  async removeContent(
    reportId: string,
    entityType: ReportEntityType,
    entityId: string,
    reason: string
  ): Promise<{ error?: string }> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('moderate_remove_content', {
      p_report_id: reportId,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_reason: reason
    });

    if (error) {
      return { error: mapRpcError(error) };
    }
    return {};
  },

  /**
   * Restrict (suspend) a user account.
   * Returns an error message string or null on success.
   */
  async restrictAccount(
    reportId: string,
    targetUserId: string,
    reason: string
  ): Promise<{ error?: string }> {
    assertSupabaseConfigured();

    const { error } = await supabase.rpc('moderate_restrict_account', {
      p_report_id: reportId,
      p_target_user_id: targetUserId,
      p_reason: reason
    });

    if (error) {
      return { error: mapRpcError(error) };
    }
    return {};
  }
};

// ─── Error mapping ─────────────────────────────────────────────────────────

function mapRpcError(error: { code?: string; message: string }): string {
  const code = error.code ?? '';
  const msg = error.message;

  if (code === '42501' || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('only moderators')) {
    return 'You do not have permission to perform this action.';
  }
  if (code === '23514' || msg.toLowerCase().includes('not open') || msg.toLowerCase().includes('does not exist')) {
    return 'This report has already been resolved or does not exist.';
  }
  return msg || 'Something went wrong. Please try again.';
}