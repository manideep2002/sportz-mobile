/**
 * moderationService unit tests — MF-03
 *
 * Covers: getReportDetail, getEntityPreview, getReporterProfile,
 * dismissReport, removeContent, restrictAccount, error mapping for
 * permission-denied, already-resolved, and generic errors.
 */

import { supabase } from '@/lib/supabase';
import { moderationService } from '@/services/moderationService';

let mockRpc: jest.Mock;

jest.mock('@/lib/supabaseOnly', () => ({ assertSupabaseConfigured: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn()
  }
}));

beforeAll(() => {
  mockRpc = supabase.rpc as jest.Mock;
});

// ─── helpers ──────────────────────────────────────────────────────────────
function rpcOk(data: unknown) {
  mockRpc.mockImplementation(() => Promise.resolve({ data, error: null }));
}

function rpcError(code: string, message: string) {
  mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: { code, message } }));
}

describe('moderationService.getReportDetail', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('returns parsed report detail with audit log', async () => {
    rpcOk({
      report: {
        id: 'rpt-1',
        reporter_id: 'user-rep',
        entity_type: 'comment',
        entity_id: 'cmt-1',
        reason: 'Harassment',
        status: 'open',
        resolution: null,
        created_at: '2026-07-28T10:00:00Z',
        reviewed_by: null,
        reviewed_at: null
      },
      auditLog: [
        {
          id: 'aud-1',
          report_id: 'rpt-1',
          moderator_id: 'mod-1',
          action: 'dismissed',
          reason: 'No violation found',
          created_at: '2026-07-28T11:00:00Z'
        }
      ]
    });

    const result = await moderationService.getReportDetail('rpt-1');
    expect(result.id).toBe('rpt-1');
    expect(result.entityType).toBe('comment');
    expect(result.auditLog).toHaveLength(1);
    expect(result.auditLog[0].action).toBe('dismissed');
    expect(mockRpc).toHaveBeenCalledWith('moderate_get_report_detail', { p_report_id: 'rpt-1' });
  });

  it('throws on rpc error', async () => {
    rpcError('P0001', 'Report not found.');
    await expect(moderationService.getReportDetail('bad-id')).rejects.toThrow('Report not found.');
  });
});

describe('moderationService.getEntityPreview', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('returns parsed entity preview for post type', async () => {
    rpcOk({
      id: 'post-1',
      author_id: 'user-1',
      body: 'Test content',
      media_url: null,
      media_kind: null,
      kind: 'post',
      visibility: 'public',
      removed_by_moderator: false,
      created_at: '2026-07-28T10:00:00Z'
    });

    const result = await moderationService.getEntityPreview('post', 'post-1');
    expect(result.id).toBe('post-1');
    expect(result.body).toBe('Test content');
    expect(result.removedByModerator).toBe(false);
  });

  it('returns empty object for unsupported types', async () => {
    rpcOk({});
    const result = await moderationService.getEntityPreview('event', 'evt-1');
    expect(result).toEqual({});
  });

  it('throws on rpc error', async () => {
    rpcError('42501', 'Only moderators can view entity previews.');
    await expect(
      moderationService.getEntityPreview('post', 'p-1')
    ).rejects.toThrow('Only moderators');
  });
});

describe('moderationService.getReporterProfile', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('returns parsed reporter profile', async () => {
    rpcOk({ id: 'user-r', username: 'asha', display_name: 'Asha', avatar_url: null });

    const result = await moderationService.getReporterProfile('user-r');
    expect(result.id).toBe('user-r');
    expect(result.displayName).toBe('Asha');
  });
});

describe('moderationService.dismissReport', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('returns empty error on success', async () => {
    const result = await moderationService.dismissReport('rpt-1', 'No violation');
    expect(result).toEqual({});
  });

  it('returns mapped permission error for 42501', async () => {
    rpcError('42501', 'Only moderators can dismiss reports.');
    const result = await moderationService.dismissReport('rpt-1', 'reason');
    expect(result.error).toContain('do not have permission');
  });

  it('returns mapped already-resolved error for 23514', async () => {
    rpcError('23514', 'Report is not open or does not exist.');
    const result = await moderationService.dismissReport('rpt-1', 'reason');
    expect(result.error).toContain('already been resolved');
  });

  it('returns raw message for unknown errors', async () => {
    rpcError('P0001', 'Database connection failed');
    const result = await moderationService.dismissReport('rpt-1', 'reason');
    expect(result.error).toBe('Database connection failed');
  });
});

describe('moderationService.removeContent', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('returns empty error on success', async () => {
    const result = await moderationService.removeContent('rpt-1', 'post', 'post-1', 'Rule violation');
    expect(result).toEqual({});
    expect(mockRpc).toHaveBeenCalledWith('moderate_remove_content', {
      p_report_id: 'rpt-1',
      p_entity_type: 'post',
      p_entity_id: 'post-1',
      p_reason: 'Rule violation'
    });
  });

  it('maps permission error', async () => {
    rpcError('42501', 'Only moderators can remove content.');
    const result = await moderationService.removeContent('rpt-1', 'comment', 'cmt-1', 'Spam');
    expect(result.error).toContain('do not have permission');
  });
});

describe('moderationService.restrictAccount', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('returns empty error on success', async () => {
    const result = await moderationService.restrictAccount('rpt-1', 'user-abc', 'Repeated violations');
    expect(result).toEqual({});
    expect(mockRpc).toHaveBeenCalledWith('moderate_restrict_account', {
      p_report_id: 'rpt-1',
      p_target_user_id: 'user-abc',
      p_reason: 'Repeated violations'
    });
  });

  it('maps already-resolved error', async () => {
    rpcError('23514', 'Report is not open or does not exist.');
    const result = await moderationService.restrictAccount('rpt-1', 'user-abc', 'reason');
    expect(result.error).toContain('already been resolved');
  });
});

describe('moderationService — error mapping edge cases', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('maps "only moderators" in message text', async () => {
    rpcError('P0001', 'Only moderators can do this.');
    const result = await moderationService.dismissReport('rpt-1', 'reason');
    expect(result.error).toContain('do not have permission');
  });

  it('maps "not open" in message text', async () => {
    rpcError('P0001', 'Report is not open anymore.');
    const result = await moderationService.dismissReport('rpt-1', 'reason');
    expect(result.error).toContain('already been resolved');
  });

  it('falls back to generic message when error has no code or message', async () => {
    mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: { code: '', message: '' } }));
    const result = await moderationService.dismissReport('rpt-1', 'reason');
    expect(result.error).toBe('Something went wrong. Please try again.');
  });
});