import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const lightColors = {
  bgPrimary: '#F2F2F7',
  bgSurface: '#FFFFFF',
  bgSurfaceRaised: '#E9ECEF',
  bgWarm: '#E9ECEF',
  textPrimary: '#2B3031',
  textSecondary: '#7A7E80',
  textTertiary: '#B8BABB',
  separator: 'rgba(43,48,49,0.10)',
  accentBlue: '#0A84FF',
  accentRed: '#FF3D4D',
  accentGold: '#E8A838',
  accentOrange: '#F08C3A',
  accentGreen: '#34A853',
  accentPurple: '#7A5AF8',
  destructive: '#D93025',
  highlight: 'rgba(255,61,77,0.12)',
  emptyBg: '#E9ECEF',
  dimOverlay: 'rgba(0,0,0,0.35)',
  spinnerTrack: 'rgba(43,48,49,0.08)',
  spinnerArc: '#FF3D4D',
  stepPipInactive: 'rgba(43,48,49,0.12)',
  statusSuccess: '#34A853',
  statusError: '#D93025',
  fabShadow: 'rgba(255,61,77,0.35)',
  cardShadow: 'rgba(43,48,49,0.06)',
} as const;

export const darkColors = {
  bgPrimary: '#0C0A09',
  bgSurface: '#1C1917',
  bgSurfaceRaised: '#292524',
  bgWarm: '#1E1410',
  textPrimary: '#F5F0EB',
  textSecondary: 'rgba(245,240,235,0.55)',
  textTertiary: 'rgba(245,240,235,0.28)',
  separator: 'rgba(245,240,235,0.10)',
  accentBlue: '#4DA3FF',
  accentRed: '#FF5A67',
  accentGold: '#F0B95A',
  accentOrange: '#F5A05A',
  accentGreen: '#5ABF78',
  accentPurple: '#9B7EFF',
  destructive: '#FF5A67',
  highlight: 'rgba(255,90,103,0.15)',
  emptyBg: '#2A2A2E',
  dimOverlay: 'rgba(0,0,0,0.55)',
  spinnerTrack: 'rgba(245,240,235,0.10)',
  spinnerArc: '#FF5A67',
  stepPipInactive: 'rgba(245,240,235,0.15)',
  statusSuccess: '#5ABF78',
  statusError: '#FF5A67',
  fabShadow: 'rgba(255,90,103,0.4)',
  cardShadow: 'rgba(0,0,0,0.3)',
} as const;

export type Colors = typeof lightColors;

export function useTheme(): Colors {
  const scheme = useColorScheme();
  return useMemo(() => (scheme === 'dark' ? darkColors as unknown as Colors : lightColors), [scheme]);
}

export const typography = {
  largeTitle: { fontSize: 32, fontWeight: '700' as const, letterSpacing: 0.2, lineHeight: 40 },
  title2: { fontSize: 24, fontWeight: '700' as const, letterSpacing: 0.1, lineHeight: 30 },
  title3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.15, lineHeight: 26 },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 23 },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.2, lineHeight: 24 },
  callout: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.15, lineHeight: 22 },
  subhead: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.1, lineHeight: 21 },
  footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.2, lineHeight: 16 },
  sectionHeader: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.8, lineHeight: 16, textTransform: 'uppercase' as const },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  rowMinHeight: 48,
} as const;

export const radius = {
  card: 16,
  small: 10,
  button: 14,
  pill: 999,
  fab: 30,
} as const;

export const motion = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;
