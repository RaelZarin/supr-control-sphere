// Faceted pixel-diamond geometry. The sphere uses a data-driven necked silhouette;
// small option nodes keep a chamfered octagon so they stay readable at r≈28.
import { polylinePath, isOctilinear } from './route.js';

export const PIXEL = 6;
export const VIEW = 384;
export const CHAMFER = 24;
// Motif swatches (icon look, not the file): void, sage, cream, stone, blue, deep.
export const MOTIF = { void: '#232147', sage: '#b4bda5', cream: '#ede1a9', creamDeep: '#e4d9aa', stone: '#93938f', blue: '#5294cd', deep: '#5963a3', ink: '#15132b', shadow: '#0c0a1d' };

export const snap = (v, p = PIXEL) => Math.round(v / p) * p;

// Necked diamond, snapped to the pixel grid. Width/height ≈ 0.655, neck ≈ 31% of width.
// Top neck is 10% of height; bottom neck is a little longer. Tips are 45°.
export const SPHERE_H = 330;
export const SPHERE_W = 216;
export const NECK_W = 66;
export const TIP = 66;
export const TOP_NECK = 66;
export const BOT_NECK = 84;
// Mid-neck radii, used to drop high/low icons into the vertical necks.
export const TOP_SLOT = SPHERE_H - TIP - TOP_NECK / 2; // 231
export const BOT_SLOT = SPHERE_H - TIP - BOT_NECK / 2; // 222
// In-game crop: origin + d-pad stay visible; left point tucks behind Undo, bottom tip is clipped.
export const DOCK_LEFT = 162;
export const DOCK_RIGHT = 126;
export const DOCK_BOTTOM = 126;
export const DOCK_ARM = 76;

export function snapPoly(pts, p = PIXEL) { return pts.map((q) => ({ x: snap(q.x, p), y: snap(q.y, p) })); }

// Prototype, clockwise from the top tip. `inset` > 0 shrinks along the normals (parallel rim).
export function sphereProfile() {
  const H = SPHERE_H, W = SPHERE_W, N = NECK_W, T = TIP, TN = TOP_NECK, BN = BOT_NECK;
  return [
    { x: 0, y: -H },
    { x: N, y: -H + T }, { x: N, y: -H + T + TN },
    { x: W, y: 0 },
    { x: N, y: H - T - BN }, { x: N, y: H - T },
    { x: 0, y: H },
    { x: -N, y: H - T }, { x: -N, y: H - T - BN },
    { x: -W, y: 0 },
    { x: -N, y: -H + T + TN }, { x: -N, y: -H + T },
  ];
}

function edgeInward(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let nx = dy / len, ny = -dx / len;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  if (nx * -mx + ny * -my < 0) { nx = -nx; ny = -ny; }
  return { nx, ny, len };
}

function intersectLines(p, d, q, e) {
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-9) return { x: p.x, y: p.y };
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den;
  return { x: p.x + d.x * t, y: p.y + d.y * t };
}

export function insetPoly(pts, dist) {
  if (!dist) return pts.map((p) => ({ x: p.x, y: p.y }));
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const u = edgeInward(a, b), v = edgeInward(b, c);
    const p = { x: a.x + u.nx * dist, y: a.y + u.ny * dist };
    const d = { x: b.x - a.x, y: b.y - a.y };
    const q = { x: b.x + v.nx * dist, y: b.y + v.ny * dist };
    const e = { x: c.x - b.x, y: c.y - b.y };
    out.push(intersectLines(p, d, q, e));
  }
  return out;
}

export function sphereVerts(inset = 0) { return insetPoly(sphereProfile(), inset); }

export function spherePath(inset = 0, p = PIXEL) {
  return polylinePath(snapPoly(sphereVerts(inset), p)) + 'Z';
}

// 8 vertices of a chamfered 45° diamond. Used only for option-node gems.
export function diamondOctagon(r, flat = CHAMFER) {
  const rv = r * Math.SQRT2, h = flat / 2;
  return [
    { x: -h, y: -rv + h }, { x: h, y: -rv + h },
    { x: rv - h, y: -h }, { x: rv - h, y: h },
    { x: h, y: rv - h }, { x: -h, y: rv - h },
    { x: -rv + h, y: h }, { x: -rv + h, y: -h },
  ];
}

