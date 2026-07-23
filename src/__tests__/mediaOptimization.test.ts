import { env } from '@/lib/env';
import { mediaVariants, optimizedImageUrl } from '@/utils/mediaOptimization';

describe('mediaOptimization', () => {
  const publicImageUrl = `${env.supabaseUrl}/storage/v1/object/public/post-media/user-1/image.jpg`;

  it('rewrites Supabase public image URLs to transformed render URLs', () => {
    const optimized = optimizedImageUrl(publicImageUrl, {
      width: 500,
      height: 300,
      resize: 'cover',
      quality: 70
    });

    expect(optimized).toContain('/storage/v1/render/image/public/post-media/user-1/image.jpg');
    expect(optimized).toContain('width=500');
    expect(optimized).toContain('height=300');
    expect(optimized).toContain('resize=cover');
    expect(optimized).toContain('quality=70');
  });

  it('leaves non-Supabase and local URLs untouched', () => {
    expect(optimizedImageUrl('https://example.com/image.jpg', { width: 500 })).toBe('https://example.com/image.jpg');
    expect(optimizedImageUrl('file:///local/image.jpg', { width: 500 })).toBe('file:///local/image.jpg');
  });

  it('does not transform videos', () => {
    const videoUrl = `${env.supabaseUrl}/storage/v1/object/public/post-media/user-1/clip.mp4`;

    expect(optimizedImageUrl(videoUrl, { width: 500 })).toBe(videoUrl);
  });

  it('uses bounded avatar variants', () => {
    const optimized = mediaVariants.avatar(publicImageUrl, 2000, 3);

    expect(optimized).toContain('width=2500');
    expect(optimized).toContain('height=2500');
    expect(optimized).toContain('quality=72');
  });

  it('optimizes private signed profile covers without dropping the token', () => {
    const signedCoverUrl = `${env.supabaseUrl}/storage/v1/object/sign/profile-covers/user-1/cover.jpg?token=signed-token`;
    const optimized = mediaVariants.profileCover(signedCoverUrl);

    expect(optimized).toContain('/storage/v1/render/image/sign/profile-covers/user-1/cover.jpg');
    expect(optimized).toContain('token=signed-token');
    expect(optimized).toContain('width=1200');
    expect(optimized).toContain('height=600');
  });
});
