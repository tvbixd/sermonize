# Information Architecture: Sermonize

## Site Map

- Welcome `/` (onboarding, shown only when no API key)
- Folders `/folders` (home screen)
  - Sermons `/sermons` (all sermons, flat list)
  - Sermons `/sermons?folderId=X` (filtered by folder)
  - Sermons `/sermons?isDrafts=true` (drafts view)
  - Sermons `/sermons?isDeleted=true` (trash view)
  - Sermon Detail `/sermon/[id]` (view/edit a sermon)
- Record `/record` (recording + processing flow)
- Settings `/settings` (modal: API key, translation, about)

## Navigation Model

- **Primary navigation**: Folders screen is the persistent home. All paths return here. Record FAB is always visible on this screen for one-tap access to the core action.
- **Secondary navigation**: Within sermon detail, a segmented tab bar switches between Outline, Scriptures, and Transcript. Within sermons list, search bar filters inline.
- **Utility navigation**: Settings gear icon (top-right of folders screen). Opens as a modal overlay, dismisses back to previous screen.
- **Mobile navigation**: Stack-based (expo-router Stack). No bottom tab bar. Each screen has a custom nav bar with back chevron + title + right action. Modals slide up (settings, folder create/edit, context menus).

### Navigation depth
Maximum 3 taps to any content: Folders → Sermons → Sermon Detail. Recording is 1 tap from home (FAB → Record screen).

## Content Hierarchy

### Folders (Home)
1. **Record FAB** -- The most important action, always visible and prominent
2. **All Sermons row** -- Quick access to everything, shows total count
3. **My Folders** -- User-created organization, grows over time
4. **System folders** (Drafts, Recently Deleted) -- Maintenance, low frequency
5. **Welcome card** (empty state only) -- Guides new users, disappears after first sermon
6. **New Folder button** -- Secondary action in bottom toolbar
7. **Settings gear** -- Utility, top-right

### Sermons List
1. **Search bar** -- Fast filtering when list grows
2. **Pinned sermons** -- User's favorites, always at top
3. **Recent sermons** (Today, Previous 7 Days) -- Chronological groups
4. **Earlier sermons** -- Scrollable history
5. **Record FAB** -- Always accessible
6. **Empty state** -- Guidance when folder has no sermons

### Sermon Detail
1. **Title** -- Identifies the sermon
2. **Summary card** (NEW) -- Theme + summary + key scriptures at a glance. Visible without scrolling.
3. **Metadata row** -- Date, duration, play button
4. **Tab bar** -- Outline / Scriptures / Transcript
5. **Tab content** -- Full detail per tab
6. **Footer actions** -- Regenerate, Export

### Record Screen
1. **Timer** -- Elapsed time, always visible
2. **Status indicator** -- Recording / Paused / Processing
3. **Record button** -- Central, large, unmissable
4. **Live panels** -- Transcript + outline as they generate
5. **Bottom bar** -- Stop & Save / Discard

### Settings (Modal)
1. **Groq API Key** -- Primary setup requirement, with validation
2. **Bible Translation** -- Secondary preference
3. **About** -- Version info, low priority

## User Flows

### First-time user setup
1. User opens app, sees Welcome screen (no API key detected)
2. User taps "Set Up API Key" → Settings modal opens
3. User enters Groq key → taps Done
4. App validates key with test API call
   - If valid → success indicator, modal closes, redirects to Folders
   - If invalid → error message shown inline, user corrects
5. User lands on Folders screen with welcome card ("Record your first sermon")

### Record a sermon (primary flow)
1. User is on Folders screen
2. User taps Record FAB → navigates to Record screen
3. User taps record button → recording starts, timer runs
4. User taps record button again → paused (can resume)
5. User taps "Stop & Save" → processing begins (outline → scriptures → save)
6. Processing completes → auto-navigate to Sermon Detail
7. Summary card shows theme + key points + top scriptures immediately

### Review a sermon
1. User opens Folders → taps folder or "All Sermons"
2. User sees sermon list, optionally searches
3. User taps a sermon → Sermon Detail opens
4. Summary card visible immediately (theme, summary, scriptures)
5. User taps tabs to dive deeper: full Outline, all Scriptures, raw Transcript
6. User can tap Play to listen to audio

### Discard / save draft
1. User is recording, taps "Discard"
2. Alert offers: Keep Recording / Save as Draft / Discard
   - Save as Draft → sermon saved with isDraft=true → appears in Drafts folder
   - Discard → audio deleted, session reset, back to previous screen

### Organize sermons
1. User long-presses a sermon in list → context menu appears
2. User taps "Move to Folder" → folder picker shows
3. User selects target folder → sermon moved, sheet closes

### Delete and restore
1. User long-presses sermon → taps Delete → soft-deleted (moved to trash)
2. In Recently Deleted, user taps Restore → sermon returns to original location
3. After 30 days, trash items auto-purge permanently

## Naming Conventions

| Concept | Label in UI | Notes |
|---------|-------------|-------|
| Audio recording of a sermon | Sermon | Not "recording" or "note" — the output is the sermon itself |
| AI-generated structure | Outline | Not "notes" or "summary" — matches the church bulletin convention |
| Individual outline item | Point | Not "section" or "heading" — matches preaching terminology |
| Bible verse reference | Scripture | Not "verse" or "reference" — warmer, faith-aligned |
| Organizational group | Folder | Familiar iOS metaphor |
| Unfinished recording | Draft | Standard convention |
| Removed item | Recently Deleted | Matches iOS Files app language |
| AI reprocessing | Regenerate | Clear action verb |
| File output | Export | Standard |

## Component Reuse Map

| Component | Used on | Behavior differences |
|-----------|---------|---------------------|
| SafeAreaView + custom NavBar | All screens | Back chevron + title + right actions. Title and actions vary per screen. |
| Card (bgSurface, rounded) | Folders, Sermons, Sermon Detail | Same visual treatment, different content |
| Bottom sheet (Modal) | Sermons (context menu, folder picker), Folders (create/edit) | Same overlay + sheet pattern, different content |
| TextInput (styled) | Settings, Sermon edit, Search, Folder create, Add scripture | Same visual style everywhere |
| TouchableOpacity row | Folders, Sermons, Settings | Same tap feedback, different row content |
| FAB (record button) | Folders (NEW), Sermons | Same red mic button, bottom-right position |

## Content Growth Plan

- **Sermons**: Primary growing content. Managed by date-grouped list with search. Pinning surfaces favorites. Folders provide manual organization. Trash auto-purges after 30 days.
- **Folders**: User-created, typically small count (3-10). Shown in a single scrollable card.
- **Scriptures per sermon**: Varies (0-20). Scrollable list within Scripture tab.
- **Drafts**: Temporary, expected to be finished or deleted. No pagination needed.

## URL Strategy

- Pattern: `/[screen]` for top-level, `/sermon/[id]` for detail
- Dynamic segments: `[id]` for sermon detail (UUID)
- Query parameters: `folderId`, `folderName` for filtered views; `isDrafts`, `isDeleted` for special views
- Modal: `/settings` uses `presentation: 'modal'` (overlays current screen)
