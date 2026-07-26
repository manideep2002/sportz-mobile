import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createEdgeObservability,
  edgeJsonResponse
} from '../_shared/observability.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const configuredSecret = Deno.env.get('OBSERVABILITY_HEALTH_SECRET');
const staleQueueSeconds = Number(Deno.env.get('OBSERVABILITY_STALE_QUEUE_SECONDS') ?? 300);
const repeatedFailureAttempts = Number(Deno.env.get('OBSERVABILITY_REPEATED_FAILURE_ATTEMPTS') ?? 3);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function resolveSecret(): Promise<string | null> {
  if (configuredSecret) return configuredSecret;
  const { data, error } = await supabase.rpc('get_edge_function_secret', {
    secret_name: 'observability_health_webhook'
  });
  if (error) throw error;
  return typeof data === 'string' ? data : null;
}

const ageSeconds = (value?: string | null) =>
  value ? Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000)) : 0;

Deno.serve(async (request) => {
  const observability = createEdgeObservability(request, 'observability-health');

  if (request.method !== 'POST') {
    return edgeJsonResponse(observability, { ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const secret = await resolveSecret();
    if (!secret || request.headers.get('x-supabase-webhook-secret') !== secret) {
      observability.log('warn', 'health.unauthorized');
      return edgeJsonResponse(observability, { ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const [feedResult, pushResult, mediaResult] = await Promise.all([
      supabase
        .from('feed_fanout_jobs')
        .select('id,status,attempts,created_at')
        .in('status', ['pending', 'processing', 'failed'])
        .order('created_at', { ascending: true })
        .limit(500),
      supabase
        .from('notifications')
        .select('id,push_attempts,created_at')
        .is('push_sent_at', null)
        .order('created_at', { ascending: true })
        .limit(500),
      supabase
        .from('post_media_assets')
        .select('id,status,created_at,updated_at')
        .in('status', ['processing', 'failed'])
        .order('created_at', { ascending: true })
        .limit(500)
    ]);

    const queryError = feedResult.error ?? pushResult.error ?? mediaResult.error;
    if (queryError) throw queryError;

    const feedRows = feedResult.data ?? [];
    const pushRows = pushResult.data ?? [];
    const mediaRows = mediaResult.data ?? [];
    const oldestQueueAgeSeconds = Math.max(
      ageSeconds(feedRows[0]?.created_at),
      ageSeconds(pushRows[0]?.created_at)
    );
    const repeatedDeliveryFailures =
      feedRows.filter((row) => (row.attempts ?? 0) >= repeatedFailureAttempts).length +
      pushRows.filter((row) => (row.push_attempts ?? 0) >= repeatedFailureAttempts).length;
    const mediaProcessingFailures = mediaRows.filter((row) => row.status === 'failed').length;
    const staleMedia = mediaRows.filter((row) =>
      row.status === 'processing' && ageSeconds(row.updated_at) >= staleQueueSeconds
    ).length;

    const metrics = {
      oldest_queue_age_seconds: oldestQueueAgeSeconds,
      repeated_delivery_failures: repeatedDeliveryFailures,
      media_processing_failures: mediaProcessingFailures,
      stale_media_processing: staleMedia,
      pending_feed_jobs: feedRows.filter((row) => row.status !== 'failed').length,
      pending_pushes: pushRows.length
    };

    if (oldestQueueAgeSeconds >= staleQueueSeconds) {
      observability.log('warn', 'health.stale_queue', metrics);
    }
    if (repeatedDeliveryFailures > 0) {
      observability.log('error', 'health.repeated_delivery_failure', metrics);
    }
    if (mediaProcessingFailures > 0 || staleMedia > 0) {
      observability.log('error', 'health.media_processing_failure', metrics);
    }
    observability.log('info', 'health.completed', metrics);

    return edgeJsonResponse(observability, {
      ok: repeatedDeliveryFailures === 0 && mediaProcessingFailures === 0 && staleMedia === 0,
      metrics
    });
  } catch (error) {
    observability.log('error', 'health.failed', {
      error: error instanceof Error ? error.message : 'Unknown health probe failure'
    });
    return edgeJsonResponse(observability, { ok: false, error: 'Health probe failed' }, { status: 500 });
  }
});
