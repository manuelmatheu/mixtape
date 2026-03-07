// ── Last.fm API ───────────────────────────────────────────────────────────────
async function lfm(params) {
  const p = new URLSearchParams({ ...params, api_key: LASTFM_API_KEY, format: 'json' });
  const r = await fetch('https://ws.audioscrobbler.com/2.0/?' + p);
  if (!r.ok) throw new Error('Last.fm ' + r.status);
  return r.json();
}

// ── Similar artist fetching ───────────────────────────────────────────────────
async function getSimilarArtists(artistNames, limit = 3) {
  const results = await Promise.allSettled(
    artistNames.map(name => lfm({ method: 'artist.getSimilar', artist: name, limit: 10 }))
  );

  const selectedNorm = new Set(artistNames.map(norm));
  const seen   = new Set();
  const similar = [];

  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    const raw = res.value.similarartists?.artist || [];
    const items = Array.isArray(raw) ? raw : [raw];
    for (const a of items) {
      if (!a?.name) continue;
      const key = norm(a.name);
      if (selectedNorm.has(key) || seen.has(key)) continue;
      seen.add(key);
      similar.push(a.name);
      if (similar.length >= limit) break;
    }
    if (similar.length >= limit) break;
  }

  return similar;
}

async function getDiscoveryTracks(similarArtistNames) {
  const tracks = [];
  for (const name of similarArtistNames) {
    try {
      const data = await lfm({ method: 'artist.getTopTracks', artist: name, limit: 5 });
      const raw  = data.toptracks?.track || [];
      const all  = (Array.isArray(raw) ? raw : [raw]).filter(t => t?.name);
      const picked = all.slice(0, 2).map(t => ({ ...t, _type: 'discovery', _similarArtist: name }));
      tracks.push(...picked);
    } catch { /* skip silently */ }
  }
  return tracks;
}

async function getTracksForArtist(artist) {
  const data   = await lfm({ method: 'artist.getTopTracks', artist: artist.name, limit: 50 });
  const raw    = data.toptracks?.track || [];
  const all    = (Array.isArray(raw) ? raw : [raw]).filter(t => t?.name);

  if (trackMode === 'top') {
    return all.slice(0, tracksPerArtist).map(t => ({ ...t, _type: 'top' }));
  }
  if (trackMode === 'deep') {
    return all.slice(10, 10 + tracksPerArtist).map(t => ({ ...t, _type: 'deep' }));
  }
  // Mix
  const half    = Math.ceil(tracksPerArtist / 2);
  const topHalf = all.slice(0, half).map(t => ({ ...t, _type: 'top' }));
  const deep    = all.slice(10, 10 + (tracksPerArtist - half)).map(t => ({ ...t, _type: 'deep' }));
  return [...topHalf, ...deep];
}

// ── Artist tags (for context narrative) ────────────────────────────────────────
async function getArtistTags(artistName) {
  try {
    const data = await lfm({ method: 'artist.getTopTags', artist: artistName });
    const tags = data.toptags?.tag || [];
    return (Array.isArray(tags) ? tags : [tags])
      .filter(t => t?.name)
      .slice(0, 5)
      .map(t => t.name.toLowerCase());
  } catch { return []; }
}

async function getArtistInfo(artistName) {
  try {
    const data = await lfm({ method: 'artist.getInfo', artist: artistName });
    const bio = data.artist?.bio?.summary || '';
    // Strip HTML tags and "Read more" links
    return bio.replace(/<[^>]+>/g, '').replace(/Read more on Last\.fm.*/i, '').trim();
  } catch { return ''; }
}

async function matchToSpotify(lfmTrack) {
  const trackName  = lfmTrack.name;
  const artistName = lfmTrack.artist?.name || '';
  const q = `track:${encodeURIComponent(trackName)} artist:${encodeURIComponent(artistName)}`;
  try {
    const data  = await spGet(`/search?type=track&q=${q}&limit=5&market=from_token`);
    const items = data.tracks?.items || [];
    if (!items.length) return null;

    const normArtist = norm(artistName);
    const best = items.find(t => t.artists.some(a => norm(a.name) === normArtist)) || items[0];

    return {
      uri:        best.uri,
      name:       best.name,
      artist:     best.artists[0]?.name || artistName,
      duration:   best.duration_ms,
      albumArt:   best.album?.images?.[2]?.url || best.album?.images?.[0]?.url || '',
      _type:      lfmTrack._type,
      _playcount: parseInt(lfmTrack.playcount) || 0,
    };
  } catch { return null; }
}
