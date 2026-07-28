import fs from 'fs';
import path from 'path';

import {
  aggregateSportStats,
  generatedAchievementKeys,
  validateSportStats
} from '@/services/athleteStatsService';

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260727000002_structured_athlete_stats.sql'),
  'utf8'
);
const integrityMigration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260727000003_structured_stats_integrity.sql'),
  'utf8'
);
const mutationGuardMigration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260727000004_structured_stats_mutation_guard.sql'),
  'utf8'
);
const verificationWorkflowMigration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260728000004_stat_verification_workflow.sql'),
  'utf8'
);

describe('sport-aware stat validation', () => {
  it('accepts each supported sport schema', () => {
    expect(validateSportStats('basketball', { points: 22, rebounds: 9, assists: 6 })).toEqual({
      points: 22,
      rebounds: 9,
      assists: 6
    });
    expect(validateSportStats('football', { goals: 2, assists: 1, minutes: 90 })).toEqual({
      goals: 2,
      assists: 1,
      minutes: 90
    });
    expect(validateSportStats('cricket', { runs: 74, wickets: 2, balls_faced: 61 })).toEqual({
      runs: 74,
      wickets: 2,
      balls_faced: 61
    });
  });

  it('rejects missing, invalid, and cross-sport fields', () => {
    expect(() => validateSportStats('basketball', { points: 10, rebounds: 4 }))
      .toThrow('Assists is required');
    expect(() => validateSportStats('football', { goals: 1.5, assists: 0, minutes: 90 }))
      .toThrow('Goals must be a whole number');
    expect(() => validateSportStats('cricket', {
      runs: 10,
      wickets: 1,
      balls_faced: 12,
      rebounds: 4
    })).toThrow('rebounds is not a valid Cricket statistic');
  });
});

describe('deterministic aggregation and achievements', () => {
  it('calculates sport-appropriate totals, averages, personal bests, and verification counts', () => {
    const summary = aggregateSportStats('basketball', [
      {
        outcome: 'win',
        verificationStatus: 'verified',
        stats: { points: 20, rebounds: 10, assists: 4 }
      },
      {
        outcome: 'loss',
        verificationStatus: 'self_reported',
        stats: { points: 30, rebounds: 6, assists: 8 }
      },
      {
        outcome: 'win',
        verificationStatus: 'rejected',
        stats: { points: 100, rebounds: 50, assists: 50 }
      }
    ]);
    expect(summary.matchCount).toBe(2);
    expect(summary.wins).toBe(1);
    expect(summary.winRate).toBe(50);
    expect(summary.verifiedMatchCount).toBe(1);
    expect(summary.metrics.find((metric) => metric.key === 'points')).toMatchObject({
      value: 25,
      personalBest: 30
    });
  });

  it('generates achievements from defined sport rules', () => {
    expect(generatedAchievementKeys('football', [
      { stats: { goals: 3, assists: 0, minutes: 90 } },
      { stats: { goals: 7, assists: 2, minutes: 90 } }
    ])).toEqual(['hat_trick', 'ten_goals']);
    expect(generatedAchievementKeys('cricket', [
      { stats: { runs: 101, wickets: 5, balls_faced: 90 } }
    ])).toEqual(['century', 'five_wickets']);
  });
});

describe('structured stats database authorization', () => {
  it('uses data-backed season labels and rejects cross-sport records', () => {
    expect(migration).toContain('create table if not exists public.athlete_seasons');
    expect(migration).toContain('label text not null');
    expect(migration).toContain('Stat definition does not belong to the match sport.');
    expect(migration).toContain('Missing required stats: %');
    expect(migration).toContain('Match date must fall within the selected season.');
  });

  it('prevents athletes editing another athlete and restricts verification', () => {
    expect(migration).toMatch(/auth\.uid\(\) = athlete_id/i);
    expect(migration).toContain("Only an admin or the athlete''s team manager can verify this record.");
    expect(migration).toMatch(/revoke insert on public\.athlete_matches/i);
    expect(migration).toContain('public.current_user_is_admin()');
    expect(migration).toContain('join public.team_managers');
    expect(mutationGuardMigration).toContain('grant update (value)');
    expect(mutationGuardMigration).toContain('A recorded stat cannot change its definition.');
  });

  it('derives aggregates and achievements from structured records', () => {
    expect(migration).toContain('create or replace view public.athlete_stat_aggregates');
    expect(migration).toContain('join public.athlete_match_stats');
    expect(migration).toContain('create or replace function public.recompute_athlete_achievements');
    expect(migration).not.toContain('stats_line');
  });

  it('recomputes profile summaries and achievements after edits and deletions', () => {
    expect(integrityMigration).toContain('public.refresh_athlete_profile_summary');
    expect(integrityMigration).toMatch(/after insert or update or delete on public\.athlete_matches/i);
    expect(integrityMigration).toContain('verification_status <>');
    expect(integrityMigration).toContain('delete from public.athlete_achievements');
    expect(integrityMigration).toContain('Season changes cannot invalidate existing matches.');
  });

  it('implements verification workflow with audit, notification, and verifier RPCs', () => {
    expect(verificationWorkflowMigration).toContain('evidence_url');
    expect(verificationWorkflowMigration).toContain('create table if not exists public.stat_verification_audit');
    expect(verificationWorkflowMigration).toContain('alter type public.sportz_notification_kind add value if not exists');
    expect(verificationWorkflowMigration).toContain('current_user_can_verify');
    expect(verificationWorkflowMigration).toContain('verify_athlete_match');
    expect(verificationWorkflowMigration).toContain('stat_verification_audit (match_id, verifier_id, previous_status, new_status, reason)');
    expect(verificationWorkflowMigration).toContain("insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)");
    expect(verificationWorkflowMigration).toContain('list_pending_verifications');
    expect(verificationWorkflowMigration).toContain('get_verification_detail');
    expect(verificationWorkflowMigration).toContain('jsonb_build_object');
    expect(verificationWorkflowMigration).toContain("'auditLog'");
  });

  it('authorizes verifiers in RPCs, not client-side role checks', () => {
    expect(verificationWorkflowMigration).toContain('security definer');
    expect(verificationWorkflowMigration).toContain("public.current_user_can_verify()");
    expect(verificationWorkflowMigration).toContain("raise exception using errcode = '42501'");
    expect(verificationWorkflowMigration).toContain('Only an admin or the athlete');
    const adminCheckCount = (verificationWorkflowMigration.match(/public\.current_user_is_admin\(\)/g) ?? []).length;
    expect(adminCheckCount).toBeGreaterThanOrEqual(1);
  });
});
