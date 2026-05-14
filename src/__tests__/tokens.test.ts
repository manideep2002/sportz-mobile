import { colors, radii, spacing } from '@/design/tokens';

describe('SPORTZ design tokens', () => {
  it('keeps the primary orange and dark shell values stable', () => {
    expect(colors.orange[500]).toBe('#FF5A1F');
    expect(colors.dark[950]).toBe('#0A0907');
  });

  it('uses compact mobile spacing and radii', () => {
    expect(spacing.screen).toBe(18);
    expect(radii.xl).toBe(18);
  });
});
