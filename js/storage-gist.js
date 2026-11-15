// Gist + localStorage store: offline-first cache, optional private-gist sync, last-write-wins.
export const LS_TOKEN = 'cs_gist_token';
export const LS_GIST = 'cs_gist_id';
export const LS_CACHE = 'cs_state_cache';
export const LS_PRESETS = 'cs_presets_cache';
export const GIST_DESC = 'SUPR Control Sphere saved state';
const API = 'https://api.github.com';
const PRESET_RE = /^preset-(.+)\.json$/;
const NAME_RE = /^[\w \-]{1,40}$/;

export function scrub(text) {
  return String(text ?? '').replace(/gh[a-z]_[A-Za-z0-9_]+/g, '***').replace(/github_pat_[A-Za-z0-9_]+/g, '***');
}
export function isNewer(remote, local) {
  if (!remote) return false;
  if (!local) return true;
  const rr = remote.rev || 0, lr = local.rev || 0;
  if (rr !== lr) return rr > lr;
  return String(remote.updatedAt || '') > String(local.updatedAt || '');
}
export function presetFile(name) { return 'preset-' + name + '.json'; }
export function parsePresetName(file) { const m = PRESET_RE.exec(file); return m ? m[1] : ''; }

function readJson(storage, key, fallback) {
  try { const v = JSON.parse(storage.getItem(key) || 'null'); return v == null ? fallback : v; } catch { return fallback; }
}
export async function gistRequest(fetchFn, token, method, path, body) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetchFn(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (r.status === 304) return { _notModified: true, etag: r.headers.get('ETag') };
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 160) }; }
  if (!r.ok) throw new Error(scrub((data && (data.message || data.error)) || r.statusText || 'gist request failed'));
  if (data && typeof data === 'object') data._etag = r.headers.get('ETag');
  return data;
}
function fileDoc(gist, name) {
  const f = gist && gist.files && gist.files[name];
  if (!f || f.content == null) return null;
  try { return JSON.parse(f.content); } catch { return null; }
}
function presetsFromGist(gist) {
  const out = {};
  for (const [file, meta] of Object.entries((gist && gist.files) || {})) {
    const name = parsePresetName(file); if (!name || !meta || meta.content == null) continue;
    try { const doc = JSON.parse(meta.content); if (doc && doc.state) out[name] = { name, savedAt: doc.savedAt, state: doc.state }; } catch { /* skip bad preset */ }
  }
  return out;
}

