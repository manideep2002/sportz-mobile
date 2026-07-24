import { createAppTheme } from '@/design/ThemeProvider';

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
    const dark = createAppTheme('dark');
    const light = createAppTheme('light');

    expect(dark.colors.background).not.toBe(light.colors.background);
    expect(dark.colors.surface).not.toBe(light.colors.surface);
    expect(contrastRatio(dark.colors.text, dark.colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light.colors.text, light.colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses the original bright orange in dark mode and the deeper orange in light mode', () => {
    const dark = createAppTheme('dark');
    const light = createAppTheme('light');

    expect(dark.colors.accent).toBe('#FF5A1F');
    expect(light.colors.accent).toBe('#C2410C');
    expect(contrastRatio(dark.colors.onAccent, dark.colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light.colors.onAccent, light.colors.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['dark', 'light'] as const)('keeps the %s bottom navigation transparent', (mode) => {
    expect(createAppTheme(mode).colors.nav).toBe('transparent');
  });
});
