// Stance edge FX around the faceted diamond. Cheap SVG: pooled, grid-snapped rects, no worms or rounded rims.
import { R_SPHERE } from './layout.js';
import { STANCES } from './data.js';
import { PIXEL, snap, MOTIF, diamondPath, diamondNormal } from './shape.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SMOKE = ['#0c0a1d', '#1a1730', '#2a2540', '#545a78', '#6e6f7d'];

export function createFx(root) {
  const groups = {};
  // Leaping Dragon: blocky cream/yellow puffs lifting off the diamond, plus a hard diamond halo.
  const air = el('g');
  const halo = el('path', { d: diamondPath(R_SPHERE + PIXEL), fill: 'none', stroke: STANCES.midair.color, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square', 'stroke-miterlimit': 2, 'shape-rendering': 'crispEdges' });
  const puffAir = el('g');
  air.append(halo, puffAir);
  const wisps = Array.from({ length: 30 }, () => puffAir.appendChild(el('rect', { fill: STANCES.midair.color, 'shape-rendering': 'crispEdges' })));
  groups.midair = air;
  // Crouching Tiger: dark-gray pixel smoke/shadow wafting up and out from the diamond — no tendrils, no circle, no spiral.
  const crouch = el('g');
  const vignette = el('path', { d: diamondPath(R_SPHERE), fill: MOTIF.shadow, 'shape-rendering': 'crispEdges' });
  const shade = el('path', { d: diamondPath(R_SPHERE + PIXEL * 2), fill: 'none', stroke: MOTIF.shadow, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square', 'shape-rendering': 'crispEdges' });
  const puffC = el('g');
  const puffs = Array.from({ length: 36 }, () => puffC.appendChild(el('rect', { 'shape-rendering': 'crispEdges' })));
  crouch.append(vignette, shade, puffC);
  groups.crouch = crouch;
  // Whipping Reed: solid square motifs stepping out of the diamond edge.
  const stand = el('g');
  const blocks = Array.from({ length: 36 }, () => stand.appendChild(el('rect', { fill: STANCES.standing.color, stroke: MOTIF.void, 'stroke-width': 1, 'shape-rendering': 'crispEdges' })));
  const caps = Array.from({ length: 18 }, () => stand.appendChild(el('rect', { fill: STANCES.standing.deep, stroke: MOTIF.void, 'stroke-width': 1, 'shape-rendering': 'crispEdges' })));
  groups.standing = stand;
  for (const g of Object.values(groups)) root.appendChild(g);

  const shown = { standing: 0, crouch: 0, midair: 0 };
  let frozen = 0;

  function placePuff(el, ang, phase, L, lift, palette, grow) {
    const nrm = diamondNormal(ang, R_SPHERE);
    const out = phase * (10 + 42 * L), up = phase * lift * (14 + 28 * L);
    const x = snap(nrm.px + nrm.x * out), y = snap(nrm.py + nrm.y * out - up);
    const sz = snap(Math.max(PIXEL * 2, PIXEL * 2 + phase * grow * (1.2 + L)));
    el.setAttribute('x', x - sz / 2); el.setAttribute('y', y - sz / 2);
    el.setAttribute('width', sz); el.setAttribute('height', sz);
    const col = palette[Math.floor(hash(ang * 13 + 3) * palette.length) % palette.length];
    el.setAttribute('fill', col);
    el.setAttribute('opacity', (Math.sin(Math.PI * Math.min(1, phase * 1.2)) * (0.35 + 0.55 * L)).toFixed(2));
  }

  function drawAir(t, L) {
    halo.setAttribute('stroke-width', String(PIXEL + snap(2 + 10 * L, 2)));
    halo.setAttribute('opacity', (0.25 + 0.45 * L).toFixed(2));
    const n = Math.round(6 + 24 * L);
    const pal = [STANCES.midair.color, MOTIF.cream, STANCES.midair.deep];
    wisps.forEach((w, i) => {
      if (i >= n) { w.setAttribute('opacity', 0); return; }
      const phase = (t * 0.12 + hash(i)) % 1;
      const ang = hash(i + 7) * 360 + snap(phase * 16, PIXEL);
      placePuff(w, ang, phase, L, 1, pal, 8);
    });
  }

  function drawCrouch(t, L) {
    // Soft-looking smoke made of overlapping hard squares: drift up and out, swell, fade. Grows with depth.
    vignette.setAttribute('opacity', (0.15 + 0.45 * L).toFixed(2));
    shade.setAttribute('stroke-width', String(PIXEL + snap(4 + 18 * L, 2)));
    shade.setAttribute('opacity', (0.3 + 0.55 * L).toFixed(2));
    const n = Math.round(8 + 28 * L);
    puffs.forEach((p, i) => {
      if (i >= n) { p.setAttribute('opacity', 0); return; }
      const phase = (t * 0.1 + hash(i + 2)) % 1;
      const ang = hash(i + 11) * 360 + snap(phase * 10, PIXEL);
      placePuff(p, ang, phase, L, 1.35, SMOKE, 10);
    });
  }

  function drawStand(t, L) {
    const n = Math.round(10 + 26 * L);
    const put = (r, i, extra) => {
      const ang = i * (360 / Math.max(n, 1));
      const s = snap(PIXEL + (5 + 11 * L) * (0.5 + 0.5 * hash(i)));
      const step = Math.floor((Math.sin(t * 1.4 + i * 0.9) + 1) * 2) / 4;
      const nrm = diamondNormal(ang, R_SPHERE);
      const off = s / 2 + extra + step * 8 * L;
      const x = snap(nrm.px + nrm.x * off), y = snap(nrm.py + nrm.y * off);
      r.setAttribute('x', x - s / 2); r.setAttribute('y', y - s / 2);
      r.setAttribute('width', s); r.setAttribute('height', s);
    };
    blocks.forEach((r, i) => {
      if (i >= n) { r.setAttribute('opacity', 0); return; }
      put(r, i, 0); r.setAttribute('opacity', (0.45 + 0.55 * L).toFixed(2));
    });
    caps.forEach((r, i) => {
      const on = L > 0.45 && i < Math.round((n / 2) * (L - 0.45) / 0.55);
      if (!on) { r.setAttribute('opacity', 0); return; }
      put(r, i * 2, 16 * L + PIXEL); r.setAttribute('opacity', (0.8 * L).toFixed(2));
    });
  }
  const draw = { midair: drawAir, crouch: drawCrouch, standing: drawStand };

  return function update(time, target, settings) {
    const t = settings.reducedMotion ? frozen : time * settings.speed;
    if (!settings.reducedMotion) frozen = t;
    for (const k of Object.keys(groups)) {
      const goal = k === target.stance ? target.level : 0;
      shown[k] += (goal - shown[k]) * (settings.reducedMotion ? 1 : 0.08);
      const vis = k === target.stance ? Math.max(shown[k], 0.001) : shown[k];
      groups[k].setAttribute('opacity', Math.min(1, shown[k] * 4).toFixed(2));
      if (vis > 0.004) { groups[k].style.display = ''; draw[k](t, Math.max(0, shown[k])); }
      else groups[k].style.display = 'none';
    }
  };
}
