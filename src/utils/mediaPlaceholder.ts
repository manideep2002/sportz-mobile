import type { ImageSource } from 'expo-image';

const BLURHASH_PREFIX = 'blurhash:';

export function mediaPlaceholderSource(placeholder?: string | null): ImageSource | null {
  if (!placeholder) return null;

  if (placeholder.startsWith(BLURHASH_PREFIX)) {
    return {
      blurhash: placeholder.slice(BLURHASH_PREFIX.length),
      width: 32,
      height: 32
    };
  }

  if (placeholder.startsWith('data:') || placeholder.startsWith('http://') || placeholder.startsWith('https://')) {
    return { uri: placeholder };
  }

  return {
    blurhash: placeholder,
    width: 32,
    height: 32
  };
}

export function clampedMediaAspectRatio(width?: number | null, height?: number | null) {
  if (!width || !height || width <= 0 || height <= 0) return 1;
  return Math.min(1.91, Math.max(0.8, width / height));
}
