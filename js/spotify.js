// ── PKCE helpers ──────────────────────────────────────────────────────────────
function rndBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
function b64url(buf) { return btoa(String.fromCharCode(...buf)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
async function sha256(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); }

async function startAuth() {
  const verifier  = b64url(rndBytes(64));
  const challenge = b64url(new Uint8Array(await sha256(verifier)));
  sessionStorage.setItem('pkce_verifier', verifier);
  const p = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID, response_type: 'code',
    redirect_uri: REDIRECT_URI, code_challenge_method: 'S256',
    code_challenge: challenge, scope: SCOPES,
  });
  window.location = 'https://accounts.spotify.com/authorize?' + p;
}

async function exchangeCode(code) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code,
      redirect_uri: REDIRECT_URI,
      client_id: SPOTIFY_CLIENT_ID, code_verifier: verifier,
    }),
  });
  const d = await res.json();
  if (d.access_token) {
    accessToken = d.access_token;
    localStorage.setItem('spotify_token', accessToken);
    localStorage.setItem('spotify_token_expiry', Date.now() + (d.expires_in || 3600) * 1000);
    if (d.refresh_token) localStorage.setItem('spotify_refresh', d.refresh_token);
    sessionStorage.removeItem('pkce_verifier');
    window.history.replaceState({}, '', REDIRECT_URI);
  }
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem('spotify_refresh');
  if (!refresh) return false;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: SPOTIFY_CLIENT_ID,
      }),
    });
    const d = await res.json();
    if (d.access_token) {
      accessToken = d.access_token;
      localStorage.setItem('spotify_token', accessToken);
      localStorage.setItem('spotify_token_expiry', Date.now() + (d.expires_in || 3600) * 1000);
      if (d.refresh_token) localStorage.setItem('spotify_refresh', d.refresh_token);
      return true;
    }
  } catch {}
  return false;
}

function logout() {
  localStorage.removeItem('spotify_token');
  localStorage.removeItem('spotify_refresh');
  accessToken = null; userId = null;
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('app-section').classList.remove('visible');
}

// ── Spotify API ───────────────────────────────────────────────────────────────
async function spGet(path) {
  let r = await fetch('https://api.spotify.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (r.status === 401) {
    // Try refreshing token before giving up
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      r = await fetch('https://api.spotify.com/v1' + path, {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
    }
    if (r.status === 401) { logout(); throw new Error('Token expired'); }
  }
  if (!r.ok) throw new Error('Spotify ' + r.status);
  return r.json();
}

async function spPost(path, body) {
  const r = await fetch('https://api.spotify.com/v1' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Spotify POST ' + r.status);
  return r.json().catch(() => ({}));
}

async function spPut(path, body) {
  let r = await fetch('https://api.spotify.com/v1' + path, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      r = await fetch('https://api.spotify.com/v1' + path, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    if (r.status === 401) { logout(); throw new Error('Token expired'); }
  }
  if (!r.ok) throw new Error('Spotify PUT ' + r.status);
  return r.status === 204 ? {} : r.json().catch(() => ({}));
}

async function spDelete(path, body) {
  let r = await fetch('https://api.spotify.com/v1' + path, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      r = await fetch('https://api.spotify.com/v1' + path, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    if (r.status === 401) { logout(); throw new Error('Token expired'); }
  }
  if (!r.ok) throw new Error('Spotify DELETE ' + r.status);
  return {};
}

async function checkLikedTracks(trackIds) {
  const liked = new Set();
  for (let i = 0; i < trackIds.length; i += 50) {
    const chunk = trackIds.slice(i, i + 50);
    try {
      const data = await spGet('/me/tracks/contains?ids=' + chunk.join(','));
      chunk.forEach((id, j) => { if (data[j]) liked.add(id); });
    } catch (e) { console.warn('checkLikedTracks chunk failed:', e); }
  }
  return liked;
}

async function toggleLikeTrack(trackId, currentlyLiked) {
  if (currentlyLiked) {
    await spDelete('/me/tracks', { ids: [trackId] });
    return false;
  } else {
    await spPut('/me/tracks', { ids: [trackId] });
    return true;
  }
}

async function getDevices() {
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!r.ok) return [];
    return (await r.json()).devices || [];
  } catch { return []; }
}

async function transferPlayback(deviceId) {
  // Tell Spotify to make this device the active one
  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
  // Give Spotify a moment to complete the transfer
  await new Promise(r => setTimeout(r, 800));
}

async function spotifyPlay(uris) {
  // Spotify API has a limit of ~100 URIs per play call
  const playUris = uris.slice(0, 100);

  // If SDK player is ready, transfer playback to it first then play
  if (sdkReady && sdkDeviceId) {
    // Ensure the SDK device is active
    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [sdkDeviceId], play: false }),
    });
    await new Promise(r => setTimeout(r, 300));

    const r = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${sdkDeviceId}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: playUris }),
    });
    if (r.ok || r.status === 204) return true;
    // SDK play failed — fall through to remote
  }

  // Remote fallback
  const devices = await getDevices();
  let device = devices.find(d => d.is_active);

  if (!device) {
    device = devices.find(d => !d.is_restricted) || devices[0];
    if (!device) {
      const r = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: playUris }),
      });
      return r.ok || r.status === 204;
    }
    await transferPlayback(device.id);
  }

  const r = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device.id}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: playUris }),
  });
  return r.ok || r.status === 204;
}

