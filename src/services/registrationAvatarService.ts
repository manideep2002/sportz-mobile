import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { ImagePickerAsset } from 'expo-image-picker';

import { profileService } from '@/services/profileService';
import { storageService } from '@/services/storageService';
import type { UserProfile } from '@/types/domain';

const STORAGE_KEY = 'auth:pending-registration-avatar:v1';
const FILESYSTEM_ROOT = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
const DIRECTORY = FILESYSTEM_ROOT ? `${FILESYSTEM_ROOT}registration-avatar/` : null;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface PendingRegistrationAvatar {
  version: 1;
  expectedEmail: string;
  userId: string | null;
  createdAt: number;
  asset: Pick<ImagePickerAsset, 'uri' | 'width' | 'height' | 'fileName' | 'fileSize' | 'mimeType' | 'type'>;
}

let attachment: { userId: string; promise: Promise<UserProfile | null> } | null = null;

const normalizedEmail = (email?: string | null) => email?.trim().toLowerCase() ?? '';

async function removeFile(uri?: string | null) {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

async function readPending(): Promise<PendingRegistrationAvatar | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as PendingRegistrationAvatar;
    if (
      pending.version !== 1 ||
      !pending.expectedEmail ||
      !pending.asset?.uri ||
      Date.now() - pending.createdAt > MAX_AGE_MS
    ) {
      await removeFile(pending.asset?.uri);
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return pending;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export const registrationAvatarService = {
  validate(asset: ImagePickerAsset) {
    if (!asset.uri || asset.width <= 0 || asset.height <= 0 || asset.type === 'video') {
      throw new Error('Choose a valid profile image.');
    }
    storageService.validateMediaAsset(asset, {
      maxSizeMb: 5,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });
  },

  async stage(asset: ImagePickerAsset, email: string): Promise<void> {
    this.validate(asset);
    const scope = normalizedEmail(email);
    if (!scope) throw new Error('A valid registration email is required before saving the photo.');
    if (!DIRECTORY) throw new Error('This device cannot preserve the selected photo.');

    const previous = await readPending();
    await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true });
    const extension = asset.mimeType === 'image/png'
      ? 'png'
      : asset.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const uri = `${DIRECTORY}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    await FileSystem.copyAsync({ from: asset.uri, to: uri });

    const pending: PendingRegistrationAvatar = {
      version: 1,
      expectedEmail: scope,
      userId: null,
      createdAt: Date.now(),
      asset: {
        uri,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName ?? null,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        type: 'image'
      }
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } catch (error) {
      await removeFile(uri);
      throw error;
    }
    if (previous?.asset.uri !== uri) await removeFile(previous?.asset.uri);
  },

  async bindToUser(userId: string, email: string): Promise<void> {
    const pending = await readPending();
    if (!pending || pending.expectedEmail !== normalizedEmail(email)) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...pending, userId }));
  },

  async discard(): Promise<void> {
    const pending = await readPending();
    await AsyncStorage.removeItem(STORAGE_KEY);
    await removeFile(pending?.asset.uri);
  },

  async attachForAuthenticatedUser(userId: string, email?: string | null): Promise<UserProfile | null> {
    if (attachment?.userId === userId) return attachment.promise;
    const promise = (async () => {
      const pending = await readPending();
      if (
        !pending ||
        pending.userId !== userId ||
        pending.expectedEmail !== normalizedEmail(email)
      ) return null;

      this.validate(pending.asset as ImagePickerAsset);
      const avatarUrl = await storageService.uploadMedia(pending.asset as ImagePickerAsset, 'avatars', userId);
      try {
        const profile = await profileService.updateProfile(userId, { avatarUrl });
        await this.discard();
        return profile;
      } catch (error) {
        await storageService.removeAvatar(avatarUrl).catch(() => undefined);
        throw error;
      }
    })().finally(() => {
      if (attachment?.promise === promise) attachment = null;
    });
    attachment = { userId, promise };
    return promise;
  },

  async hasPendingForUser(userId: string): Promise<boolean> {
    return (await readPending())?.userId === userId;
  }
};
