# Design Brief: Scribe UX Improvement

## Problem

A churchgoer attending multiple services per week wants to capture sermon notes without the distraction of typing during worship. After the service, they want to quickly review what was preached — the main points, the scriptures referenced, and the key themes — without scrubbing through audio or deciphering handwritten notes. The current app works functionally but requires too many taps to start recording, provides no guidance when empty, doesn't validate setup, and buries the sermon summary inside a tab rather than surfacing it immediately.

## Solution

A refined experience that puts recording one tap away, welcomes new users with clear guidance, validates setup before the moment it matters (during a live service), and surfaces the sermon summary at a glance on the detail screen. The folder structure stays as home for users who attend multiple churches or organize by event, but the most important actions — record and review latest — are always within reach.

## Experience Principles

1. **Instant capture over perfect setup** -- The user should be able to start recording in one tap from the home screen. Configuration and organization are secondary to the core act of capturing the sermon.
2. **Reverence over efficiency** -- This is a spiritual tool used in sacred spaces. The interface should feel calm, warm, and trustworthy — never rushed, never flashy. Transitions should be gentle, text should be readable, and the design should honor the weight of the content.
3. **Surfaced value over hidden depth** -- The AI-generated summary, key scriptures, and theme should be visible immediately when opening a sermon — not buried inside tabs. The app earns trust by showing its best work upfront.

## Aesthetic Direction

- **Philosophy**: Warm minimalism — clean surfaces with soft warmth. iOS-native feel with subtle faith-oriented touches.
- **Tone**: Warm, reverent, trustworthy. Quiet confidence.
- **Reference points**: YouVersion Bible App (warmth, scripture focus, community feel), Apple Voice Memos (simplicity, native feel), Apple Notes (clean organization).
- **Anti-references**: Otter.ai (too corporate/tech), Notion (too complex), any app with aggressive onboarding or gamification.

## Existing Patterns

- **Typography**: SF Pro system font via React Native defaults. Scale from caption (12px) to largeTitle (34px). All defined in `src/theme.ts` typography object.
- **Colors**: Dual-theme (light/dark) following iOS conventions. Blues (`#0A84FF`), reds (`#FF3B30`/`#FF453A`), golds, greens. Background hierarchy: bgPrimary → bgSurface → bgSurfaceRaised.
- **Spacing**: 4-point scale (xs:4, sm:8, md:16, lg:24, xl:32). Row min height 44pt.
- **Radius**: card:12, small:10, button:14, pill:999.
- **Components**: SafeAreaView with custom nav bars on every screen. Cards with rounded corners. Bottom sheets for context menus. Segmented tab bars. Color picker swatches. Scripture cards. Icon set (SVG via react-native-svg).

## Component Inventory

| Component | Status | Notes |
| --------- | ------ | ----- |
| RecordFAB (home screen) | New | Floating record button on folders screen — large, red, prominent |
| WelcomeCard | New | Empty state card for folders screen with record CTA |
| SummaryCard | New | Condensed theme + summary + key scriptures above tabs on sermon detail |
| KeyValidator | New | Settings: test Groq API key on save with visual feedback |
| NavBar (custom) | Exists | Blue chevron back + title + right actions. Used on all screens |
| FolderRow | Exists | Folder icon + name + count + chevron |
| SermonRow | Exists | Title + date + duration + pin indicator |
| ContextMenu (bottom sheet) | Exists | Long-press actions: Open, Pin, Move, Delete |
| FolderPicker (bottom sheet) | Exists | Select target folder for sermon |
| ScriptureCard | Exists | Reference + translation + verse text |
| TabBar (segmented) | Exists | Outline / Scriptures / Transcript tabs |
| PointCard | Exists | Outline point with heading + sub-points + refs |
| RecordButton | Exists | Large ring + animated inner shape |
| SpinnerSvg | Exists | Processing state spinner |
| TextInput (styled) | Exists | Used in settings, edit mode, search, folder creation |

## Key Interactions

1. **First launch**: Welcome onboarding → Set Up API Key → validate key → success feedback → navigate to folders.
2. **Start recording from home**: Tap record FAB on folders screen → navigate directly to record screen → recording starts after one more tap.
3. **Empty folders screen**: Show welcome card with "Record your first sermon" CTA. Card disappears once first sermon is saved.
4. **API key validation**: User enters key in settings → taps Save/Done → app makes lightweight Groq API test call → shows checkmark (success) or error message (invalid key) inline.
5. **Sermon detail summary**: On opening a sermon, the summary card (theme, summary text, top 3 scripture refs) is visible above the tab bar. User can scroll down into tabs for full detail.
6. **Record → Review flow**: Stop recording → processing steps → auto-navigate to sermon detail → summary card is the first thing they see.

## Responsive Behavior

Mobile-only (React Native / Expo). No tablet-specific layouts needed. All screens use SafeAreaView for notch/status bar avoidance. Scroll views handle varying content length. Keyboard avoiding views wrap all input screens.

## Accessibility Requirements

- Touch targets minimum 44pt
- Text contrast meets WCAG AA (already handled by iOS system colors)
- VoiceOver labels on all interactive elements (icons, buttons)
- Keyboard navigation not applicable (mobile-only)
- Reduce Motion: respect system setting for animations (spinner, transitions)

## Out of Scope

- Tablet/iPad layout optimization
- Web version
- Cloud sync / backup
- Social features (sharing sermons with others)
- Sermon series linking
- Voice commands during recording
- Statistics dashboard
- Custom theme colors beyond light/dark
- Offline-first mode (recording requires API for transcription)
- Multi-language UI (English only)
