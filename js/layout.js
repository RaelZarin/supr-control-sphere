import { DIRS } from './data.js';
// Layout math: height-sector placement (port of MomentumCatalog.place_star_nodes), graph-arm angles, facing + mirror.
export const R_INNER = 110, R_OUTER = 168, MIN_GAP = 64, R_SPHERE = 214;
const rad = (d) => (d * Math.PI) / 180;

function capacity(r, span) {
  const s = rad(span); let n = 1;
  while (n < 12) { const nxt = n + 1; if (2 * r * Math.sin(s / (2 * nxt)) + 0.05 < MIN_GAP) return n; n = nxt; }
  return n;
}
function mixRings(innerN, outerN) {
  const total = innerN + outerN; const flags = Array(total).fill(outerN === 0);
  if (innerN <= 0 || outerN <= 0) return flags;
  for (let j = 0; j < innerN; j++) {
    let idx = Math.min(total - 1, Math.max(0, Math.floor(((j + 0.5) / innerN) * total)));
    while (flags[idx] && idx + 1 < total) idx++;
    flags[idx] = true;
  }
  return flags;
}
function endsInner(innerN, outerN) {
  const total = innerN + outerN; const flags = Array(total).fill(false);
  if (total >= 1) flags[0] = true; if (total >= 2) flags[total - 1] = true;
  const need = innerN - 2;
  for (let j = 0; j < Math.max(need, 0); j++) {
    let idx = 1 + Math.floor(((j + 0.5) / Math.max(need, 1)) * Math.max(total - 2, 1));
    idx = Math.min(total - 2, Math.max(1, idx));
    while (flags[idx] && idx + 1 < total - 1) idx++;
    flags[idx] = true;
  }
  return flags;
}
function sectorMin(flags, start, span) {
  const total = flags.length; if (total <= 1) return 1000;
  const pts = flags.map((f, i) => { const a = rad(start + (span * (i + 0.5)) / total); const r = f ? R_INNER : R_OUTER; return [Math.cos(a) * r, Math.sin(a) * r]; });
  let best = 1000;
  for (let i = 0; i < total; i++) for (let j = i + 1; j < total; j++) best = Math.min(best, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
  return best;
}

// Returns Map id -> { deg, r, sector } in Godot degrees before facing/mirror.
export function placeBySectors(ids, heightOf, sectors) {
  const buckets = new Map(sectors.map((s) => [s.id, []]));
  const midIds = sectors.filter((s) => s.height === 'mid').map((s) => s.id);
  const mids = [];
  for (const id of ids) {
    const h = heightOf(id);
    if (h === 'mid') { mids.push(id); continue; }
    const sec = sectors.find((s) => s.height === h);
    if (sec) buckets.get(sec.id).push(id);
  }
  const split = midIds.length >= 2 ? Math.floor((mids.length + 1) / 2) : mids.length;
  mids.forEach((id, i) => buckets.get(i < split ? midIds[0] : midIds[Math.min(1, midIds.length - 1)]).push(id));
  const out = new Map();
  for (const sec of sectors) {
    const b = buckets.get(sec.id); if (!b.length) continue;
    const span = sec.end - sec.start; const cap = capacity(R_INNER, span);
    const innerN = Math.min(b.length, cap); const outerN = b.length - innerN;
    let flags = mixRings(innerN, outerN);
    if (innerN >= 2 && outerN >= 1) { const alt = endsInner(innerN, outerN); if (sectorMin(alt, sec.start, span) + 0.05 >= MIN_GAP) flags = alt; }
    b.forEach((id, i) => out.set(id, { deg: sec.start + (span * (i + 0.5)) / b.length, r: flags[i] ? R_INNER : R_OUTER, sector: sec.id }));
  }
  return out;
}

// Graph "arms" mode: the angles written in momentum_graph.json layouts.
export function placeByArms(ids, layout) {
  const out = new Map(); if (!layout) return out;
  for (const arm of layout.arms || []) {
    if (ids.includes(arm.id) && !out.has(arm.id)) out.set(arm.id, { deg: arm.angle, r: R_INNER, sector: 'arm' });
    for (const n of arm.next || []) if (ids.includes(n.id) && !out.has(n.id)) out.set(n.id, { deg: n.angle, r: R_OUTER, sector: 'arm' });
  }
  return out;
}

// Final screen angle: mirror flips left/right, facing rotates the whole sphere.
export function screenDeg(deg, s) { const d = s.mirror ? 180 - deg : deg; return d + s.facing; }
export function polar(deg, r) { const a = rad(deg); return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }

export function placeOptions(cat, ids, stance, prev, settings, fromId) {
  const tree = cat.tree;
  const pinned = new Map();
  for (const id of ids) {
    const dir = DIRS.find((d) => d.id === cat.move(id).dir && d.deg != null);
    const over = tree.placement?.[cat.linkKey(fromId, id, stance)];
    if (dir || typeof over === 'number') {
      pinned.set(id, { deg: typeof over === 'number' ? over : dir.deg, r: R_INNER, sector: typeof over === 'number' ? 'custom' : 'dir' });
    }
  }
  let base = settings.placement === 'arms' ? placeByArms(ids, cat.layoutFor(stance, prev)) : new Map();
  const rest = ids.filter((id) => !base.has(id) && !pinned.has(id));
  const sec = placeBySectors(rest, (id) => cat.move(id).height || 'mid', tree.sectors);
  for (const [k, v] of sec) base.set(k, v);
  const out = [];
  for (const id of ids) {
    const p = { ...(pinned.get(id) || base.get(id) || { deg: -90, r: R_INNER, sector: '?' }) };
    const deg = screenDeg(p.deg, settings);
    out.push({ id, ...p, screen: deg, ...polar(deg, p.r) });
  }
  // Two options on the exact same spot (e.g. custom overrides) get nudged apart.
  for (let i = 0; i < out.length; i++) for (let j = 0; j < i; j++) {
    if (Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) < 40) { out[i].r = out[i].r === R_INNER ? R_OUTER : R_INNER; Object.assign(out[i], polar(out[i].screen, out[i].r)); }
  }
  return out;
}

export const FACING_NAMES = { 0: 'Forward', 45: 'Forward-right', 90: 'Right', 135: 'Back-right', 180: 'Backward', 225: 'Back-left', 270: 'Left', 315: 'Forward-left' };
