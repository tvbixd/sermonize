# Design Tokens: Sermonize

**Philosophy**: Warm minimalism. iOS-native foundations with faith-oriented warmth.
**File**: `src/theme.ts` (React Native StyleSheet tokens, not CSS)
**Mode**: Dual-theme (light + dark), auto-follows system `useColorScheme()`

## Color Tokens

### Backgrounds (3-tier hierarchy)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| bgPrimary | `#F2F2F7` | `#000000` | Screen backgrounds |
| bgSurface | `#FFFFFF` | `#1C1C1E` | Cards, nav bars, sheets |
| bgSurfaceRaised | `#F7F7F9` | `#2C2C2E` | Inputs, nested cards |

### Text (3-tier hierarchy)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| textPrimary | `#000000` | `#FFFFFF` | Headings, body text |
| textSecondary | `#8E8E93` | `rgba(235,235,245,0.6)` | Subtitles, metadata |
| textTertiary | `#C7C7CC` | `rgba(235,235,245,0.3)` | Placeholders, disabled |

### Accents
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| accentBlue | `#0A84FF` | `#0A84FF` | Primary action, links |
| accentRed | `#FF3B30` | `#FF453A` | Record button, destructive |
| accentGreen | `#30B65B` | `#30D158` | Success states |
| accentGold | `#FFD60A` | `#FFD60A` | Pinned items |
| accentOrange | `#FF9F0A` | `#FF9F0A` | Warnings |
| accentPurple | `#5E5CE6` | `#5E5CE6` | Badges, tags |

### Status (NEW)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| statusSuccess | `#34C759` | `#30D158` | Key validation success |
| statusError | `#FF3B30` | `#FF453A` | Key validation error |

### Utility
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| separator | `rgba(60,60,67,0.12)` | `rgba(84,84,88,0.45)` | Dividers |
| dimOverlay | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.5)` | Modal backdrop |
| highlight | `rgba(10,132,255,0.25)` | `rgba(10,132,255,0.15)` | Selection highlight |
| emptyBg | `#EAEAEF` | `#2C2C2E` | Empty state icons bg |
| fabShadow | `rgba(255,59,48,0.35)` | `rgba(255,69,58,0.4)` | Record FAB shadow (NEW) |

## Spacing Scale

4px base unit (balanced, iOS-standard).

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight gaps, icon padding |
| sm | 8px | Standard gap, small padding |
| md | 16px | Section padding, card padding |
| lg | 24px | Large sections, hero padding |
| xl | 32px | Page padding, major sections |
| rowMinHeight | 44px | Touch target minimum |

## Typography Scale

System font (SF Pro via React Native defaults). iOS Human Interface Guidelines.

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| largeTitle | 34px | 700 | 41px | Screen titles |
| title2 | 22px | 700 | 28px | Sermon title |
| title3 | 20px | 600 | 25px | Section headings |
| headline | 17px | 600 | 22px | Card titles, buttons |
| body | 17px | 400 | 22px | Body text |
| callout | 16px | 400 | 21px | Secondary body |
| subhead | 15px | 400 | 20px | Metadata, captions |
| footnote | 13px | 400 | 18px | Fine print, timestamps |
| caption | 12px | 400 | 16px | Badges, tags |
| sectionHeader | 11px | 500 | 16px | Section labels (uppercase) |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| card | 12px | Cards, panels |
| small | 10px | Inputs, small cards |
| button | 14px | Buttons |
| pill | 999px | Pills, badges, tags |
| fab | 32px | Floating action button |

## Motion (NEW)

| Token | Value | Usage |
|-------|-------|-------|
| fast | 150ms | Micro-interactions (toggles, badges) |
| normal | 250ms | Standard transitions (sheets, tabs) |
| slow | 400ms | Emphasis transitions (processing states) |

## Deviations from pure iOS

- FAB (floating action button) is not standard iOS but critical for one-tap record access
- Summary card above tabs on sermon detail is a custom pattern
- Bottom sheet context menus instead of UIKit action sheets (more control over styling)
