// Renderer: faceted diamond Control Sphere, octilinear links, select/travel/undo motion.
import { STANCES, IDLE } from './data.js';
import { R_SPHERE, R_INNER, polar, screenDeg } from './layout.js';
import { curveFn, tween, onFrame, cancelAll } from './anim.js';
import { createFx } from './fx.js';
import { octilinearRoute, polylinePath, polylineAt, partialPolyline } from './route.js';
import { createJuice, motionOff, juiceMs, PRESETS } from './juice.js';
import { PIXEL, VIEW, CHAMFER, MOTIF, snap, diamondPath, diamondWedge, diamondAtAngle, facetFills, embossPaths, consumeAmount } from './shape.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); for (const c of kids) if (c) e.append(c); return e; };
const SECTOR_TINT = { high: MOTIF.creamDeep, mid: MOTIF.stone, low: MOTIF.void };
const INK = MOTIF.ink;
export { VIEW };
const LINE = { fill: 'none', 'stroke-linejoin': 'miter', 'stroke-linecap': 'square', 'stroke-miterlimit': 3 };

function abbrev(label) {
  const w = String(label).replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/);
  return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : (w[0] || '?').slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function nodeDiamond(r, fill, stroke, sw, dash) {
  const pix = r < 24 ? 2 : PIXEL; const flat = Math.max(pix * 2, Math.round(r * 0.3));
  return el('path', { d: diamondPath(r, flat, pix), ...LINE, fill, stroke, 'stroke-width': sw, 'stroke-dasharray': dash, 'shape-rendering': 'crispEdges' });
}

function raelGlyph(scale = 1) { // top-down Rael: shoulders, head, blade pointing to the front (character, not the frame)
  return el('g', { transform: `scale(${scale})`, 'pointer-events': 'none' },
    el('ellipse', { cx: 0, cy: 3, rx: 15, ry: 8, fill: '#3e6c9c', stroke: INK, 'stroke-width': 2 }),
    el('circle', { cx: 0, cy: 1, r: 7.5, fill: '#ede1a9', stroke: INK, 'stroke-width': 2 }),
    el('path', { d: 'M-2,-6 L0,-12 L2,-6', fill: INK }),
    el('path', { d: 'M11,1 L13,-19', stroke: '#ede1a9', 'stroke-width': 3, 'stroke-linecap': 'square' }),
    el('path', { d: 'M11,1 L13,-19', stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'square' }));
}