export function createGistStore({ onStatus, onRemote }, deps = {}) {
  const storage = deps.storage || localStorage;
  const fetchFn = deps.fetch || fetch.bind(globalThis);
  const now = deps.now || (() => new Date().toISOString());
  const client = deps.client || Math.random().toString(36).slice(2, 8);
  const pollMs = deps.pollMs ?? 12000;
  const hidden = deps.hidden || (() => typeof document !== 'undefined' && document.hidden);
  const delay = deps.delay ?? 700;
  let rev = 0, seenRev = 0, etag = '', timer = null, pollTimer = null, retryTimer = null;
  let dirty = false, saving = false, latest = null, remoteKnown = false;

  const token = () => storage.getItem(LS_TOKEN) || '';
  const gistId = () => storage.getItem(LS_GIST) || '';
  const cache = () => readJson(storage, LS_CACHE, null);
  const writeCache = (doc) => storage.setItem(LS_CACHE, JSON.stringify(doc));
  const presetMap = () => readJson(storage, LS_PRESETS, {}) || {};
  const writePresets = (m) => storage.setItem(LS_PRESETS, JSON.stringify(m));
  const api = (method, path, body) => gistRequest(fetchFn, token(), method, path, body);
  const localStatus = () => onStatus(token() ? 'Saved locally — waiting to sync' : 'Local only');

  async function findGist() {
    const list = await api('GET', '/gists?per_page=100');
    const hits = (Array.isArray(list) ? list : []).filter((g) => g.description === GIST_DESC);
    hits.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    return hits[0]?.id || '';
  }
  async function ensureGistId() {
    if (gistId()) return gistId();
    const found = await findGist();
    if (found) storage.setItem(LS_GIST, found);
    return found;
  }
  function applyDoc(doc, { announce = false } = {}) {
    if (!doc || !doc.state || !doc.state.tree) return false;
    rev = doc.rev || 0; seenRev = Math.max(seenRev, rev);
    writeCache(doc);
    if (announce) { onRemote(doc.state); onStatus('Synced from another device'); }
    return true;
  }
  function readFiles(gist) {
    if (gist && gist._etag) etag = gist._etag;
    const presets = presetsFromGist(gist);
    if (Object.keys(presets).length) writePresets({ ...presetMap(), ...presets });
    return fileDoc(gist, 'state.json');
  }

  async function pull() {
    const t = token(); if (!t) return null;
    const id = gistId() || await ensureGistId();
    if (!id) { remoteKnown = true; return null; }
    const r = await gistRequest(fetchFn, t, 'GET', '/gists/' + id);
    remoteKnown = true;
    return readFiles(r);
  }
  async function pollGet() {
    const t = token(); const id = gistId(); if (!t || !id) return null;
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + t };
    if (etag) headers['If-None-Match'] = etag;
    const r = await fetchFn(API + '/gists/' + id, { method: 'GET', headers });
    if (r.status === 304) return { _notModified: true };
    const text = await r.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 160) }; }
    if (!r.ok) throw new Error(scrub((data && data.message) || r.statusText || 'gist request failed'));
    data._etag = r.headers.get('ETag'); remoteKnown = true;
    return readFiles(data);
  }

  async function load() {
    const local = cache();
    if (local && local.state && local.state.tree) { rev = local.rev || 0; seenRev = rev; latest = local.state; }
    if (!token()) {
      onStatus('Local only');
      if (local && local.state && local.state.tree) return { state: local.state, savedAt: local.updatedAt };
      const d = await defaults();
      return { state: { tree: d.tree, settings: null }, savedAt: null, fresh: true, source: d.source };
    }
    try {
      const remote = await pull();
      if (remote && remote.state && remote.state.tree) {
        if (isNewer(remote, local)) { applyDoc(remote); latest = remote.state; return { state: remote.state, savedAt: remote.updatedAt }; }
        latest = local.state; return { state: local.state, savedAt: local.updatedAt };
      }
      if (local && local.state && local.state.tree) { onStatus('Local only until first sync'); return { state: local.state, savedAt: local.updatedAt }; }
      const d = await defaults();
      return { state: { tree: d.tree, settings: null }, savedAt: null, fresh: true, source: d.source };
    } catch (e) {
      onStatus('Offline — using last saved copy' + (e.message ? ' (' + e.message + ')' : ''));
      if (local && local.state && local.state.tree) return { state: local.state, savedAt: local.updatedAt };
      const d = await defaults();
      return { state: { tree: d.tree, settings: null }, savedAt: null, fresh: false, source: d.source };
    }
  }

  async function createGist(doc) {
    const files = { 'state.json': { content: JSON.stringify(doc) } };
    for (const [name, p] of Object.entries(presetMap())) files[presetFile(name)] = { content: JSON.stringify(p) };
    const created = await api('POST', '/gists', { description: GIST_DESC, public: false, files });
    if (!created || !created.id) throw new Error('gist was not created');
    storage.setItem(LS_GIST, created.id); remoteKnown = true; if (created._etag) etag = created._etag;
    return created.id;
  }
  async function flush() {
    if (!dirty || saving) return; saving = true; dirty = false;
    rev = Math.max(rev, seenRev) + 1;
    const doc = { rev, updatedAt: now(), client, state: latest };
    writeCache(doc);
    if (!token()) { localStatus(); saving = false; return; }
    onStatus('Saving…');
    try {
      let id = gistId() || await ensureGistId();
      if (!id) id = await createGist(doc);
      else await api('PATCH', '/gists/' + id, { files: { 'state.json': { content: JSON.stringify(doc) } } });
      seenRev = rev; remoteKnown = true;
      onStatus('Saved ' + new Date(doc.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    } catch (e) {
      dirty = true; onStatus('Not saved, retrying (' + e.message + ')');
      retryTimer = setTimeout(flush, 4000);
    } finally { saving = false; if (dirty) schedule(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, delay); }
  function save(state) {
    latest = state; dirty = true;
    writeCache({ rev, updatedAt: now(), client, state });
    onStatus(token() ? 'Editing…' : 'Local only');
    schedule();
  }
  async function poll() {
    if (dirty || saving || hidden() || !token()) return;
    try {
      if (!gistId()) { const id = await ensureGistId(); if (!id) return; }
      const remote = await pollGet();
      if (!remote || remote._notModified) return;
      const local = cache();
      if (remote.client === client) { if (remote.rev > rev) rev = remote.rev; seenRev = Math.max(seenRev, remote.rev || 0); return; }
      if (isNewer(remote, local)) applyDoc(remote, { announce: true });
      else if (remote.rev > seenRev) seenRev = remote.rev;
    } catch { onStatus('Offline'); }
  }

  async function defaults() {
    const r = await fetchFn('defaults.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('Could not load defaults');
    return r.json();
  }
  function listPresets() {
    return Object.values(presetMap()).map((p) => ({ name: p.name, savedAt: p.savedAt })).sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
  }
  async function savePreset(name, state) {
    const n = NAME_RE.test(name || '') ? name.trim() : '';
    if (!n) throw new Error('name: letters, numbers, space, _ or -, up to 40');
    const doc = { name: n, savedAt: now(), state };
    const map = presetMap(); map[n] = doc; writePresets(map);
    if (token()) {
      const id = gistId() || await ensureGistId() || await createGist(cache() || { rev, updatedAt: now(), client, state: latest || state });
      await api('PATCH', '/gists/' + id, { files: { [presetFile(n)]: { content: JSON.stringify(doc) } } });
    }
    return { name: n, savedAt: doc.savedAt };
  }
  async function loadPreset(name) {
    const doc = presetMap()[name]; if (doc) return doc;
    throw new Error('no preset');
  }
  async function deletePreset(name) {
    const map = presetMap(); delete map[name]; writePresets(map);
    if (token() && gistId()) await api('PATCH', '/gists/' + gistId(), { files: { [presetFile(name)]: null } });
    return { ok: true };
  }

  if (pollMs > 0) pollTimer = setInterval(poll, pollMs);
  if (typeof document !== 'undefined' && !deps.noTimers) {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); else flush(); });
    window.addEventListener('pagehide', () => { if (dirty) flush(); });
  }

  async function applySettings(cfg = {}) {
    if (cfg.forgetToken || cfg.token === '') storage.removeItem(LS_TOKEN);
    else if (typeof cfg.token === 'string' && cfg.token.trim()) storage.setItem(LS_TOKEN, cfg.token.trim());
    if (typeof cfg.gistId === 'string' && cfg.gistId.trim()) storage.setItem(LS_GIST, cfg.gistId.trim());
    if (!token()) { onStatus('Local only'); return { ok: true, mode: 'local' }; }
    try {
      const remote = await pull();
      const local = cache();
      if (remote && isNewer(remote, local)) { applyDoc(remote, { announce: true }); return { ok: true, mode: 'gist' }; }
      if (local && local.state) { latest = local.state; dirty = true; await flush(); return { ok: true, mode: 'gist' }; }
      onStatus('Connected');
      return { ok: true, mode: 'gist' };
    } catch (e) {
      const err = new Error(scrub(e.message || e));
      onStatus('Token saved, but sync failed (' + err.message + ')');
      throw err;
    }
  }

  return {
    mode: 'gist', load, save, flush, defaults, listPresets, savePreset, loadPreset, deletePreset,
    applySettings, poll, pull, ensureGistId, findGist,
    dispose() { clearTimeout(timer); clearTimeout(retryTimer); clearInterval(pollTimer); },
  };
}