export function diamondPath(r, flat = CHAMFER, p = PIXEL) {
  const pts = snapPoly(diamondOctagon(r, flat), p);
  return polylinePath(pts) + 'Z';
}

export function frameCommands(d) { return (String(d).match(/[A-Za-z]/g) || []); }
export function isLineFrame(d) { return frameCommands(d).every((c) => 'MLZmlz'.includes(c)); }

export function octagonIsOctilinear(pts, tol = 0.51) {
  if (!pts || pts.length < 3) return false;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (!isOctilinear(b.x - a.x, b.y - a.y, tol)) return false;
  }
  return true;
}

function raySeg(dx, dy, a, b) {
  const ex = b.x - a.x, ey = b.y - a.y;
  const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) return null;
  const t = (a.x * ey - a.y * ex) / den;
  const u = (a.x * dy - a.y * dx) / den;
  if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) return t;
  return null;
}

function angOf(p) { return (Math.atan2(p.y, p.x) * 180) / Math.PI; }
function normDeg(d) { return ((d + 180) % 360 + 360) % 360 - 180; }
function inSweep(deg, lo, hi) {
  const d = normDeg(deg - lo), s = normDeg(hi - lo); const w = s < 0 ? s + 360 : s;
  const t = d < 0 ? d + 360 : d; return t > 0.05 && t < w - 0.05;
}

function vertsOf(inset = 0) { return sphereVerts(inset); }

// Outward point where the ray at `deg` (0 = right, -90 = up) hits the silhouette.
export function sphereAtAngle(deg, inset = 0) {
  const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
  const pts = vertsOf(inset);
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const t = raySeg(dx, dy, pts[i], pts[(i + 1) % pts.length]);
    if (t != null && t < best) best = t;
  }
  if (!Number.isFinite(best)) return { x: dx * (SPHERE_W - inset), y: dy * (SPHERE_H - inset) };
  return { x: dx * best, y: dy * best };
}

export const diamondAtAngle = (deg, inset = 0) => sphereAtAngle(deg, inset);

export function sphereNormal(deg, inset = 0) {
  const p = sphereAtAngle(deg, inset); const len = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / len, y: p.y / len, px: p.x, py: p.y };
}

export const diamondNormal = sphereNormal;

function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

export function distToPoly(x, y, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) best = Math.min(best, distToSeg(x, y, pts[i], pts[(i + 1) % pts.length]));
  return best;
}

// Even-odd fill. The necked silhouette is concave at the neck-to-body corners, so a half-plane test is not enough.
export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

export function pointInDiamond(x, y, pad = 0) {
  const pts = sphereProfile();
  if (pointInPoly(x, y, pts)) return true;
  return distToPoly(x, y, pts) <= pad + 0.51;
}

export function diskInSphere(x, y, r, pad = 0) {
  const pts = sphereProfile();
  if (!pointInPoly(x, y, pts) && distToPoly(x, y, pts) > 0.51) return false;
  return distToPoly(x, y, pts) >= r + pad - 0.51;
}

export function diskInDock(x, y, r, pad = 4) {
  if (x + r + pad > DOCK_RIGHT || y + r + pad > DOCK_BOTTOM || x - r - pad < -DOCK_LEFT) return false;
  return diskInSphere(x, y, r, pad);
}

function vertsBetween(lo, hi, inset) {
  const pts = vertsOf(inset);
  const tagged = pts.map((p) => ({ p, a: angOf(p) })).filter((v) => inSweep(v.a, lo, hi));
  tagged.sort((A, B) => normDeg(A.a - lo) - normDeg(B.a - lo));
  return tagged.map((v) => v.p);
}

