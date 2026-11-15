// App glue: state (tree, settings, path), wiring between storage, renderer, input, controls and builder.
import { makeCatalog, mergeSettings, DEFAULT_SETTINGS, STANCES, IDLE, walk } from './data.js';
import { buildModel } from './model.js';
import { createRenderer } from './renderer.js';
import { startLoop, tween } from './anim.js';
import { bindInput } from './input.js';
import { createStore } from './storage.js';
import { renderControls } from './controls.js';
import { renderBuilder } from './builder.js';
import { FACING_NAMES } from './layout.js';
import { h } from './ui.js';
import { renderStanceBar } from './stances.js';
import { bindSettingsButton } from './settings.js';

const $ = (s) => document.querySelector(s);
const statusEl = $('#sync');
const store = createStore({ onStatus: (t) => (statusEl.textContent = t), onRemote: (st) => { applyState(st); toast('Updated from your other device'); } });

const app = {
  tree: null, settings: mergeSettings(null), path: [], boost: 0, hover: null, cat: null, model: null, store,
  openSections: new Set(['style', 'fx', 'b-add']), sourceNote: '',
};
const svg = $('#sphere');
const renderer = createRenderer(svg, {});

function sanitizeTree(t) {
  t.links ||= {}; t.placement ||= {}; t.edges ||= []; t.moves ||= []; return t;
}
function validPath(path) { // keep the chain only as far as it is still legal after edits
  const cat = app.cat; const out = []; let steps = walk(cat, []);
  for (const id of path) { const last = steps[steps.length - 1]; if (!cat.legalNext(last.stance, last.prev).includes(id)) break; out.push(id); steps = walk(cat, out); }
  return out;
}
function persist() { store.save(app.snapshot()); }

function refresh(enter = false) {
  app.cat = makeCatalog(app.tree);
  const m = buildModel(app.cat, app.settings, app.path);
  if (app.boost) { m.depth += app.boost; const s = m.settings; const span = Math.max(1, s.fxFull - s.fxStart + 1); m.level = Math.min(1, Math.max(0, (m.depth - s.fxStart + 1) / span)) * s.fxMax * (s.fx[m.cur.stance] ?? 1); m.depthLevel = Math.min(1, m.depth / Math.max(1, s.fxFull)); }
  app.model = m; renderer.show(m, { enter }); renderHud();
}

function renderHud() {
  const m = app.model; const st = STANCES[m.cur.stance];
  $('#stance').replaceChildren(h('span', { class: 'dot', style: `background:${st.color}` }), h('b', {}, st.name), h('span', { class: 'muted' }, ` · ${st.short}`));
  const pips = Array.from({ length: Math.max(5, app.settings.fxFull) }, (_, i) => h('i', { class: i < m.depth ? 'on' : '', style: i < m.depth ? `background:${st.color}` : '' }));
  $('#depth').replaceChildren(h('span', { class: 'muted' }, 'Depth '), h('b', {}, String(m.depth)), h('span', { class: 'pips' }, pips));
  const crumbs = [h('button', { type: 'button', class: 'crumb', onClick: () => go([]) }, 'Idle')];
  app.path.forEach((id, i) => { crumbs.push(h('span', { class: 'arrow' }, '›')); crumbs.push(h('button', { type: 'button', class: 'crumb', style: `border-color:${STANCES[m.steps[i + 1].stance].color}`, onClick: () => go(app.path.slice(0, i + 1)) }, id === IDLE ? 'Idle' : app.cat.move(id).label)); });
  $('#crumbs').replaceChildren(...crumbs);
  $('#facing').textContent = `Attack facing: ${FACING_NAMES[((app.settings.facing % 360) + 360) % 360] || app.settings.facing + '°'}${app.settings.mirror ? ' · mirrored' : ''}`;
  renderStanceBar($('#stanceBar'), m, (id) => act.select(id));
  renderInfo();
}
function renderInfo() {
  const m = app.model; const o = app.hover ? m.options.find((x) => x.id === app.hover) : null;
  const id = o ? o.id : m.cur.id; const mv = app.cat.move(id);
  const performed = o ? m.cur.stance : (m.steps[m.steps.length - 2]?.stance || 'standing');
  const result = o ? o.resultStance : m.cur.stance;
  const facts = [['Height', mv.height], ['Tier', mv.tier], ['Windup', mv.windup], ['Action', mv.action], ['Recovery', mv.recovery], ['Damage', mv.damage], ['Spend', mv.spend], ['Advance', mv.advance]].filter(([, v]) => v != null);
  $('#info').replaceChildren(
    h('div', { class: 'infoHead' }, h('b', {}, id === IDLE ? 'Idle' : mv.label), o ? h('span', { class: 'muted' }, ' · option') : h('span', { class: 'muted' }, ' · current'), mv.stub ? h('span', { class: 'tag' }, 'stub') : null, mv.custom ? h('span', { class: 'tag' }, 'custom') : null),
    h('div', { class: 'muted small' }, id === IDLE ? `Options: ${m.options.length}` : `${STANCES[performed].name} → ${STANCES[result].name}`),
    h('div', { class: 'facts' }, facts.map(([k, v]) => h('span', {}, h('i', {}, k), ' ', String(v)))));
}

