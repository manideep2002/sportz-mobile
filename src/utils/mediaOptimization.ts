import { env } from '@/lib/env';

type ResizeMode = 'cover' | 'contain' | 'fill';

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  resize?: ResizeMode;
  quality?: number;
}

const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/';
const STORAGE_RENDER_PATH = '/storage/v1/render/image/public/';
const TRANSFORMABLE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'tiff']);

const clampDimension = (value?: number) => {
  if (!value || !Number.isFinite(value)) return undefined;
  return String(Math.min(2500, Math.max(1, Math.round(value))));
};

const clampQuality = (value?: number) => {
  if (!value || !Number.isFinite(value)) return undefined;
  return String(Math.min(100, Math.max(20, Math.round(value))));
};

const extensionFromPath = (pathname: string) => {
  const cleanPath = pathname.split('?')[0] ?? pathname;
  const fileName = cleanPath.split('/').pop() ?? '';
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension && extension !== fileName ? extension : null;
};

const isSupabaseStorageUrl = (url: URL) => {
  const configuredHost = new URL(env.supabaseUrl).host;
  return url.host === configuredHost && (
    url.pathname.includes(STORAGE_PUBLIC_PATH) ||
    url.pathname.includes(STORAGE_RENDER_PATH)
  );
};

const isTransformableImage = (url: URL) => {
  const extension = extensionFromPath(url.pathname);
  return Boolean(extension && TRANSFORMABLE_EXTENSIONS.has(extension));
};

export function optimizedImageUrl(uri?: string | null, options: ImageTransformOptions = {}) {
  if (!uri) return uri;

  try {
    const url = new URL(uri);
    if (!isSupabaseStorageUrl(url) || !isTransformableImage(url)) {
      return uri;
    }

    url.pathname = url.pathname.replace(STORAGE_PUBLIC_PATH, STORAGE_RENDER_PATH);

    const width = clampDimension(options.width);
    const height = clampDimension(options.height);
    const quality = clampQuality(options.quality);

    if (width) url.searchParams.set('width', width);
    if (height) url.searchParams.set('height', height);
    if (options.resize) url.searchParams.set('resize', options.resize);
    if (quality) url.searchParams.set('quality', quality);

    return url.toString();
  } catch {
    return uri;
  }
}

export const mediaVariants = {
  avatar: (uri?: string | null, size = 42, scale = 3) =>
    optimizedImageUrl(uri, {
      width: size * scale,
      height: size * scale,
      resize: 'cover',
      quality: 72
    }),

  feedImage: (uri?: string | null) =>
    optimizedImageUrl(uri, {
      width: 900,
      height: 560,
      resize: 'cover',
      quality: 76
    }),

  messageImage: (uri?: string | null) =>
    optimizedImageUrl(uri, {
      width: 520,
      height: 410,
      resize: 'cover',
      quality: 74
    }),

  storyImage: (uri?: string | null) =>
    optimizedImageUrl(uri, {
      width: 1080,
      height: 1920,
      resize: 'cover',
      quality: 78
    }),

  eventCover: (uri?: string | null) =>
    optimizedImageUrl(uri, {
      width: 1200,
      height: 620,
      resize: 'cover',
      quality: 78
    }),

  fullImage: (uri?: string | null) =>
    optimizedImageUrl(uri, {
      width: 1600,
      resize: 'contain',
      quality: 84
    })
};
