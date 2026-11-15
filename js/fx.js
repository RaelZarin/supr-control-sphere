// Stance edge FX around the faceted diamond. Depth chews the outline until it is fully consumed.
import { R_SPHERE } from './layout.js';
import { STANCES } from './data.js';
import { PIXEL, snap, MOTIF, diamondPath, diamondNormal, distortPath, consumeAmount } from './shape.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SMOKE = ['#0c0a1d', '#1a1730', '#2a2540', '#545a78', '#6e6f7d'];
const AIR = [STANCES.midair.color, MOTIF.cream, STANCES.midair.deep, MOTIF.creamDeep];

export function createFx(root) {
  const groups = {}, rims = {}, pools = {};
  function group(key, n, extra) {
    const g = el('g'); const rim = el('path', { fill: 'none', 'stroke-linejoin': 'miter', 'stroke-linecap': 'square', 'shape-rendering': 'crispEdges' });
    const layer = el('g'); const rects = Array.from({ length: n }, () => layer.appendChild(el('rect', { 'shape-rendering': 'crispEdges' })));
    g.append(rim, ...(extra ? [extra] : []), layer); root.appendChild(g);
    groups[key] = g; rims[key] = rim; pools[key] = rects;
  }
  const airHalo = el('path', { d: diamondPath(R_SPHERE + PIXEL), fill: 'none', stroke: STANCES.midair.color, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square', 'shape-rendering': 'crispEdges' });
  group('midair', 36, airHalo);
  const vignette = el('path', { d: diamondPath(R_SPHERE), fill: MOTIF.shadow, 'shape-rendering': 'crispEdges' });
  group('crouch', 40, vignette);
  group('standing', 48);
  const shown = { standing: 0, crouch: 0, midair: 0 };
  let frozen = 0;

  function place(el, ang, phase, L, lift, palette, grow, onRim) {
    const nrm = diamondNormal(ang, R_SPHERE);
    const out = onRim ? (hash(ang) - 0.35) * PIXEL * 2 * L : phase * (10 + 42 * L);
    const up = onRim ? 0 : phase * lift * (14 + 28 * L);
    const x = snap(nrm.px + nrm.x * out), y = snap(nrm.py + nrm.y * out - up);
    const sz = snap(Math.max(PIXEL * 2, onRim ? PIXEL * 3 + 16 * L : PIXEL * 2 + phase * grow * (1.2 + L)));
    el.setAttribute('x', x - sz / 2); el.setAttribute('y', y - sz / 2);
    el.setAttribute('width', sz); el.setAttribute('height', sz);
    el.setAttribute('fill', palette[Math.floor(hash(ang * 13 + 3) * palette.length) % palette.length]);
    el.setAttribute('opacity', (onRim ? (0.6 + 0.4 * L) : Math.sin(Math.PI * Math.min(1, phase * 1.2)) * (0.4 + 0.6 * L)).toFixed(2));
  }

  function paintRim(key, t, L, color) {
    const eat = consumeAmount(L);
    const d = distortPath(L, t, key === 'standing' ? 1 : key === 'crouch' ? 2 : 3);
    rims[key].setAttribute('d', d || 'M0,0');
    rims[key].setAttribute('stroke', color);
    rims[key].setAttribute('stroke-width', String(Math.max(0, snap((PIXEL * 2 + 6 * L) * (1 - eat * 0.3), 2))));
    rims[key].setAttribute('opacity', (eat < 0.05 || eat > 0.45 || !d) ? 0 : (0.4 + 0.4 * eat).toFixed(2));
  }

  function drawAir(t, L) {
    airHalo.setAttribute('stroke-width', String(PIXEL + snap(2 + 10 * L, 2)));
    airHalo.setAttribute('opacity', ((0.25 + 0.45 * L) * (1 - consumeAmount(L))).toFixed(2));
    paintRim('midair', t, L, STANCES.midair.color);
    const n = Math.round(12 + 24 * L);
    pools.midair.forEach((w, i) => {
      if (i >= n) { w.setAttribute('opacity', 0); return; }
      const phase = (t * 0.14 + hash(i)) % 1;
      const ang = hash(i + 7) * 360 + snap(phase * 16, PIXEL);
      place(w, ang, phase, L, 1, AIR, 8, i < n * (0.5 + 0.5 * L));
    });
  }

  function drawCrouch(t, L) {
    const eat = consumeAmount(L);
    const inset = snap(eat * PIXEL * 5);
    vignette.setAttribute('d', diamondPath(Math.max(PIXEL * 16, R_SPHERE - inset)));
    vignette.setAttribute('opacity', (0.1 + 0.35 * eat).toFixed(2));
    paintRim('crouch', t, L, MOTIF.shadow);
    const n = Math.round(14 + 26 * L);
    const chew = Math.round(n * (0.6 + 0.4 * L));
    pools.crouch.forEach((p, i) => {
      if (i >= n) { p.setAttribute('opacity', 0); return; }
      if (i < chew) {
        const ang = (i * 360) / Math.max(chew, 1);
        const s = snap(PIXEL * 3 + 14 * L * (0.5 + 0.5 * hash(i + 4)));
        const step = Math.floor((Math.sin(t * 0.9 + i) + 1) * 2) / 4;
        const nrm = diamondNormal(ang, R_SPHERE);
        const off = step * PIXEL * L - s * 0.2;
        const x = snap(nrm.px + nrm.x * off), y = snap(nrm.py + nrm.y * off);
        p.setAttribute('x', x - s / 2); p.setAttribute('y', y - s / 2);
        p.setAttribute('width', s); p.setAttribute('height', s);
        p.setAttribute('fill', SMOKE[i % SMOKE.length]);
        p.setAttribute('opacity', (0.65 + 0.35 * L).toFixed(2));
        return;
      }
      const phase = (t * 0.1 + hash(i + 2)) % 1;
      const ang = hash(i + 11) * 360 + snap(phase * 10, PIXEL);
      place(p, ang, phase, L, 1.35, SMOKE, 12, false);
    });
  }

  function drawStand(t, L) {
    paintRim('standing', t, L, STANCES.standing.color);
    const n = Math.round(12 + 36 * L);
    const pal = [STANCES.standing.color, STANCES.standing.deep, MOTIF.creamDeep];
    pools.standing.forEach((r, i) => {
      if (i >= n) { r.setAttribute('opacity', 0); return; }
      const ang = (i * 360) / Math.max(n, 1);
      const s = snap(PIXEL * 2 + (8 + 16 * L) * (0.45 + 0.55 * hash(i)));
      const step = Math.floor((Math.sin(t * 1.4 + i * 0.9) + 1) * 2) / 4;
      const nrm = diamondNormal(ang, R_SPHERE);
      const onRim = i < n * (0.6 + 0.4 * L);
      const off = onRim ? (step * PIXEL * L - s * 0.15) : (s / 2 + step * 8 * L);
      const x = snap(nrm.px + nrm.x * off), y = snap(nrm.py + nrm.y * off);
      r.setAttribute('x', x - s / 2); r.setAttribute('y', y - s / 2);
      r.setAttribute('width', s); r.setAttribute('height', s);
      r.setAttribute('fill', pal[i % pal.length]);
      r.setAttribute('stroke', MOTIF.ink);
      r.setAttribute('stroke-width', 1);
      r.setAttribute('opacity', (0.5 + 0.5 * L).toFixed(2));
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
