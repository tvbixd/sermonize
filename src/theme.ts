import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const lightColors = {
  bgPrimary: '#F2F2F7',
  bgSurface: '#FFFFFF',
  bgSurfaceRaised: '#F2F2F7',
  textPrimary: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  separator: 'rgba(60,60,67,0.12)',
  accentBlue: '#007AFF',
  accentRed: '#FF3B30',
  accentGold: '#FFD60A',
  destructive: '#FF3B30',
} as const;

export const darkColors = {
  bgPrimary: '#000000',
  bgSurface: '#1C1C1E',
  bgSurfaceRaised: '#2C2C2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  separator: 'rgba(84,84,88,0.65)',
  accentBlue: '#0A84FF',
  accentRed: '#FF453A',
  accentGold: '#FFD60A',
  destructive: '#FF453A',
} as const;

export type Colors = typeof lightColors;

export function useTheme(): Colors {
  const scheme = useColorScheme();
  return useMemo(() => (scheme === 'dark' ? darkColors : lightColors), [scheme]);
}

// Keep static `colors` export for backwards compat (resolves to light)
export const colors = lightColors;

export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const },
  title2: { fontSize: 22, fontWeight: '700' as const },
  title3: { fontSize: 20, fontWeight: '600' as const },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  callout: { fontSize: 16, fontWeight: '400' as const },
  subhead: { fontSize: 15, fontWeight: '400' as const },
  footnote: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  rowMinHeight: 44,
} as const;

export const radius = {
  card: 12,
  small: 10,
  pill: 999,
  fab: 16,
} as const;
