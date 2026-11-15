// Data-driven juice presets. Swap numbers / kit kinds when final art lands; playback stays the same.
import { tween, curveFn } from './anim.js';
import { polylinePath, polylineLength } from './route.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); return e; };

export const PRESETS = {
  select: {
    id: 'select',
    anticipMs: 40, anticipScale: 0.82,
    popMs: 170, popScale: 1.24, settleScale: 1,
    ringMs: 280, ringStart: 22, ringEnd: 58,
    pathMs: 300, pathWidth: 5, pathGlow: 11,
    neighborMs: 220, neighborDim: 0.18,
  },
  undo: {
    id: 'undo',
    retractMs: 280,
    squashMs: 200, squashX: 1.14, squashY: 0.72, shrink: 0.18,
    flickerMs: 180, flicker: '#3e6c9c', flickerSoft: '#545a78',
    pathWidth: 5,
  },
};

// Stance kits: Whipping Reed = light gray/blue squares, Crouching Tiger = dark shadowy, Leaping Dragon = white/yellow wisps.
export const STANCE_KIT = {
  standing: { kind: 'squares', color: '#b9cde3', deep: '#3e6c9c', flash: '#b9cde3' },
  crouch: { kind: 'shadow', color: '#6e6f7d', deep: '#0c0a1d', flash: '#545a78' },
  midair: { kind: 'wisps', color: '#f4eecf', deep: '#e8b84a', flash: '#f4eecf' },
};

export function motionOff(settings) {
  return !!(settings?.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));
}

export function juiceMs(ms, settings) {
  if (motionOff(settings) || !(ms > 0)) return 0;
  return ms / Math.max(0.25, settings?.speed || 1);
}

function play(layer, node, ms, update) {
  layer.append(node);
  if (ms <= 0) { node.remove(); return; }
  tween(ms, (p) => update(node, p), { done: () => node.remove() });
}

function burstSquares(layer, x, y, kit, ms, count = 8) {
  for (let i = 0; i < count; i++) {
    const ang = i * 45, rad = (ang * Math.PI) / 180;
    const s0 = 7, r = el('rect', { x: -s0 / 2, y: -s0 / 2, width: s0, height: s0, fill: kit.color, stroke: kit.deep, 'stroke-width': 1.2, 'pointer-events': 'none' });
    play(layer, r, ms, (_, p) => {
      const d = 16 + 36 * p, sz = s0 * (1 - 0.35 * p);
      r.setAttribute('x', (x + Math.cos(rad) * d - sz / 2).toFixed(1));
      r.setAttribute('y', (y + Math.sin(rad) * d - sz / 2).toFixed(1));
      r.setAttribute('width', sz.toFixed(1)); r.setAttribute('height', sz.toFixed(1));
      r.setAttribute('opacity', (1 - p).toFixed(2));
    });
  }
}

function burstShadow(layer, x, y, kit, ms) {
  const ring = el('rect', { fill: 'none', stroke: kit.deep, 'stroke-width': 6, filter: 'url(#fxBlurSm)', 'pointer-events': 'none' });
  play(layer, ring, ms, (_, p) => {
    const s = 28 + 44 * p;
    ring.setAttribute('x', (x - s / 2).toFixed(1)); ring.setAttribute('y', (y - s / 2 + 4 * p).toFixed(1));
    ring.setAttribute('width', s.toFixed(1)); ring.setAttribute('height', s.toFixed(1));
    ring.setAttribute('opacity', ((1 - p) * 0.9).toFixed(2));
    ring.setAttribute('stroke-width', (6 * (1 - p) + 1).toFixed(1));
  });
  burstSquares(layer, x, y, kit, ms, 4);
}

function burstWisps(layer, x, y, kit, ms) {
  for (let i = 0; i < 7; i++) {
    const ang = i * 45 + (i % 2 ? 0 : 22.5), rad = (ang * Math.PI) / 180;
    const w = el('ellipse', { fill: kit.color, filter: 'url(#fxBlurSm)', 'pointer-events': 'none' });
    play(layer, w, ms * (0.85 + 0.15 * (i % 3)), (_, p) => {
      const d = 10 + 40 * p;
      w.setAttribute('cx', (x + Math.cos(rad) * d).toFixed(1));
      w.setAttribute('cy', (y + Math.sin(rad) * d - 6 * p).toFixed(1));
      w.setAttribute('rx', (5 + 10 * p).toFixed(1)); w.setAttribute('ry', (3 + 5 * p).toFixed(1));
      w.setAttribute('opacity', (Math.sin(Math.PI * Math.min(1, p * 1.15)) * 0.85).toFixed(2));
    });
  }
}

function flashRing(layer, x, y, kit, P, ms) {
  if (kit.kind === 'squares') {
    const r = el('rect', { fill: 'none', stroke: kit.flash, 'stroke-width': 3.5, 'pointer-events': 'none' });
    play(layer, r, ms, (_, p) => {
      const s = (P.ringStart + (P.ringEnd - P.ringStart) * p) * 2;
      r.setAttribute('x', (x - s / 2).toFixed(1)); r.setAttribute('y', (y - s / 2).toFixed(1));
      r.setAttribute('width', s.toFixed(1)); r.setAttribute('height', s.toFixed(1));
      r.setAttribute('opacity', (1 - p).toFixed(2));
      r.setAttribute('stroke-width', (3.5 * (1 - p) + 0.5).toFixed(1));
    });
  } else if (kit.kind === 'shadow') {
    const c = el('rect', { fill: 'none', stroke: kit.deep, 'stroke-width': 5, rx: 4, filter: 'url(#smokeBlur)', 'pointer-events': 'none' });
    play(layer, c, ms, (_, p) => {
      const s = (P.ringStart + (P.ringEnd - P.ringStart) * p) * 2;
      c.setAttribute('x', (x - s / 2).toFixed(1)); c.setAttribute('y', (y - s / 2).toFixed(1));
      c.setAttribute('width', s.toFixed(1)); c.setAttribute('height', s.toFixed(1));
      c.setAttribute('opacity', ((1 - p) * 0.95).toFixed(2));
    });
  } else {
    const c = el('circle', { cx: x, cy: y, r: P.ringStart, fill: 'none', stroke: kit.flash, 'stroke-width': 3, filter: 'url(#fxBlurSm)', 'pointer-events': 'none' });
    play(layer, c, ms, (_, p) => {
      c.setAttribute('r', (P.ringStart + (P.ringEnd - P.ringStart) * p).toFixed(1));
      c.setAttribute('opacity', (1 - p).toFixed(2));
      c.setAttribute('stroke-width', (3.2 * (1 - p) + 0.4).toFixed(1));
    });
  }
}

