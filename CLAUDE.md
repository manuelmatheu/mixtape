# CLAUDE.md — SpotiMix Development Guide

## What is SpotiMix?

SpotiMix is a single-page web app that generates Spotify playlists by blending tracks from artists, genres, and moods. It uses Last.fm for music discovery (tags, similar artists, track data) and the Spotify Web API + Web Playback SDK for authentication, search, playback, and playlist management. There is no backend — everything runs client-side, deployed as static files on Vercel.

**Live:** https://spotimix-app.vercel.app/
**Repo:** https://github.com/manuelmatheu/SpotiMix
**GitHub Pages (legacy):** https://manuelmatheu.github.io/SpotiMix/

---

## Architecture

### File structure

```
SpotiMix/
├── index.html        — HTML structure, player bar, modals (changelog, save, shortcuts)
├── CLAUDE.md         — This file
├── README.md         — User-facing docs
├── ROADMAP.md        — Feature roadmap with shipped/planned phases
├── css/
│   └── style.css     — All styles: dark/light theme via CSS vars, player bar, responsive
└── js/
    ├── config.js     — API keys, OAuth scopes, all global state variables
    ├── spotify.js    — PKCE OAuth, token refresh, Spotify API helpers, SDK init, remote controls
    ├── lastfm.js     — All Last.fm API calls: tracks, tags, similar artists, bios, matching
    ├── supabase.js   — Supabase client init, cloud combo sync (fetch, upsert, merge)
    ├── player.js     — SDK event handling, polling fallback, player bar UI, playback controls, liked songs
    └── ui.js         — The big one: search, slots, combos, genres, moods, suggest, generate, results, narrative
```

### Script load order (matters — no modules)

```html
<script src="https://sdk.scdn.co/spotify-player.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="js/config.js"></script>     <!-- globals first -->
<script src="js/spotify.js"></script>    <!-- auth + API helpers -->
<script src="js/lastfm.js"></script>    <!-- Last.fm API -->
<script src="js/supabase.js"></script>  <!-- cloud sync -->
<script src="js/player.js"></script>    <!-- playback + player bar -->
<script src="js/ui.js"></script>        <!-- everything else + init() -->
```

All functions and variables are global. No modules, no build step, no bundler.

### Theme system

CSS variables in `:root` (light) and `[data-theme="dark"]` (dark). Theme toggle stored in `localStorage('mixtape_theme')`. The toggle script runs inline before other JS to prevent flash.

Key semantic vars: `--bg`, `--fg`, `--surface`, `--border`, `--border-s`, `--tape-bg`, `--rust`, `--gold`, `--sage`, `--card-shadow`, `--input-bg`, `--num-bg`, `--error-bg`.

---

## Two independent mix flows

### Artist Mix (Search artists tab)
1. User searches Spotify for up to 3 artists → fills `artists[0..2]`
2. Smart Suggest shows similar artists + genre tags to auto-fill remaining slots
3. User picks track mode: `top`, `deep`, `mix`, `discovery`
4. `generate()` → `getTracksForArtist()` per artist → `matchToSpotify()` → `interleaveShuffle()` → `renderResults()` → `autoPlay()`

### Tag Mix (Browse genres tab)
1. User clicks mood preset or selects 1–3 genre tags
2. `generateTagMix()` → `getTopTracksForTag()` per tag → `matchToSpotify()` → `interleaveShuffle()` → `renderResults()` → `autoPlay()`
3. Never touches `artists[]` — completely independent

Both flows share: `matchToSpotify()`, `interleaveShuffle()`, `renderResults()`, `playFromTrack()`, `autoPlay()`, save playlist, add to queue, liked songs.

---

## Spotify integration

### OAuth (PKCE, no backend)
- `startAuth()` → redirects to Spotify with code challenge
- `exchangeCode(code)` → exchanges for access + refresh tokens
- Tokens stored in `localStorage` (`spotify_token`, `spotify_refresh`)
- `refreshAccessToken()` → uses refresh token to get new access token silently
- `spGet(path)` → auto-retries with token refresh on 401

### Scopes
```
user-read-private, user-read-email,
user-modify-playback-state, user-read-playback-state, user-read-currently-playing,
playlist-modify-public, playlist-modify-private,
streaming, user-library-modify, user-library-read
```
**Any scope change requires users to disconnect and reconnect Spotify.**

