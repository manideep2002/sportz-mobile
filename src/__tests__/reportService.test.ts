/**
 * reportService unit tests — MF-02
 *
 * Covers: submit, duplicate detection (pre-check + 23505 race), offline,
 * unauthenticated, network error, listReports filter, updateReportStatus,
 * and all new entity types (comment, event, group, page).
 */

// ─── NetInfo mock ──────────────────────────────────────────────────────────
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn()
}));

// ─── supabaseOnly mock ─────────────────────────────────────────────────────
jest.mock('@/lib/supabaseOnly', () => ({
  assertSupabaseConfigured: jest.fn()
}));

// ─── supabase mock ────────────────────────────────────────────────────────
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
    from: jest.fn()
  }
}));

// ─── imports after mocks ──────────────────────────────────────────────────
// eslint-disable-next-line import/first
import { reportService, reportReasons } from '@/services/reportService';
// eslint-disable-next-line import/first
import type { ReportEntityType } from '@/services/reportService';

// ─── helpers ──────────────────────────────────────────────────────────────
const authedUser = { data: { user: { id: 'user-1' } }, error: null };
const unauthed = { data: { user: null }, error: null };
const authErr = { data: { user: null }, error: new Error('auth failure') };

type FromMock = { from: jest.Mock };
function getFrom() {
  return (require('@/lib/supabase') as { supabase: FromMock }).supabase.from;
}

/** Build a full from() mock for the reportEntity flow. */
function mockFromForReport(
  checkCount: number,
  checkError: unknown,
  insertError: unknown
) {
  getFrom().mockImplementation(() => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: checkCount, error: checkError })
          })
        })
      })
    }),
    insert: jest.fn().mockResolvedValue({ error: insertError })
  }));
}

// ─── reportEntity tests ───────────────────────────────────────────────────

describe('reportService.reportEntity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns "submitted" for every supported entity type', async () => {
    mockGetUser.mockResolvedValue(authedUser);
    const entityTypes: ReportEntityType[] = [
      'post', 'comment', 'event', 'group', 'page', 'user', 'community', 'team_offer'
    ];
    for (const entityType of entityTypes) {
      mockFromForReport(0, null, null);
      const result = await reportService.reportEntity(entityType, 'entity-1', 'Spam');
      expect(result).toBe('submitted');
    }
  });

  it('returns "duplicate" when an open report already exists (pre-check)', async () => {
    mockGetUser.mockResolvedValue(authedUser);
    mockFromForReport(1, null, null);
    const result = await reportService.reportEntity('comment', 'cmt-1', 'Harassment');
    expect(result).toBe('duplicate');
  });

  it('returns "duplicate" on a 23505 unique violation from insert (race condition)', async () => {
    mockGetUser.mockResolvedValue(authedUser);
    mockFromForReport(0, null, { code: '23505', message: 'duplicate key' });
    const result = await reportService.reportEntity('event', 'evt-1', 'Spam');
    expect(result).toBe('duplicate');
  });

  it('throws on non-unique DB insert errors', async () => {
    mockGetUser.mockResolvedValue(authedUser);
    mockFromForReport(0, null, { code: '42501', message: 'permission denied' });
    await expect(
      reportService.reportEntity('group', 'grp-1', 'Other')
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('throws when the user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(unauthed);
    await expect(
      reportService.reportEntity('page', 'pg-1', 'Spam')
    ).rejects.toThrow('You must be signed in');
  });

  it('throws when auth.getUser itself fails', async () => {
    mockGetUser.mockResolvedValue(authErr);
    await expect(
      reportService.reportEntity('post', 'p-1', 'Spam')
    ).rejects.toThrow('auth failure');
  });

  it('throws on select-check network error', async () => {
    mockGetUser.mockResolvedValue(authedUser);
    mockFromForReport(0, new Error('network'), null);
    await expect(
      reportService.reportEntity('comment', 'c-1', 'Other')
    ).rejects.toThrow('network');
  });
});

// ─── reportReasons ────────────────────────────────────────────────────────

describe('reportService.reportReasons', () => {
  it('exports the canonical set of report reasons', () => {
    expect(reportReasons).toEqual([
      'Spam',
      'Harassment',
      'Inappropriate content',
      'Fake profile',
      'Other'
    ]);
  });
});

// ─── listReports ──────────────────────────────────────────────────────────

const sampleRow = {
  id: 'rpt-1',
  reporter: {
    id: 'user-1', username: 'asha', display_name: 'Asha', initials: 'AS',
    avatar_url: null, bio: '', city: '', country: '',
    primary_sport: 'Basketball', sports: ['Basketball'],
    skill_level: 'Intermediate', is_online: false, is_verified: false,
    badges: [], stats: null
  },
  entity_type: 'group',
  entity_id: 'grp-1',
  reason: 'Spam',
  status: 'open',
  resolution: null,
  created_at: '2026-07-28T10:00:00Z',
  reviewed_at: null
};

describe('reportService.listReports', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mapped reports for status="open"', async () => {
    getFrom().mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [sampleRow], error: null })
          })
        })
      })
    }));
    const reports = await reportService.listReports('open');
    expect(reports).toHaveLength(1);
    expect(reports[0].entityType).toBe('group');
    expect(reports[0].entityId).toBe('grp-1');
    expect(reports[0].status).toBe('open');
  });

  it('returns all reports when status="all"', async () => {
    getFrom().mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [sampleRow, { ...sampleRow, id: 'rpt-2', entity_type: 'page' }],
            error: null
          })
        })
      })
    }));
    const reports = await reportService.listReports('all');
    expect(reports).toHaveLength(2);
    expect(reports[1].entityType).toBe('page');
  });

  it('throws on DB error', async () => {
    getFrom().mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            // supports both direct resolve (status=all) and .eq chain (status=open)
            eq: jest.fn().mockResolvedValue({ data: null, error: new Error('db error') }),
            then: (_cb: (v: unknown) => unknown) =>
              Promise.resolve({ data: null, error: new Error('db error') }).then(_cb)
          })
        })
      })
    }));
    await expect(reportService.listReports()).rejects.toThrow('db error');
  });
});

// ─── updateReportStatus ───────────────────────────────────────────────────

describe('reportService.updateReportStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates status and reviewer fields', async () => {
    mockGetUser.mockResolvedValue(authedUser);
    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null })
    });
    getFrom().mockImplementation(() => ({ update: updateMock }));
    await reportService.updateReportStatus('rpt-1', 'reviewed', 'Confirmed violation');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'reviewed',
        resolution: 'Confirmed violation',
        reviewed_by: 'user-1'
      })
    );
  });

  it('throws when not authenticated', async () => {
    mockGetUser.mockResolvedValue(unauthed);
    await expect(
      reportService.updateReportStatus('rpt-1', 'dismissed')
    ).rejects.toThrow('You must be signed in');
  });
});
