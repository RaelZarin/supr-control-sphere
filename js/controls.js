// Controls: the modifiers panel (style, facing, FX, motion, look) plus presets / reset.
import { h, slider, select, toggle, segmented, section } from './ui.js';
import { STANCES, CURVES } from './data.js';

const pct = (v) => Math.round(v * 100) + '%';

export function renderControls(root, app) {
  const s = app.settings; const set = (patch) => app.setSettings(patch);
  const open = app.openSections;
  const keep = (d, id) => { d.dataset.sec = id; d.open = open.has(id) ? true : d.open; d.addEventListener('toggle', () => (d.open ? open.add(id) : open.delete(id))); return d; };
  root.replaceChildren(
    keep(section('Tree style', true,
      segmented(s.style, [['tree', 'Tree'], ['star', 'Radial star'], ['direction', 'Directional']], (v) => set({ style: v })),
      select('Placement', s.placement, [['sectors', 'Height sectors (current rule)'], ['arms', 'Graph arm angles']], (v) => set({ placement: v })),
      select('Ring labels', s.ringLabels, [['height', 'Height (high / mid / low)'], ['facing', 'Facing (fwd / back / L / R)'], ['none', 'None']], (v) => set({ ringLabels: v })),
      h('div', { class: 'row' }, h('span', {}, 'Attack facing'), h('div', { class: 'btns' },
        h('button', { type: 'button', onClick: () => app.rotate(-45) }, '⟲ Q'), h('button', { type: 'button', onClick: () => app.rotate(45) }, 'E ⟳'))),
      toggle('Mirror left / right', s.mirror, (v) => set({ mirror: v })),
      toggle('Show labels', s.labels, (v) => set({ labels: v })),
      toggle('Show stub moves', s.stubs, (v) => set({ stubs: v })),
    ), 'style'),
    keep(section('Stance edge FX', true,
      ...Object.entries(STANCES).map(([k, st]) => slider(`${st.name}`, s.fx[k], { max: 1.5, fmt: pct, onInput: (v) => set({ fx: { ...app.settings.fx, [k]: v } }) })),
      slider('FX start depth', s.fxStart, { min: 0, max: 6, step: 1, fmt: (v) => `step ${v}`, onInput: (v) => set({ fxStart: v }) }),
      slider('Full FX at depth', s.fxFull, { min: 1, max: 10, step: 1, fmt: (v) => `step ${v}`, onInput: (v) => set({ fxFull: v }) }),
      slider('Max FX level', s.fxMax, { fmt: pct, onInput: (v) => set({ fxMax: v }) }),
      slider('Glow strength', s.glow, { fmt: pct, onInput: (v) => set({ glow: v }) }),
      h('div', { class: 'row' }, h('span', {}, 'Preview depth'), h('div', { class: 'btns' },
        h('button', { type: 'button', onClick: () => app.previewDepth(-1) }, '−'), h('button', { type: 'button', onClick: () => app.previewDepth(1) }, '+'))),
    ), 'fx'),
    keep(section('Motion', false,
      slider('Animation speed', s.speed, { min: 0.25, max: 2.5, step: 0.05, fmt: (v) => v.toFixed(2) + '×', onInput: (v) => set({ speed: v }) }),
      select('Motion curve', s.curve, CURVES, (v) => set({ curve: v })),
      slider('Overshoot', s.overshoot, { min: 0, max: 3, step: 0.05, fmt: (v) => v.toFixed(2), onInput: (v) => set({ overshoot: v }) }),
      slider('Elbow bias', s.bend, { min: -1, max: 1, step: 0.05, fmt: (v) => v.toFixed(2), onInput: (v) => set({ bend: v }) }),
      slider('Travel time', s.travelMs, { min: 120, max: 700, step: 10, fmt: (v) => v + ' ms', onInput: (v) => set({ travelMs: v }) }),
      slider('Breathing', s.breathe, { min: 0, max: 0.15, step: 0.005, fmt: pct, onInput: (v) => set({ breathe: v }) }),
      toggle('Reduced motion', s.reducedMotion, (v) => set({ reducedMotion: v })),
    ), 'motion'),
    keep(section('Look', false,
      slider('Line thickness', s.line, { min: 0.5, max: 6, step: 0.25, fmt: (v) => v + ' px', onInput: (v) => set({ line: v }) }),
    ), 'look'),
    keep(presetsSection(app), 'presets'),
  );
}

function presetsSection(app) {
  const list = h('div', { class: 'presetList' });
  const name = h('input', { type: 'text', placeholder: 'Preset name', maxlength: 40 });
  const msg = h('div', { class: 'hint' });
  const refresh = async () => {
    try {
      const items = await app.store.listPresets();
      list.replaceChildren(...items.map((p) => h('div', { class: 'presetRow' }, h('span', {}, p.name),
        h('button', { type: 'button', onClick: async () => { await app.loadPreset(p.name); msg.textContent = `Loaded “${p.name}”.`; } }, 'Load'),
        h('button', { type: 'button', class: 'danger', onClick: async () => { if (confirm(`Delete preset “${p.name}”?`)) { await app.store.deletePreset(p.name); refresh(); } } }, '✕'))));
    } catch (e) { msg.textContent = e.message; }
  };
  const saveAs = async () => {
    const n = name.value.trim(); if (!n) { msg.textContent = 'Name it first.'; return; }
    try { await app.store.savePreset(n, app.snapshot()); name.value = ''; msg.textContent = `Saved “${n}”.`; refresh(); } catch (e) { msg.textContent = e.message; }
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAs(); });
  refresh();
  return section('Presets & reset', false,
    h('div', { class: 'row' }, name, h('button', { type: 'button', class: 'primary', onClick: saveAs }, 'Save as')),
    list, msg,
    h('div', { class: 'btns wrap' },
      h('button', { type: 'button', onClick: () => { if (confirm('Replace the tree with the repo defaults? Builder edits are lost unless saved as a preset.')) app.resetTree(); } }, 'Reset tree to repo defaults'),
      h('button', { type: 'button', onClick: () => app.resetSettings() }, 'Reset modifiers')),
    h('div', { class: 'hint' }, `Everything autosaves and can sync across your devices. ${app.sourceNote}`),
  );
}
