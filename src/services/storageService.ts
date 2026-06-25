import * as ImagePicker from 'expo-image-picker';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/** Supported video extensions */
const VIDEO_EXTS = new Set(['mp4', 'mov', 'm4v', 'webm']);

/** Map file extension → MIME type. Falls back to image/jpeg. */
const mimeFromExt = (ext: string): string => {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm'
  };
  return map[ext] ?? 'image/jpeg';
};

/**
 * Derive a clean extension + MIME type from an ImagePicker asset.
 *
 * expo-image-picker on iOS can return:
 *   - file:///…/ImagePicker/xxx.jpg   → easy
 *   - ph://ED7AC36B-…/L0/001          → no real extension; use `type` field
 *
 * We prefer the asset's `mimeType` field when available, then fall back to
 * the file extension in the URI, then default to jpeg.
 */
function resolveExtAndMime(asset: ImagePicker.ImagePickerAsset): { ext: string; mime: string } {
  // 1. Use mimeType field from the picker (most reliable)
  if (asset.mimeType) {
    const mime = asset.mimeType;
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    return { ext, mime };
  }

  // 2. Fall back to the URI extension (last segment after the last dot,
  //    only if it looks like a real extension ≤ 4 chars)
  const lastSegment = asset.uri.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex !== -1) {
    const rawExt = lastSegment.slice(dotIndex + 1).toLowerCase();
    if (rawExt.length > 0 && rawExt.length <= 5 && /^[a-z0-9]+$/.test(rawExt)) {
      return { ext: rawExt === 'jpeg' ? 'jpg' : rawExt, mime: mimeFromExt(rawExt) };
    }
  }

  // 3. Default
  return { ext: 'jpg', mime: 'image/jpeg' };
}

/**
 * Read a local file URI into an ArrayBuffer using XMLHttpRequest.
 *
 * React Native's XHR routes file://, ph://, and content:// URIs
 * through the native layer, which fetch() alone may fail to do for
 * ph:// (iOS PhotoKit) and content:// (Android MediaStore) URIs.
 */
function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`Could not read file (status ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while reading local file.'));
    xhr.send();
  });
}

export const storageService = {
  async pickMedia(): Promise<ImagePicker.ImagePickerAsset | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.86,
      allowsEditing: false
    });

    if (result.canceled) return null;
    return result.assets[0];
  },

  async pickMultipleImages(): Promise<ImagePicker.ImagePickerAsset[]> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.86,
      allowsEditing: false,
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: 10
    });

    if (result.canceled) return [];
    return result.assets;
  },

  /**
   * Upload a media asset to Supabase Storage and return its public URL.
   *
   * In mock mode (no Supabase configured) returns the original URI unchanged
   * so the app can still display it locally.
   *
   * @param asset   The ImagePicker asset (has URI + mimeType info).
   * @param bucket  The target Supabase Storage bucket.
   * @param ownerId The authenticated user's UUID (used as the folder name).
   */
  async uploadMedia(
    asset: ImagePicker.ImagePickerAsset | string,
    bucket: 'post-media' | 'story-media' | 'avatars' | 'event-covers',
    ownerId: string
  ): Promise<string> {
    // Accept a plain URI string for backward compatibility with callsites
    // that predate the asset-based API.
    const pickerAsset: ImagePicker.ImagePickerAsset | null =
      typeof asset === 'string'
        ? { uri: asset, width: 0, height: 0, assetId: null }
        : asset;

    if (!env.isSupabaseConfigured) return pickerAsset.uri;

    const { ext, mime } = resolveExtAndMime(pickerAsset);
    const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Read via XHR so ph://, content://, and file:// all work correctly.
    const buffer = await readAsArrayBuffer(pickerAsset.uri);

    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: mime,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
};