### Web Playback SDK
- Loaded from `https://sdk.scdn.co/spotify-player.js`
- `initSDKPlayer()` creates a Spotify Connect device named "SpotiMix"
- `onSpotifyWebPlaybackSDKReady` callback initializes after SDK loads
- `player_state_changed` events drive real-time player bar updates + track highlighting
- `getOAuthToken` callback provides current `accessToken`; on `authentication_error`, refreshes token and reconnects
- `spotifyPlay(uris)` prefers SDK device when `sdkReady`, falls back to remote control

### Playback device targeting
- Always transfer playback to target device before sending play command
- SDK device: transfer → 300ms delay → play with `device_id`
- Remote: find active device → transfer if needed → play with `device_id`
- URIs capped at 100 per play call (Spotify API limit)

### Liked Songs
- `checkLikedTracks()` — batch-checks via `GET /me/tracks/contains` (50 IDs per call)
- `toggleLikeTrack(idx)` — `PUT` or `DELETE` on `/me/tracks` with `{ ids: [id] }` body
- Heart icons on track rows (`heart-{i}`) and player bar (`pb-heart`)
- `likedSet` (Set of track IDs) tracks liked state client-side
- `updatePlayerBarHeart()` called on track change via `highlightNowPlaying()`

---

## Last.fm integration

### API key (read-only, no user auth)
- Key: `177b9e8ee70fe2325bfff606cfdaee23`
- All calls go through `lfm(params)` helper which adds key + format

### Endpoints used
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getTracksForArtist()` | `artist.getTopTracks` | Artist Mix track sourcing |
| `getSimilarArtists()` | `artist.getSimilar` | Discovery mode + Smart Suggest |
| `getTopTags()` | `tag.getTopTags` | Genre browser (cached) |
| `getTopArtistsForTag()` | `tag.getTopArtists` | Genre → artist resolution |
| `getTopTracksForTag()` | `tag.getTopTracks` | Tag Mix track sourcing |
| `getArtistTags()` | `artist.getTopTags` | Smart Suggest + liner notes |
| `getArtistInfo()` | `artist.getInfo` | Bio snippets for liner notes |
| `matchToSpotify()` | (uses Spotify search) | Matches Last.fm tracks to Spotify URIs |

### matchToSpotify() pattern
- Searches Spotify with `track:{name} artist:{artist}` query
- Prefers exact artist name match, falls back to first result
- Returns `{ uri, name, artist, duration, albumArt, _type, _playcount }`
- Returns `null` if no match (track skipped)

---

## Key UI components

### Player bar (`#player-bar`)
- Fixed bottom position, hidden until first playback
- Shows: album art, track name/artist, heart, prev/play-pause/next, progress bar, volume
- Populated by SDK `player_state_changed` events OR `pollNowPlaying()` (remote fallback)
- Progress animated via `requestAnimationFrame` between state updates
- `body.has-player` class adds bottom padding

### Smart Suggest (`#suggest-bar`)
- Appears when 1–2 artists selected with empty slots
- Fetches similar artists + genre tags in parallel
- Similar artists shown as rust-colored `.artist-suggest` chips (one-click fill)
- Genre tags shown as default chips (tag → artist → Spotify lookup)
- `suggestAbort` counter prevents stale results
- Refreshes on every artist add/remove

### Liner notes (`#mix-context`)
- Collapsible "About this mix" panel
- Artist Mix: `generateContext()` → `buildNarrative()` — template pool with ~150+ combinations
- Tag Mix: `generateTagContext()` → `buildTagNarrative()` — separate template pool
- Genre tags shown as clickable chips (click → opens genre browser with that tag)
- Templates randomized at 3 layers: opening (artist/tag connection), mode color, closing

### Saved combos
- `savedCombos` array in `localStorage('mixtape_combos')`
- Compact cards with overlapping avatars below artist grid
- Deduplicated by artist names (order-independent)
- `loadCombo(idx)` fills artist slots + triggers suggest update

---

## Important patterns and gotchas

### Spotify API quirks
- Use `/v1/me/playlists` (not `/v1/users/{id}/playlists`) to avoid 403 in Development Mode
- `PUT /me/player/play` with `uris` array — pass all URIs directly, don't queue separately
- `transferPlayback()` with ~300-800ms delay before retrying play on idle devices
- Refresh tokens: Spotify may return a new refresh token — always store it
- SDK `getOAuthToken` is called periodically — must provide current token, not stale one

### interleaveShuffle()
- Groups tracks by artist, shuffles within groups
- Round-robin picks with randomized group order each round
- Final pass swaps any remaining adjacent same-artist pairs
- Used for both Artist Mix and Tag Mix generation + reshuffle

