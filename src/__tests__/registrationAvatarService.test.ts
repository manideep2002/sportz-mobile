const mockValues = new Map<string, string>();
const mockCopy = jest.fn();
const mockDelete = jest.fn();
const mockValidate = jest.fn();
const mockUpload = jest.fn();
const mockRemoveAvatar = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => Promise.resolve(mockValues.get(key) ?? null),
  setItem: (key: string, value: string) => { mockValues.set(key, value); return Promise.resolve(); },
  removeItem: (key: string) => { mockValues.delete(key); return Promise.resolve(); }
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: (...args: unknown[]) => mockCopy(...args),
  deleteAsync: (...args: unknown[]) => mockDelete(...args)
}));
jest.mock('@/services/storageService', () => ({
  storageService: {
    validateMediaAsset: (...args: unknown[]) => mockValidate(...args),
    uploadMedia: (...args: unknown[]) => mockUpload(...args),
    removeAvatar: (...args: unknown[]) => mockRemoveAvatar(...args)
  }
}));
jest.mock('@/services/profileService', () => ({
  profileService: { updateProfile: (...args: unknown[]) => mockUpdateProfile(...args) }
}));

// eslint-disable-next-line import/first
import { registrationAvatarService } from '@/services/registrationAvatarService';

const asset = {
  uri: 'file:///picker/avatar.jpg',
  width: 640,
  height: 640,
  fileName: 'avatar.jpg',
  fileSize: 120_000,
  mimeType: 'image/jpeg',
  type: 'image' as const,
  assetId: null
};

describe('registration avatar continuation', () => {
  beforeEach(() => {
    mockValues.clear();
    jest.clearAllMocks();
    mockCopy.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockUpload.mockResolvedValue('https://project.supabase.co/storage/v1/object/public/avatars/user-a/avatar.jpg');
    mockRemoveAvatar.mockResolvedValue(undefined);
    mockUpdateProfile.mockResolvedValue({ id: 'user-a', avatarUrl: 'https://project/avatar.jpg' });
  });

  it('persists a durable file without credentials and binds it to the signed-up user', async () => {
    await registrationAvatarService.stage(asset, ' Athlete@Example.com ');
    await registrationAvatarService.bindToUser('user-a', 'athlete@example.com');

    const raw = [...mockValues.values()][0];
    const pending = JSON.parse(raw);
    expect(pending).toMatchObject({ expectedEmail: 'athlete@example.com', userId: 'user-a' });
    expect(pending.asset.uri).toMatch(/^file:\/\/\/documents\/registration-avatar\//);
    expect(raw).not.toMatch(/access_token|refresh_token|service_role|password/i);
  });

  it('survives restart semantics and never attaches to a different account', async () => {
    await registrationAvatarService.stage(asset, 'athlete@example.com');
    await registrationAvatarService.bindToUser('user-a', 'athlete@example.com');

    await expect(registrationAvatarService.attachForAuthenticatedUser('user-b', 'other@example.com')).resolves.toBeNull();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(await registrationAvatarService.hasPendingForUser('user-a')).toBe(true);
  });

  it('retains the continuation after upload failure and removes it after retry succeeds', async () => {
    await registrationAvatarService.stage(asset, 'athlete@example.com');
    await registrationAvatarService.bindToUser('user-a', 'athlete@example.com');
    mockUpload.mockRejectedValueOnce(new Error('offline'));

    await expect(registrationAvatarService.attachForAuthenticatedUser('user-a', 'athlete@example.com')).rejects.toThrow('offline');
    expect(await registrationAvatarService.hasPendingForUser('user-a')).toBe(true);

    await expect(registrationAvatarService.attachForAuthenticatedUser('user-a', 'athlete@example.com')).resolves.toMatchObject({ id: 'user-a' });
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(await registrationAvatarService.hasPendingForUser('user-a')).toBe(false);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('rejects invalid image dimensions before copying or uploading', async () => {
    await expect(registrationAvatarService.stage({ ...asset, width: 0 }, 'athlete@example.com'))
      .rejects.toThrow('valid profile image');
    expect(mockCopy).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
