// Stance edge FX around the Control Sphere outline. Cheap SVG: pooled shapes moved once per frame.
import { R_SPHERE, polar } from './layout.js';
import { STANCES } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function createFx(root) {
  const groups = {};
  // Leaping Dragon: wafting smoke wisps.
  const air = el('g');
  const halo = el('circle', { r: R_SPHERE + 3, fill: 'none', stroke: STANCES.midair.color, filter: 'url(#smokeWarp)' });
  const puffG = el('g', { filter: 'url(#smokeBlur)' });
  air.append(halo, puffG);
  const wisps = Array.from({ length: 30 }, () => puffG.appendChild(el('ellipse', { fill: STANCES.midair.color })));
  groups.midair = air;
  // Crouching Tiger: creeping shadow.
  const crouch = el('g');
  const vignette = el('circle', { r: R_SPHERE, fill: 'url(#shadowVignette)' });
  const shadowRing = el('circle', { r: R_SPHERE + 4, fill: 'none', stroke: '#0c0a1d', filter: 'url(#shadowWarp)' });
  const tendG = el('g', { filter: 'url(#fxBlurSm)' });
  const tendrils = Array.from({ length: 18 }, () => tendG.appendChild(el('path', { fill: 'none', stroke: '#0c0a1d', 'stroke-linecap': 'round' })));
  crouch.append(vignette, shadowRing, tendG);
  groups.crouch = crouch;
  // Whipping Reed: solid square motifs growing out of the edge.
  const stand = el('g');
  const blocks = Array.from({ length: 36 }, () => stand.appendChild(el('rect', { fill: STANCES.standing.color, stroke: '#232147', 'stroke-width': 1.5 })));
  const caps = Array.from({ length: 18 }, () => stand.appendChild(el('rect', { fill: STANCES.standing.deep, stroke: '#232147', 'stroke-width': 1.2 })));
  groups.standing = stand;
  for (const g of Object.values(groups)) root.appendChild(g);

  const shown = { standing: 0, crouch: 0, midair: 0 };
  let frozen = 0;

  function drawAir(t, L) {
    // A soft warped halo plus blurred puffs that lift off the rim, swell, curl sideways and fade: smoke, not particles.
    halo.setAttribute('stroke-width', (3 + 14 * L).toFixed(1)); halo.setAttribute('opacity', (0.2 + 0.4 * L).toFixed(2));
    halo.setAttribute('transform', `rotate(${(-t * 6) % 360})`);
    const n = Math.round(6 + 24 * L);
    wisps.forEach((w, i) => {
      if (i >= n) { w.setAttribute('opacity', 0); return; }
      const phase = (t * 0.12 + hash(i)) % 1;
      const base = hash(i + 7) * 360 + t * 3 + phase * (18 + 10 * Math.sin(i)); // curl along the rim as it rises
      const r0 = R_SPHERE + phase * (8 + 34 * L);
      const p = polar(base, r0);
      const size = 5 + phase * (8 + 16 * L);
      w.setAttribute('cx', p.x.toFixed(1)); w.setAttribute('cy', p.y.toFixed(1));
      w.setAttribute('rx', (size * 1.6).toFixed(1)); w.setAttribute('ry', size.toFixed(1));
      w.setAttribute('transform', `rotate(${(base + 90).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      w.setAttribute('opacity', (Math.sin(Math.PI * Math.min(1, phase * 1.3)) * (0.12 + 0.3 * L)).toFixed(2));
    });
  }
  function drawCrouch(t, L) {
    vignette.setAttribute('opacity', (0.25 + 0.75 * L).toFixed(2));
    shadowRing.setAttribute('stroke-width', (5 + 26 * L).toFixed(1));
    shadowRing.setAttribute('opacity', (0.35 + 0.6 * L).toFixed(2));
    shadowRing.setAttribute('transform', `rotate(${(t * 4) % 360})`);
    const n = Math.round(4 + 14 * L);
    tendrils.forEach((p, i) => {
      if (i >= n) { p.setAttribute('opacity', 0); return; }
      const a0 = i * (360 / n) + hash(i) * 12 + Math.sin(t * 0.3 + i) * 4;
      const reach = (8 + 40 * L) * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.7)));
      const inward = i % 3 === 0 ? -1 : 1;
      const a = polar(a0, R_SPHERE), c = polar(a0 + 6 * Math.sin(t + i), R_SPHERE + inward * reach * 0.6), b = polar(a0 - 4, R_SPHERE + inward * reach);
      p.setAttribute('d', `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
      p.setAttribute('stroke-width', (3 + 7 * L).toFixed(1));
      p.setAttribute('opacity', (0.5 + 0.5 * L).toFixed(2));
    });
  }
  function drawStand(t, L) {
    const n = Math.round(10 + 26 * L);
    blocks.forEach((r, i) => {
      if (i >= n) { r.setAttribute('opacity', 0); return; }
      const ang = i * (360 / n);
      const s = 5 + 11 * L * (0.55 + 0.45 * hash(i));
      const step = Math.floor((Math.sin(t * 1.4 + i * 0.9) + 1) * 2) / 4; // stepped, blocky extrusion
      const off = R_SPHERE + s / 2 + step * 8 * L;
      r.setAttribute('x', (-s / 2).toFixed(1)); r.setAttribute('y', (-s / 2).toFixed(1)); r.setAttribute('width', s.toFixed(1)); r.setAttribute('height', s.toFixed(1));
      r.setAttribute('transform', `rotate(${ang.toFixed(1)}) translate(${off.toFixed(1)},0)`);
      r.setAttribute('opacity', (0.45 + 0.55 * L).toFixed(2));
    });
    caps.forEach((r, i) => {
      const on = L > 0.45 && i < Math.round((n / 2) * (L - 0.45) / 0.55);
      if (!on) { r.setAttribute('opacity', 0); return; }
      const idx = i * 2; const ang = idx * (360 / n);
      const s = 4 + 7 * L; const step = Math.floor((Math.sin(t * 1.4 + idx * 0.9) + 1) * 2) / 4;
      const off = R_SPHERE + 16 * L + s + step * 8 * L + 4;
      r.setAttribute('x', (-s / 2).toFixed(1)); r.setAttribute('y', (-s / 2).toFixed(1)); r.setAttribute('width', s.toFixed(1)); r.setAttribute('height', s.toFixed(1));
      r.setAttribute('transform', `rotate(${ang.toFixed(1)}) translate(${off.toFixed(1)},0)`);
      r.setAttribute('opacity', (0.8 * L).toFixed(2));
    });
  }
  const draw = { midair: drawAir, crouch: drawCrouch, standing: drawStand };

  // target: { stance, level } ; settings for speed / reduced motion.
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
