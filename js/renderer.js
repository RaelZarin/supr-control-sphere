// Renderer: draws the Control Sphere SVG (sectors, ring, world of nodes and links) and runs select/travel/entrance motion.
import { STANCES, IDLE } from './data.js';
import { R_SPHERE, R_INNER, polar, screenDeg } from './layout.js';
import { curveFn, bezierCtrl, bezierAt, tween, onFrame, cancelAll } from './anim.js';
import { createFx } from './fx.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); for (const c of kids) if (c) e.append(c); return e; };
const SECTOR_TINT = { high: '#5294cd', mid: '#545a78', low: '#2c2449' };
const INK = '#15132b';
export const VIEW = 272;

function abbrev(label) {
  const w = String(label).replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/);
  return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : (w[0] || '?').slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function partialQuad(a, c, b, t) { // first t of a quadratic bezier, as a path
  const c1 = { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t }; const e = bezierAt(a, c, b, t);
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${e.x.toFixed(1)},${e.y.toFixed(1)}`;
}

function raelGlyph(scale = 1) { // top-down Rael: shoulders, head, blade pointing to the front
  return el('g', { transform: `scale(${scale})`, 'pointer-events': 'none' },
    el('ellipse', { cx: 0, cy: 3, rx: 15, ry: 8, fill: '#3e6c9c', stroke: INK, 'stroke-width': 2 }),
    el('circle', { cx: 0, cy: 1, r: 7.5, fill: '#ede1a9', stroke: INK, 'stroke-width': 2 }),
    el('path', { d: 'M-2,-6 L0,-12 L2,-6', fill: INK }),
    el('path', { d: 'M11,1 L13,-19', stroke: '#ede1a9', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    el('path', { d: 'M11,1 L13,-19', stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'round' }));
}

export function createRenderer(svg, handlers) {
  svg.setAttribute('viewBox', `${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`);
  svg.innerHTML = `<defs>
    <filter id="fxBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="smokeBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="smokeWarp" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="9"/><feDisplacementMap in="SourceGraphic" scale="22"/><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="fxBlurSm" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="glowF" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="shadowWarp" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="18"/><feGaussianBlur stdDeviation="2.5"/></filter>
    <radialGradient id="shadowVignette"><stop offset="0.62" stop-color="#0c0a1d" stop-opacity="0"/><stop offset="1" stop-color="#0c0a1d" stop-opacity="0.85"/></radialGradient>
    <radialGradient id="bodyGrad"><stop offset="0" stop-color="#2c2a58"/><stop offset="1" stop-color="#232147"/></radialGradient>
    <radialGradient id="fadeGrad"><stop offset="0.72" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
    <mask id="worldMask" maskUnits="userSpaceOnUse" x="${-VIEW}" y="${-VIEW}" width="${VIEW * 2}" height="${VIEW * 2}"><circle r="${R_SPHERE + 26}" fill="url(#fadeGrad)"/></mask>
  </defs>`;
  const body = el('circle', { r: R_SPHERE, fill: 'url(#bodyGrad)' });
  const bg = el('g'); const fxLayer = el('g', { 'pointer-events': 'none' });
  const glow = el('circle', { r: R_SPHERE, fill: 'none', filter: 'url(#glowF)', 'pointer-events': 'none' });
  const ring = el('circle', { r: R_SPHERE, fill: 'none', class: 'ring', 'pointer-events': 'none' });
  const deco = el('g', { 'pointer-events': 'none' });
  const world = el('g'); const worldWrap = el('g', { mask: 'url(#worldMask)' }, world);
  const trailL = el('g', { 'pointer-events': 'none' }), linkL = el('g', { 'pointer-events': 'none' }), twigL = el('g', { 'pointer-events': 'none' }), nodeL = el('g'), labelL = el('g', { 'pointer-events': 'none' });
  world.append(trailL, linkL, twigL, nodeL, labelL);
  const burstL = el('g', { 'pointer-events': 'none' });
  svg.append(body, bg, fxLayer, glow, ring, deco, worldWrap, burstL);
  const fx = createFx(fxLayer);

  let model = null; let cam = { x: 0, y: 0 }; let curNode = null; let optNodes = new Map(); let busy = false;
  const setCam = (c) => { cam = c; world.setAttribute('transform', `translate(${(-c.x).toFixed(2)},${(-c.y).toFixed(2)})`); };

  onFrame((t) => {
    if (!model) return;
    const s = model.settings;
    if (curNode) {
      const b = s.reducedMotion ? 0 : s.breathe * Math.sin(t * 2 * Math.PI / (3.2 / s.speed));
      curNode.body.setAttribute('transform', `scale(${(1 + b).toFixed(4)})`);
    }
    fx(t, { stance: model.cur.stance, level: model.level }, s);
  });

  function drawBackground(m) {
    const s = m.settings; bg.replaceChildren(); deco.replaceChildren();
    const strong = s.style === 'direction' ? 0.28 : 0.12;
    for (const sec of m.cat.tree.sectors) {
      const a0 = screenDeg(sec.start, s), a1 = screenDeg(sec.end, s);
      const [lo, hi] = a0 < a1 ? [a0, a1] : [a1, a0];
      const p = (d, r) => polar(d, r); const r0 = 62, r1 = R_SPHERE - 4;
      const A = p(lo, r0), B = p(lo, r1), C = p(hi, r1), D = p(hi, r0);
      bg.append(el('path', { d: `M${A.x},${A.y} L${B.x},${B.y} A${r1},${r1} 0 0 1 ${C.x},${C.y} L${D.x},${D.y} A${r0},${r0} 0 0 0 ${A.x},${A.y}Z`,
        fill: SECTOR_TINT[sec.height] || '#545a78', opacity: strong, stroke: '#545a78', 'stroke-opacity': 0.5, 'stroke-width': 1, 'pointer-events': 'none' }));
      if (s.ringLabels === 'height') {
        const mid = (lo + hi) / 2; const q = polar(mid, R_SPHERE + 17);
        deco.append(el('text', { x: q.x, y: q.y + 4, class: 'ringLabel' }, sec.height.toUpperCase()));
      }
    }
    if (s.ringLabels === 'facing') {
      [['FWD', -90], ['R', 0], ['BACK', 90], ['L', 180]].forEach(([t, d]) => { const q = polar(d + s.facing, R_SPHERE + 17); deco.append(el('text', { x: q.x, y: q.y + 4, class: 'ringLabel' }, t)); });
    }
    const f = polar(s.facing - 90, R_SPHERE - 11); // front marker, just inside the ring
    deco.append(el('path', { d: 'M0,-7 L7,5 L-7,5Z', transform: `translate(${f.x},${f.y}) rotate(${s.facing})`, fill: '#ede1a9', stroke: INK, 'stroke-width': 1.5 }));
  }

  function drawRing(m) {
    const st = STANCES[m.cur.stance]; const dl = m.depthLevel; const s = m.settings;
    const col = mix(st.color, st.deep, dl * 0.85);
    ring.style.stroke = col; ring.style.strokeWidth = (s.line + 1 + 4 * dl).toFixed(1);
    glow.style.stroke = col; glow.style.strokeWidth = (6 + 16 * dl).toFixed(1); glow.style.opacity = (s.glow * (0.25 + 0.75 * dl)).toFixed(2);
  }

  function nodeEl(id, move, stance, opts = {}) {
    const st = STANCES[stance] || STANCES.standing; const r = opts.r || 28;
    const g = el('g', { class: 'node' + (move.stub ? ' stub' : '') + (opts.center ? ' center' : ''), 'data-id': opts.trail ? null : opts.center ? '__center' : id });
    const b = el('g', { class: 'body' });
    b.append(el('circle', { r: r + 10, fill: 'transparent' })); // larger touch target
    b.append(el('circle', { r, fill: st.color, stroke: INK, 'stroke-width': 2.6, 'stroke-dasharray': move.stub ? '5 4' : null }));
    b.append(el('circle', { r: r - 5, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.18, 'stroke-width': 2 }));
    if (opts.center) b.append(raelGlyph(r / 30));
    else b.append(el('text', { class: 'abbr', y: 5, fill: st.ink }, abbrev(move.label || id)));
    const tier = Math.min(3, Math.round(move.tier || 0));
    for (let i = 0; i < tier; i++) b.append(el('circle', { cx: (i - (tier - 1) / 2) * 8, cy: -r + 7, r: 2.4, fill: '#ea5439', stroke: INK, 'stroke-width': 1 }));
    if (move.spend) b.append(el('g', { transform: `translate(${r * 0.72},${-r * 0.72})` }, el('circle', { r: 8.5, fill: '#e88a4a', stroke: INK, 'stroke-width': 1.6 }), el('text', { class: 'badge', y: 3.5 }, String(move.spend))));
    if (opts.dirChevron != null) { const c = polar(opts.dirChevron, r + 7); b.append(el('path', { d: 'M-5,-4 L3,0 L-5,4', transform: `translate(${c.x},${c.y}) rotate(${opts.dirChevron})`, fill: 'none', stroke: st.color, 'stroke-width': 2.4, 'stroke-linecap': 'round' })); }
    g.append(b);
    if (opts.label) g.append(el('text', { class: 'label', y: r + 15 }, opts.label));
    return { g, body: b };
  }

  function show(m, { enter = true } = {}) {
    model = m; const s = m.settings; const fast = s.reducedMotion;
    drawBackground(m); drawRing(m); setCam(m.cam);
    trailL.replaceChildren(); linkL.replaceChildren(); twigL.replaceChildren(); nodeL.replaceChildren(); labelL.replaceChildren(); optNodes = new Map();
    // Trail: previous steps of the chain.
    const n = m.steps.length;
    for (let k = Math.max(1, n - 7); k < n; k++) {
      const a = m.pos[k - 1], b = m.pos[k]; const age = n - 1 - k; const stc = STANCES[m.steps[k].stance].color;
      const ctrl = bezierCtrl(a, b, s.bend);
      trailL.append(el('path', { d: `M${a.x},${a.y} Q${ctrl.x},${ctrl.y} ${b.x},${b.y}`, fill: 'none', stroke: stc, 'stroke-width': s.line + 2, 'stroke-opacity': Math.max(0.15, 0.7 - age * 0.1), 'stroke-linecap': 'round' }));
    }
    for (let k = Math.max(0, n - 7); k < n - 1; k++) {
      const st = m.steps[k]; const age = n - 1 - k; const p = m.pos[k]; const mv = m.cat.move(st.id);
      const { g } = nodeEl(st.id, mv, st.stance, { r: 17, trail: true, label: s.labels ? (st.id === IDLE ? 'Idle' : mv.label) : null });
      g.setAttribute('transform', `translate(${p.x},${p.y})`); g.setAttribute('opacity', Math.max(0.2, 0.75 - age * 0.12)); g.setAttribute('pointer-events', 'none');
      trailL.append(g);
    }
    // Current node.
    const cm = m.cat.move(m.cur.id);
    curNode = nodeEl(m.cur.id, cm, m.cur.stance, { r: 34, center: true, label: s.labels ? (m.cur.id === IDLE ? 'Idle' : cm.label) : null });
    curNode.g.setAttribute('transform', `translate(${m.cam.x},${m.cam.y})`);
    // Options, links and twigs.
    for (const o of m.options) {
      const from = m.cam, to = { x: m.cam.x + o.x, y: m.cam.y + o.y };
      const ctrl = bezierCtrl(from, to, o.link.bend);
      const stc = STANCES[o.resultStance].color;
      let link = null;
      if (s.style !== 'direction') {
        link = el('path', { fill: 'none', stroke: stc, 'stroke-width': s.line, 'stroke-opacity': 0.75, 'stroke-linecap': 'round', 'stroke-dasharray': o.move.stub ? '4 5' : null });
        linkL.append(link);
      }
      const node = nodeEl(o.id, o.move, o.resultStance, { dirChevron: s.style === 'direction' ? o.screen : null });
      nodeL.append(node.g);
      let lab = null; // labels sit under their node, in a top layer so neighbouring nodes never hide them
      if (s.labels) { lab = el('text', { class: 'label' }, o.id === IDLE ? 'Idle' : o.move.label); labelL.append(lab); }
      const labOff = { x: 0, y: 28 + 14 };
      let twigG = null;
      if (s.style === 'tree' && o.twigs.length) {
        twigG = el('g', { opacity: 0 });
        const k = o.twigs.length;
        o.twigs.forEach((tw, i) => {
          const d = o.screen + (i - (k - 1) / 2) * 22; const tp = polar(d, 46);
          const q = { x: to.x + tp.x, y: to.y + tp.y }; const sp = polar(d, 30);
          twigG.append(el('line', { x1: to.x + sp.x, y1: to.y + sp.y, x2: q.x, y2: q.y, stroke: STANCES[tw.stance].color, 'stroke-width': Math.max(1, s.line - 0.5), 'stroke-opacity': 0.55 }));
          twigG.append(el('circle', { cx: q.x, cy: q.y, r: 5.5, fill: STANCES[tw.stance].color, stroke: INK, 'stroke-width': 1.4 }));
        });
        twigL.append(twigG);
      }
      optNodes.set(o.id, { o, node, link, twigG, to, lab });
      const place = (p) => {
        const e = curveFn(o.link.curve, s.overshoot)(p); const pt = bezierAt(from, ctrl, to, Math.min(1.15, e));
        node.g.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)}) scale(${(0.35 + 0.65 * Math.min(1, p * 1.6)).toFixed(3)})`);
        node.g.setAttribute('opacity', Math.min(1, p * 2.5).toFixed(2));
        if (lab) { lab.setAttribute('x', (pt.x + labOff.x).toFixed(1)); lab.setAttribute('y', (pt.y + labOff.y).toFixed(1)); lab.setAttribute('opacity', Math.max(0, (p - 0.5) * 2).toFixed(2)); }
        if (link) link.setAttribute('d', s.style === 'tree' ? partialQuad(from, ctrl, to, Math.min(1, e)) : `M${from.x},${from.y} L${(from.x + (to.x - from.x) * Math.min(1, e)).toFixed(1)},${(from.y + (to.y - from.y) * Math.min(1, e)).toFixed(1)}`);
        if (twigG) twigG.setAttribute('opacity', Math.max(0, (p - 0.6) / 0.4).toFixed(2));
      };
      if (enter && !fast) { place(0); tween(o.link.ms / s.speed, place, { delay: 0 }); } else place(1);
    }
    nodeL.append(curNode.g);
  }

  function burst(x, y, color) {
    const c = el('circle', { cx: x, cy: y, r: 20, fill: 'none', stroke: color, 'stroke-width': 4 });
    burstL.append(c);
    tween(260, (p) => { c.setAttribute('r', (20 + 34 * p).toFixed(1)); c.setAttribute('opacity', (1 - p).toFixed(2)); c.setAttribute('stroke-width', (4 * (1 - p) + 0.5).toFixed(1)); }, { done: () => c.remove() });
  }

  // Selecting an option: pop + glow burst, then the sphere travels forward along the chain to it.
  function travelTo(id, done) {
    const hit = optNodes.get(id); if (!hit || !model) return false;
    if (busy) cancelAll();
    const s = model.settings; const o = hit.o; busy = true;
    hit.node.body.classList.remove('pop'); void hit.node.body.getBBox(); hit.node.body.classList.add('pop');
    burst(o.x, o.y, STANCES[o.resultStance].color);
    tween(s.reducedMotion ? 0 : 160, (p) => { glow.style.opacity = (s.glow * (1 - 0.5 * p) + 0.2).toFixed(2); });
    for (const [k, v] of optNodes) if (k !== id) { v.node.g.setAttribute('opacity', 0.15); if (v.lab) v.lab.setAttribute('opacity', 0.1); if (v.link) v.link.setAttribute('stroke-opacity', 0.1); if (v.twigG) v.twigG.setAttribute('opacity', 0); }
    curNode.g.setAttribute('opacity', 0.5);
    const from = { ...cam }, to = hit.to; const ctrl = bezierCtrl(from, to, o.link.bend * 0.5);
    const ease = curveFn(s.curve === 'linear' ? 'linear' : 'easeOut', s.overshoot);
    tween(s.reducedMotion ? 0 : s.travelMs / s.speed, (p) => setCam(bezierAt(from, ctrl, to, ease(p))), { done: () => { busy = false; done(); } });
    return true;
  }

  function optionAtAngle(deg, tol = 50) {
    if (!model) return null; let best = null, bd = tol;
    for (const o of model.options) { let d = Math.abs((((o.screen - deg) % 360) + 540) % 360 - 180); if (o.r > R_INNER) d += 4; if (d < bd) { bd = d; best = o; } }
    return best;
  }
  return { show, travelTo, optionAtAngle, get model() { return model; }, get busy() { return busy; } };
}
