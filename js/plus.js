// In-context add: pixel '+' on a node opens a compact popover to create or link a child move.
import { h } from './ui.js';
import { STANCES, HEIGHTS, DIRS, IDLE, stanceRoot, optionLabel } from './data.js';

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? undefined : Number(v));

export function uniqueId(tree, label) {
  let id = slug(label) || 'move';
  while (tree.moves.some((x) => x.id === id)) id += '_2';
  return id;
}

export function parentEdge(parentId, parentStance, to) {
  if (!parentId || parentId === IDLE) return { from: IDLE, to, stance: parentStance || 'standing' };
  return { from: parentId, to };
}

// Stance home: Crouching Tiger idles on the Crouch node; Reed and Dragon return to Idle.
export const stanceIdleId = stanceRoot;


export function addCustomMove(tree, fields, linkKeyFn) {
  const label = String(fields.label || '').trim();
  if (!label) return { error: 'Give it a name.' };
  const id = uniqueId(tree, label);
  const stance = fields.stance || fields.parentStance || 'standing';
  const mv = {
    id, label, height: fields.height || 'mid', tier: num(fields.tier) ?? 0,
    windup: num(fields.windup), action: num(fields.action), recovery: num(fields.recovery),
    damage: num(fields.damage), spend: num(fields.spend), stances: [stance], custom: true,
  };
  if (fields.moving) mv.moving = true;
  if (fields.result) mv.result_stance = fields.result;
  Object.keys(mv).forEach((k) => mv[k] === undefined && delete mv[k]);
  const edge = parentEdge(fields.parentId, stance, id);
  tree.moves.push(mv); tree.edges.push(edge);
  const dir = DIRS.find((d) => d.id === fields.dir);
  if (dir && dir.deg != null && linkKeyFn) tree.placement[linkKeyFn(edge.from, id, edge.stance)] = dir.deg;
  let back = null;
  if (fields.linkBack === 'idle' || fields.linkBack === 'stance') {
    back = linkExistingMove(tree, { parentId: id, parentStance: stance, toId: fields.linkBack === 'stance' ? stanceIdleId(stance) : IDLE });
  }
  return { id, move: mv, edge, linkBack: back };
}

export function linkExistingMove(tree, { parentId, parentStance, toId }) {
  if (!toId) return { error: 'Pick a move to link.' };
  const edge = parentEdge(parentId, parentStance, toId);
  const dup = tree.edges.some((e) => e.from === edge.from && e.to === edge.to && (edge.from !== IDLE || !e.stance || e.stance === edge.stance));
  if (dup) return { error: 'Already linked from here.' };
  tree.edges.push(edge);
  return { id: toId, edge };
}

function nodeAnchor(svg, id) {
  const el = svg.querySelector(id === '__center' || id === IDLE ? '[data-id="__center"]' : `[data-id="${id}"]`);
  if (!el) return null;
  return el.getBoundingClientRect();
}