### State scoping
- `artists[]` — only touched by Artist Mix flow, never by Tag Mix
- `generatedTracks` — shared output, overwritten by whichever flow runs
- `selectedGenres` (Set) — cleared after Tag Mix generation to prevent stale state
- `sessionQueue` (Set) — URIs sent to Spotify, used by polling to detect drift
- `sdkReady` / `sdkDeviceId` — SDK availability, checked before every play command

### GitHub push protection
- GitHub secret scanning auto-revokes API keys pushed to the repo
- Never hardcode Spotify/Anthropic/OpenAI keys in source
- Current keys (Spotify Client ID, Last.fm API key) are non-secret (client-side app)
- Sensitive keys should use sessionStorage or environment variables

### Deployment
- **Vercel** (production): auto-deploys from `main` branch
- **GitHub Pages** (legacy): still active at `manuelmatheu.github.io/SpotiMix/`
- `REDIRECT_URI = window.location.origin + window.location.pathname` — adapts to any domain
- Must add each deployment URL as redirect URI in Spotify Developer Dashboard
- Hard refresh (Cmd+Shift+R) needed on mobile to see changes after deploy

### Git workflow
- Single `main` branch, direct pushes
- Git config: `user.email=claude@anthropic.com`, `user.name=Claude`
- Remote uses PAT in URL: `https://x-access-token:{PAT}@github.com/manuelmatheu/SpotiMix.git`
- PAT may need updating after expiry
- Always `node -c file.js` syntax-check before committing

### CSS conventions
- All colors via CSS variables (never hardcode hex in rules)
- Dark mode: `[data-theme="dark"]` selector overrides
- Mobile: single `@media (max-width: 580px)` breakpoint
- `overflow-x: hidden` on both `html` and `body` (mobile Safari fix)
- Animations: `fadeIn` keyframe with staggered `animation-delay` for lists

---

## Current version: v1.8

### What's shipped
1. ✅ Genre Tag Browser — browse genres, multi-select, Spotify artist lookup
2. ✅ Smart Suggest — similar artists + genre tags auto-fill empty slots
3. ✅ Mood Presets — 10 one-click mood cards (Melancholy, Late Night, etc.)
4. ✅ Tag Mix — parallel genre-based mix flow, direct from tags
5. ✅ Embedded Player — Spotify Web Playback SDK with remote fallback
6. ✅ Liked Songs — heart/like on player bar + track rows
7. ✅ Cloud-Synced Combos — Supabase sync, merge+dedup, offline-resilient
8. ✅ Hybrid Track Sourcing — Top Hits/Mix/Discovery use Spotify search (current popularity); Deep Cuts unchanged

### What's next (see ROADMAP.md)
- **Phase 7:** UX improvements (heart animation, loading skeletons, tab title, Tag Mix reshuffle)
- **Phase 8:** Share Mix via URL

### Known issues / areas for improvement
- SDK playback: some tracks may skip or mute if token refresh timing is off — monitor `authentication_error` events
- Mobile: SDK not supported on all mobile browsers — remote fallback handles this but player bar updates are less smooth (5s polling)
- Liner notes: template pool is good but not AI-quality — Anthropic/OpenAI API integration was explored and deferred (see conversation history)
- `artists[]` is fixed at 3 slots — could be made dynamic
- No scrobbling to Last.fm (would require Last.fm user auth, separate OAuth flow)

---

## Quick reference: key functions

| Function | File | Purpose |
|----------|------|---------|
| `generate()` | ui.js | Artist Mix generation |
| `generateTagMix()` | ui.js | Tag Mix generation |
| `matchToSpotify(lfmTrack)` | lastfm.js | Last.fm → Spotify track matching |
| `interleaveShuffle(tracks)` | ui.js | Artist-separated shuffle |
| `playFromTrack(i)` | player.js | Start playback from track index |
| `spotifyPlay(uris)` | spotify.js | Play URIs (SDK or remote) |
| `initSDKPlayer()` | spotify.js | Initialize Web Playback SDK |
| `pollNowPlaying()` | player.js | Remote fallback: poll current track |
| `onSDKStateChange(state)` | player.js | SDK: handle state changes |
| `updateSuggest()` | ui.js | Refresh Smart Suggest chips |
| `applyMood(idx)` | ui.js | Apply mood preset → Tag Mix |
| `applyGenres()` | ui.js | Genre tags → find artists → fill slots |
| `buildNarrative()` | ui.js | Artist Mix liner notes (template pool) |
| `buildTagNarrative()` | ui.js | Tag Mix liner notes (template pool) |
| `checkLikedTracks()` | ui.js | Batch-check liked status for all tracks |
| `toggleLikeTrack(idx)` | ui.js | Like/unlike a track on Spotify |
| `savePlaylist()` | spotify.js | Save to Spotify playlist |
| `refreshAccessToken()` | spotify.js | Silent token refresh |

