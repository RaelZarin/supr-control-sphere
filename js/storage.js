// Storage facade: use the Node API when this app is served from the box, otherwise gist/local mode.
import { createServerStore } from './storage-server.js';
import { createGistStore } from './storage-gist.js';

export async function detectMode(fetchFn = fetch) {
  try {
    const r = await fetchFn('/healthz', { cache: 'no-store' });
    if (!r.ok) return 'gist';
    const j = await r.json();
    return j && j.ok === true ? 'server' : 'gist';
  } catch {
    return 'gist';
  }
}

export function createStore({ onStatus, onRemote }, deps = {}) {
  const detect = deps.detectMode || detectMode;
  const makeServer = deps.createServerStore || createServerStore;
  const makeGist = deps.createGistStore || createGistStore;
  let implP = null;
  const hooks = { onStatus, onRemote };
  const impl = () => (implP ||= detect(deps.fetch).then((m) => (m === 'server' ? makeServer(hooks, deps) : makeGist(hooks, deps))));
  const wrap = (name) => (...args) => impl().then((i) => i[name](...args));
  return {
    load: wrap('load'),
    save: (state) => { impl().then((i) => i.save(state)); },
    flush: wrap('flush'),
    defaults: wrap('defaults'),
    listPresets: wrap('listPresets'),
    savePreset: wrap('savePreset'),
    loadPreset: wrap('loadPreset'),
    deletePreset: wrap('deletePreset'),
    applySettings: wrap('applySettings'),
    mode: () => impl().then((i) => i.mode),
    dispose: () => { if (implP) implP.then((i) => i.dispose?.()); },
  };
}
