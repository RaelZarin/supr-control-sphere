// Server-backed store: passcode handling, JSON API, debounced autosave, polling, presets.
const KEY_LS = 'cs_key';
const CLIENT = Math.random().toString(36).slice(2, 8);

export function initKey() {
  const u = new URL(location.href); const k = u.searchParams.get('key');
  if (k) { localStorage.setItem(KEY_LS, k); u.searchParams.delete('key'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
  return localStorage.getItem(KEY_LS) || '';
}

export function createServerStore({ onStatus, onRemote }) {
  const key = initKey();
  const api = async (path, opts = {}) => {
    const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Key': key, ...(opts.headers || {}) } });
    if (r.status === 401) { localStorage.removeItem(KEY_LS); location.reload(); throw new Error('locked'); }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    return r.json();
  };
  let rev = 0, timer = null, dirty = false, saving = false, latest = null;

  async function load() {
    const doc = await api('/api/state'); rev = doc.rev || 0;
    if (doc.state && doc.state.tree) return { state: doc.state, savedAt: doc.updatedAt };
    const d = await api('/api/defaults');
    return { state: { tree: d.tree, settings: null }, savedAt: null, fresh: true, source: d.source };
  }
  async function flush() {
    if (!dirty || saving) return; saving = true; dirty = false; onStatus('Saving…');
    try { const r = await api('/api/state', { method: 'PUT', body: JSON.stringify({ state: latest, client: CLIENT }) }); rev = r.rev; onStatus('Saved ' + new Date(r.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })); }
    catch (e) { dirty = true; onStatus('Not saved, retrying (' + e.message + ')'); setTimeout(flush, 4000); }
    finally { saving = false; if (dirty) schedule(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, 700); }
  function save(state) { latest = state; dirty = true; onStatus('Editing…'); schedule(); }
  async function poll() {
    if (dirty || saving || document.hidden) return;
    try { const doc = await api('/api/state'); if (doc.rev > rev && doc.state && doc.client !== CLIENT) { rev = doc.rev; onRemote(doc.state); onStatus('Synced from another device'); } else if (doc.rev > rev) rev = doc.rev; }
    catch { onStatus('Offline'); }
  }
  setInterval(poll, 6000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); else flush(); });
  window.addEventListener('pagehide', () => { if (dirty && latest) fetch('/api/state', { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Key': key }, body: JSON.stringify({ state: latest, client: CLIENT }) }); });

  return {
    mode: 'server',
    load, save, flush,
    defaults: () => api('/api/defaults'),
    listPresets: () => api('/api/presets'),
    savePreset: (name, state) => api('/api/presets/' + encodeURIComponent(name), { method: 'PUT', body: JSON.stringify({ state }) }),
    loadPreset: (name) => api('/api/presets/' + encodeURIComponent(name)),
    deletePreset: (name) => api('/api/presets/' + encodeURIComponent(name), { method: 'DELETE' }),
    applySettings: async () => ({ ok: true, mode: 'server' }),
    dispose() { clearTimeout(timer); },
  };
}
