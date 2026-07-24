import { createAppTheme } from '@/design/ThemeProvider';
import type { AccentColor } from '@/store/uiStore';

const relativeLuminance = (hex: string) => {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

describe('semantic themes', () => {
  it('provides distinct readable light and dark surfaces', () => {
    const dark = createAppTheme('dark', 'orange');
    const light = createAppTheme('light', 'orange');

    expect(dark.colors.background).not.toBe(light.colors.background);
    expect(dark.colors.surface).not.toBe(light.colors.surface);
    expect(contrastRatio(dark.colors.text, dark.colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light.colors.text, light.colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each<AccentColor>(['orange', 'green', 'blue', 'pink'])(
    'resolves the %s accent with readable foreground text',
    (accent) => {
      const theme = createAppTheme('light', accent);
      expect(theme.accentName).toBe(accent);
      expect(contrastRatio(theme.colors.onAccent, theme.colors.accent)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('falls back to orange if corrupted persisted accent data is encountered', () => {
    const theme = createAppTheme('dark', 'unknown' as AccentColor);
    expect(theme.colors.accent).toBe(createAppTheme('dark', 'orange').colors.accent);
  });
});
