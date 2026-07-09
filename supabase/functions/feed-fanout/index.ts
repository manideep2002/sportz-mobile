import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type FeedFanoutJob = {
  id: string;
  post_id: string;
  author_id: string;
  post_created_at: string;
};

type FollowRow = {
  follower_id: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const jobLimit = Number(Deno.env.get('FEED_FANOUT_JOB_LIMIT') ?? 20);
const followerBatchSize = Number(Deno.env.get('FEED_FANOUT_FOLLOWER_BATCH_SIZE') ?? 1000);

const completeJob = async (jobId: string, error?: string) => {
  await supabase.rpc('complete_feed_fanout_job', {
    job_id: jobId,
    job_error: error ?? null
  });
};

const loadFollowers = async (authorId: string, offset: number) => {
  const from = offset;
  const to = offset + followerBatchSize - 1;
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', authorId)
    .order('follower_id', { ascending: true })
    .range(from, to);

  if (error) throw error;
  return (data ?? []) as FollowRow[];
};

const processJob = async (job: FeedFanoutJob) => {
  const { data: shouldPush, error: modeError } = await supabase.rpc('profile_uses_push_feed', {
    profile_id: job.author_id
  });
  if (modeError) throw modeError;
  if (!shouldPush) return 0;

  let offset = 0;
  let inserted = 0;

  while (true) {
    const followers = await loadFollowers(job.author_id, offset);
    if (!followers.length) break;

    const rows = followers.map((follower) => ({
      user_id: follower.follower_id,
      post_id: job.post_id,
      author_id: job.author_id,
      post_created_at: job.post_created_at,
      source: 'push'
    }));

    const { error } = await supabase
      .from('feed_items')
      .upsert(rows, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
    if (error) throw error;

    inserted += rows.length;
    if (followers.length < followerBatchSize) break;
    offset += followerBatchSize;
  }

  return inserted;
};

Deno.serve(async () => {
  const { data, error } = await supabase.rpc('claim_feed_fanout_jobs', {
    job_limit: jobLimit
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const jobs = (data ?? []) as FeedFanoutJob[];
  if (!jobs.length) {
    return Response.json({ ok: true, jobs: 0, inserted: 0, failed: 0 });
  }

  let inserted = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      inserted += await processJob(job);
      await completeJob(job.id);
    } catch (jobError) {
      failed += 1;
      await completeJob(job.id, jobError instanceof Error ? jobError.message : 'Feed fan-out failed.');
    }
  }

  return Response.json({
    ok: failed === 0,
    jobs: jobs.length,
    inserted,
    failed
  }, { status: failed ? 207 : 200 });
});
