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

const VIDEO_EXTS = new Set(['mp4', 'mov', 'm4v', 'webm']);

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
    const contentType = VIDEO_EXTS.has(ext) ? 'video/mp4' : mime;

    const fileData = await readFileAsArrayBuffer(pickerAsset.uri);

    const { error } = await supabase.storage.from(bucket).upload(path, fileData, {
      contentType,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async uploadPostMediaResumable(
    asset: ImagePicker.ImagePickerAsset,
    ownerId: string,
    postId: string,
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
        postId,
        ownerId,
        mediaKind: asset.type === 'video' ? 'video' : 'image',
        width: asset.width,
        height: asset.height,
        uploadIntent: 'post-media'
      },
      onProgress
    });
  }
};
