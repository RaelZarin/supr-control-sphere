// Top-down Rael glyphs for the sphere center: idle, moving, running, and crouch. Crunchy, not sleek.
import { MOTIF } from './shape.js';

const NS = 'http://www.w3.org/2000/svg';
const INK = MOTIF.ink;
const el = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); for (const c of kids) if (c) e.append(c); return e; };

function blade(lean = 0) {
  return el('g', { transform: `translate(${lean},0)` },
    el('path', { d: 'M11,1 L13,-19', stroke: '#ede1a9', 'stroke-width': 3, 'stroke-linecap': 'square' }),
    el('path', { d: 'M11,1 L13,-19', stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'square' }));
}

function idleBody() {
  return [
    el('ellipse', { cx: 0, cy: 3, rx: 15, ry: 8, fill: '#3e6c9c', stroke: INK, 'stroke-width': 2 }),
    el('circle', { cx: 0, cy: 1, r: 7.5, fill: '#ede1a9', stroke: INK, 'stroke-width': 2 }),
    el('path', { d: 'M-2,-6 L0,-12 L2,-6', fill: INK }),
    blade(0),
  ];
}

function movingBody(run) {
  const kick = run ? 5 : 3;
  return [
    el('rect', { x: -12, y: 6, width: 7, height: 10, fill: '#2a4a72', stroke: INK, 'stroke-width': 1.5, transform: `rotate(-18 -8 11)` }),
    el('rect', { x: 4, y: 5, width: 7, height: 10, fill: '#3e6c9c', stroke: INK, 'stroke-width': 1.5, transform: `rotate(${kick} 8 10)` }),
    el('ellipse', { cx: 1, cy: 1, rx: 14, ry: 7, fill: '#3e6c9c', stroke: INK, 'stroke-width': 2 }),
    el('circle', { cx: 2, cy: -2, r: 7.5, fill: '#ede1a9', stroke: INK, 'stroke-width': 2 }),
    el('path', { d: 'M0,-8 L3,-14 L5,-8', fill: INK }),
    blade(run ? 2 : 1),
    el('rect', { x: -18, y: 4, width: 5, height: 2, fill: MOTIF.creamDeep, opacity: 0.8 }),
    el('rect', { x: -16, y: 9, width: 4, height: 2, fill: MOTIF.creamDeep, opacity: 0.55 }),
  ];
}

function crouchBody(moving) {
  return [
    moving ? el('rect', { x: -13, y: 8, width: 8, height: 7, fill: '#2a2540', stroke: INK, 'stroke-width': 1.5 }) : null,
    moving ? el('rect', { x: 5, y: 9, width: 8, height: 7, fill: '#3a3555', stroke: INK, 'stroke-width': 1.5 }) : null,
    el('ellipse', { cx: 0, cy: 7, rx: 16, ry: 7, fill: '#6e6f7d', stroke: INK, 'stroke-width': 2 }),
    el('circle', { cx: 0, cy: 4, r: 7, fill: '#ede1a9', stroke: INK, 'stroke-width': 2 }),
    el('path', { d: 'M-2,-2 L0,-8 L2,-2', fill: INK }),
    blade(0),
  ];
}

const BODIES = {
  idle: () => idleBody(),
  moving: () => movingBody(false),
  running: () => movingBody(true),
  crouch: () => crouchBody(false),
  crouch_moving: () => crouchBody(true),
};

export function raelGlyph(scale = 1, pose = 'idle') {
  const inner = el('g', { class: 'raelStride' }, ...(BODIES[pose] || BODIES.idle)().filter(Boolean));
  return el('g', { class: `rael ${pose}`, transform: `scale(${scale})`, 'pointer-events': 'none' }, inner);
}
