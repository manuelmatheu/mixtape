// ── Supabase Cloud Sync ──────────────────────────────────────────────────────
// Syncs saved combos to Supabase. localStorage is the primary read source;
// Supabase is the background sync layer. All failures are silent.

let _sb = null; // Supabase client instance

// Init: create client at load time if UMD is available
(function initSupabase() {
  try {
    if (window.supabase && SUPABASE_URL && SUPABASE_ANON) {
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      cloudSyncReady = true;
    }
  } catch (e) {
    console.warn('Supabase init failed:', e);
  }
})();

async function fetchCloudCombos(spotifyId) {
  if (!cloudSyncReady || !spotifyId) return [];
  try {
    const { data, error } = await _sb
      .from('user_combos')
      .select('combos')
      .eq('spotify_id', spotifyId)
      .single();
    if (error || !data) return [];
    return Array.isArray(data.combos) ? data.combos : [];
  } catch (e) {
    console.warn('fetchCloudCombos failed:', e);
    return [];
  }
}

async function upsertCloudCombos(spotifyId, combos) {
  if (!cloudSyncReady || !spotifyId) return;
  try {
    const { error } = await _sb
      .from('user_combos')
      .upsert({
        spotify_id: spotifyId,
        combos: combos,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'spotify_id' });
    if (error) console.warn('upsertCloudCombos error:', error);
  } catch (e) {
    console.warn('upsertCloudCombos failed:', e);
  }
}

async function mergeAndSync(spotifyId, localCombos) {
  if (!cloudSyncReady || !spotifyId) return;
  syncInProgress = true;
  try {
    const cloudCombos = await fetchCloudCombos(spotifyId);

    // Build set of existing keys from local combos
    const seen = new Set(localCombos.map(c => comboKey(c)));
    const merged = [...localCombos];

    // Add cloud combos not already in local
    for (const c of cloudCombos) {
      const key = comboKey(c);
      if (!seen.has(key)) {
        merged.push(c);
        seen.add(key);
      }
    }

    // Update global state and persist
    savedCombos = merged;
    try { localStorage.setItem('mixtape_combos', JSON.stringify(savedCombos)); } catch {}
    renderCombos();

    // Push merged result to cloud
    await upsertCloudCombos(spotifyId, merged);
  } catch (e) {
    console.warn('mergeAndSync failed:', e);
  } finally {
    syncInProgress = false;
  }
}