// Straight-edged sector from an inner radius to the silhouette (outerInset into the rim).
export function diamondWedge(lo, hi, r0, outerInset = 4) {
  const outer = [sphereAtAngle(lo, outerInset), ...vertsBetween(lo, hi, outerInset), sphereAtAngle(hi, outerInset)];
  const inner = [];
  const a1 = (hi * Math.PI) / 180, a0 = (lo * Math.PI) / 180;
  inner.push({ x: Math.cos(a1) * r0, y: Math.sin(a1) * r0 });
  inner.push({ x: Math.cos(a0) * r0, y: Math.sin(a0) * r0 });
  return polylinePath(snapPoly([...outer, ...inner])) + 'Z';
}

const BEVEL = [MOTIF.cream, MOTIF.creamDeep, MOTIF.sage, MOTIF.stone, MOTIF.shadow, MOTIF.ink];

function facetShade(a, b) {
  const { nx, ny } = edgeInward(a, b);
  // Outward is the opposite of inward; light comes from the upper-left (cream leads).
  const outx = -nx, outy = -ny;
  const lit = outx * -0.72 + outy * -0.7;
  const t = Math.max(0, Math.min(1, (1 - lit) / 2));
  return BEVEL[Math.min(BEVEL.length - 1, Math.floor(t * BEVEL.length))] || MOTIF.stone;
}

export function facetFills(inset = PIXEL * 2) {
  const outer = snapPoly(sphereVerts(0));
  const inner = snapPoly(sphereVerts(inset));
  return outer.map((p, i) => {
    const q = outer[(i + 1) % outer.length], a = inner[i], b = inner[(i + 1) % inner.length];
    return { d: polylinePath([p, q, b, a]) + 'Z', fill: facetShade(p, q) };
  });
}

const hash01 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function consumeAmount(level) {
  const L = Number(level);
  if (!Number.isFinite(L) || L <= 0) return 0;
  return L >= 1 ? 1 : L;
}

export function distortRim(level, t = 0, seed = 1, inset = 0) {
  const L = consumeAmount(level);
  const src = snapPoly(sphereVerts(inset));
  const out = [], per = 5, tick = Math.floor((Number(t) || 0) * 8);
  for (let i = 0; i < src.length; i++) {
    const a = src[i], b = src[(i + 1) % src.length];
    const nx = b.y - a.y, ny = a.x - b.x, len = Math.hypot(nx, ny) || 1;
    const ux = nx / len, uy = ny / len;
    for (let s = 0; s < per; s++) {
      const u = s / per;
      const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u;
      const h = hash01(i * 17 + s * 9 + seed * 3 + tick);
      if (L > 0 && h < L) continue;
      const jig = (hash01(i * 3 + s * 13 + seed + tick * 0.01) - 0.5) * 2 * L * PIXEL * 3;
      out.push({ x: snap(px + ux * jig), y: snap(py + uy * jig) });
    }
  }
  return out;
}

export function rimIntactRatio(level, t = 0, seed = 1) {
  if (consumeAmount(level) <= 0) return 1;
  const full = distortRim(0, t, seed).length, left = distortRim(level, t, seed).length;
  return full ? left / full : 0;
}

export function distortPath(level, t = 0, seed = 1) {
  const pts = distortRim(level, t, seed);
  return pts.length < 2 ? '' : polylinePath(pts);
}

export function outlineAtDepth(level, rimDistortion = false) {
  const eat = rimDistortion ? consumeAmount(level) : 0;
  const inset = snap(eat * PIXEL * 5);
  return { body: spherePath(inset), emboss: embossPaths(), keep: 1 - eat };
}

export function embossPaths() {
  const src = snapPoly(sphereVerts(0));
  const hi = snapPoly(src.map((p) => ({ x: p.x - PIXEL, y: p.y - PIXEL })));
  const sh = snapPoly(src.map((p) => ({ x: p.x + PIXEL, y: p.y + PIXEL })));
  return {
    highlight: polylinePath(hi) + 'Z',
    shadow: polylinePath(sh) + 'Z',
    outer: spherePath(-PIXEL),
    ink: spherePath(0),
    inner: spherePath(PIXEL * 2),
  };
}
