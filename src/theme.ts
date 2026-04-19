import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const lightColors = {
  bgPrimary: '#F2F2F7',
  bgSurface: '#FFFFFF',
  bgSurfaceRaised: '#F7F7F9',
  textPrimary: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  separator: 'rgba(60,60,67,0.12)',
  accentBlue: '#0A84FF',
  accentRed: '#FF3B30',
  accentGold: '#FFD60A',
  accentOrange: '#FF9F0A',
  accentGreen: '#30B65B',
  accentPurple: '#5E5CE6',
  destructive: '#FF3B30',
  highlight: 'rgba(10,132,255,0.25)',
  emptyBg: '#EAEAEF',
  dimOverlay: 'rgba(0,0,0,0.35)',
  spinnerTrack: 'rgba(0,0,0,0.08)',
  spinnerArc: '#0A84FF',
  stepPipInactive: 'rgba(0,0,0,0.1)',
} as const;

export const darkColors = {
  bgPrimary: '#000000',
  bgSurface: '#1C1C1E',
  bgSurfaceRaised: '#2C2C2E',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.6)',
  textTertiary: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.45)',
  accentBlue: '#0A84FF',
  accentRed: '#FF453A',
  accentGold: '#FFD60A',
  accentOrange: '#FF9F0A',
  accentGreen: '#30D158',
  accentPurple: '#5E5CE6',
  destructive: '#FF453A',
  highlight: 'rgba(10,132,255,0.15)',
  emptyBg: '#2C2C2E',
  dimOverlay: 'rgba(0,0,0,0.5)',
  spinnerTrack: 'rgba(255,255,255,0.15)',
  spinnerArc: '#FFFFFF',
  stepPipInactive: 'rgba(255,255,255,0.2)',
} as const;

export type Colors = typeof lightColors;

export function useTheme(): Colors {
  const scheme = useColorScheme();
  return useMemo(() => (scheme === 'dark' ? darkColors : lightColors), [scheme]);
}

export const colors = lightColors;

export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37, lineHeight: 41 },
  title2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35, lineHeight: 28 },
  title3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.38, lineHeight: 25 },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.43, lineHeight: 22 },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.43, lineHeight: 22 },
  callout: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32, lineHeight: 21 },
  subhead: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24, lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 16 },
  sectionHeader: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5, lineHeight: 16, textTransform: 'uppercase' as const },
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
  button: 14,
  pill: 999,
  fab: 32,
} as const;