export function createPlus(app, { layer, pop, svg, onAdd, onLink }) {
  let edit = false, hoverId = null, openFor = null;

  function targets() {
    if (!app.model) return [];
    const cur = app.model.cur;
    const list = [{ id: '__center', parentId: cur.id, parentStance: cur.stance, title: optionLabel(app.cat, cur.id, cur.stance) }];
    for (const o of app.model.options) {
      list.push({ id: o.id, parentId: o.id, parentStance: o.resultStance, title: optionLabel(app.cat, o.id, o.resultStance) });
    }
    return list;
  }

  function placeButtons() {
    if (!layer) return;
    const showAll = edit || app.model?.empty;
    const items = targets().filter((t) => showAll || t.id === hoverId);
    const wrap = layer.getBoundingClientRect();
    layer.replaceChildren(...items.map((t) => {
      const box = nodeAnchor(svg, t.id); if (!box) return null;
      const b = h('button', {
        type: 'button', class: 'plusBtn', title: `Add a move under ${t.title}`,
        'data-plus': t.id, 'aria-label': `Add under ${t.title}`,
        style: `left:${box.right - wrap.left - 10}px;top:${box.top - wrap.top - 10}px`,
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); open(t, box); },
      }, h('span', { class: 'plusGlyph', 'aria-hidden': 'true' }, '+'));
      return b;
    }).filter(Boolean));
  }

  function close() { openFor = null; pop.hidden = true; pop.replaceChildren(); }

  function open(t, box) {
    openFor = t; pop.hidden = false;
    const f = { label: '', stance: t.parentStance || 'standing', result: '', height: 'mid', dir: 'auto', tier: '0', spend: '', windup: '0.25', action: '', recovery: '0.25', damage: '', linkBack: '', moving: false };
    const msg = h('div', { class: 'hint' });
    const more = h('div', { class: 'plusMore', hidden: true });
    const existing = app.tree.moves.filter((x) => x.id !== IDLE && x.id !== t.parentId && !app.cat.outgoing(t.parentId === IDLE ? IDLE : t.parentId, t.parentStance).includes(x.id));
    let pick = existing[0]?.id || '';
    const stanceRow = h('div', { class: 'plusStances' }, ...Object.entries(STANCES).map(([k, st]) => {
      const b = h('button', { type: 'button', class: `plusSt ${k}${k === f.stance ? ' on' : ''}`, style: `--st:${st.color}`, onClick: () => { f.stance = k; pop.querySelectorAll('.plusSt').forEach((x) => x.classList.toggle('on', x === b)); } }, st.short);
      return b;
    }));
    const add = () => {
      const res = {};
      app.updateTree((tree) => Object.assign(res, addCustomMove(tree, { ...f, parentId: t.parentId, parentStance: t.parentStance }, (...a) => app.cat.linkKey(...a))));
      if (res.error) { msg.textContent = res.error; return; }
      close(); onAdd(res, t);
    };
    const link = () => {
      const res = {};
      app.updateTree((tree) => Object.assign(res, linkExistingMove(tree, { parentId: t.parentId, parentStance: t.parentStance, toId: pick })));
      if (res.error) { msg.textContent = res.error; return; }
      close(); onLink(res, t);
    };
    more.append(
      h('label', {}, 'Height', h('select', { onChange: (e) => (f.height = e.target.value) }, HEIGHTS.map((v) => { const o = h('option', { value: v }, v); if (v === 'mid') o.selected = true; return o; }))),
      h('label', {}, 'Direction', h('select', { onChange: (e) => (f.dir = e.target.value) }, DIRS.map((d) => h('option', { value: d.id }, d.label)))),
      h('label', {}, 'Windup', h('input', { type: 'number', step: 0.25, min: 0, value: f.windup, onInput: (e) => (f.windup = e.target.value) })),
      h('label', {}, 'Action', h('input', { type: 'number', step: 0.25, min: 0, value: f.action, onInput: (e) => (f.action = e.target.value) })),
      h('label', {}, 'Recovery', h('input', { type: 'number', step: 0.25, min: 0, value: f.recovery, onInput: (e) => (f.recovery = e.target.value) })),
      h('label', {}, 'Damage', h('input', { type: 'number', step: 1, min: 0, value: f.damage, onInput: (e) => (f.damage = e.target.value) })),
      h('button', { type: 'button', class: 'plusSt', onClick: (e) => { f.moving = !f.moving; e.target.classList.toggle('on', f.moving); } }, 'Moving / locomotion'),
    );
    const setBack = (v) => { f.linkBack = f.linkBack === v ? '' : v; pop.querySelectorAll('[data-back]').forEach((x) => x.classList.toggle('on', x.dataset.back === f.linkBack)); };
    const backBox = () => h('div', { class: 'plusBack' },
      h('span', { class: 'muted small' }, 'Then'),
      h('button', { type: 'button', class: 'plusSt', 'data-back': 'idle', onClick: () => setBack('idle') }, `Link back to ${STANCES.standing.center}`),
      h('button', { type: 'button', class: 'plusSt', 'data-back': 'stance', onClick: () => setBack('stance') }, `Link back to ${STANCES[t.parentStance]?.center || STANCES.standing.center}`),
    );
    const laterBack = () => h('div', { class: 'plusBack later' },
      h('span', { class: 'muted small' }, 'Or link this move back'),
      h('button', { type: 'button', onClick: () => doBack('idle') }, STANCES.standing.center),
      h('button', { type: 'button', onClick: () => doBack('stance') }, STANCES[t.parentStance]?.center || STANCES.standing.center),
    );
    const doBack = (kind) => {
      const res = {};
      app.updateTree((tree) => Object.assign(res, linkExistingMove(tree, { parentId: t.parentId, parentStance: t.parentStance, toId: kind === 'stance' ? stanceIdleId(t.parentStance) : IDLE })));
      if (res.error) { msg.textContent = res.error; return; }
      close(); onLink(res, t);
    };
    pop.replaceChildren(
      h('div', { class: 'plusHead' }, h('b', {}, `Add under ${t.title}`), h('button', { type: 'button', class: 'small', onClick: close }, '✕')),
      h('div', { class: 'muted small' }, 'Performed in'),
      stanceRow,
      h('label', { class: 'plusName' }, 'Name', h('input', { type: 'text', maxlength: 40, placeholder: 'e.g. Rising slash', autofocus: true, onInput: (e) => (f.label = e.target.value) })),
      h('button', { type: 'button', class: 'plusToggle', onClick: (e) => { more.hidden = !more.hidden; e.target.textContent = more.hidden ? 'More options' : 'Fewer options'; } }, 'More options'),
      more,
      backBox(),
      h('button', { type: 'button', class: 'primary', onClick: add }, 'Add'),
      existing.length ? h('div', { class: 'plusLink' }, h('span', { class: 'muted small' }, 'Or link existing'), h('select', { onChange: (e) => (pick = e.target.value) }, existing.map((x) => h('option', { value: x.id }, x.label))), h('button', { type: 'button', onClick: link }, 'Link')) : null,
      laterBack(),
      msg,
    );
    const name = pop.querySelector('.plusName input');
    requestAnimationFrame(() => { name?.focus(); placePop(box); });
    name?.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') close(); });
  }

  function placePop(box) {
    const r = box || { left: 80, top: 80, right: 120, bottom: 120, width: 40, height: 40 };
    const pw = pop.offsetWidth || 300, ph = pop.offsetHeight || 240;
    const stage = document.querySelector('.stageWrap')?.getBoundingClientRect();
    const maxR = stage ? Math.min(window.innerWidth - 8, stage.right - 4) : window.innerWidth - 8;
    const minL = stage ? Math.max(8, stage.left + 4) : 8;
    let left = r.right + 8, top = r.top;
    if (left + pw > maxR) left = r.left - pw - 8;
    if (left < minL) left = minL;
    if (left + pw > maxR) left = Math.max(minL, maxR - pw);
    const maxB = window.innerHeight - 8;
    if (top + ph > maxB) top = Math.max(8, maxB - ph);
    if (stage && top < stage.top + 4) top = stage.top + 4;
    pop.style.left = `${left}px`; pop.style.top = `${top}px`;
  }

  function openCurrent() {
    const t = targets().find((x) => x.id === '__center');
    const box = nodeAnchor(svg, '__center') || nodeAnchor(svg, '__slot');
    if (!t || !box) return false;
    open(t, box); return true;
  }
  function setEdit(v) { edit = !!v; if (!edit) hoverId = null; placeButtons(); return edit; }
  function hover(id) { if (edit) return; hoverId = id; placeButtons(); }
  function longPress(id) {
    const t = targets().find((x) => x.id === id || (id === '__center' && x.id === '__center') || x.parentId === id);
    const box = nodeAnchor(svg, t ? t.id : id); if (!t || !box) return false;
    open(t, box); return true;
  }

  document.addEventListener('pointerdown', (e) => { if (openFor && !pop.contains(e.target) && !e.target.closest('.plusBtn')) close(); });
  window.addEventListener('resize', () => { placeButtons(); if (openFor) placePop(nodeAnchor(svg, openFor.id)); });
  return { sync: placeButtons, setEdit, hover, longPress, openCurrent, close, get edit() { return edit; } };
}
