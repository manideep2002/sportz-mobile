import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

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
 * Prefers the picker's mimeType field (most reliable), then falls back
 * to the extension in the URI, then defaults to jpeg.
 */
function resolveExtAndMime(asset: ImagePicker.ImagePickerAsset): { ext: string; mime: string } {
  // 1. mimeType field from the picker (most reliable)
  if (asset.mimeType) {
    const mime = asset.mimeType;
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    return { ext, mime };
  }

  // 2. Extension from the URI (only when it looks like a real extension ≤ 5 chars)
  const lastSegment = asset.uri.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex !== -1) {
    const rawExt = lastSegment.slice(dotIndex + 1).toLowerCase();
    if (rawExt.length > 0 && rawExt.length <= 5 && /^[a-z0-9]+$/.test(rawExt)) {
      const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
      return { ext, mime: mimeFromExt(ext) };
    }
  }

  // 3. Default
  return { ext: 'jpg', mime: 'image/jpeg' };
}

/**
 * Read a local file URI into an ArrayBuffer for upload.
 *
 * On Android, React Native's fetch() does not reliably produce a non-empty
 * Blob from file:// URIs (the blob body can be 0 bytes). We use
 * expo-file-system on native to read the raw base64 and convert it, which
 * works correctly on both iOS and Android.
 *
 * On web, fetch() + arrayBuffer() is the standard approach.
 */
async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS !== 'web') {
    // expo-file-system reliably reads file:// and content:// URIs on native.
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64'
    });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Web: fetch handles blob/data URIs fine.
  const response = await fetch(uri);
  return response.arrayBuffer();
}

export const storageService = {
  async pickMedia(): Promise<ImagePicker.ImagePickerAsset | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // Array form — MediaTypeOptions.All is deprecated in SDK 54+
      mediaTypes: ['images', 'videos'],
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

  async captureMedia(): Promise<ImagePicker.ImagePickerAsset | null> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission is required.');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.86,
      allowsEditing: false
    });

    if (result.canceled) return null;
    return result.assets[0];
  },

  /**
   * Upload a media asset to Supabase Storage and return its public URL.
   *
   * Uses expo-file-system on native to avoid the Android fetch()+blob() bug
   * where the blob body comes back as 0 bytes from file:// URIs.
   */
  async uploadMedia(
    asset: ImagePicker.ImagePickerAsset | string,
    bucket: 'post-media' | 'story-media' | 'avatars' | 'event-covers',
    ownerId: string
  ): Promise<string> {
    const pickerAsset: ImagePicker.ImagePickerAsset =
      typeof asset === 'string'
        ? { uri: asset, width: 0, height: 0, assetId: null }
        : asset;

    if (!env.isSupabaseConfigured) return pickerAsset.uri;

    const { ext, mime } = resolveExtAndMime(pickerAsset);
    const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = VIDEO_EXTS.has(ext) ? 'video/mp4' : mime;

    const fileData = await readFileAsArrayBuffer(pickerAsset.uri);

    const { error } = await supabase.storage.from(bucket).upload(path, fileData, {
      contentType,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
};
