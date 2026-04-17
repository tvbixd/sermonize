export const colors = {
  // Light mode (Apple Notes style)
  bgPrimary: '#F2F2F7',
  bgSurface: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  separator: 'rgba(60,60,67,0.12)',

  // Dark mode (Voice Memos style)
  darkBgPrimary: '#000000',
  darkBgSurface: '#1C1C1E',
  darkBgSurfaceRaised: '#2C2C2E',
  darkTextPrimary: '#FFFFFF',
  darkTextSecondary: '#8E8E93',

  // Accents
  accentBlue: '#0A84FF',
  accentRed: '#FF3B30',
  accentGold: '#FFD60A',

  // Semantic
  destructive: '#FF3B30',
} as const;

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
