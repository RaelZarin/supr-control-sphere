// Settings dialog: paste a gist-scoped GitHub token (and optional gist id) once per device. The token is stored only in localStorage and never logged.
import { h } from './ui.js';
import { LS_TOKEN, LS_GIST, scrub } from './storage-gist.js';

export function currentGistConfig(storage = localStorage) {
  return { token: storage.getItem(LS_TOKEN) || '', gistId: storage.getItem(LS_GIST) || '' };
}

export function bindSettingsButton(btn, store) {
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const mode = await store.mode();
    openSettingsDialog({
      mode,
      getConfig: () => currentGistConfig(),
      onSave: async (cfg) => store.applySettings(cfg),
      onForget: async () => store.applySettings({ token: '', gistId: currentGistConfig().gistId, forgetToken: true }),
    });
  });
}

export function openSettingsDialog({ mode, getConfig, onSave, onForget }) {
  document.getElementById('csSettings')?.remove();
  const cfg = getConfig() || {};
  const token = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'github_pat_… or ghp_…', value: cfg.token || '' });
  const gist = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Leave blank to find or create one', value: cfg.gistId || '' });
  const msg = h('div', { class: 'hint' }, '');
  const close = () => back.remove();
  const save = async () => {
    msg.textContent = 'Saving…';
    try {
      await onSave({ token: token.value.trim(), gistId: gist.value.trim() });
      close();
    } catch (e) { msg.textContent = scrub(e.message || e); }
  };
  const forget = async () => {
    token.value = '';
    try { await onForget(); msg.textContent = 'Token removed from this device. Builds stay in this browser only.'; }
    catch (e) { msg.textContent = scrub(e.message || e); }
  };

  const body = mode === 'server'
    ? [h('p', {}, 'This session is syncing through the Tailscale server on the always-on box host. Use Settings on the public site to sync with a private gist instead.'),
       h('p', { class: 'hint' }, 'Always-on site: https://raelzarin.github.io/supr-control-sphere/')]
    : [h('p', {}, 'Paste a GitHub token that can only read and write gists. It stays in this browser and is sent only to api.github.com.'),
       h('label', {}, 'GitHub token', token),
       h('label', {}, 'Gist ID (optional)', gist),
       msg,
       h('div', { class: 'actions' },
         h('button', { type: 'button', class: 'primary', onClick: save }, 'Save'),
         h('button', { type: 'button', onClick: forget }, 'Forget token'),
         h('button', { type: 'button', onClick: close }, 'Close')),
       h('p', { class: 'hint' }, 'Create the token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Name it “Control Sphere sync”. Repository access: None. Account permissions: Gists = Read and write. Everything else stays No access. Or a classic token with only the gist scope.')];

  const back = h('div', { id: 'csSettings', class: 'modalBack', onClick: (e) => { if (e.target === back) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-labelledby': 'csSettingsTitle' },
      h('h2', { id: 'csSettingsTitle' }, 'Sync settings'),
      ...body));
  document.body.append(back);
  (mode === 'server' ? null : token).focus?.();
  if (mode === 'server') {
    back.querySelector('.modal').append(h('div', { class: 'actions' }, h('button', { type: 'button', onClick: close }, 'Close')));
  }
}
