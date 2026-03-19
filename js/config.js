// ── Config ───────────────────────────────────────────────────────────────────
const SPOTIFY_CLIENT_ID = '73fce01f5762463e86ff6555751a148c';
const LASTFM_API_KEY    = '177b9e8ee70fe2325bfff606cfdaee23';
const REDIRECT_URI      = window.location.origin + window.location.pathname;
const SCOPES = [
  'user-read-private','user-read-email',
  'user-modify-playback-state','user-read-playback-state','user-read-currently-playing',
  'playlist-modify-public','playlist-modify-private',
  'streaming','user-library-modify','user-library-read',
].join(' ');

// ── State ─────────────────────────────────────────────────────────────────────
let accessToken     = null;
let userId          = null;
let trackMode       = 'top';
let tracksPerArtist = 5;
let showMeta        = false;
let generatedTracks = [];
let rawTracks       = {};
let nowPlayingIndex = -1;
let pollTimer       = null;
let uriToIndices    = {};
const artists       = [null, null, null];
const searchTimers  = {};
let savedCombos     = [];  // [{artists: [{name, image, sub},...]}]
let tracksPerTag    = 5;   // Tag Mix: tracks fetched per tag

// ── SDK Player State ──────────────────────────────────────────────────────────
let sdkPlayer          = null;
let sdkDeviceId        = null;
let sdkReady           = false;
let sdkNeedsRetransfer = false; // set true when SDK reconnects after auth error
let progressRAF        = null;  // requestAnimationFrame id for progress bar
let lastSDKState       = null;  // last player_state_changed state
