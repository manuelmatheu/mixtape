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
  updateSuggest();
}

function removeArtist(idx) { artists[idx] = null; renderSlot(idx); updateComboSaveBtn(); updateSuggest(); }

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
  for (let i = 0; i < 3; i++) artists[i] = null;
  combo.artists.forEach((a, i) => { if (i < 3) artists[i] = { ...a }; });
  renderAllSlots();
  updateComboSaveBtn();
  updateSuggest();
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

// ── Smart Suggest ─────────────────────────────────────────────────────────────
let suggestAbort = 0; // Simple generation counter to discard stale results

async function updateSuggest() {
  const bar    = document.getElementById('suggest-bar');
  const chips  = document.getElementById('suggest-chips');
  const active = artists.filter(Boolean);
  const empty  = artists.filter(a => a === null).length;

  // Only show when 1-2 artists and at least 1 empty slot
  if (active.length === 0 || empty === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = '';
  chips.innerHTML = '<span class="suggest-chip loading">loading…</span>';

  const gen = ++suggestAbort;
  const activeNames = active.map(a => a.name);

  // Fetch tags and similar artists in parallel
  const [allTags, similarNames] = await Promise.all([
    Promise.all(activeNames.map(getArtistTags)),
    getSimilarArtists(activeNames, 6),
  ]);

  // Stale check
  if (gen !== suggestAbort) return;

  // Filter out already-selected from similar artists
  const selectedNorm = new Set(active.map(a => norm(a.name)));
  const filteredSimilar = similarNames.filter(n => !selectedNorm.has(norm(n))).slice(0, 4);

  // Merge and rank tags
  const tagCount = {};
  allTags.flat().forEach(t => {
    if (['seen live', 'favorites', 'favourite', 'all'].some(x => t.includes(x))) return;
    tagCount[t] = (tagCount[t] || 0) + 1;
  });

  const rankedTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(e => e[0])
    .slice(0, 6);

  if (!filteredSimilar.length && !rankedTags.length) {
    bar.style.display = 'none';
    return;
  }

  // Build chips: similar artists first, then tags
  let html = '';
  let delay = 0;

  filteredSimilar.forEach(name => {
    html += `<button class="suggest-chip artist-suggest" onclick="suggestArtistByName(this,'${esc(name)}')" style="animation-delay:${delay}ms">${esc(name)}</button>`;
    delay += 30;
  });

  rankedTags.forEach(t => {
    html += `<button class="suggest-chip" onclick="suggestFromTag(this,'${esc(t)}')" style="animation-delay:${delay}ms">${esc(t)}</button>`;
    delay += 30;
  });

  chips.innerHTML = html;
}

async function suggestArtistByName(chip, name) {
  const emptyIdx = artists.findIndex(a => a === null);
  if (emptyIdx === -1) return;

  chip.classList.add('loading');
  chip.textContent = name + ' …';

  try {
    const data = await spGet(`/search?type=artist&q=${encodeURIComponent(name)}&limit=3`);
    const items = data.artists?.items || [];
    const item = items.find(a => norm(a.name) === norm(name)) || items[0];

    if (item) {
      artists[emptyIdx] = {
        name:  item.name,
        image: item.images?.[1]?.url || item.images?.[0]?.url || '',
        sub:   item.followers?.total ? fmtNum(item.followers.total) + ' followers' : '',
      };
      renderSlot(emptyIdx);
      updateComboSaveBtn();
      showToast(`${item.name} added`);
      updateSuggest();
      return;
    }
  } catch { /* fall through */ }

  chip.classList.remove('loading');
  chip.textContent = name;
  showToast(`Couldn't find "${name}" on Spotify`);
}

async function suggestFromTag(chip, tag) {
  const emptyIdx = artists.findIndex(a => a === null);
  if (emptyIdx === -1) return;

  // Loading state
  chip.classList.add('loading');
  chip.textContent = tag + ' …';

  // Get artist names from Last.fm for this tag
  const lfmArtists = await getTopArtistsForTag(tag, 15);

  // Filter out already-selected artists
  const selectedNames = new Set(artists.filter(Boolean).map(a => norm(a.name)));
  const candidates = lfmArtists.filter(a => !selectedNames.has(norm(a.name)));

  // Shuffle and search Spotify for a match
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  let match = null;

  for (const candidate of shuffled.slice(0, 5)) {
    try {
      const data = await spGet(`/search?type=artist&q=${encodeURIComponent(candidate.name)}&limit=1`);
      const item = data.artists?.items?.[0];
      if (item && norm(item.name) === norm(candidate.name)) {
        match = {
          name:  item.name,
          image: item.images?.[1]?.url || item.images?.[0]?.url || '',
          sub:   item.followers?.total ? fmtNum(item.followers.total) + ' followers' : '',
        };
        break;
      }
    } catch { /* skip */ }
  }

  if (!match) {
    chip.classList.remove('loading');
    chip.textContent = tag;
    showToast(`No match found for "${tag}" — try another`);
    return;
  }

  // Fill the empty slot
  artists[emptyIdx] = match;
  renderSlot(emptyIdx);
  updateComboSaveBtn();
  showToast(`${match.name} added from "${tag}"`);

  // Refresh suggestions (new artist changes the tag pool)
  updateSuggest();
}

// ── Entry toggle (Search / Browse) ────────────────────────────────────────────
let entryMode = 'search';
let genresLoaded = false;
let selectedGenres = new Set();

function setEntry(mode) {
  entryMode = mode;
  document.getElementById('entry-search').classList.toggle('active', mode === 'search');
  document.getElementById('entry-browse').classList.toggle('active', mode === 'browse');
  document.getElementById('entry-search-panel').style.display = mode === 'search' ? '' : 'none';
  document.getElementById('entry-browse-panel').style.display = mode === 'browse' ? '' : 'none';
  document.getElementById('artist-mix-options').style.display = mode === 'search' ? '' : 'none';

  if (mode === 'browse') {
    renderMoodPresets();
    if (!genresLoaded) loadGenres();
  }
}

// ── Mood Presets ──────────────────────────────────────────────────────────────
const MOOD_PRESETS = [
  { name: 'Melancholy',     emoji: '🌧', tags: ['sad', 'melancholy', 'ambient'],              mode: 'deep' },
  { name: 'Late Night',     emoji: '🌙', tags: ['electronic', 'chillwave', 'synthwave'],      mode: 'mix' },
  { name: 'Sunday Morning', emoji: '☀️', tags: ['acoustic', 'folk', 'singer-songwriter'],     mode: 'top' },
  { name: 'Raw Energy',     emoji: '⚡', tags: ['punk', 'garage rock', 'post-punk'],           mode: 'top' },
  { name: 'Dreamy',         emoji: '💭', tags: ['shoegaze', 'dream pop', 'ethereal'],          mode: 'deep' },
  { name: 'Soul Kitchen',   emoji: '🎷', tags: ['soul', 'funk', 'rnb'],                       mode: 'mix' },
  { name: 'Deep Focus',     emoji: '🎧', tags: ['post-rock', 'minimal', 'instrumental'],      mode: 'deep' },
  { name: 'Midnight Jazz',  emoji: '🍷', tags: ['jazz', 'smooth jazz', 'bossa nova'],         mode: 'mix' },
  { name: 'Headbanger',     emoji: '🤘', tags: ['metal', 'heavy metal', 'thrash metal'],      mode: 'top' },
  { name: 'Tropicália',     emoji: '🌴', tags: ['latin', 'bossa nova', 'tropicalia'],         mode: 'mix' },
];

function renderMoodPresets() {
  const grid = document.getElementById('mood-grid');
  grid.innerHTML = MOOD_PRESETS.map((m, i) =>
    `<button class="mood-card" onclick="applyMood(${i})" style="animation-delay:${i * 30}ms">
      <span class="mood-emoji">${m.emoji}</span>
      <span class="mood-name">${esc(m.name)}</span>
    </button>`
  ).join('');
}

async function applyMood(idx) {
  const mood = MOOD_PRESETS[idx];
  if (!mood) return;

  // Pre-select the mood's tags
  selectedGenres.clear();
  mood.tags.forEach(t => selectedGenres.add(t));

  showToast(`${mood.emoji} ${mood.name} — building your mix…`);
  await generateTagMix();
}

// ── Tag Mix Generation ────────────────────────────────────────────────────────
async function generateTagMix() {
  const tags = [...selectedGenres];
  if (!tags.length) { showError('Select at least one genre tag.'); return; }
  currentMixLabel = tags.join(', ');

  // Clear selection so it doesn't block future tag picks
  selectedGenres.clear();
  updateTagMixControls();
  if (genresLoaded) {
    document.querySelectorAll('.genre-chip.selected').forEach(c => c.classList.remove('selected'));
  }

  clearError();
  document.getElementById('status-area').classList.add('visible');
  document.getElementById('results-section').classList.remove('visible');
  document.getElementById('mix-context').style.display = 'none';

  try {
    // 1. Fetch tracks from Last.fm for each tag
    const allLfm = [];
    for (let i = 0; i < tags.length; i++) {
      setProgress(Math.round((i / tags.length) * 30), `Fetching tracks for "${tags[i]}"…`);
      const tagTracks = await getTopTracksForTag(tags[i], tracksPerTag);
      allLfm.push(...tagTracks);
    }

    if (!allLfm.length) throw new Error('No tracks found for selected tags');

    // Deduplicate by artist+track name
    const seen = new Set();
    const dedupLfm = allLfm.filter(t => {
      const key = norm(t.artist.name) + '||' + norm(t.name);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    setProgress(35, `Matching ${dedupLfm.length} tracks on Spotify…`);

    // 2. Match on Spotify (reuse existing matchToSpotify)
    const CONC = 3;
    const matched = [];
    for (let i = 0; i < dedupLfm.length; i += CONC) {
      const chunk   = dedupLfm.slice(i, i + CONC);
      const results = await Promise.all(chunk.map(matchToSpotify));
      matched.push(...results);
      setProgress(35 + Math.round(((i + chunk.length) / dedupLfm.length) * 55),
        `Matched ${Math.min(i + CONC, dedupLfm.length)} / ${dedupLfm.length}…`);
    }

    const found   = matched.filter(Boolean);
    const missing = matched.length - found.length;

    // Deduplicate by Spotify URI
    const seenUri = new Set();
    const dedup = found.filter(t => { if (seenUri.has(t.uri)) return false; seenUri.add(t.uri); return true; });

    if (!dedup.length) throw new Error('No tracks matched on Spotify');

    // 3. Interleave shuffle
    generatedTracks = interleaveShuffle(dedup);

    // Capture context data
    const ctxTags   = [...tags];
    const ctxTracks = [...generatedTracks];

    setProgress(100, 'Done!');
    setTimeout(() => {
      document.getElementById('status-area').classList.remove('visible');
      renderResults(missing);
      autoPlay();
      generateTagContext(ctxTags, ctxTracks);
    }, 400);

  } catch (e) {
    document.getElementById('status-area').classList.remove('visible');
    showError('Something went wrong: ' + e.message);
  }
}

async function generateTagContext(tags, tracks) {
  const panel  = document.getElementById('mix-context');
  const textEl = document.getElementById('context-text');
  const tagsEl = document.getElementById('context-tags');

  panel.style.display = '';
  panel.classList.remove('collapsed');

  // Show the tags as clickable chips
  tagsEl.innerHTML = tags.map(t => `<span class="context-tag clickable" onclick="browseFromTag('${esc(t)}')">${esc(t)}</span>`).join('');

  // Build a tag-specific narrative
  textEl.innerHTML = buildTagNarrative(tags, tracks);
}

// Capitalize first visible letter, even if preceded by an HTML tag like <em>
function senCase(html) {
  return html.replace(/^(\s*(?:<[^>]+>\s*)*)([a-z])/, (_, pre, ch) => pre + ch.toUpperCase());
}

function buildTagNarrative(tags, tracks) {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const em = t => `<em>${t}</em>`;
  const count = tracks.length;
  const totalMs = tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const totalMin = Math.round(totalMs / 60000);

  // Unique artists in the mix
  const artistSet = new Set(tracks.map(t => t.artist));
  const artistCount = artistSet.size;
  const artistSample = [...artistSet].slice(0, 4);

  // Opening — how the tags set the scene
  const openings = tags.length === 1 ? [
    () => `A deep pull from the ${em(tags[0])} catalog.`,
    () => `${em(tags[0])} — the tracks that define the sound.`,
    () => `Everything ${em(tags[0])}, distilled into one session.`,
    () => `The heart of ${em(tags[0])}, track by track.`,
    () => `Built from the most-played corners of ${em(tags[0])}.`,
  ] : tags.length === 2 ? [
    () => `${em(tags[0])} meets ${em(tags[1])} — two frequencies, one playlist.`,
    () => `Where ${em(tags[0])} bleeds into ${em(tags[1])}.`,
    () => `A collision of ${em(tags[0])} and ${em(tags[1])}.`,
    () => `Two worlds: ${em(tags[0])} and ${em(tags[1])}. Let them talk.`,
    () => `The overlap between ${em(tags[0])} and ${em(tags[1])} is wider than you'd think.`,
  ] : [
    () => `${tags.map(em).join(', ')} — blended into something that shouldn't work but does.`,
    () => `Three threads: ${tags.map(em).join(', ')}. Woven together here.`,
    () => `A mix that reaches across ${tags.map(em).join(', ')}.`,
    () => `${tags.map(em).join(' + ')}. See what falls out.`,
  ];

  // Middle — what's in the mix
  const middles = [
    () => `${artistCount} different artists make an appearance, from ${artistSample.slice(0, 2).join(' to ')}.`,
    () => `Tracks from ${artistSample.slice(0, 3).join(', ')}${artistCount > 3 ? ' and ' + (artistCount - 3) + ' more' : ''}.`,
    () => `You'll hear ${artistSample[0]} alongside ${artistSample[1] || 'others'}${artistCount > 4 ? ' — and plenty more' : ''}.`,
    () => `${artistCount} artists, no two in a row.`,
  ];

  // Closings
  const closings = [
    () => `${count} tracks${totalMin > 10 ? ', about ' + totalMin + ' minutes' : ''}. Hit play.`,
    () => `${count} tracks to get lost in.`,
    () => `That's ${count} songs. Lean back.`,
    () => totalMin > 30 ? `${count} tracks — a proper session.` : `${count} tracks — just right.`,
    () => ``,
  ];

  let parts = [pick(openings)()];
  if (Math.random() < 0.65) parts.push(pick(middles)());
  const c = pick(closings)();
  if (c) parts.push(c);

  return senCase(parts.join(' '));
}

async function loadGenres() {
  const grid = document.getElementById('genre-grid');
  grid.innerHTML = '<div class="context-loading">Loading genres…</div>';

  const tags = await getTopTags();
  if (!tags.length) {
    grid.innerHTML = '<div class="context-loading">Could not load genres.</div>';
    return;
  }

  renderGenreGrid(tags);
  genresLoaded = true;
}

function renderGenreGrid(tags) {
  const grid = document.getElementById('genre-grid');
  grid.innerHTML = tags.map((t, i) =>
    `<button class="genre-chip${selectedGenres.has(t) ? ' selected' : ''}" onclick="toggleGenre(this,'${esc(t)}')" style="animation-delay:${Math.min(i * 20, 400)}ms">${esc(t)}</button>`
  ).join('');
  updateTagMixControls();
}

function toggleGenre(chip, tag) {
  if (selectedGenres.has(tag)) {
    selectedGenres.delete(tag);
    chip.classList.remove('selected');
  } else {
    if (selectedGenres.size >= 3) {
      showToast('Max 3 genres at a time');
      return;
    }
    selectedGenres.add(tag);
    chip.classList.add('selected');
  }
  updateTagMixControls();
}

function updateTagMixControls() {
  const wrap = document.getElementById('tag-mix-controls');
  if (wrap) wrap.style.display = selectedGenres.size > 0 ? '' : 'none';
}

function adjustTagTracks(d) {
  tracksPerTag = Math.max(1, Math.min(10, tracksPerTag + d));
  document.getElementById('tag-track-count').textContent = tracksPerTag;
}

async function applyGenres() {
  const tags = [...selectedGenres];
  if (!tags.length) return;

  showToast(`Finding artists for ${tags.join(' + ')}…`);

  // Fetch top artist names from Last.fm for each tag
  const allNames = [];
  for (const tag of tags) {
    const lfmArtists = await getTopArtistsForTag(tag, 8);
    allNames.push(...lfmArtists.map(a => a.name));
  }

  // Deduplicate names
  const seen = new Set();
  const uniqueNames = allNames.filter(n => { const k = norm(n); if (seen.has(k)) return false; seen.add(k); return true; });

  // Shuffle and take up to 6 candidates, then search Spotify for each
  const candidates = uniqueNames.sort(() => Math.random() - 0.5).slice(0, 6);
  const spotifyMatches = [];

  for (const name of candidates) {
    if (spotifyMatches.length >= 3) break;
    try {
      const data = await spGet(`/search?type=artist&q=${encodeURIComponent(name)}&limit=1`);
      const item = data.artists?.items?.[0];
      if (item && norm(item.name) === norm(name)) {
        spotifyMatches.push({
          name:  item.name,
          image: item.images?.[1]?.url || item.images?.[0]?.url || '',
          sub:   item.followers?.total ? fmtNum(item.followers.total) + ' followers' : '',
        });
      }
    } catch { /* skip */ }
  }

  if (!spotifyMatches.length) {
    showError('Could not find matching artists on Spotify.');
    return;
  }

  // Fill slots
  for (let i = 0; i < 3; i++) artists[i] = spotifyMatches[i] || null;

  // Switch to search view
  setEntry('search');
  renderAllSlots();
  updateComboSaveBtn();
  updateSuggest();
  showToast(`${spotifyMatches.length} artists from ${tags.join(' + ')} — hit Generate!`);
}

// Browse from a context tag (About this mix panel)
async function browseFromTag(tag) {
  selectedGenres.clear();
  selectedGenres.add(tag.toLowerCase());
  setEntry('browse');
  if (genresLoaded) {
    // Re-render to show selection, preserving the cached tags
    const tags = await getTopTags();
    renderGenreGrid(tags);
  }
  // Scroll to top
  document.querySelector('.entry-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Options ───────────────────────────────────────────────────────────────────
function setMode(m, btn) {
  trackMode = m;
  document.querySelectorAll('#mode-control .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setModeByName(m) {
  trackMode = m;
  const modeMap = { top: 'Top Hits', deep: 'Deep Cuts', mix: 'Mix', discovery: 'Discovery' };
  const label = modeMap[m];
  document.querySelectorAll('#mode-control .seg-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === label);
  });
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
  currentMixLabel = active.map(a => a.name).join(' × ');

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

    generatedTracks = interleaveShuffle(dedup);

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
  generatedTracks = interleaveShuffle([...generatedTracks]);
  buildUriMap();
  renderResults();
}

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
      <button class="track-heart" id="heart-${i}" onclick="handleTrackHeart(event,${i})" title="Save to Liked Songs">♥</button>
    </div>`;
  }).join('');

  document.getElementById('results-section').classList.add('visible');
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Reset save button for the new mix
  const saveBtn = document.querySelector('.btn-save');
  if (saveBtn) {
    saveBtn.textContent = 'Save to Spotify';
    saveBtn.className = 'btn btn-primary btn-save';
    saveBtn.onclick = savePlaylist;
    saveBtn.disabled = false;
  }

  // Async: fetch liked state and update hearts
  if (accessToken) {
    const ids = generatedTracks.map(t => t.uri && t.uri.split(':').pop()).filter(Boolean);
    checkLikedTracks(ids).then(set => {
      likedSet = set;
      generatedTracks.forEach((t, i) => {
        if (t.uri) updateTrackRowHeart(i, set.has(t.uri.split(':').pop()));
      });
      // Sync player bar if a track is already playing
      if (nowPlayingIndex >= 0 && generatedTracks[nowPlayingIndex] && generatedTracks[nowPlayingIndex].uri) {
        updatePlayerBarHeart(generatedTracks[nowPlayingIndex].uri.split(':').pop());
      }
    }).catch(e => console.warn('liked-state update failed:', e));
  }
}

function updateTrackRowHeart(i, liked, animate) {
  const btn = document.getElementById('heart-' + i);
  if (!btn) return;
  btn.classList.toggle('liked', liked);
  if (animate) triggerHeartPop(btn);
}

async function handleTrackHeart(event, i) {
  event.stopPropagation();
  if (!accessToken) return;
  const t = generatedTracks[i];
  if (!t || !t.uri) return;
  const trackId = t.uri.split(':').pop();
  const wasLiked = likedSet.has(trackId);
  // Optimistic update
  if (wasLiked) likedSet.delete(trackId); else likedSet.add(trackId);
  updateTrackRowHeart(i, !wasLiked, true);
  // Sync player bar if this is the currently playing track
  if (nowPlayingIndex >= 0 && generatedTracks[nowPlayingIndex] && generatedTracks[nowPlayingIndex].uri === t.uri) {
    updatePlayerBarHeart(trackId);
  }
  try {
    const newState = await toggleLikeTrack(trackId, wasLiked);
    if (newState !== !wasLiked) {
      if (newState) likedSet.add(trackId); else likedSet.delete(trackId);
      updateTrackRowHeart(i, newState, false);
      if (nowPlayingIndex >= 0 && generatedTracks[nowPlayingIndex] && generatedTracks[nowPlayingIndex].uri === t.uri) {
        updatePlayerBarHeart(trackId);
      }
    }
  } catch {
    // Revert on error
    if (wasLiked) likedSet.add(trackId); else likedSet.delete(trackId);
    updateTrackRowHeart(i, wasLiked, false);
    if (nowPlayingIndex >= 0 && generatedTracks[nowPlayingIndex] && generatedTracks[nowPlayingIndex].uri === t.uri) {
      updatePlayerBarHeart(trackId);
    }
  }
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

// Shuffle that avoids consecutive tracks by the same artist
function interleaveShuffle(tracks) {
  if (tracks.length <= 1) return [...tracks];

  // Group by artist
  const byArtist = {};
  for (const t of tracks) {
    const key = norm(t.artist);
    if (!byArtist[key]) byArtist[key] = [];
    byArtist[key].push(t);
  }

  // Shuffle within each artist group
  const groups = Object.values(byArtist).map(g => shuffle(g));
  // Sort groups longest first for best interleaving
  groups.sort((a, b) => b.length - a.length);

  // Round-robin pick from each group
  const result = [];
  let round = 0;
  let placed = true;
  while (placed) {
    placed = false;
    // Shuffle group order each round for variety
    const order = shuffle([...Array(groups.length).keys()]);
    for (const gi of order) {
      if (round < groups[gi].length) {
        result.push(groups[gi][round]);
        placed = true;
      }
    }
    round++;
  }

  // Final pass: fix any remaining adjacent same-artist pairs
  for (let i = 1; i < result.length; i++) {
    if (norm(result[i].artist) === norm(result[i - 1].artist)) {
      // Find the nearest swap candidate
      for (let j = i + 1; j < result.length; j++) {
        if (norm(result[j].artist) !== norm(result[i - 1].artist) &&
            (j + 1 >= result.length || norm(result[j].artist) !== norm(result[j + 1]?.artist))) {
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
    }
  }

  return result;
}
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
  tagsEl.innerHTML = uniqueTags.map(t => `<span class="context-tag clickable" onclick="browseFromTag('${esc(t)}')">${esc(t)}</span>`).join('');

  // Build Last.fm narrative
  textEl.innerHTML = buildNarrative(artistNames, allTags, allBios, similarNames, mode, tracks);
}

function buildNarrative(names, allTags, allBios, similarNames, mode, tracks) {
  const n = names.length;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ── Data prep ──────────────────────────────────────────────────────────────
  const bioSnippets = allBios.map(bio => {
    if (!bio) return '';
    const first = bio.split(/(?<=[.!?])\s+/)[0] || '';
    return first.length > 20 ? first : '';
  });

  const tagSets = allTags.map(t => new Set(t));
  let sharedTags = [];
  if (n >= 2) {
    sharedTags = [...tagSets[0]].filter(t => tagSets.slice(1).every(s => s.has(t))).slice(0, 3);
  }

  const uniquePerArtist = allTags.map((tags, i) => {
    const others = new Set(allTags.filter((_, j) => j !== i).flat());
    return tags.filter(t => !others.has(t)).slice(0, 2);
  });

  const allTopTags = [...new Set(allTags.flat())].slice(0, 5);
  const em = t => `<em>${t}</em>`;
  const A = names[0], B = names[1], C = names[2];
  const listNames = n === 2 ? `${A} and ${B}` : n === 3 ? `${A}, ${B} and ${C}` : A;

  // Track distribution
  const dist = tracks.reduce((acc, t) => { acc[t.artist] = (acc[t.artist] || 0) + 1; return acc; }, {});
  const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const dominant = sorted.length > 1 && sorted[0][1] > sorted[1][1] + 2 ? sorted[0][0] : null;
  const count = tracks.length;

  // Total duration
  const totalMs = tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const totalMin = Math.round(totalMs / 60000);

  // ── Template pools ─────────────────────────────────────────────────────────

  // OPENING — 1 artist
  const open1bio = [
    () => bioSnippets[0],
    () => `${A}. ${bioSnippets[0]}`,
  ].filter(() => bioSnippets[0]);
  const open1tags = allTags[0]?.length ? [
    () => `${A} brings a sound rooted in ${em(allTags[0][0])}${allTags[0][1] ? ' and ' + em(allTags[0][1]) : ''}.`,
    () => `Somewhere between ${em(allTags[0][0])} and ${em(allTags[0][1] || allTags[0][0])}, ${A} carved out a lane.`,
    () => `The world of ${em(allTags[0][0])} through the lens of ${A}.`,
    () => `${A}: ${allTags[0].slice(0, 3).map(em).join(', ')}, and everything in between.`,
  ] : [];
  const open1 = [
    ...open1bio,
    ...open1tags,
    () => `A deep dive into the catalog of ${A}.`,
    () => `Just ${A}. Nothing else needed.`,
  ];

  // OPENING — 2 artists, shared tags
  const open2shared = sharedTags.length ? [
    () => `${A} and ${B} both live in the world of ${em(sharedTags[0])}${uniquePerArtist[0][0] ? ' — though ${A} pulls it toward ' + em(uniquePerArtist[0][0]) + ' while ${B} keeps it closer to ' + em(uniquePerArtist[1]?.[0] || sharedTags[0]) : ''}.`,
    () => `There's a shared thread of ${sharedTags.slice(0, 2).map(em).join(' and ')} running through both ${A} and ${B}.`,
    () => `${em(sharedTags[0])} is the common language here — ${A} and ${B} just speak it with different accents.`,
    () => `Both rooted in ${em(sharedTags[0])}, ${A} and ${B} approach it from opposite ends of the room.`,
    () => `${A} meets ${B} on the common ground of ${sharedTags.slice(0, 2).map(em).join(' and ')}.`,
    () => `Two artists, one frequency: ${em(sharedTags[0])}. ${A} and ${B} tune in differently, but the signal is the same.`,
  ] : [];

  // OPENING — 2 artists, contrast
  const t0 = allTags[0]?.slice(0, 2) || [], t1 = allTags[1]?.slice(0, 2) || [];
  const open2contrast = (t0.length && t1.length) ? [
    () => `${A}'s ${em(t0[0])} sensibility collides with ${B}'s ${em(t1[0])} instincts.`,
    () => `On paper, ${em(t0[0])} and ${em(t1[0])} don't belong together. In practice, ${A} and ${B} prove otherwise.`,
    () => `${A} comes from the ${em(t0[0])} side. ${B} from ${em(t1[0])}. The tension is the point.`,
    () => `An unlikely combination: ${A}'s ${em(t0[0])} world meets ${B}'s ${em(t1[0])} edge.`,
    () => `File this under "shouldn't work but does" — ${em(t0[0])} meets ${em(t1[0])}, courtesy of ${A} and ${B}.`,
  ] : [
    () => `${A} and ${B} — two distinct voices, one playlist.`,
    () => `${A} alongside ${B}. Different worlds, same wavelength.`,
  ];

  // OPENING — 3 artists, shared
  const open3shared = sharedTags.length ? [
    () => `${em(sharedTags[0])} runs through all three: ${listNames}.`,
    () => `${listNames} — three corners of the ${em(sharedTags[0])} universe.`,
    () => `A triangle built on ${sharedTags.slice(0, 2).map(em).join(' and ')}: ${listNames}.`,
    () => `Three artists who all orbit ${em(sharedTags[0])}, each with their own gravity.`,
    () => `${listNames}. The thread connecting them? ${sharedTags.slice(0, 2).map(em).join(' and ')}.`,
    () => `What do ${listNames} have in common? Start with ${em(sharedTags[0])}.`,
  ] : [];

  // OPENING — 3 artists, mixed/no shared
  const open3mixed = allTopTags.length >= 2 ? [
    () => `A mix that wanders between ${allTopTags.slice(0, 3).map(em).join(', ')} — ${listNames} leading the way.`,
    () => `${listNames} each bring something different: ${allTopTags.slice(0, 3).map(em).join(', ')}.`,
    () => `Three artists, three angles: ${allTopTags.slice(0, 3).map(em).join(', ')}. ${listNames}.`,
    () => `${listNames} don't share a genre so much as a restlessness — touching on ${allTopTags.slice(0, 3).map(em).join(', ')}.`,
  ] : [
    () => `${listNames} — three voices, one session.`,
    () => `${listNames}, together. Let it play.`,
  ];

  // MODE sentences
  const modeSentences = {
    top: [
      () => `The biggest tracks, front and center.`,
      () => `This is the highlight reel — the songs that made them.`,
      () => `All hits, no filler.`,
      () => `The tracks everyone knows, and for good reason.`,
      () => `Start here if you're meeting these artists for the first time.`,
    ],
    deep: [
      () => `Past the singles, into the album cuts.`,
      () => `These are the tracks the fans talk about.`,
      () => `Deeper than the setlist — the songs you find on the third listen.`,
      () => `Skip the greatest hits. This is where it gets interesting.`,
      () => `The B-sides, the deep cuts, the ones that reward attention.`,
    ],
    mix: [
      () => `A mix of the anthems and the deep pulls.`,
      () => `Hits to anchor it, deeper tracks to keep it honest.`,
      () => `Half familiar, half discovery.`,
      () => `The best of both — big songs and buried ones.`,
    ],
    discovery: similarNames?.length ? [
      () => `Discovery mode pulled in ${similarNames.slice(0, 2).join(' and ')}${similarNames.length > 2 ? ' among others' : ''} — expanding the map.`,
      () => `Beyond the names you picked: ${similarNames.slice(0, 3).join(', ')}${similarNames.length > 3 ? ' and more' : ''} round out the mix.`,
      () => `The algorithm went exploring and came back with ${similarNames.slice(0, 2).join(' and ')}${similarNames.length > 2 ? ', plus a few more' : ''}.`,
      () => `${similarNames.slice(0, 2).join(', ')}${similarNames.length > 2 ? ' and others' : ''} join the session — artists cut from similar cloth.`,
    ] : [
      () => `Discovery mode on — expect some names you haven't heard.`,
    ],
  };

  // CLOSING sentences
  const closings = [
    () => `${count} tracks${totalMin > 10 ? ', about ' + totalMin + ' minutes' : ''}.`,
    () => `${count} tracks. Hit play.`,
    () => `${count} songs${dominant ? ', tilted slightly toward ' + dominant : ' spread evenly'}.`,
    () => `${count} tracks to settle into.`,
    () => totalMin > 30 ? `${count} tracks — enough for a long drive.` : `${count} tracks — enough for the commute.`,
    () => `That's ${count} tracks${totalMin ? ' and about ' + totalMin + ' minutes' : ''}. Lean back.`,
    () => dominant ? `${count} tracks, with ${dominant} carrying a little more of the weight.` : `${count} tracks, balanced across the board.`,
    () => ``,  // Sometimes skip the closing entirely
  ];

  // ── Assemble ───────────────────────────────────────────────────────────────
  let parts = [];

  // Pick opening
  if (n === 1) {
    parts.push(pick(open1)());
  } else if (n === 2) {
    parts.push(pick(sharedTags.length ? open2shared : open2contrast)());
  } else {
    parts.push(pick(sharedTags.length ? open3shared : open3mixed)());
  }

  // Pick mode sentence (~70% chance, skip sometimes for variety)
  const modePool = modeSentences[mode];
  if (modePool && Math.random() < 0.7) {
    parts.push(pick(modePool)());
  }

  // Maybe add a bio snippet (~40% chance, only if we have one and it's not redundant)
  if (Math.random() < 0.4 && n > 0) {
    const unusedBio = bioSnippets.find((b, i) => b && !parts[0]?.includes(names[i]));
    if (unusedBio && parts.join('').length < 250) {
      parts.push(unusedBio);
    }
  }

  // Pick closing (~80% chance)
  if (Math.random() < 0.8) {
    const c = pick(closings)();
    if (c) parts.push(c);
  }

  return senCase(parts.join(' '));
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
  // Load combos regardless of auth state
  loadCombos();
  renderCombos();

  const code = new URLSearchParams(window.location.search).get('code');
  if (code) await exchangeCode(code);
  else accessToken = localStorage.getItem('spotify_token');

  if (accessToken) {
    try {
      const me = await spGet('/me');
      userId = me.id;
      document.getElementById('username-label').textContent = me.display_name || me.id;
      document.getElementById('auth-section').classList.add('hidden');
      document.getElementById('app-section').classList.add('visible');
      renderAllSlots();
      // Initialize SDK if loaded
      if (window.Spotify && !sdkPlayer) initSDKPlayer();
    } catch {
      // Token expired — try refreshing
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        try {
          const me = await spGet('/me');
          userId = me.id;
          document.getElementById('username-label').textContent = me.display_name || me.id;
          document.getElementById('auth-section').classList.add('hidden');
          document.getElementById('app-section').classList.add('visible');
          renderAllSlots();
          if (window.Spotify && !sdkPlayer) initSDKPlayer();
        } catch {
          localStorage.removeItem('spotify_token');
          localStorage.removeItem('spotify_refresh');
          accessToken = null;
        }
      } else {
        localStorage.removeItem('spotify_token');
        accessToken = null;
      }
    }
  }
}

init();
