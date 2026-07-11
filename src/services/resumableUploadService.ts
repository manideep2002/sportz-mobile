import * as FileSystem from 'expo-file-system/legacy';
import type * as ImagePicker from 'expo-image-picker';
import * as tus from 'tus-js-client';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type StorageMediaBucket = 'post-media' | 'story-media' | 'avatars' | 'event-covers';

export interface ResumableUploadMetadata {
  postId?: string;
  ownerId: string;
  mediaKind: 'image' | 'video' | 'unknown';
  width?: number | null;
  height?: number | null;
  uploadIntent?: 'post-media' | 'story-media' | 'avatar' | 'event-cover';
}

export interface ResumableUploadOptions {
  bucket: StorageMediaBucket;
  ownerId: string;
  objectName?: string;
  upsert?: boolean;
  cacheControl?: string;
  metadata: ResumableUploadMetadata;
  signal?: AbortSignal;
  onProgress?: (progress: { bytesUploaded: number; bytesTotal: number; percentage: number }) => void;
}

export interface ResumableUploadResult {
  bucket: StorageMediaBucket;
  objectName: string;
  publicUrl: string;
  contentType: string;
  bytesUploaded: number;
  bytesTotal: number;
}

type ReactNativeTusFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;
const VIDEO_EXTS = new Set(['mp4', 'mov', 'm4v', 'webm']);

const mimeFromExt = (ext: string): string => {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/mp4',
    webm: 'video/webm'
  };
  return map[ext] ?? 'image/jpeg';
};

export function resolveAssetExtAndMime(asset: Pick<ImagePicker.ImagePickerAsset, 'mimeType' | 'uri'>): {
  ext: string;
  mime: string;
} {
  if (asset.mimeType) {
    const mime = asset.mimeType;
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    return { ext, mime };
  }

  const lastSegment = asset.uri.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex !== -1) {
    const rawExt = lastSegment.slice(dotIndex + 1).toLowerCase();
    if (rawExt.length > 0 && rawExt.length <= 5 && /^[a-z0-9]+$/.test(rawExt)) {
      const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
      return { ext, mime: mimeFromExt(ext) };
    }
  }

  return { ext: 'jpg', mime: 'image/jpeg' };
}

export function buildStorageObjectName(ownerId: string, ext: string, stablePrefix?: string) {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const suffix = stablePrefix ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${ownerId}/${suffix}.${safeExt}`;
}

function getResumableEndpoint() {
  const url = new URL(env.supabaseUrl);

  if (url.hostname.endsWith('.supabase.co') && !url.hostname.endsWith('.storage.supabase.co')) {
    const projectRef = url.hostname.replace(/\.supabase\.co$/, '');
    url.hostname = `${projectRef}.storage.supabase.co`;
  }

  url.pathname = '/storage/v1/upload/resumable';
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function getAssetSize(uri: string, fallback?: number | null) {
  if (fallback && Number.isFinite(fallback)) return fallback;

  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === 'number' ? info.size : undefined;
}

function assetFileName(asset: ImagePicker.ImagePickerAsset, objectName: string) {
  return asset.fileName ?? objectName.split('/').pop() ?? 'upload';
}

export const resumableUploadService = {
  async uploadAsset(
    asset: ImagePicker.ImagePickerAsset,
    options: ResumableUploadOptions
  ): Promise<ResumableUploadResult> {
    if (!env.isSupabaseConfigured) {
      return {
        bucket: options.bucket,
        objectName: options.objectName ?? asset.uri,
        publicUrl: asset.uri,
        contentType: asset.mimeType ?? 'image/jpeg',
        bytesUploaded: asset.fileSize ?? 0,
        bytesTotal: asset.fileSize ?? 0
      };
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error('You must be signed in to upload media.');

    const { ext, mime } = resolveAssetExtAndMime(asset);
    const objectName = options.objectName ?? buildStorageObjectName(options.ownerId, ext);
    const contentType = VIDEO_EXTS.has(ext) ? (mime === 'video/quicktime' ? mime : 'video/mp4') : mime;
    const size = await getAssetSize(asset.uri, asset.fileSize);
    const file: ReactNativeTusFile = {
      uri: asset.uri,
      name: assetFileName(asset, objectName),
      type: contentType,
      size
    };

    let latestBytesUploaded = 0;
    let latestBytesTotal = size ?? 0;

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file as unknown as Blob, {
        endpoint: getResumableEndpoint(),
        chunkSize: TUS_CHUNK_SIZE_BYTES,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        uploadSize: size,
        headers: {
          authorization: `Bearer ${accessToken}`,
          apikey: env.supabasePublishableKey,
          ...(options.upsert ? { 'x-upsert': 'true' } : {})
        },
        metadata: {
          bucketName: options.bucket,
          objectName,
          contentType,
          cacheControl: options.cacheControl ?? '31536000',
          metadata: JSON.stringify({
            ...options.metadata,
            bucket: options.bucket,
            objectName,
            contentType,
            width: options.metadata.width ?? asset.width ?? null,
            height: options.metadata.height ?? asset.height ?? null
          })
        },
        fingerprint: async () => `supabase:${options.bucket}:${objectName}:${file.size ?? 'unknown'}`,
        onProgress: (bytesUploaded, bytesTotal) => {
          latestBytesUploaded = bytesUploaded;
          latestBytesTotal = bytesTotal;
          options.onProgress?.({
            bytesUploaded,
            bytesTotal,
            percentage: bytesTotal > 0 ? bytesUploaded / bytesTotal : 0
          });
        },
        onError: reject,
        onSuccess: () => {
          const { data: publicUrlData } = supabase.storage.from(options.bucket).getPublicUrl(objectName);
          resolve({
            bucket: options.bucket,
            objectName,
            publicUrl: publicUrlData.publicUrl,
            contentType,
            bytesUploaded: latestBytesUploaded,
            bytesTotal: latestBytesTotal
          });
        }
      });

      const abortUpload = () => {
        void upload.abort().finally(() => reject(new Error('Media upload was cancelled.')));
      };

      if (options.signal?.aborted) {
        abortUpload();
        return;
      }

      options.signal?.addEventListener('abort', abortUpload, { once: true });

      void upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      }).catch(reject);
    });
  }
};
