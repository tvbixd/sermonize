# Build Tasks: Sermonize UX Improvement

Generated from: .design/sermonize-ux-improvement/DESIGN_BRIEF.md
Date: 2026-05-19

## Foundation

- [ ] **Extend theme tokens**: Add `statusSuccess`, `statusError`, `fabShadow`, and `motion` tokens to `src/theme.ts`. _Modifies: existing theme file. Already done in Phase 4._

## Core UI

- [ ] **Record FAB on folders screen**: Add a prominent floating red mic button (bottom-right) to `app/folders.tsx`. Uses `MicIcon`, `accentRed`, `fabShadow` token. Tapping navigates to `/record`. Button has drop shadow for elevation. _New component (inline). Reuses: MicIcon, radius.fab._

- [ ] **Welcome card (empty state)**: When sermon count is 0 on the folders screen, show a warm welcome card above the folder list. Card contains: mic icon, "Record your first sermon" heading, brief description, and a "Start Recording" button that navigates to `/record`. Card disappears once sermons exist. _New component (inline in folders.tsx). Reuses: Card style, accentRed, MicIcon._

- [ ] **Summary card on sermon detail**: Add a card above the tab bar in `app/sermon/[id].tsx` that shows: sermon theme (italic), summary text (2-3 lines), and up to 3 scripture reference pills. Visible in both view and edit modes. Only shown if outline has theme or summary content. _New component (inline). Reuses: Card style, refTag style, typography.subhead._

## Interactions & States

- [ ] **API key validation in settings**: When user taps Save/Done in `app/settings.tsx`, make a lightweight Groq API test call (e.g., list models or a tiny completion). Show inline status: spinner while testing, green checkmark + "Key valid" on success, red X + "Invalid key" on failure. Still saves the key either way (user may be offline). _Modifies: settings.tsx. New: validation logic + status UI. Uses: statusSuccess, statusError tokens._

- [ ] **Validation feedback animation**: The success/error indicator fades in smoothly using `motion.fast` (150ms). Checkmark is green (`statusSuccess`), error X is red (`statusError`). _Part of settings validation task._

## Polish

- [ ] **FAB shadow and press feedback**: Record FAB has a colored shadow (`fabShadow` token) and scales down slightly on press (activeOpacity + transform). Shadow uses the warm red tint to ground the button visually. _Part of Record FAB task._

- [ ] **Welcome card dismiss**: Welcome card hides with no animation when sermon count > 0. No need for explicit dismiss — it's data-driven. _Part of welcome card task._

## Review

- [ ] **Design review**: Run /design-review against the brief to validate all changes match intent.
