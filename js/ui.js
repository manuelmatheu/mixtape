// ── Artist search (Spotify only) ──────────────────────────────────────────────
function debounceSearch(idx, q) {
  clearTimeout(searchTimers[idx]);
  searchTimers[idx] = setTimeout(() => doSearch(idx, q), 300);
}

async function doSearch(idx, q) {
  const dd = document.getElementById(`dd-${idx}`);
  if (!q.trim()) { dd.classList.remove('open'); return; }
  dd.classList.add('open');
  dd.innerHTML = '<div class="autocomplete-loading">Searching…</div>';

  try {
    const data  = await spGet(`/search?type=artist&q=${encodeURIComponent(q)}&limit=6`);
    const items = data.artists?.items || [];
    renderDropdown(idx, items.map(a => ({
      name:  a.name,
      image: a.images?.[1]?.url || a.images?.[0]?.url || '',
      sub:   a.followers?.total ? fmtNum(a.followers.total) + ' followers' : '',
    })));
  } catch {
    dd.innerHTML = '<div class="autocomplete-loading">Error — try again.</div>';
  }
}

function renderDropdown(idx, items) {
  const dd = document.getElementById(`dd-${idx}`);
  if (!items.length) { dd.innerHTML = '<div class="autocomplete-loading">No results.</div>'; return; }
  dd.innerHTML = items.map((a, i) => {
    const imgEl = a.image
      ? `<img class="autocomplete-thumb" src="${esc(a.image)}" alt="" onerror="this.style.visibility='hidden'" />`
      : `<div class="autocomplete-thumb"></div>`;
    return `<div class="autocomplete-item" onclick="selectArtist(${idx},${i})">
      ${imgEl}
      <div style="flex:1;min-width:0">
        <div class="autocomplete-name">${esc(a.name)}</div>
        ${a.sub ? `<div class="autocomplete-sub">${esc(a.sub)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  dd._items = items;
}

function selectArtist(idx, i) {
  const dd = document.getElementById(`dd-${idx}`);
  artists[idx] = dd._items[i];
  renderSlot(idx);
  dd.classList.remove('open');
  updateComboSaveBtn();
}

function removeArtist(idx) { artists[idx] = null; renderSlot(idx); updateComboSaveBtn(); }

// ── Saved Combos ──────────────────────────────────────────────────────────────
function loadCombos() {
  try {
    const raw = localStorage.getItem('mixtape_combos');
    if (raw) savedCombos = JSON.parse(raw);
  } catch { savedCombos = []; }
}

function persistCombos() {
  try { localStorage.setItem('mixtape_combos', JSON.stringify(savedCombos)); } catch {}
}

function comboKey(combo) {
  return combo.artists.map(a => a.name.toLowerCase()).sort().join('||');
}

function saveCombo() {
  const active = artists.filter(Boolean);
  if (active.length < 2) return;

  const combo = { artists: active.map(a => ({ name: a.name, image: a.image || '', sub: a.sub || '' })) };
  // Don't save duplicates
  const key = comboKey(combo);
  if (savedCombos.some(c => comboKey(c) === key)) {
    showToast('Combo already saved');
    return;
  }

  savedCombos.unshift(combo);
  persistCombos();
  renderCombos();
  showToast('Combo saved!');
}

function loadCombo(idx) {
  const combo = savedCombos[idx];
  if (!combo) return;
  // Clear all slots, then fill from combo
  for (let i = 0; i < 3; i++) artists[i] = null;
  combo.artists.forEach((a, i) => { if (i < 3) artists[i] = { ...a }; });
  renderAllSlots();
  updateComboSaveBtn();
}

function removeCombo(idx, evt) {
  evt.stopPropagation();
  savedCombos.splice(idx, 1);
  persistCombos();
  renderCombos();
}

function updateComboSaveBtn() {
  const active = artists.filter(Boolean).length;
  const btn = document.getElementById('combo-save-btn');
  if (btn) btn.style.display = active >= 2 ? '' : 'none';
}

function renderCombos() {
  const wrap = document.getElementById('combos-scroll');
  if (!wrap) return;
  wrap.innerHTML = savedCombos.map((combo, ci) => {
    const avatars = combo.artists.map(a =>
      a.image
        ? `<img src="${esc(a.image)}" alt="" onerror="this.outerHTML='<span class=\\'combo-avatar-ph\\'>${esc(a.name[0])}</span>'" />`
        : `<span class="combo-avatar-ph">${esc(a.name[0])}</span>`
    ).join('');
    const names = combo.artists.map(a => a.name).join(' × ');
    return `<div class="combo-card" onclick="loadCombo(${ci})" title="${esc(names)}">
      <div class="combo-avatars">${avatars}</div>
      <span class="combo-names">${esc(names)}</span>
      <button class="combo-remove" onclick="removeCombo(${ci},event)" title="Remove combo">✕</button>
    </div>`;
  }).join('');
}

// ── Slots ─────────────────────────────────────────────────────────────────────
function renderAllSlots() {
  const grid = document.getElementById('artists-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div');
    el.id = `slot-${i}`; el.className = 'artist-slot';
    grid.appendChild(el); renderSlot(i);
  }
}

function renderSlot(idx) {
  const slot   = document.getElementById(`slot-${idx}`);
  const artist = artists[idx];
  const nums   = ['One','Two','Three'];

  if (artist) {
    const imgEl = artist.image
      ? `<img class="artist-avatar" src="${esc(artist.image)}" alt="" onerror="this.outerHTML='<div class=&quot;artist-avatar-placeholder&quot;>${esc(artist.name[0])}</div>'" />`
      : `<div class="artist-avatar-placeholder">${esc(artist.name[0])}</div>`;
    slot.className = 'artist-slot filled';
    slot.innerHTML = `
      <span class="slot-number">${nums[idx]}</span>
      <div class="artist-card">
        ${imgEl}
        <div class="artist-info">
          <div class="artist-name">${esc(artist.name)}</div>
          ${artist.sub ? `<div class="artist-sub">${esc(artist.sub)}</div>` : ''}
        </div>
        <button class="remove-artist" onclick="removeArtist(${idx})">&#x2715;</button>
      </div>`;
  } else {
    slot.className = 'artist-slot';
    slot.innerHTML = `
      <span class="slot-number">${nums[idx]}</span>
      <div class="artist-search-wrap">
        <input class="search-input" id="search-${idx}" type="text" placeholder="Search artist…" autocomplete="off"
          oninput="debounceSearch(${idx},this.value)"
          onkeydown="handleSearchKey(event,${idx})"
          onblur="setTimeout(()=>document.getElementById('dd-${idx}').classList.remove('open'),200)" />
      </div>
      <div class="autocomplete-dropdown" id="dd-${idx}"></div>`;
  }
}

// ── Options ───────────────────────────────────────────────────────────────────
function setMode(m, btn) {
  trackMode = m;
  document.querySelectorAll('#mode-control .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function adjustTracks(d) {
  tracksPerArtist = Math.max(1, Math.min(10, tracksPerArtist + d));
  document.getElementById('track-count').textContent = tracksPerArtist;
}

function toggleMeta(btn) {
  showMeta = !showMeta;
  btn.classList.toggle('on', showMeta);
  document.getElementById('track-list').classList.toggle('show-meta', showMeta);
}

// ── Generate ──────────────────────────────────────────────────────────────────
async function generate() {
  const active = artists.filter(Boolean);
  if (!active.length) { showError('Add at least one artist first.'); return; }

  clearError();
  document.getElementById('status-area').classList.add('visible');
  document.getElementById('results-section').classList.remove('visible');
  document.getElementById('mix-context').style.display = 'none';
  rawTracks = {};

  try {
    for (let i = 0; i < active.length; i++) {
      setProgress(Math.round((i / active.length) * 30), `Fetching Last.fm tracks for ${active[i].name}…`);
      rawTracks[active[i].name] = await getTracksForArtist(active[i]);
    }

    if (trackMode === 'discovery') {
      setProgress(32, 'Finding similar artists…');
      const activeNames     = active.map(a => a.name);
      const similarNames    = await getSimilarArtists(activeNames, 3 * active.length);
      setProgress(40, `Fetching tracks for ${similarNames.length} similar artists…`);
      const discoveryTracks = await getDiscoveryTracks(similarNames);
      rawTracks['__discovery__'] = discoveryTracks;
    }

    const allLfm = Object.values(rawTracks).flat();
    setProgress(45, `Matching ${allLfm.length} tracks on Spotify…`);

    const CONC = 3;
    const matched = [];
    for (let i = 0; i < allLfm.length; i += CONC) {
      const chunk   = allLfm.slice(i, i + CONC);
      const results = await Promise.all(chunk.map(matchToSpotify));
      matched.push(...results);
      setProgress(45 + Math.round(((i + chunk.length) / allLfm.length) * 50),
        `Matched ${Math.min(i + CONC, allLfm.length)} / ${allLfm.length}…`);
    }

    const found   = matched.filter(Boolean);
    const missing = matched.length - found.length;

    const seen  = new Set();
    const dedup = found.filter(t => { if (seen.has(t.uri)) return false; seen.add(t.uri); return true; });

    generatedTracks = shuffle(dedup);

    // Capture context data before rendering
    const ctxArtists  = [...active];
    const ctxSimilar  = trackMode === 'discovery' ? (rawTracks['__discovery__'] || []).map(t => t._similarArtist).filter((v,i,a) => a.indexOf(v) === i) : [];
    const ctxMode     = trackMode;
    const ctxTracks   = [...generatedTracks];

    setProgress(100, 'Done!');
    setTimeout(() => {
      document.getElementById('status-area').classList.remove('visible');
      renderResults(missing);
      autoPlay();
      // Fire context generation async — doesn't block playback
      generateContext(ctxArtists, ctxSimilar, ctxMode, ctxTracks);
    }, 400);

  } catch (e) {
    document.getElementById('status-area').classList.remove('visible');
    showError('Something went wrong: ' + e.message);
  }
}

function reshuffle() {
  stopPolling();
  generatedTracks = shuffle([...generatedTracks]);
  buildUriMap();
  renderResults();
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openSaveModal() {
  const names = artists.filter(Boolean).map(a => a.name).join(' × ');
  document.getElementById('playlist-name').value = names ? `${names} — SpotiMix` : 'My SpotiMix';
  document.getElementById('playlist-desc').value = `Generated by SpotiMix · ${generatedTracks.length} tracks`;
  document.getElementById('save-modal').classList.add('open');
}
function closeSaveModal() { document.getElementById('save-modal').classList.remove('open'); }

// ── Results ───────────────────────────────────────────────────────────────────
function renderResults(missingCount) {
  const list = document.getElementById('track-list');
  document.getElementById('results-count').textContent = `${generatedTracks.length} tracks`;
  const warn = document.getElementById('match-warning');
  warn.textContent = missingCount > 0
    ? `${missingCount} track${missingCount > 1 ? 's' : ''} not found on Spotify` : '';

  list.className = 'track-list' + (showMeta ? ' show-meta' : '');
  list.innerHTML = generatedTracks.map((t, i) => {
    const imgEl = t.albumArt
      ? `<img class="track-thumb" src="${esc(t.albumArt)}" alt="" />`
      : `<div class="track-thumb"></div>`;
    const badge = t._type === 'deep'
      ? `<span class="track-badge badge-deep">Deep</span>`
      : t._type === 'discovery'
        ? `<span class="track-badge badge-discovery">Discovery</span>`
        : `<span class="track-badge badge-top">Top</span>`;
    const plays = t._playcount
      ? `<div class="track-scrobbles">${fmtNum(t._playcount)} scrobbles</div>` : '';
    return `<div class="track-item" id="track-${i}" onclick="playFromTrack(${i})">
      <div class="track-num-wrap">
        <span class="track-num">${i+1}</span>
        <span class="track-play-icon">▶</span>
      </div>
      ${imgEl}
      <div class="track-info">
        <div class="track-name">${esc(t.name)}</div>
        <div class="track-artist">${esc(t.artist)}</div>
        ${plays}
      </div>
      ${badge}
      <span class="track-duration">${msToTime(t.duration)}</span>
    </div>`;
  }).join('');

  document.getElementById('results-section').classList.add('visible');
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setProgress(pct, msg) {
  document.getElementById('status-pct').textContent    = pct + '%';
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('status-msg').textContent    = msg;
}
function showError(m) { const e = document.getElementById('error-msg'); e.textContent = m; e.classList.add('visible'); }
function clearError()  { document.getElementById('error-msg').classList.remove('visible'); }

let toastT;
function showToast(m) {
  const t = document.getElementById('toast');
  t.textContent = m; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function shuffle(a) { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function chunkArr(a,n) { const c=[]; for(let i=0;i<a.length;i+=n) c.push(a.slice(i,i+n)); return c; }
function msToTime(ms) { if(!ms) return '--:--'; const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function fmtNum(n) { if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e3) return (n/1e3).toFixed(0)+'K'; return String(n); }
function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g,''); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Mix context (Last.fm-powered narrative) ──────────────────────────────────
function toggleContext() {
  document.getElementById('mix-context').classList.toggle('collapsed');
}

async function generateContext(artistList, similarNames, mode, tracks) {
  const panel  = document.getElementById('mix-context');
  const textEl = document.getElementById('context-text');
  const tagsEl = document.getElementById('context-tags');

  panel.style.display = '';
  panel.classList.remove('collapsed');
  textEl.innerHTML = '<div class="context-loading">Reading the liner notes…</div>';
  tagsEl.innerHTML = '';

  const artistNames = artistList.map(a => a.name);

  // Fetch tags and bios in parallel
  const [allTags, allBios] = await Promise.all([
    Promise.all(artistNames.map(getArtistTags)),
    Promise.all(artistNames.map(getArtistInfo)),
  ]);

  // Build tag chips (deduplicated)
  const tagSet = new Set();
  allTags.flat().forEach(t => tagSet.add(t));
  const uniqueTags = [...tagSet].slice(0, 12);
  tagsEl.innerHTML = uniqueTags.map(t => `<span class="context-tag">${esc(t)}</span>`).join('');

  // Build the narrative
  textEl.innerHTML = buildNarrative(artistNames, allTags, allBios, similarNames, mode, tracks);
}

function buildNarrative(names, allTags, allBios, similarNames, mode, tracks) {
  const n = names.length;

  // Extract first meaningful sentence from each bio
  const bioSnippets = allBios.map(bio => {
    if (!bio) return '';
    // Take the first sentence, clean it up
    const first = bio.split(/(?<=[.!?])\s+/)[0] || '';
    return first.length > 20 ? first : '';
  });

  // Find shared tags between artists
  const tagSets = allTags.map(t => new Set(t));
  let sharedTags = [];
  if (n >= 2) {
    const intersection = [...tagSets[0]].filter(t => tagSets.slice(1).every(s => s.has(t)));
    sharedTags = intersection.slice(0, 3);
  }

  // Find unique tags per artist (what they bring that others don't)
  const uniquePerArtist = allTags.map((tags, i) => {
    const others = new Set(allTags.filter((_, j) => j !== i).flat());
    return tags.filter(t => !others.has(t)).slice(0, 2);
  });

  // Mode descriptions
  const modeDesc = {
    top:       'their biggest tracks',
    deep:      'deeper cuts beyond the obvious hits',
    mix:       'a blend of hits and deeper cuts',
    discovery: 'their tracks alongside similar artists',
  };

  // --- Assemble the narrative ---
  let parts = [];

  // Opening: artist connection
  if (n === 1) {
    const bio = bioSnippets[0];
    const tags = allTags[0].slice(0, 3);
    if (bio) {
      parts.push(bio);
    } else if (tags.length) {
      parts.push(`${names[0]} brings a sound rooted in <em>${tags.join('</em>, <em>')}</em>.`);
    } else {
      parts.push(`A focused session with ${names[0]}.`);
    }
  } else if (n === 2) {
    if (sharedTags.length) {
      parts.push(`${names[0]} and ${names[1]} share common ground in <em>${sharedTags.join('</em> and <em>')}</em>${uniquePerArtist[0].length ? ', but where ' + names[0] + ' leans into <em>' + uniquePerArtist[0][0] + '</em>' + (uniquePerArtist[1].length ? ', ' + names[1] + ' pulls toward <em>' + uniquePerArtist[1][0] + '</em>' : '') : ''}.`);
    } else {
      // No shared tags — highlight the contrast
      const t0 = allTags[0].slice(0, 2);
      const t1 = allTags[1].slice(0, 2);
      if (t0.length && t1.length) {
        parts.push(`An unexpected pairing: ${names[0]}'s <em>${t0.join('</em>-tinged <em>')}</em> sensibility meets ${names[1]}'s <em>${t1.join('</em> and <em>')}</em> edge.`);
      } else {
        parts.push(`${names[0]} and ${names[1]} — two distinct voices woven into one session.`);
      }
    }
  } else {
    // 3 artists
    if (sharedTags.length) {
      parts.push(`Three artists united by <em>${sharedTags[0]}</em>${sharedTags[1] ? ' and <em>' + sharedTags[1] + '</em>' : ''}: ${names.slice(0, -1).join(', ')} and ${names[n - 1]}.`);
    } else {
      const allTop = allTags.map(t => t[0]).filter(Boolean);
      if (allTop.length >= 2) {
        parts.push(`A mix that moves between <em>${[...new Set(allTop)].join('</em>, <em>')}</em> — pulling from ${names.slice(0, -1).join(', ')} and ${names[n - 1]}.`);
      } else {
        parts.push(`${names.slice(0, -1).join(', ')} and ${names[n - 1]} — three voices, one mixtape.`);
      }
    }
  }

  // Middle: mode-specific color
  const modePhrase = modeDesc[mode] || 'a curated selection';
  if (mode === 'deep') {
    parts.push(`This mix digs past the surface into ${modePhrase} — the songs that fans know best.`);
  } else if (mode === 'discovery' && similarNames?.length) {
    const simShort = similarNames.slice(0, 3);
    parts.push(`Discovery mode expands the palette with ${simShort.join(', ')}${similarNames.length > 3 ? ' and more' : ''}, drawing lines between the familiar and the unexpected.`);
  } else if (mode === 'mix') {
    parts.push(`Pulling from ${modePhrase}, the tracklist balances the anthems with album-deep rewards.`);
  }

  // Closing: a bio excerpt if we haven't used one yet and have one
  if (n > 1) {
    const unusedBio = bioSnippets.find((b, i) => b && !parts[0]?.includes(names[i]));
    if (unusedBio && parts.join('').length < 300) {
      // Only add if we're not already too long
      parts.push(unusedBio);
    }
  }

  // Track count note
  const topArtist = tracks.reduce((acc, t) => { acc[t.artist] = (acc[t.artist] || 0) + 1; return acc; }, {});
  const sorted = Object.entries(topArtist).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 1 && sorted[0][1] > sorted[1][1] + 2) {
    parts.push(`${tracks.length} tracks, leaning a little heavier on ${sorted[0][0]}.`);
  } else {
    parts.push(`${tracks.length} tracks across the full spread.`);
  }

  return parts.join(' ');
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
let acSelectedIdx = -1;

function handleSearchKey(e, idx) {
  const dd = document.getElementById(`dd-${idx}`);
  if (!dd || !dd.classList.contains('open') || !dd._items) return;
  const items = dd.querySelectorAll('.autocomplete-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    acSelectedIdx = Math.min(acSelectedIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('ac-active', i === acSelectedIdx));
    items[acSelectedIdx]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    acSelectedIdx = Math.max(acSelectedIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('ac-active', i === acSelectedIdx));
    items[acSelectedIdx]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && acSelectedIdx >= 0) {
    e.preventDefault();
    selectArtist(idx, acSelectedIdx);
    acSelectedIdx = -1;
  } else if (e.key === 'Escape') {
    dd.classList.remove('open');
    acSelectedIdx = -1;
  } else {
    acSelectedIdx = -1;  // Reset on any other key (typing)
  }
}

function openShortcuts()  { document.getElementById('shortcuts-modal').classList.add('open'); }
function closeShortcuts() { document.getElementById('shortcuts-modal').classList.remove('open'); }

function isModalOpen() {
  return document.querySelector('.modal-overlay.open') !== null;
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
}

function isTyping() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

document.addEventListener('keydown', e => {
  // Escape: close any open modal or dropdown
  if (e.key === 'Escape') {
    if (isModalOpen()) { closeAllModals(); return; }
    // Close any open autocomplete dropdowns
    document.querySelectorAll('.autocomplete-dropdown.open').forEach(dd => dd.classList.remove('open'));
    return;
  }

  // Don't trigger shortcuts while typing in inputs
  if (isTyping()) return;

  if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); openShortcuts(); return; }
  if (e.key === 'g' || e.key === 'G') { e.preventDefault(); generate(); return; }
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); saveCombo(); return; }
  if (e.key === 'd' || e.key === 'D') { e.preventDefault(); toggleTheme(); return; }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (code) await exchangeCode(code);
  else accessToken = sessionStorage.getItem('spotify_token');

  if (accessToken) {
    try {
      const me = await spGet('/me');
      userId = me.id;
      document.getElementById('username-label').textContent = me.display_name || me.id;
      document.getElementById('auth-section').classList.add('hidden');
      document.getElementById('app-section').classList.add('visible');
      renderAllSlots();
      loadCombos();
      renderCombos();
    } catch {
      sessionStorage.removeItem('spotify_token');
    }
  }
}

init();
