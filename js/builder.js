// Builder: add moves to a stance/parent, edit per-link motion + direction, move/delete custom moves, export JSON.
import { h, select, section } from './ui.js';
import { STANCES, HEIGHTS, CURVES, DIRS, IDLE } from './data.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? undefined : Number(v));

// Parent choices: "Idle (stance)" entries plus every move. Value format: "idle@stance" or a move id.
function parentOptions(tree) {
  return [...Object.entries(STANCES).map(([k, st]) => [`idle@${k}`, `${st.name} (stance root)`]), ...tree.moves.filter((m) => m.id !== IDLE).map((m) => [m.id, m.label + (m.custom ? ' ★' : '')])];
}
function parentToEdge(parent, to) { if (parent.startsWith('idle@')) return { from: IDLE, to, stance: parent.slice(5) }; return { from: parent, to }; }
function edgeParent(e) { return e.from === IDLE ? `idle@${e.stance || 'standing'}` : e.from; }

export function renderBuilder(root, app) {
  const tree = app.tree; const m = app.model; const cur = m.cur;
  const src = app.cat.sourceOf(cur.stance, cur.prev);
  const here = src === IDLE ? `idle@${cur.stance}` : src;
  const open = app.openSections;
  const keep = (d, id) => { d.open = open.has(id); d.addEventListener('toggle', () => (d.open ? open.add(id) : open.delete(id))); return d; };

  // --- Add move form
  const f = { label: '', stance: cur.stance, result: '', height: 'mid', parent: here, dir: 'auto', tier: '0', spend: '', windup: '0.25', action: '', recovery: '0.25', damage: '', moving: false };
  const inp = (k, type = 'text', attrs = {}) => h('input', { type, value: f[k], ...attrs, onInput: (e) => (f[k] = e.target.value) });
  const msg = h('div', { class: 'hint' });
  const add = () => {
    const label = f.label.trim(); if (!label) { msg.textContent = 'Give it a name.'; return; }
    let id = slug(label) || 'move'; while (tree.moves.some((x) => x.id === id)) id += '_2';
    const mv = { id, label, height: f.height, tier: num(f.tier) ?? 0, windup: num(f.windup), action: num(f.action), recovery: num(f.recovery), damage: num(f.damage), spend: num(f.spend), stances: [f.stance], custom: true }; if (f.moving) mv.moving = true;
    if (f.result) mv.result_stance = f.result;
    Object.keys(mv).forEach((k) => mv[k] === undefined && delete mv[k]);
    const edge = parentToEdge(f.parent, id);
    const dir = DIRS.find((d) => d.id === f.dir);
    app.updateTree((t) => {
      t.moves.push(mv); t.edges.push(edge);
      if (dir && dir.deg != null) t.placement[app.cat.linkKey(edge.from, id, edge.stance)] = dir.deg;
    });
    msg.textContent = `Added “${label}” under ${f.parent.startsWith('idle@') ? 'Idle' : app.cat.move(f.parent).label}.`;
  };
  const addSec = section('Add an attack or action', true,
    h('label', { class: 'row' }, h('span', {}, 'Name'), inp('label', 'text', { placeholder: 'e.g. Rising slash', maxlength: 40 })),
    select('Performed in', f.stance, Object.entries(STANCES).map(([k, st]) => [k, st.name]), (v) => (f.stance = v)),
    select('Leaves you in', '', [['', 'Same stance'], ...Object.entries(STANCES).map(([k, st]) => [k, st.name])], (v) => (f.result = v)),
    select('Parent (place in tree)', f.parent, parentOptions(tree), (v) => (f.parent = v)),
    select('Height', f.height, HEIGHTS, (v) => (f.height = v)),
    select('Direction', 'auto', DIRS.map((d) => [d.id, d.label]), (v) => (f.dir = v)),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', onChange: (e) => (f.moving = e.target.checked) }), ' Moving / locomotion'),
    h('div', { class: 'grid4' },
      h('label', {}, 'Tier', inp('tier', 'number', { step: 1, min: 0 })), h('label', {}, 'Spend', inp('spend', 'number', { step: 1, min: 0 })),
      h('label', {}, 'Windup', inp('windup', 'number', { step: 0.25, min: 0 })), h('label', {}, 'Action', inp('action', 'number', { step: 0.25, min: 0 })),
      h('label', {}, 'Recovery', inp('recovery', 'number', { step: 0.25, min: 0 })), h('label', {}, 'Damage', inp('damage', 'number', { step: 1, min: 0 }))),
    h('div', { class: 'hint' }, 'Windup / action / recovery are in ticks, like momentum_moves.json. Spend is momentum.'),
    h('button', { type: 'button', class: 'primary', onClick: add }, 'Add to tree'), msg);

  // --- Links from the current node
  const fromId = src;
  const linkRows = m.options.map((o) => {
    const key = app.cat.linkKey(fromId, o.id, cur.stance);
    const L = tree.links[key] || {}; const over = tree.placement[key];
    const setL = (patch) => app.updateTree((t) => { t.links[key] = { ...(t.links[key] || {}), ...patch }; });
    return h('div', { class: 'linkRow' },
      h('div', { class: 'linkHead' }, h('b', {}, o.id === IDLE ? 'Idle' : o.move.label), o.link.custom ? h('span', { class: 'tag' }, 'custom') : null,
        h('button', { type: 'button', class: 'danger small', title: 'Remove this link', onClick: () => app.updateTree((t) => { t.edges = t.edges.filter((e) => !(e.from === fromId && e.to === o.id && (fromId !== IDLE || !e.stance || e.stance === cur.stance))); delete t.links[key]; delete t.placement[key]; }) }, 'Unlink')),
      h('div', { class: 'grid3' },
        h('label', {}, 'Curve', h('select', { onChange: (e) => setL({ curve: e.target.value || undefined }) }, [['', 'Default'], ...CURVES.map((c) => [c, c])].map(([v, t]) => { const op = h('option', { value: v }, t); if ((L.curve || '') === v) op.selected = true; return op; }))),
        h('label', {}, 'ms', h('input', { type: 'number', min: 60, max: 1500, step: 10, value: L.ms ?? '', placeholder: String(app.settings.travelMs), onChange: (e) => setL({ ms: num(e.target.value) }) })),
        h('label', {}, 'Elbow', h('input', { type: 'number', min: -1, max: 1, step: 0.05, value: L.bend ?? '', placeholder: String(app.settings.bend), onChange: (e) => setL({ bend: num(e.target.value) }) }))),
      select('Direction', DIRS.find((d) => d.deg === over)?.id || 'auto', DIRS.map((d) => [d.id, d.label]), (v) => app.updateTree((t) => { const d = DIRS.find((x) => x.id === v); if (d?.deg == null) delete t.placement[key]; else t.placement[key] = d.deg; })));
  });
  const existing = tree.moves.filter((x) => x.id !== IDLE && !m.options.some((o) => o.id === x.id));
  let pick = existing[0]?.id || '';
  const linkSec = section(`Links from ${src === IDLE ? 'Idle (' + STANCES[cur.stance].name + ')' : app.cat.move(src).label}`, false,
    h('div', { class: 'hint' }, 'Navigate the sphere to a node, then tune how each follow-up animates in and where it sits.'),
    ...linkRows,
    existing.length ? h('div', { class: 'row' }, select('Link existing move', pick, existing.map((x) => [x.id, x.label]), (v) => (pick = v)),
      h('button', { type: 'button', onClick: () => pick && app.updateTree((t) => t.edges.push(fromId === IDLE ? { from: IDLE, to: pick, stance: cur.stance } : { from: fromId, to: pick })) }, 'Link')) : null);

  // --- Custom moves (move / delete)
  const customs = tree.moves.filter((x) => x.custom);
  const customSec = customs.length ? section('Your custom moves', false, ...customs.map((mv) => {
    const e = tree.edges.find((x) => x.to === mv.id);
    return h('div', { class: 'linkRow' },
      h('div', { class: 'linkHead' }, h('b', {}, mv.label), h('span', { class: 'tag' }, `${mv.height} · ${STANCES[mv.stances[0]]?.short || ''}`),
        h('button', { type: 'button', class: 'danger small', onClick: () => { if (confirm(`Delete “${mv.label}”?`)) app.updateTree((t) => { t.moves = t.moves.filter((x) => x.id !== mv.id); t.edges = t.edges.filter((x) => x.to !== mv.id && x.from !== mv.id); for (const k of Object.keys(t.links)) if (k.includes(mv.id)) delete t.links[k]; for (const k of Object.keys(t.placement)) if (k.includes(mv.id)) delete t.placement[k]; }, { resetPath: true }); } }, 'Delete')),
      select('Move under', e ? edgeParent(e) : '', parentOptions(tree).filter(([v]) => v !== mv.id), (v) => app.updateTree((t) => {
        const old = t.edges.find((x) => x.to === mv.id); const ne = parentToEdge(v, mv.id);
        if (old) { const ok = app.cat.linkKey(old.from, mv.id, old.stance); const nk = app.cat.linkKey(ne.from, mv.id, ne.stance); if (t.placement[ok] != null) { t.placement[nk] = t.placement[ok]; delete t.placement[ok]; } if (t.links[ok]) { t.links[nk] = t.links[ok]; delete t.links[ok]; } t.edges = t.edges.filter((x) => x !== old); }
        t.edges.push(ne);
      }, { resetPath: true })),
      select('Height', mv.height, HEIGHTS, (v) => app.updateTree((t) => { t.moves.find((x) => x.id === mv.id).height = v; })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!mv.moving, onChange: (e) => app.updateTree((t) => { const x = t.moves.find((m) => m.id === mv.id); if (e.target.checked) x.moving = true; else delete x.moving; }) }), ' Moving'));
  })) : null;

  // --- Export
  const exportSec = section('Export JSON', false,
    h('div', { class: 'hint' }, 'Same shape as the repo files: moves, edges (graph links), plus per-link motion and direction overrides.'),
    h('textarea', { class: 'export', readonly: true, rows: 12, value: JSON.stringify(app.exportTree(), null, 2) }),
    h('div', { class: 'btns' },
      h('button', { type: 'button', onClick: async (e) => { const ta = root.querySelector('textarea.export'); try { await navigator.clipboard.writeText(ta.value); e.target.textContent = 'Copied'; } catch { ta.select(); document.execCommand('copy'); e.target.textContent = 'Copied'; } } }, 'Copy'),
      h('button', { type: 'button', onClick: () => { const b = new Blob([JSON.stringify(app.exportTree(), null, 2)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(b), download: 'control-sphere-tree.json' }); a.click(); } }, 'Download')));

  root.replaceChildren(keep(addSec, 'b-add'), keep(linkSec, 'b-links'), customSec ? keep(customSec, 'b-custom') : '', keep(exportSec, 'b-export'));
}
