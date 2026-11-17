import { DIRS } from './data.js';
import { sphereAtAngle, diskInSphere, diskInDock, TOP_SLOT, BOT_SLOT, DOCK_ARM, DOCK_LEFT, DOCK_RIGHT, DOCK_CLIP_Y, DOCK_NODE_R, DOCK_CENTER_R, DOCK_CAM_Y, SPHERE_H, TIP, dockHalfW } from './shape.js';
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

// Option diamonds are r=28, so centers need at least this much room, and must clear the center node.
export const NODE_MIN = 64;
export const CENTER_CLEAR = 74;

export function firstOverlap(opts, min = NODE_MIN) {
  for (let i = 0; i < opts.length; i++) for (let j = 0; j < i; j++) {
    if (Math.hypot(opts[i].x - opts[j].x, opts[i].y - opts[j].y) < min - 0.05) return [opts[i], opts[j]];
  }
  return null;
}

export function resolveOverlaps(opts, min = NODE_MIN, clear = CENTER_CLEAR, keep, origin = { x: 0, y: 0 }) {
  const out = opts.map((o) => ({ ...o }));
  const hold = (o) => { if (keep) keep(o); };
  for (let step = 0; step < 48; step++) {
    let moved = false;
    for (const o of out) {
      const dx = o.x - origin.x, dy = o.y - origin.y;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d < clear) { const s = clear / d; o.x = origin.x + dx * s; o.y = origin.y + dy * s; hold(o); moved = true; }
    }
    for (let i = 0; i < out.length; i++) for (let j = 0; j < i; j++) {
      const dx = out[i].x - out[j].x, dy = out[i].y - out[j].y;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d < min) {
        const push = (min - d) / 2 + 0.8, ux = dx / d, uy = dy / d;
        out[i].x += ux * push; out[i].y += uy * push;
        out[j].x -= ux * push; out[j].y -= uy * push;
        hold(out[i]); hold(out[j]);
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const o of out) {
    o.r = Math.hypot(o.x, o.y);
    o.screen = Math.atan2(o.y, o.x) * 180 / Math.PI;
  }
  return out;
}


function applyPos(o, x, y) {
  o.x = x; o.y = y; o.r = Math.hypot(x, y);
  o.screen = Math.atan2(y, x) * 180 / Math.PI;
  return o;
}

function neckTarget(deg) {
  const d = ((deg + 90) % 360 + 360) % 360 - 180; // 0 = up
  if (Math.abs(d) <= 40) return -TOP_SLOT;
  const u = ((deg - 90) % 360 + 360) % 360 - 180;
  if (Math.abs(u) <= 40) return BOT_SLOT;
  return null;
}

// Pull a disk onto the ray so it stays inside the silhouette (and optional dock crop).
export function clampOption(o, nodeR = 28, pad = 8, docked = false) {
  if (docked) {
    let x = o.x, y = o.y;
    const limY = DOCK_CLIP_Y - nodeR - pad;
    let yTop = -SPHERE_H + 8 + nodeR + pad;
    while (yTop < limY && dockHalfW(yTop) < nodeR + pad) yTop += 2;
    if (y > limY) y = limY;
    if (y < yTop) y = yTop;
    const room = Math.max(0, dockHalfW(y) - nodeR - pad - 6);
    const maxX = Math.min(DOCK_RIGHT - nodeR - pad, room);
    const minX = Math.max(-DOCK_LEFT + nodeR + pad, -room);
    if (x > maxX) x = maxX;
    if (x < minX) x = minX;
    while (Math.abs(x) > 0 && !diskInDock(x, y, nodeR, pad)) x += x > 0 ? -1 : 1;
    return applyPos(o, x, y);
  }
  const ang = Math.atan2(o.y, o.x);
  const deg = ang * 180 / Math.PI;
  const hit = sphereAtAngle(deg);
  const maxR = Math.max(CENTER_CLEAR, Math.hypot(hit.x, hit.y) - nodeR - pad);
  let r = Math.hypot(o.x, o.y) || CENTER_CLEAR;
  const neck = neckTarget(deg);
  if (neck != null) r = Math.max(r, Math.abs(neck));
  r = Math.min(Math.max(r, CENTER_CLEAR), maxR);
  let x = Math.cos(ang) * r, y = Math.sin(ang) * r;
  for (let i = 0; i < 12 && !diskInSphere(x, y, nodeR, pad); i++) {
    r = Math.max(CENTER_CLEAR, r - 8);
    x = Math.cos(ang) * r; y = Math.sin(ang) * r;
  }
  return applyPos(o, x, y);
}

