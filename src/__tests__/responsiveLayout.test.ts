import { responsiveLayoutFor, widthClassFor } from '@/layout/responsive';

describe('responsive layout contract', () => {
  test.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [1023, 'medium'],
    [1024, 'expanded'],
    [1439, 'expanded'],
    [1440, 'wide']
  ] as const)('maps %i points to %s', (width, expected) => {
    expect(widthClassFor(width)).toBe(expected);
  });

  it('uses split panes only at expanded widths with standard text', () => {
    expect(responsiveLayoutFor(1024, 768, 1).supportsSplitPane).toBe(true);
    expect(responsiveLayoutFor(768, 1024, 1).supportsSplitPane).toBe(false);
    expect(responsiveLayoutFor(1440, 900, 1.6).supportsSplitPane).toBe(false);
  });

  it('responds deterministically to resize and rotation', () => {
    const portrait = responsiveLayoutFor(390, 844);
    const landscape = responsiveLayoutFor(844, 390);
    const desktop = responsiveLayoutFor(1280, 800);

    expect(portrait).toMatchObject({ widthClass: 'compact', isLandscape: false, gutter: 16 });
    expect(landscape).toMatchObject({ widthClass: 'medium', isLandscape: true, gutter: 24 });
    expect(desktop).toMatchObject({ widthClass: 'expanded', supportsSplitPane: true });
  });

  it('keeps desktop content within documented maximum widths', () => {
    const layout = responsiveLayoutFor(1920, 1080);
    expect(layout.feedMaxWidth).toBe(720);
    expect(layout.contentMaxWidth).toBe(760);
    expect(layout.wideMaxWidth).toBe(1180);
  });
});
