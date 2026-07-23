import type { ImagePickerAsset } from 'expo-image-picker';

import { storageService } from '@/services/storageService';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const asset = (overrides: Partial<ImagePickerAsset> = {}): ImagePickerAsset => ({
  uri: 'file:///valid.mp4',
  width: 1920,
  height: 1080,
  type: 'video',
  fileSize: 20 * 1024 * 1024,
  duration: 30_000,
  mimeType: 'video/mp4',
  ...overrides
});

describe('validateMediaAsset', () => {
  it('throws when the file exceeds the size limit', () => {
    expect(() =>
      storageService.validateMediaAsset(asset({ fileSize: 11 * 1024 * 1024 }), {
        maxSizeMb: 10
      })
    ).toThrow('File is too large');
  });

  it('throws when a video exceeds the duration limit', () => {
    expect(() =>
      storageService.validateMediaAsset(asset({ duration: 61_000 }), {
        maxDurationSecs: 60
      })
    ).toThrow('Video is too long');
  });

  it('throws when the MIME type is disallowed', () => {
    expect(() =>
      storageService.validateMediaAsset(asset({ mimeType: 'video/x-msvideo' }), {
        allowedMimeTypes: ['image/jpeg', 'video/mp4']
      })
    ).toThrow('is not supported');
  });

  it.each([
    asset(),
    asset({
      uri: 'file:///valid.jpg',
      type: 'image',
      duration: null,
      mimeType: 'image/jpeg'
    })
  ])('accepts a valid image or video asset', (validAsset) => {
    expect(() => storageService.validateMediaAsset(validAsset)).not.toThrow();
  });
});
