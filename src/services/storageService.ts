import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import {
  buildStorageObjectName,
  resolveAssetExtAndMime,
  resumableUploadService,
  type ResumableUploadResult
} from '@/services/resumableUploadService';

export interface StoredProfileCover {
  bucket: 'profile-covers' | 'post-media';
  objectName: string;
}

async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'android') {
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

  const response = await fetch(uri);
  return response.arrayBuffer();
}

export const storageService = {
  profileCoverObjectFromValue(value?: string | null): StoredProfileCover | null {
    if (!value) return null;

    if (!value.includes('://')) {
      const objectName = value.replace(/^\/+/, '');
      return objectName.includes('/')
        ? { bucket: 'profile-covers', objectName }
        : null;
    }

    try {
      const pathname = new URL(value).pathname;
      for (const bucket of ['profile-covers', 'post-media'] as const) {
        const markers = [
          `/storage/v1/object/public/${bucket}/`,
          `/storage/v1/object/sign/${bucket}/`,
          `/storage/v1/render/image/public/${bucket}/`,
          `/storage/v1/render/image/sign/${bucket}/`
        ];
        const marker = markers.find((candidate) => pathname.includes(candidate));
        if (!marker) continue;

        const objectName = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
        return objectName.includes('/') ? { bucket, objectName } : null;
      }
    } catch {
      return null;
    }

    return null;
  },

  async resolveProfileCoverUrl(value?: string | null): Promise<string | null> {
    if (!value) return null;
    if (!env.isSupabaseConfigured || value.includes('://')) return value;

    const storedCover = this.profileCoverObjectFromValue(value);
    if (!storedCover || storedCover.bucket !== 'profile-covers') return null;

    const { data, error } = await supabase.storage
      .from('profile-covers')
      .createSignedUrl(storedCover.objectName, 300);
    if (error) return null;
    return data.signedUrl;
  },

  postMediaObjectNameFromUrl(mediaUrl?: string | null): string | null {
    if (!mediaUrl) return null;
    try {
      const marker = '/storage/v1/object/public/post-media/';
      const markerIndex = new URL(mediaUrl).pathname.indexOf(marker);
      if (markerIndex < 0) return null;
      const objectName = decodeURIComponent(
        new URL(mediaUrl).pathname.slice(markerIndex + marker.length)
      );
      return objectName.includes('/') ? objectName : null;
    } catch {
      return null;
    }
  },

  async pickMedia(): Promise<ImagePicker.ImagePickerAsset | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.86,
      allowsEditing: false
    });

    if (result.canceled) return null;
    return result.assets[0];
  },

  async pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.86,
      allowsEditing: true
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
      mediaTypes: ['images', 'videos'],
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

    const { ext, mime } = resolveAssetExtAndMime(pickerAsset);
    const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const fileData = await readFileAsArrayBuffer(pickerAsset.uri);

    const { error } = await supabase.storage.from(bucket).upload(path, fileData, {
      contentType: mime,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async uploadProfileCover(
    asset: ImagePicker.ImagePickerAsset,
    ownerId: string
  ): Promise<string> {
    this.validateMediaAsset(asset, {
      maxSizeMb: 10,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });

    if (!env.isSupabaseConfigured) return asset.uri;

    const { ext, mime } = resolveAssetExtAndMime(asset);
    const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const fileData = await readFileAsArrayBuffer(asset.uri);
    const { error } = await supabase.storage.from('profile-covers').upload(path, fileData, {
      contentType: mime,
      cacheControl: '31536000',
      upsert: false
    });
    if (error) throw error;
    return path;
  },

  async removeProfileCover(value: string): Promise<void> {
    if (!env.isSupabaseConfigured || !value) return;

    const storedCover = this.profileCoverObjectFromValue(value);
    if (!storedCover) return;

    const { error } = await supabase.storage
      .from(storedCover.bucket)
      .remove([storedCover.objectName]);
    if (error) throw error;
  },

  async uploadPostMediaResumable(
    asset: ImagePicker.ImagePickerAsset,
    ownerId: string,
    postId?: string,
    onProgress?: (progress: { bytesUploaded: number; bytesTotal: number; percentage: number }) => void
  ): Promise<ResumableUploadResult> {
    const { ext } = resolveAssetExtAndMime(asset);
    const objectName = buildStorageObjectName(ownerId, ext, postId);

    return resumableUploadService.uploadAsset(asset, {
      bucket: 'post-media',
      ownerId,
      objectName,
      cacheControl: '31536000',
      metadata: {
        ...(postId ? { postId } : {}),
        ownerId,
        mediaKind: asset.type === 'video' ? 'video' : 'image',
        width: asset.width,
        height: asset.height,
        uploadIntent: 'post-media'
      },
      onProgress
    });
  },

  async removePostMedia(objectName: string): Promise<void> {
    if (!objectName) return;
    const { error } = await supabase.storage.from('post-media').remove([objectName]);
    if (error) throw error;
  },
  /**
   * Validate a media asset before uploading.
   * Throws a descriptive Error if the asset violates any constraint.
   *
   * @param asset - The ImagePickerAsset to validate.
   * @param options.maxSizeMb - Maximum file size in megabytes (default 200).
   * @param options.maxDurationSecs - Maximum video duration in seconds (default 300 = 5 min).
   * @param options.allowedMimeTypes - Allowed MIME type prefixes or exact types (default images + common videos).
   */
  validateMediaAsset(
    asset: ImagePicker.ImagePickerAsset,
    options: {
      maxSizeMb?: number;
      maxDurationSecs?: number;
      allowedMimeTypes?: string[];
    } = {}
  ): void {
    const maxSizeBytes = (options.maxSizeMb ?? 200) * 1024 * 1024;
    const maxDurationMs = (options.maxDurationSecs ?? 300) * 1000;
    const allowedTypes = options.allowedMimeTypes ?? [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
    ];

    // Size check (fileSize is available on Android; skip on iOS where it may be absent)
    if (asset.fileSize !== undefined && asset.fileSize !== null && asset.fileSize > maxSizeBytes) {
      const sizeMb = (asset.fileSize / 1024 / 1024).toFixed(1);
      const limitMb = (options.maxSizeMb ?? 200).toFixed(0);
      throw new Error(`File is too large (${sizeMb} MB). Maximum allowed is ${limitMb} MB.`);
    }

    // Duration check for videos
    if (asset.type === 'video' && asset.duration !== undefined && asset.duration !== null) {
      if (asset.duration > maxDurationMs) {
        const durationSecs = Math.round(asset.duration / 1000);
        const limitSecs = options.maxDurationSecs ?? 300;
        throw new Error(`Video is too long (${durationSecs}s). Maximum allowed is ${limitSecs}s.`);
      }
    }

    // MIME type check
    const mime = asset.mimeType;
    if (mime) {
      const isAllowed = allowedTypes.some(
        (allowed) => mime === allowed || mime.startsWith(allowed.endsWith('/') ? allowed : `${allowed}/`)
      );
      if (!isAllowed) {
        throw new Error(`File type "${mime}" is not supported. Please choose an image or video.`);
      }
    }
  }
};