export function createRenderer(svg, handlers) {
  svg.setAttribute('viewBox', `${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const maskD = diamondPath(R_SPHERE + 26);
  svg.innerHTML = `<defs>
    <filter id="fxBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="smokeBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="fxBlurSm" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="glowF" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
    <mask id="worldMask" maskUnits="userSpaceOnUse" x="${-VIEW}" y="${-VIEW}" width="${VIEW * 2}" height="${VIEW * 2}"><path d="${maskD}" fill="#fff"/></mask>
  </defs>`;
  const body = el('path', { d: diamondPath(), fill: MOTIF.void, 'shape-rendering': 'crispEdges', 'pointer-events': 'none' });
  const facets = el('g', { 'pointer-events': 'none', opacity: 0.34, 'shape-rendering': 'crispEdges' });
  facetFills().forEach((f) => facets.append(el('path', { d: f.d, fill: f.fill })));
  const bg = el('g', { 'pointer-events': 'none' }); const fxLayer = el('g', { 'pointer-events': 'none' });
  const ep = embossPaths();
  const emboss = el('g', { 'pointer-events': 'none', 'shape-rendering': 'crispEdges' },
    el('path', { d: ep.shadow, fill: 'none', stroke: MOTIF.shadow, 'stroke-width': PIXEL + 2, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square' }),
    el('path', { d: ep.highlight, fill: 'none', stroke: MOTIF.cream, 'stroke-width': PIXEL + 2, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square' }),
    el('path', { d: ep.outer, fill: 'none', stroke: MOTIF.creamDeep, 'stroke-width': 3, 'stroke-linejoin': 'miter', 'stroke-linecap': 'square' }));
  const glow = el('path', { d: diamondPath(R_SPHERE + PIXEL), ...LINE, filter: 'url(#glowF)', 'pointer-events': 'none' });
  const ring = el('path', { d: diamondPath(), class: 'ring', ...LINE, 'shape-rendering': 'crispEdges', 'pointer-events': 'none' });
  const deco = el('g', { 'pointer-events': 'none' });
  const world = el('g'); const worldWrap = el('g', { mask: 'url(#worldMask)' }, world);
  const trailL = el('g', { 'pointer-events': 'none' }), linkL = el('g', { 'pointer-events': 'none' }), twigL = el('g', { 'pointer-events': 'none' }), nodeL = el('g'), labelL = el('g', { 'pointer-events': 'none' });
  const juiceL = el('g', { 'pointer-events': 'none' });
  world.append(trailL, linkL, twigL, nodeL, labelL, juiceL);
  svg.append(body, facets, bg, fxLayer, emboss, glow, ring, deco, worldWrap);
  const fx = createFx(fxLayer);
  const juice = createJuice(juiceL);

  let model = null; let cam = { x: 0, y: 0 }; let curNode = null; let optNodes = new Map(); let busy = false;
  const setCam = (c) => { cam = c; world.setAttribute('transform', `translate(${(-c.x).toFixed(2)},${(-c.y).toFixed(2)})`); };

  onFrame((t) => {
    if (!model) return;
    const s = model.settings;
    if (curNode && !busy && !curNode.body.classList.contains('undoJuice')) {
      const b = motionOff(s) ? 0 : s.breathe * Math.sin(t * 2 * Math.PI / (3.2 / s.speed));
      curNode.body.setAttribute('transform', `scale(${(1 + b).toFixed(4)})`);
    }
    fx(t, { stance: model.cur.stance, level: model.level }, s);
    applyRim(model);
  });

  function stackFx(distort) {
    if (distort) svg.append(emboss, glow, ring, fxLayer, deco, worldWrap);
    else svg.append(fxLayer, emboss, glow, ring, deco, worldWrap);
  }

  function eatFrame(level) {
    const eat = consumeAmount(level);
    const inset = snap(eat * PIXEL * 5);
    body.setAttribute('d', diamondPath(Math.max(PIXEL * 16, R_SPHERE - inset), Math.max(PIXEL * 2, CHAMFER - inset / 2)));
  }

  function applyRim(m) {
    if (!m) return;
    if (m.settings.rimDistortion) eatFrame(m.level);
    else body.setAttribute('d', diamondPath());
  }

  function drawBackground(m) {
    const s = m.settings; bg.replaceChildren(); deco.replaceChildren();
    const strong = s.style === 'direction' ? 0.28 : 0.12;
    for (const sec of m.cat.tree.sectors) {
      const a0 = screenDeg(sec.start, s), a1 = screenDeg(sec.end, s);
      const [lo, hi] = a0 < a1 ? [a0, a1] : [a1, a0];
      bg.append(el('path', { d: diamondWedge(lo, hi, 62, R_SPHERE - 4), fill: SECTOR_TINT[sec.height] || '#545a78', opacity: strong, stroke: '#545a78', 'stroke-opacity': 0.5, 'stroke-width': 1, 'stroke-linejoin': 'miter', 'pointer-events': 'none' }));
      if (s.ringLabels === 'height') {
        const mid = (lo + hi) / 2; const q = diamondAtAngle(mid, R_SPHERE + 18);
        deco.append(el('text', { x: q.x, y: q.y + 4, class: 'ringLabel' }, sec.height.toUpperCase()));
      }
    }
    if (s.ringLabels === 'facing') {
      [['FWD', -90], ['R', 0], ['BACK', 90], ['L', 180]].forEach(([t, d]) => { const q = diamondAtAngle(d + s.facing, R_SPHERE + 18); deco.append(el('text', { x: q.x, y: q.y + 4, class: 'ringLabel' }, t)); });
    }
    const f = diamondAtAngle(s.facing - 90, R_SPHERE - PIXEL * 2);
    deco.append(el('path', { d: 'M0,-7 L7,5 L-7,5Z', transform: `translate(${f.x},${f.y}) rotate(${s.facing})`, fill: MOTIF.cream, stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'miter' }));
  }

  function drawRing(m) {
    const st = STANCES[m.cur.stance]; const dl = m.depthLevel; const s = m.settings;
    const distort = !!s.rimDistortion;
    const eat = distort ? consumeAmount(m.level) : 0;
    const keep = 1 - eat;
    const col = mix(st.color, st.deep, dl * 0.85);
    ring.style.stroke = col; ring.style.strokeWidth = (s.line + 1 + 4 * dl).toFixed(1); ring.style.opacity = keep.toFixed(2);
    glow.style.stroke = col; glow.style.strokeWidth = (6 + 16 * dl).toFixed(1); glow.style.opacity = (s.glow * (0.25 + 0.75 * dl) * keep).toFixed(2);
    emboss.style.opacity = keep.toFixed(2);
    facets.style.opacity = (0.34 * (distort ? keep : 1)).toFixed(2);
    stackFx(distort);
    applyRim(m);
  }

  function nodeEl(id, move, stance, opts = {}) {
    const st = STANCES[stance] || STANCES.standing; const r = opts.r || 28;
    const g = el('g', { class: 'node' + (move.stub ? ' stub' : '') + (opts.center ? ' center' : ''), 'data-id': opts.trail ? null : opts.center ? '__center' : id });
    const b = el('g', { class: 'body' });
    b.append(nodeDiamond(r + 10, 'transparent', 'none', 0));
    b.append(nodeDiamond(r, st.color, INK, 2.6, move.stub ? '5 4' : null));
    b.append(nodeDiamond(Math.max(6, r - 6), 'none', MOTIF.cream, 1.6));
    if (opts.center) b.append(raelGlyph(r / 30));
    else b.append(el('text', { class: 'abbr', y: 5, fill: st.ink }, abbrev(move.label || id)));
    const tier = Math.min(3, Math.round(move.tier || 0));
    for (let i = 0; i < tier; i++) b.append(el('rect', { x: (i - (tier - 1) / 2) * 8 - 2.5, y: -r + 2, width: 5, height: 5, fill: '#ea5439', stroke: INK, 'stroke-width': 1 }));
    if (move.spend) b.append(el('g', { transform: `translate(${r * 0.72},${-r * 0.72})` }, el('rect', { x: -8, y: -8, width: 16, height: 16, fill: '#e88a4a', stroke: INK, 'stroke-width': 1.6 }), el('text', { class: 'badge', y: 3.5 }, String(move.spend))));
    if (opts.dirChevron != null) { const c = polar(opts.dirChevron, r + 7); b.append(el('path', { d: 'M-5,-4 L3,0 L-5,4', transform: `translate(${c.x},${c.y}) rotate(${opts.dirChevron})`, fill: 'none', stroke: st.color, 'stroke-width': 2.4, 'stroke-linecap': 'square' })); }
    g.append(b);
    if (opts.label) g.append(el('text', { class: 'label', y: r + 15 }, opts.label));
    return { g, body: b };
  }

  function show(m, { enter = true } = {}) {
    model = m; const s = m.settings; const fast = motionOff(s);
    drawBackground(m); drawRing(m); setCam(m.cam);
    trailL.replaceChildren(); linkL.replaceChildren(); twigL.replaceChildren(); nodeL.replaceChildren(); labelL.replaceChildren(); juiceL.replaceChildren(); optNodes = new Map();
    const n = m.steps.length;
    for (let k = Math.max(1, n - 7); k < n; k++) {
      const a = m.pos[k - 1], b = m.pos[k]; const age = n - 1 - k; const stc = STANCES[m.steps[k].stance].color;
      trailL.append(el('path', { d: polylinePath(octilinearRoute(a, b, s.bend)), ...LINE, stroke: stc, 'stroke-width': s.line + 2, 'stroke-opacity': Math.max(0.15, 0.7 - age * 0.1) }));
    }
    for (let k = Math.max(0, n - 7); k < n - 1; k++) {
      const st = m.steps[k]; const age = n - 1 - k; const p = m.pos[k]; const mv = m.cat.move(st.id);
      const { g } = nodeEl(st.id, mv, st.stance, { r: 17, trail: true, label: s.labels ? (st.id === IDLE ? 'Idle' : mv.label) : null });
      g.setAttribute('transform', `translate(${p.x},${p.y})`); g.setAttribute('opacity', Math.max(0.2, 0.75 - age * 0.12)); g.setAttribute('pointer-events', 'none');
      trailL.append(g);
    }
    const cm = m.cat.move(m.cur.id);
    curNode = nodeEl(m.cur.id, cm, m.cur.stance, { r: 34, center: true, label: s.labels ? (m.cur.id === IDLE ? 'Idle' : cm.label) : null });
    curNode.g.setAttribute('transform', `translate(${m.cam.x},${m.cam.y})`);
    for (const o of m.options) {
      const from = m.cam, to = { x: m.cam.x + o.x, y: m.cam.y + o.y };
      const pts = octilinearRoute(from, to, o.link.bend);
      const stc = STANCES[o.resultStance].color;
      const link = el('path', { ...LINE, stroke: stc, 'stroke-width': s.line, 'stroke-opacity': 0.75, 'stroke-dasharray': o.move.stub ? '4 5' : null });
      linkL.append(link);
      const node = nodeEl(o.id, o.move, o.resultStance, { dirChevron: s.style === 'direction' ? o.screen : null });
      nodeL.append(node.g);
      let lab = null;
      if (s.labels) { lab = el('text', { class: 'label' }, o.id === IDLE ? 'Idle' : o.move.label); labelL.append(lab); }
      const labOff = { x: 0, y: 28 + 14 };
      let twigG = null;
      if (s.style === 'tree' && o.twigs.length) {
        twigG = el('g', { opacity: 0 });
        const k = o.twigs.length;
        o.twigs.forEach((tw, i) => {
          const d = o.screen + (i - (k - 1) / 2) * 22; const tipRel = polar(d, 46); const startRel = polar(d, 30);
          const twPts = octilinearRoute({ x: to.x + startRel.x, y: to.y + startRel.y }, { x: to.x + tipRel.x, y: to.y + tipRel.y }, o.link.bend);
          const end = twPts[twPts.length - 1];
          twigG.append(el('path', { d: polylinePath(twPts), ...LINE, stroke: STANCES[tw.stance].color, 'stroke-width': Math.max(1, s.line - 0.5), 'stroke-opacity': 0.55 }));
          twigG.append(el('g', { transform: `translate(${end.x},${end.y})` }, nodeDiamond(5.5, STANCES[tw.stance].color, INK, 1.4)));
        });
        twigL.append(twigG);
      }
      optNodes.set(o.id, { o, node, link, twigG, to, lab, pts });
      const place = (p) => {
        const e = curveFn(o.link.curve, s.overshoot)(p); const u = Math.min(1, e); const pt = polylineAt(pts, u);
        node.g.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)}) scale(${(0.35 + 0.65 * Math.min(1, p * 1.6)).toFixed(3)})`);
        node.g.setAttribute('opacity', Math.min(1, p * 2.5).toFixed(2));
        if (lab) { lab.setAttribute('x', (pt.x + labOff.x).toFixed(1)); lab.setAttribute('y', (pt.y + labOff.y).toFixed(1)); lab.setAttribute('opacity', Math.max(0, (p - 0.5) * 2).toFixed(2)); }
        link.setAttribute('d', partialPolyline(pts, u));
        if (twigG) twigG.setAttribute('opacity', Math.max(0, (p - 0.6) / 0.4).toFixed(2));
      };
      if (enter && !fast) { place(0); tween(o.link.ms / s.speed, place, { delay: 0 }); } else place(1);
    }
    if (!m.options.length) {
      const rel = polar(s.facing - 90, R_INNER), to = { x: m.cam.x + rel.x, y: m.cam.y + rel.y };
      linkL.append(el('path', { d: polylinePath(octilinearRoute(m.cam, to, s.bend)), ...LINE, stroke: MOTIF.cream, 'stroke-width': s.line, 'stroke-opacity': 0.45, 'stroke-dasharray': '5 5' }));
      const slot = el('g', { class: 'node emptySlot', 'data-id': '__slot', transform: `translate(${to.x},${to.y})` });
      slot.append(nodeDiamond(24, 'none', MOTIF.cream, 2.2, '5 4'), el('text', { class: 'abbr', y: 6, fill: MOTIF.cream }, '+'));
      if (s.labels) slot.append(el('text', { class: 'label', y: 40 }, 'Add a move'));
      nodeL.append(slot);
    }
    nodeL.append(curNode.g);
  }

  function bump(el, cls) { el.classList.remove(cls); void el.getBBox(); el.classList.add(cls); }

  function travelTo(id, done) {
    const hit = optNodes.get(id); if (!hit || !model) return false;
    if (busy) cancelAll();
    const s = model.settings; const o = hit.o; busy = true;
    bump(hit.node.body, 'selectJuice');
    juice.playSelect({
      x: hit.to.x, y: hit.to.y, stance: o.resultStance, path: hit.pts, color: STANCES[o.resultStance].color, settings: s,
      neighbors: [...optNodes].filter(([k]) => k !== id).flatMap(([, v]) => [v.node.g, v.twigG, v.link].filter(Boolean)),
    });
    tween(motionOff(s) ? 0 : 160, (p) => { glow.style.opacity = (s.glow * (1 - 0.5 * p) + 0.2).toFixed(2); });
    curNode.g.setAttribute('opacity', 0.5);
    const from = { ...cam }, to = hit.to, pts = hit.pts.length > 1 ? hit.pts : octilinearRoute(from, to, o.link.bend);
    const ease = curveFn(s.curve === 'linear' ? 'linear' : 'easeOut', s.overshoot);
    tween(motionOff(s) ? 0 : s.travelMs / s.speed, (p) => setCam(polylineAt(pts, ease(p))), { done: () => { busy = false; done(); } });
    return true;
  }

  function rewind(done) {
    if (!model || model.steps.length < 2) return false;
    if (busy) cancelAll();
    const s = model.settings; const n = model.steps.length;
    const dest = model.pos[n - 2], here = model.pos[n - 1];
    const fwd = octilinearRoute(dest, here, s.bend); const back = [...fwd].reverse();
    busy = true;
    bump(curNode.body, 'undoJuice');
    juice.playUndo({ x: here.x, y: here.y, path: fwd, color: STANCES[model.cur.stance].color, settings: s });
    for (const [, v] of optNodes) { v.node.g.setAttribute('opacity', 0.12); if (v.lab) v.lab.setAttribute('opacity', 0.08); if (v.link) v.link.setAttribute('stroke-opacity', 0.08); if (v.twigG) v.twigG.setAttribute('opacity', 0); }
    const ease = curveFn(s.curve === 'linear' ? 'linear' : 'easeOut', s.overshoot);
    tween(juiceMs(PRESETS.undo.retractMs, s), (p) => setCam(polylineAt(back, ease(p))), { done: () => { busy = false; done(); } });
    return true;
  }

  function optionAtAngle(deg, tol = 50) {
    if (!model) return null; let best = null, bd = tol;
    for (const o of model.options) { let d = Math.abs((((o.screen - deg) % 360) + 540) % 360 - 180); if (o.r > R_INNER) d += 4; if (d < bd) { bd = d; best = o; } }
    return best;
  }
  return { show, travelTo, rewind, optionAtAngle, get model() { return model; }, get busy() { return busy; } };
}