export function fitOptions(opts, nodeR = 28, docked = false) {
  let out = opts.map((o) => ({ ...o }));
  const keep = docked ? (o) => clampOption(o, nodeR, 4, true) : (o) => clampOption(o, nodeR, 8, false);
  const min = docked ? nodeR * 2 + 6 : NODE_MIN;
  const clear = docked ? DOCK_CENTER_R + nodeR + 6 : CENTER_CLEAR;
  const origin = docked ? { x: 0, y: DOCK_CAM_Y } : { x: 0, y: 0 };
  for (let i = 0; i < 3; i++) out = resolveOverlaps(out.map(keep), min, clear, keep, origin);
  return out;
}

function packArm(items, deg, arm = DOCK_ARM) {
  const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  const px = -uy, py = ux;
  const n = items.length, gap = 66;
  return items.map((o, i) => {
    if (n <= 3) {
      const side = (i - (n - 1) / 2) * gap;
      return applyPos({ ...o }, ux * arm + px * side, uy * arm + py * side);
    }
    const cols = Math.ceil(n / 2);
    const row = i < cols ? 0 : 1;
    const col = i < cols ? i : i - cols;
    const nCol = i < cols ? cols : n - cols;
    const along = arm + row * gap;
    const side = (col - (nCol - 1) / 2) * gap;
    return applyPos({ ...o }, ux * along + px * side, uy * along + py * side);
  });
}

// Pack options into the visible upper cap after the diamond is shifted down 40%.
function dockSlots(n, nodeR) {
  const pad = 4, gap = nodeR * 2 + 6, slots = [];
  for (let row = 0; row < 8 && slots.length < n + 4; row++) {
    const y = DOCK_CLIP_Y - nodeR - pad - 8 - row * gap;
    if (y - nodeR < -SPHERE_H + TIP * 0.5) break;
    const half = dockHalfW(y) - nodeR - pad - 6;
    if (half < 0) continue;
    let nCol = Math.max(1, Math.floor((2 * half) / gap) + 1);
    if (nCol > 1 && ((nCol - 1) * gap) / 2 > half) nCol -= 1;
    const span = (nCol - 1) * gap;
    for (let c = 0; c < nCol; c++) slots.push({ x: nCol === 1 ? 0 : -span / 2 + c * gap, y });
  }
  return slots;
}

export function placeDockedOptions(cat, ids, stance, prev, settings, fromId) {
  const full = placeOptions(cat, ids, stance, prev, { ...settings, sphereLayout: 'full' }, fromId);
  const buckets = { high: [], low: [], left: [], right: [] };
  for (const o of full) {
    const h = cat.move(o.id).height || 'mid';
    if (h === 'high') buckets.high.push(o);
    else if (h === 'low') buckets.low.push(o);
    else if (o.x < 0) buckets.left.push(o);
    else buckets.right.push(o);
  }
  const ordered = [...buckets.low, ...buckets.left, ...buckets.right, ...buckets.high];
  const slots = dockSlots(ordered.length, DOCK_NODE_R);
  let mid = 0, midD = Infinity;
  slots.forEach((s, i) => {
    const d = Math.hypot(s.x, s.y - DOCK_CAM_Y);
    if (d < midD) { midD = d; mid = i; }
  });
  const rest = slots.filter((_, i) => i !== mid);
  const seed = ordered.map((o, i) => applyPos({ ...o }, (rest[i] || rest[rest.length - 1] || { x: 0, y: DOCK_CAM_Y }).x, (rest[i] || rest[rest.length - 1] || { x: 0, y: DOCK_CAM_Y }).y));
  return fitOptions(seed, DOCK_NODE_R, true);
}

export function placeOptions(cat, ids, stance, prev, settings, fromId) {
  if (settings?.sphereLayout === 'dock') return placeDockedOptions(cat, ids, stance, prev, settings, fromId);
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
  return fitOptions(resolveOverlaps(out), 28, false);
}

export const FACING_NAMES = { 0: 'Forward', 45: 'Forward-right', 90: 'Right', 135: 'Back-right', 180: 'Backward', 225: 'Back-left', 270: 'Left', 315: 'Forward-left' };
