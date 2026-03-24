# SpotiMix 🎶

A single-page web app that blends tracks from artists, genres, and moods into shuffled Spotify playlists. Two ways to mix: pick artists manually, or let genre tags and mood presets build it for you. Artist discovery powered by Last.fm, playback and playlists via Spotify Web API, with an embedded in-browser player.

**Live app → [spotimix-app.vercel.app](https://spotimix-app.vercel.app/)**

---

## How it works

### Artist Mix
1. Search for up to 3 artists via Spotify
2. Use **Smart Suggest** — genre tags and similar artists auto-fill remaining slots
3. Choose a track mode: **Top Hits**, **Deep Cuts**, **Mix**, or **Discovery**
4. Hit **Generate SpotiMix** — Last.fm fetches tracks, Spotify matches and plays them

### Tag Mix
1. Switch to **Browse genres** tab
2. Pick a **mood preset** (Melancholy, Late Night, Dreamy, etc.) or select up to 3 genre tags
3. Hit **Generate Tag Mix** — tracks sourced directly from Last.fm tags, matched on Spotify
4. No artist selection needed — the genre defines the mix

### Both flows share
- Embedded in-browser player with album art, controls, seekable progress bar
- Click any track to play from that point
- Save to Spotify playlist or add to queue
- Heart/like button saves tracks to Spotify Liked Songs
- "About this mix" liner notes with genre tag chips
- Interleave shuffle (no consecutive same-artist tracks)
- Save artist combos for quick recall

### Track modes (Artist Mix)

| Mode | Source |
|------|--------|
| Top Hits | Spotify search — current popularity-ranked tracks |
| Deep Cuts | Last.fm ranks 11–50 by scrobble count |
| Mix | Half Spotify top tracks + half Last.fm deep cuts |
| Discovery | Your artists' top tracks + 2 tracks each from similar artists |

### Mood presets (Tag Mix)

| Mood | Tags | Auto-mode |
|------|------|-----------|
| 🌧 Melancholy | sad, melancholy, ambient | Deep Cuts |
| 🌙 Late Night | electronic, chillwave, synthwave | Mix |
| ☀️ Sunday Morning | acoustic, folk, singer-songwriter | Top Hits |
| ⚡ Raw Energy | punk, garage rock, post-punk | Top Hits |
| 💭 Dreamy | shoegaze, dream pop, ethereal | Deep Cuts |
| 🎷 Soul Kitchen | soul, funk, rnb | Mix |
| 🎧 Deep Focus | post-rock, minimal, instrumental | Deep Cuts |
| 🍷 Midnight Jazz | jazz, smooth jazz, bossa nova | Mix |
| 🤘 Headbanger | metal, heavy metal, thrash metal | Top Hits |
| 🌴 Tropicália | latin, bossa nova, tropicalia | Mix |

---

## File structure

```
SpotiMix/
├── index.html        — HTML structure + player bar
├── css/
│   └── style.css     — All styles (dark/light theme, player bar, responsive)
└── js/
    ├── config.js     — API keys, scopes, shared state, SDK state
    ├── spotify.js    — Auth, refresh tokens, Spotify API, SDK init, playback
    ├── lastfm.js     — Last.fm tracks, tags, similar artists, Spotify matching
    ├── player.js     — SDK player, polling fallback, player bar, like/unlike
    └── ui.js         — Search, genres, moods, combos, suggest, generate, render
```

---

## Stack

- **Vanilla HTML/JS** — no framework, no build step
- **Spotify Web API** — PKCE OAuth, search, playback, playlist creation, liked songs
- **Spotify Web Playback SDK** — in-browser audio streaming
- **Last.fm API** — artist top tracks, similar artists, genre tags, bios, tag top tracks
- **Vercel** — production hosting (auto-deploys from GitHub)

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `?` | Show shortcuts help |
| `Esc` | Close any modal or dropdown |
| `G` | Generate mix |
| `S` | Save current combo |
| `D` | Toggle dark / light mode |
| `↑` `↓` | Navigate autocomplete |
| `Enter` | Select autocomplete result |

---

## Setup

### 1. Spotify app

- Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
- Create an app and select "Web Playback SDK" + "Web API"
- Add your deployment URL as a Redirect URI (e.g., `https://spotimix-app.vercel.app/`)
- Copy the Client ID

### 2. Configuration

Open `js/config.js` and update the two constants:

```js
const SPOTIFY_CLIENT_ID = 'your_spotify_client_id';
const LASTFM_API_KEY    = 'your_lastfm_api_key';
```

Get a free Last.fm API key at [last.fm/api](https://www.last.fm/api/account/create).

### 3. Deploy

Push to GitHub and connect to Vercel (or any static hosting). No build step needed.

---

## Notes

- Requires a **Spotify Premium** account for playback and the embedded player
- Deep Cuts quality depends on how well-scrobbled an artist is on Last.fm
- Embedded player streams audio in the browser tab (desktop). Mobile falls back to remote control.
- Spotify matching can occasionally miss tracks with non-standard characters; unmatched tracks are skipped with a warning

---

## Changelog

### v1.8
- Hybrid track sourcing: Top Hits and Discovery now pull from Spotify search (current popularity) instead of Last.fm all-time scrobbles — mixes feel fresher and more current
- Mix mode blends Spotify top tracks + Last.fm deep cuts in parallel
- Discovery mode: main artists' top tracks + 2 tracks each from similar artists (all via Spotify)

### v1.7
- Cloud-Synced Combos: saved artist combos persist across devices via Supabase
- Automatic merge + dedup on login (local + cloud)
- Offline-resilient: works from localStorage when Supabase is unreachable

### v1.6
- Heart/like button: save tracks to Spotify Liked Songs
- Hearts on both player bar (current track) and track list rows
- Batch-checks existing likes on render, toggles with visual feedback
- Retro SVG volume icon replacing emoji (matches transport controls)

### v1.5
- Embedded player: Spotify Web Playback SDK streams audio directly in-browser
- Persistent player bar: album art, track info, prev/play/next, seekable progress, volume
- Real-time track updates via SDK events (replaces 5s polling when active)
- Automatic remote-control fallback when SDK unavailable (mobile, ad blockers)

### v1.4
- Tag Mix: parallel mix creation flow — pick genres or moods, generate directly from tags
- Tracks sourced from Last.fm `tag.getTopTracks`, matched on Spotify
- Tracks-per-tag slider (1–10)
- Mood presets generate Tag Mix directly (skip artist slot step)
- Tag-specific liner notes with dedicated template pool

### v1.3
- Mood Presets: 10 one-click mood cards
- Each mood maps to 2–3 Last.fm tags and auto-sets track mode
- Smart Suggest includes similar artists alongside genre tags

### v1.2
- Smart Suggest: pick 1–2 artists, see genre tags and similar artists, click to auto-fill
- Liner notes rewritten with template pool system (150+ unique combinations)

### v1.1
- Genre tag browser as alternative entry point
- Multi-genre selection with Spotify artist lookup
- Clickable context tags, interleave shuffle, refresh token support

### v1.0
- "About this mix" liner notes panel, dark/light theme, persistent login, mobile responsive

### v0.1–v0.9
- Core features: Spotify PKCE OAuth, artist search, Top/Deep/Mix/Discovery modes, shuffled playlists, save to Spotify, add to queue, now-playing highlight, saved combos, keyboard shortcuts

---

Built with ❤ by Manuel Matheu with [Claude](https://claude.ai) by Anthropic