function go(path) { app.path = path; app.hover = null; refresh(true); renderBuilder($('#builder'), app); }
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800); }

const act = {
  select(id) {
    if (!app.model.options.some((o) => o.id === id)) return;
    navigator.vibrate?.(8);
    renderer.travelTo(id, () => { app.path = [...app.path, id]; app.hover = null; refresh(true); renderBuilder($('#builder'), app); });
  },
  center() { if (app.path.length) go([]); else { svg.classList.remove('miss'); void svg.getBBox(); svg.classList.add('miss'); } },
  undo() {
    if (!app.path.length) return;
    navigator.vibrate?.(8);
    const finish = () => { app.path = app.path.slice(0, -1); app.hover = null; refresh(true); renderBuilder($('#builder'), app); };
    if (!renderer.rewind(finish)) finish();
  },
  reset() { go([]); },
  rotate(d) { app.rotate(d); },
  miss() { svg.classList.remove('miss'); void svg.getBBox(); svg.classList.add('miss'); },
  hover(id) { app.hover = id; renderInfo(); },
};

app.rotate = (d) => {
  const from = app.settings.facing; const to = from + d;
  tween(app.settings.reducedMotion ? 0 : 160 / app.settings.speed, (p) => { app.settings.facing = from + d * (1 - Math.pow(1 - p, 3)); refresh(false); },
    { done: () => { app.settings.facing = ((to % 360) + 360) % 360; refresh(false); persist(); } });
};
app.setSettings = (patch) => {
  app.settings = { ...app.settings, ...patch }; refresh(false); persist();
  if ('style' in patch) renderControls($('#controls'), app);
};
app.previewDepth = (d) => { app.boost = Math.max(0, Math.min(10, app.boost + d)); refresh(false); toast(app.boost ? `Previewing +${app.boost} depth` : 'Preview off'); };
app.updateTree = (fn, { resetPath = false } = {}) => {
  fn(app.tree); app.cat = makeCatalog(app.tree); app.path = resetPath ? [] : validPath(app.path);
  refresh(false); renderBuilder($('#builder'), app); persist();
};
app.snapshot = () => ({ tree: app.tree, settings: app.settings });
app.exportTree = () => ({ schema: 1, source: app.source, moves: app.tree.moves, edges: app.tree.edges, links: app.tree.links, placement: app.tree.placement, sectors: app.tree.sectors });
app.loadPreset = async (name) => { const doc = await store.loadPreset(name); applyState(doc.state); persist(); toast(`Loaded ${name}`); };
app.resetTree = async () => { const d = await store.defaults(); app.tree = sanitizeTree(d.tree); app.path = []; refresh(true); renderBuilder($('#builder'), app); persist(); toast('Tree reset to repo defaults'); };
app.resetSettings = () => { app.settings = structuredClone(DEFAULT_SETTINGS); app.boost = 0; refresh(false); renderControls($('#controls'), app); persist(); };

function applyState(st) {
  app.tree = sanitizeTree(st.tree); app.settings = mergeSettings(st.settings); app.cat = makeCatalog(app.tree);
  app.path = validPath(app.path); refresh(false); renderControls($('#controls'), app); renderBuilder($('#builder'), app);
}

// Panel tabs
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
  $('#controls').hidden = b.dataset.tab !== 'controls'; $('#builder').hidden = b.dataset.tab !== 'builder';
}));
$('#undo').onclick = act.undo; $('#reset').onclick = act.reset;
$('#rotL').onclick = () => app.rotate(-45); $('#rotR').onclick = () => app.rotate(45);

(async function boot() {
  try {
    const d = await store.defaults(); app.source = d.source;
    app.sourceNote = `Repo defaults: ${d.source.ref} @ ${d.source.commit}.`;
    const { state, fresh } = await store.load();
    app.tree = sanitizeTree(state.tree); app.settings = mergeSettings(state.settings);
    app.cat = makeCatalog(app.tree);
    refresh(true); renderControls($('#controls'), app); renderBuilder($('#builder'), app);
    bindInput(svg, renderer, act); startLoop();
    statusEl.textContent = fresh ? 'Loaded repo defaults' : 'Loaded saved state';
    if (fresh && (await store.mode()) === 'server') persist();
    bindSettingsButton($('#settingsBtn'), store);
  } catch (e) { statusEl.textContent = 'Could not load: ' + e.message; }
})();
