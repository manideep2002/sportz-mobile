import { useWindowDimensions } from 'react-native';

export const responsiveBreakpoints = {
  compactMax: 599,
  mediumMax: 1023,
  wideMin: 1440
} as const;

export type WidthClass = 'compact' | 'medium' | 'expanded' | 'wide';

export interface ResponsiveLayout {
  width: number;
  height: number;
  fontScale: number;
  widthClass: WidthClass;
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
  isWide: boolean;
  isLandscape: boolean;
  isLargeText: boolean;
  gutter: number;
  contentMaxWidth: number;
  wideMaxWidth: number;
  feedMaxWidth: number;
  supportsSplitPane: boolean;
}

export function widthClassFor(width: number): WidthClass {
  if (width <= responsiveBreakpoints.compactMax) return 'compact';
  if (width <= responsiveBreakpoints.mediumMax) return 'medium';
  if (width < responsiveBreakpoints.wideMin) return 'expanded';
  return 'wide';
}

export function responsiveLayoutFor(
  width: number,
  height: number,
  fontScale = 1
): ResponsiveLayout {
  const widthClass = widthClassFor(width);
  const isCompact = widthClass === 'compact';
  const isMedium = widthClass === 'medium';
  const isExpanded = widthClass === 'expanded' || widthClass === 'wide';
  const isWide = widthClass === 'wide';
  const isLargeText = fontScale >= 1.3;

  return {
    width,
    height,
    fontScale,
    widthClass,
    isCompact,
    isMedium,
    isExpanded,
    isWide,
    isLandscape: width > height,
    isLargeText,
    gutter: isCompact ? 16 : isMedium ? 24 : 32,
    contentMaxWidth: 760,
    wideMaxWidth: 1180,
    feedMaxWidth: 720,
    supportsSplitPane: isExpanded && width >= 1024 && !isLargeText
  };
}

export function useResponsiveLayout(): ResponsiveLayout {
  const dimensions = useWindowDimensions();
  return responsiveLayoutFor(dimensions.width, dimensions.height, dimensions.fontScale);
}
