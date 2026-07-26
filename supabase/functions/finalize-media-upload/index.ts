import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createEdgeObservability,
  edgeJsonResponse,
  type EdgeObservabilityContext
} from '../_shared/observability.ts';

type JsonRecord = Record<string, unknown>;

type StorageObjectRow = {
  id: string;
  bucket_id: string;
  name: string;
  metadata: JsonRecord | null;
  user_metadata?: JsonRecord | string | null;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// webhookSecret is read from private.edge_function_secrets at request time
// so that it can be rotated without redeployment, and doesn't require the
// secrets-set privilege on the Supabase project.
const envWebhookSecret = Deno.env.get('MEDIA_UPLOAD_WEBHOOK_SECRET') ??
  Deno.env.get('FINALIZE_MEDIA_UPLOAD_SECRET');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (auto-set by Supabase).');
}

const requiredSupabaseUrl = supabaseUrl;
const requiredServiceRoleKey = serviceRoleKey;

const supabase = createClient(requiredSupabaseUrl, requiredServiceRoleKey, {
  auth: { persistSession: false }
});

async function resolveWebhookSecret(): Promise<string | null> {
  if (envWebhookSecret) return envWebhookSecret;
  const { data, error } = await supabase.rpc('get_edge_function_secret', {
    secret_name: 'finalize_media_upload_webhook'
  });
  if (error) throw error;
  return typeof data === 'string' ? data : null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-webhook-secret'
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseJsonRecord(value: unknown): JsonRecord | null {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return null;
}

function objectRefFromPayload(payload: JsonRecord) {
  const record = parseJsonRecord(payload.record) ?? parseJsonRecord(payload.new) ?? payload;
  const bucketId = stringValue(record.bucket_id) ?? stringValue(record.bucketId) ?? stringValue(payload.bucketId);
  const objectName = stringValue(record.name) ?? stringValue(record.objectName) ?? stringValue(payload.objectName);

  return bucketId && objectName ? { bucketId, objectName } : null;
}

async function loadStorageObject(bucketId: string, objectName: string) {
  const { data, error } = await supabase
    .schema('storage')
    .from('objects')
    .select('id,bucket_id,name,metadata,user_metadata')
    .eq('bucket_id', bucketId)
    .eq('name', objectName)
    .maybeSingle();

  if (error) throw error;
  return data as StorageObjectRow | null;
}

function extractCustomMetadata(row: StorageObjectRow) {
  const metadata = parseJsonRecord(row.metadata) ?? {};
  const userMetadata = parseJsonRecord(row.user_metadata);
  const nestedMetadata = parseJsonRecord(metadata.metadata) ??
    parseJsonRecord(metadata.user_metadata) ??
    parseJsonRecord(metadata.userMetadata);

  return {
    ...metadata,
    ...(nestedMetadata ?? {}),
    ...(userMetadata ?? {})
  };
}

function encodedObjectPath(bucketId: string, objectName: string) {
  return [bucketId, ...objectName.split('/')].map(encodeURIComponent).join('/');
}

function renderUrl(bucketId: string, objectName: string) {
  const url = new URL(requiredSupabaseUrl);
  url.pathname = `/storage/v1/render/image/public/${encodedObjectPath(bucketId, objectName)}`;
  url.searchParams.set('width', '10');
  url.searchParams.set('height', '10');
  url.searchParams.set('resize', 'cover');
  url.searchParams.set('quality', '20');
  return url.toString();
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

async function generateTinyPlaceholder(
  bucketId: string,
  objectName: string,
  contentType: string | null,
  observability: EdgeObservabilityContext
) {
  if (!contentType?.startsWith('image/')) return null;

  const response = await fetch(renderUrl(bucketId, objectName), {
    headers: {
      authorization: `Bearer ${requiredServiceRoleKey}`,
      apikey: requiredServiceRoleKey
    }
  });

  if (!response.ok) {
    observability.log('warn', 'media.placeholder_failed', {
      bucket: bucketId,
      status: response.status
    });
    return null;
  }

  const transformedType = response.headers.get('content-type') ?? 'image/jpeg';
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > 8192) return null;

  return `data:${transformedType};base64,${arrayBufferToBase64(buffer)}`;
}

async function finalizeObject(
  bucketId: string,
  objectName: string,
  observability: EdgeObservabilityContext
) {
  if (bucketId !== 'post-media' || objectName.startsWith('__placeholders/')) {
    return { skipped: true, reason: 'not post media' };
  }

  const objectRow = await loadStorageObject(bucketId, objectName);
  if (!objectRow) {
    throw new Error(`Storage object not found: ${bucketId}/${objectName}`);
  }

  const customMetadata = extractCustomMetadata(objectRow);
  const contentType = stringValue(customMetadata.contentType) ??
    stringValue(customMetadata.mimetype) ??
    stringValue(customMetadata.mime_type) ??
    stringValue(objectRow.metadata?.mimetype);
  const postId = stringValue(customMetadata.postId) ?? stringValue(customMetadata.post_id);
  const ownerId = stringValue(customMetadata.ownerId) ?? stringValue(customMetadata.owner_id);
  const width = numericValue(customMetadata.width) ?? numericValue(customMetadata.mediaWidth);
  const height = numericValue(customMetadata.height) ?? numericValue(customMetadata.mediaHeight);
  const mediaKind = contentType?.startsWith('video/') ? 'video' : contentType?.startsWith('image/') ? 'image' : 'unknown';
  const { data: publicUrlData } = supabase.storage.from(bucketId).getPublicUrl(objectName);
  const mediaPlaceholder = await generateTinyPlaceholder(bucketId, objectName, contentType, observability);

  const assetPayload = {
    post_id: postId,
    owner_id: ownerId,
    bucket_id: bucketId,
    object_name: objectName,
    public_url: publicUrlData.publicUrl,
    content_type: contentType,
    media_kind: mediaKind,
    media_width: width,
    media_height: height,
    media_placeholder: mediaPlaceholder,
    status: 'ready',
    finalized_at: new Date().toISOString()
  };

  const { error: assetError } = await supabase
    .from('post_media_assets')
    .upsert(assetPayload, { onConflict: 'bucket_id,object_name' });
  if (assetError) throw assetError;

  if (postId) {
    const { error: postError } = await supabase
      .from('posts')
      .update({
        media_url: publicUrlData.publicUrl,
        media_storage_path: objectName,
        media_placeholder: mediaPlaceholder,
        media_width: width,
        media_height: height,
        media_processing_status: 'ready'
      })
      .eq('id', postId);
    if (postError) throw postError;
  }

  return {
    skipped: false,
    postId,
    bucketId,
    objectName,
    mediaKind,
    hasPlaceholder: Boolean(mediaPlaceholder),
    width,
    height
  };
}

Deno.serve(async (request) => {
  const observability = createEdgeObservability(request, 'finalize-media-upload');

  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'x-correlation-id': observability.correlationId
      }
    });
  }

  let webhookSecret: string | null;
  try {
    webhookSecret = await resolveWebhookSecret();
  } catch (error) {
    observability.log('error', 'webhook.secret_lookup_failed', {
      error: error instanceof Error ? error.message : 'Webhook secret lookup failed'
    });
    return edgeJsonResponse(observability, { ok: false, error: 'Server misconfiguration' }, {
      status: 500,
      headers: corsHeaders
    });
  }
  if (!webhookSecret) {
    observability.log('error', 'webhook.secret_missing');
    return edgeJsonResponse(observability, { ok: false, error: 'Server misconfiguration' }, {
      status: 500,
      headers: corsHeaders
    });
  }

  const suppliedSecret = request.headers.get('x-supabase-webhook-secret');
  if (suppliedSecret !== webhookSecret) {
    observability.log('warn', 'webhook.unauthorized');
    return edgeJsonResponse(observability, { ok: false, error: 'Unauthorized' }, {
      status: 401,
      headers: corsHeaders
    });
  }

  let objectRef: { bucketId: string; objectName: string } | null = null;
  try {
    const payload = await request.json() as JsonRecord;
    objectRef = objectRefFromPayload(payload);
    if (!objectRef) {
      return edgeJsonResponse(observability, { ok: false, error: 'Missing storage object reference.' }, {
        status: 400,
        headers: corsHeaders
      });
    }

    const result = await finalizeObject(objectRef.bucketId, objectRef.objectName, observability);
    observability.log('info', 'media.processing_completed', {
      bucket: objectRef.bucketId,
      media_kind: 'mediaKind' in result ? result.mediaKind : 'unknown',
      skipped: result.skipped
    });
    return edgeJsonResponse(observability, { ok: true, result }, { headers: corsHeaders });
  } catch (error) {
    if (objectRef) {
      await supabase
        .from('post_media_assets')
        .update({
          status: 'failed',
          error: 'Media processing failed'
        })
        .eq('bucket_id', objectRef.bucketId)
        .eq('object_name', objectRef.objectName);
    }
    observability.log('error', 'media.processing_failed', {
      bucket: objectRef?.bucketId,
      error: error instanceof Error ? error.message : 'Media finalization failed'
    });
    return edgeJsonResponse(observability, {
      ok: false,
      error: 'Media finalization failed.'
    }, { status: 500, headers: corsHeaders });
  }
});
