# SpotiMix — Roadmap

A phased plan for evolving SpotiMix from a playlist generator into a standalone music discovery app.

---

## Phase 1: Genre Tag Browser ✅ **SHIPPED**

- "Browse genres" toggle as alternative entry point
- Multi-genre selection (up to 3 tags)
- Last.fm tag discovery → Spotify artist lookup
- Clickable context tags in "About this mix" panel

---

## Phase 2: Smart Suggest (Tag-Based 3rd Artist) ✅ **SHIPPED**

- "Suggest from:" bar appears when 1–2 artists selected with empty slots
- Fetches and ranks tags from selected artists (shared tags first)
- Click a tag → Last.fm top artists → Spotify lookup → fills next empty slot
- Filters out already-selected artists
- Refreshes suggestions as artists are added/removed

---

## Phase 3: Mood Presets ✅ **SHIPPED**

- 10 curated mood cards: Melancholy, Late Night, Sunday Morning, Raw Energy, Dreamy, Soul Kitchen, Deep Focus, Midnight Jazz, Headbanger, Tropicália
- Each mood maps to 2–3 Last.fm tags + auto-sets track mode
- One click: sets mode → selects tags → finds artists → fills slots

---

## Phase 4: Tag Mix / Genre Radio ✅ **SHIPPED**

- Tag Mix: parallel mix creation flow independent from Artist Mix
- Tracks fetched directly from `tag.getTopTracks` per selected tag
- Mood presets generate Tag Mix directly (no artist slot step)
- Tracks-per-tag slider (1–10)
- "Find artists instead" option preserved for artist-based flow
- Tag-specific liner notes with dedicated template pool

---

## Phase 5: Embedded Player ✅ **SHIPPED**

- Spotify Web Playback SDK creates a Connect device in the browser
- Audio streams directly in-tab (no external Spotify app needed on desktop)
- Player bar: album art, track/artist, prev/play-pause/next, seekable progress, volume
- SDK `player_state_changed` events replace polling (real-time updates)
- Automatic remote-control fallback for mobile/unsupported browsers
- Progress bar animated smoothly via `requestAnimationFrame`
- `streaming` scope added to OAuth

---

## Phase 6: Cloud-Synced Combos (Supabase) ✅ **SHIPPED**

- Saved artist combos sync across devices via Supabase, keyed by Spotify user ID
- Supabase JS client loaded from CDN (UMD), initialized with project URL + anon key
- `user_combos` table: `spotify_id` (PK), `combos` (JSONB), `updated_at` (TIMESTAMPTZ)
- On login: fetch cloud combos, merge with localStorage (dedup by artist names), push merged result back
- On save/delete: localStorage first (instant), Supabase async (fire-and-forget)
- `syncInProgress` guard prevents race conditions; `pendingSync` flag catches writes during merge
- Offline-resilient: if Supabase is unreachable, app works from localStorage only
- First-time migration automatic: existing local combos pushed to cloud on first login

---

## Design Principles

- **Tags as the connective tissue** — they're what makes "David Bowie + Nick Cave" make sense (shared: art rock, post-punk) and what makes the suggestion of a 3rd artist feel natural
- **Progressive disclosure** — the genre browser is an entry point, not a replacement. Artist search stays for users who know what they want
- **Last.fm is the brain** — all tag intelligence comes from community-driven Last.fm data, no AI API needed
- **Each phase builds on the last** — tag fetching, artist-from-tag logic, and UI patterns are reused across phases
- **Play everywhere** — embedded player for the full experience, remote control as a reliable fallback

---

## Bug fixes & polish (ongoing)

- Fix SDK playback skipping/muting (monitor `authentication_error`, test token refresh cycle)
- Verify heart/like works after re-auth with new scopes
- Test mobile responsive layout end-to-end (post-login viewport, player bar wrapping)

---

## Phase 7: UX improvements

**Goal:** Small touches that make the app feel more polished.

- Liked songs heart animation (brief scale pulse on toggle)
- Loading skeleton for genre grid while tags load
- "Now playing" mini-indicator in browser tab title (`♫ Track — Artist | SpotiMix`)
- Reshuffle button should also work for Tag Mix results

---

## Phase 8: Share Mix via URL

**Goal:** Users can share a generated mix via a URL. Recipients open the link, log in, and get the same mix auto-generated.

- Share button in results area (alongside Save/Queue/Reshuffle)
- URL query params encode artist names (or genre tags), track mode, tracks-per-artist/tag
- `sessionStorage` bridges share params through OAuth redirect (for not-yet-logged-in recipients)
- Native share sheet on mobile (`navigator.share`), clipboard copy on desktop
- Auto-generate on load when `auto=1` param present; otherwise pre-fill slots only
- No backend, no database — pure URL encoding

---

## Phase 9: Hybrid Track Sourcing ✅ **SHIPPED**

**Goal:** Fresher mixes by blending Last.fm catalog depth with Spotify's current popularity data.

**Problem:** Last.fm `artist.getTopTracks` ranks by all-time scrobble count (20+ years of data). Newer singles can't compete with catalog classics, so mixes feel skewed toward older material.

**Solution:** Last.fm stays as the discovery brain (tags, similar artists, genre connections). Track selection for Top Hits, Mix, and Discovery modes now uses Spotify search, which ranks by current streaming popularity.

Note: `GET /artists/{id}/top-tracks` was removed in the February 2026 Spotify API update. Track sourcing uses `GET /search?type=track&q=artist:{name}&limit=10` instead, which returns relevance/popularity-ranked tracks and is not affected by the removal.

**How track modes changed:**

| Mode | Before (Last.fm only) | After (hybrid) |
|------|----------------------|----------------|
| Top Hits | Last.fm ranks 1–10 by all-time scrobbles | Spotify search — current popularity |
| Deep Cuts | Last.fm ranks 11–50 | Unchanged — catalog deep pulls are the point |
| Mix | Half top, half deep from Last.fm | Half Spotify top + half Last.fm deep cuts |
| Discovery | Similar artists' Last.fm top tracks | Main artists + similar artists via Spotify search |

**What stayed the same:** `matchToSpotify()` (used only for Last.fm-sourced tracks), `interleaveShuffle()`, all playback, liked songs, Smart Suggest, mood presets, genre browser, Tag Mix, liner notes

---

## Phase 10: Future features to consider

**Ideas for future sessions — not committed, open to discussion.**

- **Last.fm scrobbling** — requires Last.fm OAuth (separate auth flow), would record plays to user's Last.fm profile
- **Playlist artwork generation** — collage from album arts of the tracks in the mix
- **Queue management** — reorder tracks, remove individual tracks before playing

---

*Built with [Claude](https://claude.ai) by Anthropic*
