// ── Now-playing poll (remote fallback) ────────────────────────────────────────
const POLL_INTERVAL = 5000;

let sessionQueue  = new Set();
let sessionPaused = false;

function registerUri(uri, index) {
  if (!uriToIndices[uri]) uriToIndices[uri] = [];
  if (!uriToIndices[uri].includes(index)) uriToIndices[uri].push(index);
}

function buildUriMap() {
  uriToIndices = {};
  generatedTracks.forEach((t, i) => registerUri(t.uri, i));
}

function startPolling() {
  if (sdkReady) return; // SDK handles updates via events
  stopPolling();
  pollTimer = setInterval(pollNowPlaying, POLL_INTERVAL);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  nowPlayingIndex = -1;
  stopProgressTimer();
}

async function pollNowPlaying() {
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (r.status === 204 || !r.ok) return;
    const data = await r.json();
    if (!data?.item) return;

    const playingUri = data.item.uri;

    // Session check
    if (sessionQueue.size > 0 && !sessionQueue.has(playingUri)) {
      if (!sessionPaused) {
        sessionPaused = true;
        highlightNowPlaying(-1);
      }
      return;
    }
    sessionPaused = false;

    // Update highlight
    if (uriToIndices[playingUri]) {
      const candidates = uriToIndices[playingUri];
      let best = candidates[0];
      for (const idx of candidates) {
        if (idx >= nowPlayingIndex) { best = idx; break; }
      }
      highlightNowPlaying(best);
    }

    // Update player bar from poll data (remote fallback)
    updatePlayerBarFromPoll(data);
  } catch { /* ignore transient errors */ }
}