async function addToQueue() {
  if (!generatedTracks.length) return;
  try {
    for (const t of generatedTracks) {
      await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(t.uri)}`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken },
      });
    }
    showToast(`${generatedTracks.length} tracks added to queue`);
  } catch { showError('Could not add to queue. Make sure Spotify is open and playing.'); }
}

async function savePlaylist() {
  const saveBtn = document.querySelector('.btn-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  try {
    const uris = generatedTracks.map(t => t.uri).filter(Boolean);
    if (!uris.length) throw new Error('No tracks to save');

    const label = currentMixLabel || 'My Mix';
    const name  = `${label} — SpotiMix`;
    const date  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const desc  = `Generated by SpotiMix · ${uris.length} tracks · ${date}`;

    // 1. Create the playlist (private by default)
    const plRes = await fetch('https://api.spotify.com/v1/me/playlists', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: desc, public: false }),
    });
    if (!plRes.ok) {
      const err = await plRes.json().catch(() => ({}));
      throw new Error(`Create playlist failed (${plRes.status}): ${err?.error?.message || 'unknown'}`);
    }
    const pl = await plRes.json();
    if (!pl.id) throw new Error('No playlist ID returned');

    // 2. Add tracks in batches of 100
    let addOk = true;
    for (let i = 0; i < uris.length; i += 100) {
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/tracks`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      });
      if (!addRes.ok) { addOk = false; break; }
    }

    if (addOk) {
      showToast(`"${name}" saved with ${uris.length} tracks!`);
      if (saveBtn && pl.external_urls?.spotify) {
        const url = pl.external_urls.spotify;
        saveBtn.textContent = 'Saved! ↗';
        saveBtn.className = 'btn btn-spotify btn-save';
        saveBtn.disabled = false;
        saveBtn.onclick = () => window.open(url, '_blank');
      }
    } else {
      // Dev mode fallback: copy URIs to clipboard, open empty playlist
      await navigator.clipboard.writeText(uris.join('\n')).catch(() => {});
      if (pl.external_urls?.spotify) window.open(pl.external_urls.spotify, '_blank');
      showToast('Playlist created — track URIs copied to clipboard (Spotify dev mode limit).');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save to Spotify'; }
    }
  } catch (e) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save to Spotify'; }
    if (e.message.includes('403') || e.message.includes('401')) {
      showError('Permission error — disconnect and reconnect Spotify.');
    } else {
      showError('Could not save: ' + e.message);
    }
  }
}

// ── Spotify Web Playback SDK ──────────────────────────────────────────────────
function initSDKPlayer() {
  if (!window.Spotify) return;
  sdkPlayer = new Spotify.Player({
    name: 'SpotiMix',
    getOAuthToken: async cb => {
      // Proactively refresh if token expires within 5 minutes
      const expiry = parseInt(localStorage.getItem('spotify_token_expiry') || '0');
      if (!accessToken || Date.now() > expiry - 5 * 60 * 1000) {
        await refreshAccessToken();
      }
      cb(accessToken || '');
    },
    volume: 0.8,
  });

  sdkPlayer.addListener('ready', ({ device_id }) => {
    const reconnecting = sdkNeedsRetransfer;
    sdkDeviceId = device_id;
    sdkReady = true;
    stopPolling();
    console.log('SDK ready, device:', device_id);
    // If we're recovering from an auth error, retransfer playback back to SDK device
    if (reconnecting && sessionQueue.size > 0 && !sessionPaused) {
      sdkNeedsRetransfer = false;
      transferPlayback(sdkDeviceId).catch(() => {});
    }
  });

  sdkPlayer.addListener('not_ready', () => {
    sdkReady = false;
    console.log('SDK device not ready');
    // Start polling as fallback so player bar stays live
    if (sessionQueue.size > 0) startPolling();
  });

  sdkPlayer.addListener('player_state_changed', state => {
    if (!state) return;
    lastSDKState = state;
    onSDKStateChange(state);
  });

  sdkPlayer.addListener('initialization_error', ({ message }) => {
    console.warn('SDK init error:', message);
    sdkReady = false;
  });
  sdkPlayer.addListener('authentication_error', async ({ message }) => {
    console.warn('SDK auth error:', message);
    sdkReady = false;
    // Start polling as fallback while we reconnect
    if (sessionQueue.size > 0) startPolling();
    const ok = await refreshAccessToken();
    if (ok && sdkPlayer) {
      sdkNeedsRetransfer = true;
      sdkPlayer.disconnect();
      sdkPlayer.connect();
    }
  });
  sdkPlayer.addListener('account_error', ({ message }) => {
    console.warn('SDK account error (Premium required):', message);
    sdkReady = false;
  });

  sdkPlayer.connect();
}

// Global callback for the SDK script
window.onSpotifyWebPlaybackSDKReady = () => {
  if (accessToken) initSDKPlayer();
};

// ── Remote playback controls (fallback when SDK not active) ───────────────────
async function remoteTogglePlay() {
  try {
    const state = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (state.status === 204) return;
    const data = await state.json();
    const endpoint = data.is_playing ? 'pause' : 'play';
    await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken },
    });
  } catch {}
}

async function remoteNext() {
  try {
    await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST', headers: { Authorization: 'Bearer ' + accessToken },
    });
  } catch {}
}

async function remotePrev() {
  try {
    await fetch('https://api.spotify.com/v1/me/player/previous', {
      method: 'POST', headers: { Authorization: 'Bearer ' + accessToken },
    });
  } catch {}
}

async function remoteSeek(ms) {
  try {
    await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.round(ms)}`, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + accessToken },
    });
  } catch {}
}

async function remoteSetVolume(pct) {
  try {
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.round(pct)}`, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + accessToken },
    });
  } catch {}
}
