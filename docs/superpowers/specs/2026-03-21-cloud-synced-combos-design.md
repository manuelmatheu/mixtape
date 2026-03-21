# Phase 6: Cloud-Synced Combos — Design Spec

## Goal

Saved artist combos persist across devices and sessions, tied to the user's Spotify account. localStorage remains the primary read source for speed; Supabase is the sync layer.

## Decisions

- **Storage:** Supabase (free tier), no backend needed
- **Auth:** Use Spotify `userId` (already available from `/me`) as row key — no Supabase Auth
- **RLS:** Disabled — data is non-sensitive (artist names/images only)
- **Scope:** Artist combos only — Tag Mix combos not included
- **Conflict resolution:** Merge + deduplicate (union of local and cloud, dedup by `comboKey()`)
- **Error handling:** Silent — log warnings, never surface Supabase failures to the user

## Supabase Config

- **Project URL:** `https://mhzfuamvkbuwlyahaqna.supabase.co`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oemZ1YW12a2J1d2x5YWhhcW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTg2MjIsImV4cCI6MjA4OTU5NDYyMn0.JHWCb_-vxvXQP7YCpjGhSVejo8vH2qWKUyOe8Tf8VaU`
  - Public, safe to commit (same risk profile as Last.fm API key)

### Table schema

```
user_combos
  spotify_id  TEXT PRIMARY KEY    -- from Spotify /me endpoint
  combos      JSONB               -- [{artists: [{name, image, sub}, ...]}, ...]
  updated_at  TIMESTAMPTZ         -- set client-side on every upsert
```

`updated_at` is set by the client via `new Date().toISOString()` in the upsert payload. No database trigger needed.

## Architecture

### New file: `js/supabase.js`

Loaded via `<script>` tag (UMD build from CDN sets `window.supabase` globally — consistent with how the Spotify SDK is loaded). No dynamic `import()`.

**CDN URL:** `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`

Exposes three global functions:

- **`fetchCloudCombos(spotifyId)`** — SELECT combos from `user_combos` where `spotify_id` matches. Returns array or `[]`.
- **`upsertCloudCombos(spotifyId, combos)`** — UPSERT full combos array with `updated_at: new Date().toISOString()`. Guards on `userId && cloudSyncReady` before making the call.
- **`mergeAndSync(spotifyId, localCombos)`** — Sets `syncInProgress = true`. Fetches cloud combos, merges with local (dedup by `comboKey()`), writes merged result to both Supabase and localStorage, updates `savedCombos`, calls `renderCombos()`. Sets `syncInProgress = false` when done.

Initialization: `supabase.js` creates the client at load time using `window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)` and sets `cloudSyncReady = true`. If the CDN fails to load, `cloudSyncReady` remains `false` and all sync functions are no-ops.

**Dependency note:** `supabase.js` depends on `config.js` globals (`SUPABASE_URL`, `SUPABASE_ANON`, `cloudSyncReady`). It also references `comboKey()`, `savedCombos`, `renderCombos()`, and `persistCombos()` from `ui.js`, but only at call time (invoked from `init()` after all scripts have loaded), not at load time.

### Script load order

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="js/config.js"></script>
<script src="js/spotify.js"></script>
<script src="js/lastfm.js"></script>
<script src="js/supabase.js"></script>   <!-- new -->
<script src="js/player.js"></script>
<script src="js/ui.js"></script>
```

The Supabase UMD script loads before `supabase.js` so `window.supabase` is available at init time.

### Config additions (`js/config.js`)

```js
const SUPABASE_URL  = 'https://mhzfuamvkbuwlyahaqna.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIs...'; // full anon key
let cloudSyncReady  = false;
let syncInProgress  = false;
```

### Changes to `ui.js`

Two touch points only:

1. **Init flow** — call `mergeAndSync(userId, savedCombos)` after `userId` is set in **both** branches: the direct-auth path (after `exchangeCode`) and the token-refresh path (after `refreshAccessToken`). Both call `loadCombos()` first, then `mergeAndSync()` async.

2. **`persistCombos()`** — after writing to localStorage, fire-and-forget `upsertCloudCombos(userId, savedCombos)` only if `!syncInProgress` (avoids race condition where a save during merge overwrites the merge result with stale data).

No changes to `saveCombo()`, `removeCombo()`, `loadCombo()`, or `renderCombos()` — they already go through `persistCombos()`.

## Sync flows

### On login

```
Spotify login succeeds -> userId set
  -> loadCombos()                    // read localStorage
  -> mergeAndSync(userId)            // async, non-blocking
      -> syncInProgress = true
      -> fetchCloudCombos(userId)
      -> merge local + cloud (dedup by comboKey)
      -> upsertCloudCombos(userId, merged)
      -> localStorage.setItem(merged)
      -> savedCombos = merged
      -> renderCombos()
      -> syncInProgress = false
```

### On save/remove

```
saveCombo() or removeCombo()
  -> persistCombos()
      -> localStorage.setItem(savedCombos)                   // instant
      -> if (!syncInProgress && userId && cloudSyncReady)
           upsertCloudCombos(userId, savedCombos)             // async, fire-and-forget
```

### First-time migration

User has combos in localStorage but nothing in Supabase. `mergeAndSync` pushes local combos to cloud automatically. No special migration code needed.

## Error handling

All Supabase failures are silent:

- `fetchCloudCombos` fails: log warning, continue with localStorage only
- `upsertCloudCombos` fails: log warning, localStorage already has the data
- `mergeAndSync` fails: log warning, set `syncInProgress = false`, combos work from localStorage
- No toasts, no error UI — Supabase is invisible to the user when down

## Known limitations

- **Delete propagation:** Removing a combo on Device A may reappear after syncing from Device B (which still has it). The merge strategy is union-based and cannot distinguish "never existed" from "was deleted." Workaround: delete the combo again after sync. Acceptable for v1.
- **Concurrent tabs:** Two tabs saving combos simultaneously may overwrite each other's cloud state. Next login reconciles via merge.
- **No combos limit:** The JSONB column can grow unbounded. Not a practical concern at current scale.

## What's NOT in scope

- Tag Mix combo syncing
- Supabase Auth integration
- Row Level Security policies
- Offline queue / retry logic (next login reconciles naturally)
- UI indicators for sync status
- Cross-tab sync via `storage` events