function pulsePath(layer, pts, color, P, ms) {
  if (!pts || pts.length < 2) return;
  const d = polylinePath(pts), len = Math.max(1, polylineLength(pts));
  const glow = el('path', { d, fill: 'none', stroke: color, 'stroke-width': P.pathGlow || 10, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square', 'stroke-miterlimit': 3, filter: 'url(#glowF)', 'pointer-events': 'none', opacity: 0.7 });
  const tip = el('path', { d, fill: 'none', stroke: '#ede1a9', 'stroke-width': P.pathWidth || 5, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square', 'stroke-miterlimit': 3, 'pointer-events': 'none' });
  tip.setAttribute('stroke-dasharray', `${(len * 0.28).toFixed(1)} ${len.toFixed(1)}`);
  layer.append(glow, tip);
  tween(ms, (p) => {
    tip.setAttribute('stroke-dashoffset', (-p * len).toFixed(1));
    const fade = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    tip.setAttribute('opacity', fade.toFixed(2));
    glow.setAttribute('opacity', (0.7 * fade).toFixed(2));
  }, { done: () => { glow.remove(); tip.remove(); } });
}

function retractPath(layer, pts, color, P, ms) {
  if (!pts || pts.length < 2) return;
  const d = polylinePath(pts), len = Math.max(1, polylineLength(pts));
  const line = el('path', { d, fill: 'none', stroke: color, 'stroke-width': P.pathWidth || 5, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square', 'stroke-miterlimit': 3, 'pointer-events': 'none' });
  const glow = el('path', { d, fill: 'none', stroke: P.flicker || '#3e6c9c', 'stroke-width': 9, filter: 'url(#glowF)', 'stroke-linejoin': 'miter', 'pointer-events': 'none', opacity: 0.55 });
  line.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${len.toFixed(1)}`);
  glow.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${len.toFixed(1)}`);
  layer.append(glow, line);
  tween(ms, (p) => {
    const off = (p * len).toFixed(1);
    line.setAttribute('stroke-dashoffset', off); glow.setAttribute('stroke-dashoffset', off);
    glow.setAttribute('opacity', (0.55 * (1 - p)).toFixed(2));
  }, { done: () => { line.remove(); glow.remove(); } });
}

function flicker(layer, x, y, P, ms) {
  const c = el('circle', { cx: x, cy: y, r: 26, fill: P.flicker, 'fill-opacity': 0.35, filter: 'url(#fxBlur)', 'pointer-events': 'none' });
  const rim = el('circle', { cx: x, cy: y, r: 30, fill: 'none', stroke: P.flickerSoft, 'stroke-width': 3, 'pointer-events': 'none' });
  layer.append(c, rim);
  tween(ms, (p) => {
    const pulse = Math.sin(p * Math.PI);
    c.setAttribute('r', (20 + 22 * pulse).toFixed(1));
    c.setAttribute('fill-opacity', (0.4 * pulse).toFixed(2));
    rim.setAttribute('r', (24 + 18 * p).toFixed(1));
    rim.setAttribute('opacity', ((1 - p) * 0.9).toFixed(2));
  }, { done: () => { c.remove(); rim.remove(); } });
}

export function createJuice(layer) {
  return {
    // Immediate select feedback around the node, along its route, and on the branch neighborhood.
    playSelect({ x, y, stance, path, neighbors, color, settings }) {
      const P = PRESETS.select, kit = STANCE_KIT[stance] || STANCE_KIT.standing, ms = (n) => juiceMs(n, settings);
      const col = color || kit.color;
      if (ms(P.ringMs) <= 0) return;
      flashRing(layer, x, y, kit, P, ms(P.ringMs));
      if (kit.kind === 'squares') burstSquares(layer, x, y, kit, ms(P.ringMs));
      else if (kit.kind === 'shadow') burstShadow(layer, x, y, kit, ms(P.ringMs));
      else burstWisps(layer, x, y, kit, ms(P.ringMs));
      pulsePath(layer, path, col, P, ms(P.pathMs));
      const nms = ms(P.neighborMs);
      if (nms > 0 && neighbors) {
        const ease = curveFn('easeOut');
        for (const n of neighbors) {
          const start = Number(n.getAttribute('opacity') || 1);
          tween(nms, (p) => n.setAttribute('opacity', (start + (P.neighborDim - start) * ease(p)).toFixed(2)));
        }
      }
    },
    playUndo({ x, y, path, color, settings }) {
      const P = PRESETS.undo, ms = (n) => juiceMs(n, settings);
      if (ms(P.retractMs) <= 0) return;
      retractPath(layer, path, color || P.flicker, P, ms(P.retractMs));
      flicker(layer, x, y, P, ms(P.flickerMs));
    },
    presets: PRESETS,
  };
}