function highlightNowPlaying(index) {
  if (index === nowPlayingIndex) return;
  document.querySelectorAll('.track-item.now-playing').forEach(r => r.classList.remove('now-playing'));
  if (index >= 0) {
    const row = document.getElementById('track-' + index);
    if (row) {
      row.classList.add('now-playing');
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  nowPlayingIndex = index;
}

// ── SDK state change handler ──────────────────────────────────────────────────
function onSDKStateChange(state) {
  if (!state) return;

  const track = state.track_window?.current_track;
  if (!track) return;
  const playingUri = track.uri;

  // Session check
  if (sessionQueue.size > 0 && !sessionQueue.has(playingUri)) {
    if (!sessionPaused) {
      sessionPaused = true;
      highlightNowPlaying(-1);
    }
    return;
  }
  sessionPaused = false;

  // Highlight track in list
  if (uriToIndices[playingUri]) {
    const candidates = uriToIndices[playingUri];
    let best = candidates[0];
    for (const idx of candidates) {
      if (idx >= nowPlayingIndex) { best = idx; break; }
    }
    highlightNowPlaying(best);
  }

  // Update player bar from SDK state
  updatePlayerBarFromSDK(state);
}

// ── Player bar UI ─────────────────────────────────────────────────────────────
let pbPlaying  = false;
let pbDuration = 0;
let pbPosition = 0;
let pbPosTime  = 0; // performance.now() when position was last set

function showPlayerBar() {
  const bar = document.getElementById('player-bar');
  if (bar) bar.classList.add('visible');
  document.body.classList.add('has-player');
}

function updatePlayerBarFromSDK(state) {
  const track = state.track_window?.current_track;
  if (!track) return;

  showPlayerBar();
  pbPlaying  = !state.paused;
  pbDuration = state.duration;
  pbPosition = state.position;
  pbPosTime  = performance.now();

  // Track info
  const art = document.getElementById('pb-art');
  const name = document.getElementById('pb-name');
  const artist = document.getElementById('pb-artist');
  const playBtn = document.getElementById('pb-play');

  if (art) art.src = track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '';
  if (name) name.textContent = track.name || '';
  if (artist) artist.textContent = track.artists?.map(a => a.name).join(', ') || '';
  if (playBtn) playBtn.textContent = pbPlaying ? '⏸' : '▶';

  updateProgressDisplay(pbPosition, pbDuration);
  if (pbPlaying) startProgressTimer(); else stopProgressTimer();
}

function updatePlayerBarFromPoll(data) {
  if (!data?.item) return;

  showPlayerBar();
  pbPlaying  = data.is_playing;
  pbDuration = data.item.duration_ms || 0;
  pbPosition = data.progress_ms || 0;
  pbPosTime  = performance.now();

  const art = document.getElementById('pb-art');
  const name = document.getElementById('pb-name');
  const artist = document.getElementById('pb-artist');
  const playBtn = document.getElementById('pb-play');

  if (art) art.src = data.item.album?.images?.[1]?.url || data.item.album?.images?.[0]?.url || '';
  if (name) name.textContent = data.item.name || '';
  if (artist) artist.textContent = data.item.artists?.map(a => a.name).join(', ') || '';
  if (playBtn) playBtn.textContent = pbPlaying ? '⏸' : '▶';

  updateProgressDisplay(pbPosition, pbDuration);
  if (pbPlaying) startProgressTimer(); else stopProgressTimer();
}

function updateProgressDisplay(pos, dur) {
  const fill = document.getElementById('pb-progress-fill');
  const elapsed = document.getElementById('pb-elapsed');
  const remaining = document.getElementById('pb-remaining');
  if (fill) fill.style.width = dur > 0 ? (pos / dur * 100) + '%' : '0%';
  if (elapsed) elapsed.textContent = msToMinSec(pos);
  if (remaining) remaining.textContent = '-' + msToMinSec(Math.max(0, dur - pos));
}

function msToMinSec(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// Smooth progress animation between state updates
function startProgressTimer() {
  stopProgressTimer();
  function tick() {
    if (!pbPlaying) return;
    const elapsed = performance.now() - pbPosTime;
    const pos = Math.min(pbPosition + elapsed, pbDuration);
    updateProgressDisplay(pos, pbDuration);
    progressRAF = requestAnimationFrame(tick);
  }
  progressRAF = requestAnimationFrame(tick);
}

function stopProgressTimer() {
  if (progressRAF) { cancelAnimationFrame(progressRAF); progressRAF = null; }
}

// ── Player bar controls ───────────────────────────────────────────────────────
function playerTogglePlay() {
  if (sdkReady && sdkPlayer) {
    sdkPlayer.togglePlay();
  } else {
    remoteTogglePlay();
  }
}

function playerNext() {
  if (sdkReady && sdkPlayer) {
    sdkPlayer.nextTrack();
  } else {
    remoteNext();
  }
}

function playerPrev() {
  if (sdkReady && sdkPlayer) {
    sdkPlayer.previousTrack();
  } else {
    remotePrev();
  }
}

function playerSeek(e) {
  const bar = document.getElementById('pb-progress');
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const ms = pct * pbDuration;
  pbPosition = ms;
  pbPosTime = performance.now();
  updateProgressDisplay(ms, pbDuration);
  if (sdkReady && sdkPlayer) {
    sdkPlayer.seek(Math.round(ms));
  } else {
    remoteSeek(ms);
  }
}

function playerVolume(e) {
  const slider = e.target;
  const vol = parseFloat(slider.value);
  if (sdkReady && sdkPlayer) {
    sdkPlayer.setVolume(vol);
  } else {
    remoteSetVolume(Math.round(vol * 100));
  }
}

// ── Playback ──────────────────────────────────────────────────────────────────
async function playFromTrack(i, silent = false) {
  const uris = generatedTracks.slice(i).map(t => t.uri);
  if (!uris.length) return;
  try {
    const ok = await spotifyPlay(uris);
    if (!ok) throw new Error('no device');

    // Turn off repeat
    try {
      await fetch('https://api.spotify.com/v1/me/player/repeat?state=off', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + accessToken },
      });
    } catch {}

    buildUriMap();
    sessionQueue  = new Set(uris);
    sessionPaused = false;

    highlightNowPlaying(i);
    showPlayerBar();

    // SDK handles state via events; only poll for remote
    if (!sdkReady) startPolling();

    if (!silent) showToast(i === 0
      ? `Playing ${generatedTracks.length} tracks`
      : `Playing from track ${i + 1}`);
  } catch {
    if (!silent) showError('Playback failed. Open Spotify on any device first, then try again.');
  }
}

async function autoPlay() {
  if (!generatedTracks.length) return;
  setTimeout(() => playFromTrack(0, true), 150);
}