---

## Claude Code session plan

### Session 1: Bug fixes & polish ✅
- Fixed SDK token expiry playback loss (proactive refresh, retransfer)
- Fixed like button endpoints (Feb 2026 Spotify API: `/me/library` with URIs)
- Restored retro heart styling on player bar + track rows
- One-click Save to Spotify (auto-named playlists)

### Session 2: Phase 6 — Cloud-Synced Combos ✅
- Supabase project + `user_combos` table created
- `supabase.js`: client init, `fetchCloudCombos()`, `upsertCloudCombos()`, `mergeAndSync()`
- `persistCombos()` fires cloud upsert with `syncInProgress` + `pendingSync` guards
- `mergeAndSync` called in both init branches (direct auth + token refresh)
- Offline-resilient: silent failures, localStorage-only fallback
- Malformed cloud data filtering for robustness

### Session 3: Hybrid Track Sourcing (fresher mixes)

**Problem:** Tracks are sourced 100% from Last.fm `artist.getTopTracks`, which ranks by all-time scrobble count. Older catalog tracks with 20 years of scrobbles always outrank newer singles. Mixes feel skewed toward classic/older material.

**Solution:** Blend Last.fm (deep catalog) with Spotify (current popularity) for track selection. Last.fm stays as the discovery brain (tags, similar artists, bios).

**New function — `spotify.js`:**
- `getSpotifyTopTracks(artistName)` — searches Spotify for artist → gets Spotify artist ID → calls `GET /artists/{id}/top-tracks` → returns track objects in same shape as `matchToSpotify()` output (already have `uri`, `name`, `artist`, `albumArt`, `duration`)
- These are Spotify's own popularity-ranked tracks, factoring in recent streaming activity

**Modified function — `generate()` in `ui.js`:**
- For each artist, fetch from **both** sources in parallel:
  - Last.fm `artist.getTopTracks` (existing) — the deep catalog
  - Spotify `GET /artists/{id}/top-tracks` (new) — current popularity
- Merge and deduplicate by normalized track name
- Track mode controls the blend:
  - **Top Hits** → Spotify top tracks only (freshest, most streamed now)
  - **Deep Cuts** → Last.fm ranks 11–50 only (unchanged, catalog deep pulls)
  - **Mix** → half Spotify top, half Last.fm deep cuts
  - **Discovery** → similar artists' Spotify top tracks (instead of Last.fm top tracks)

**Modified function — `generateTagMix()` in `ui.js` (optional enhancement):**
- After fetching Last.fm `tag.getTopTracks`, identify top artists in the pool
- Also fetch their Spotify top tracks and blend into the pool
- Gives Tag Mix a fresher feel without changing the tag-based discovery

**What to store — `config.js` / artist objects:**
- When user selects an artist via search, the Spotify artist ID is already in the search result (`data.artists.items[0].id`)
- Store it in the artist object: `{ name, image, sub, spotifyId }`
- `selectArtist()` in ui.js already has access to this data — just add the field

**What stays the same:**
- `matchToSpotify()` — still used for Last.fm-sourced tracks that need URI matching
- `interleaveShuffle()`, `renderResults()`, playback, liked songs — unchanged
- Last.fm tags, similar artists, bios — still the discovery/context brain
- Smart Suggest, mood presets, genre browser — unchanged

**Files to modify:**
- `spotify.js` — add `getSpotifyTopTracks(artistName)`
- `ui.js` — modify `generate()` to blend sources based on mode
- `ui.js` — modify `selectArtist()` to store `spotifyId`
- `ui.js` — optionally modify `generateTagMix()` for fresher tag mixes

### Session 4: UX improvements
- Liked songs heart animation (brief scale pulse on toggle)
- Loading skeleton for genre grid while tags load
- "Now playing" mini-indicator in browser tab title (`♫ Track — Artist | SpotiMix`)
- Reshuffle button should also work for Tag Mix results

### Session 4: Future features to consider
- Last.fm scrobbling (requires Last.fm OAuth — separate auth flow)
- Playlist artwork generation (collage from album arts)
- Share a mix via URL (encode artist/tag names in query params)
- Queue management (reorder tracks, remove individual tracks)

---

*This file is for Claude Code / AI-assisted development. Keep it updated when making architectural changes.*
