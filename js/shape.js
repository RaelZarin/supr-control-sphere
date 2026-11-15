// Faceted pixel-diamond geometry. Motif from SUPR's pixel-art blue diamond
// (silhouette, step pattern, proportions, limited colors) — not the icon file.
import { R_SPHERE } from './layout.js';
import { polylinePath, isOctilinear } from './route.js';

export const PIXEL = 6;
export const VIEW = 348;
export const CHAMFER = 24; // width of the flat facets at N/E/S/W
// Motif swatches (icon look, not the file): void, sage, cream, stone, blue, deep.
export const MOTIF = { void: '#232147', sage: '#b4bda5', cream: '#ede1a9', creamDeep: '#e4d9aa', stone: '#93938f', blue: '#5294cd', deep: '#5963a3', ink: '#15132b', shadow: '#0c0a1d' };

export const snap = (v, p = PIXEL) => Math.round(v / p) * p;

// 8 vertices of a chamfered 45° diamond (square rotated 45°), clockwise from the top flat's left.
// `r` is the inscribed radius (distance to the long 45° sides), so a circle of radius r fits inside.
export function diamondOctagon(r = R_SPHERE, flat = CHAMFER) {
  const rv = r * Math.SQRT2, h = flat / 2;
  return [
    { x: -h, y: -rv + h }, { x: h, y: -rv + h },
    { x: rv - h, y: -h }, { x: rv - h, y: h },
    { x: h, y: rv - h }, { x: -h, y: rv - h },
    { x: -rv + h, y: h }, { x: -rv + h, y: -h },
  ];
}

export function snapPoly(pts, p = PIXEL) { return pts.map((q) => ({ x: snap(q.x, p), y: snap(q.y, p) })); }

export function diamondPath(r = R_SPHERE, flat = CHAMFER, p = PIXEL) {
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
  const t = (a.x * ey - a.y * ex) / den; // origin is (0,0)
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

// Outward point where the ray at `deg` (0 = right, -90 = up) hits the diamond.
export function diamondAtAngle(deg, r = R_SPHERE, flat = CHAMFER) {
  const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
  const pts = diamondOctagon(r, flat);
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const t = raySeg(dx, dy, pts[i], pts[(i + 1) % pts.length]);
    if (t != null && t < best) best = t;
  }
  if (!Number.isFinite(best)) return { x: dx * r, y: dy * r };
  return { x: dx * best, y: dy * best };
}

export function diamondNormal(deg, r = R_SPHERE, flat = CHAMFER) {
  const p = diamondAtAngle(deg, r, flat); const len = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / len, y: p.y / len, px: p.x, py: p.y };
}

export function pointInDiamond(x, y, r = R_SPHERE, flat = CHAMFER, pad = 0) {
  const pts = diamondOctagon(r + pad, flat);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) < -0.51) return false;
  }
  return true;
}

function vertsBetween(lo, hi, r, flat) {
  const pts = diamondOctagon(r, flat);
  const tagged = pts.map((p) => ({ p, a: angOf(p) })).filter((v) => inSweep(v.a, lo, hi));
  tagged.sort((A, B) => normDeg(A.a - lo) - normDeg(B.a - lo));
  return tagged.map((v) => v.p);
}

// Straight-edged sector from inner diamond r0 to outer r1, no arcs.
export function diamondWedge(lo, hi, r0, r1, flat = CHAMFER) {
  const outer = [diamondAtAngle(lo, r1, flat), ...vertsBetween(lo, hi, r1, flat), diamondAtAngle(hi, r1, flat)];
  const inner = [diamondAtAngle(hi, r0, flat), ...vertsBetween(hi, lo, r0, flat), diamondAtAngle(lo, r0, flat)];
  return polylinePath(snapPoly([...outer, ...inner])) + 'Z';
}

// Bevel colors around the eight flats, starting at the north facet: light, mid, shadow.
const BEVEL = [MOTIF.cream, MOTIF.creamDeep, MOTIF.sage, MOTIF.stone, MOTIF.shadow, MOTIF.ink, MOTIF.stone, MOTIF.sage];

export function facetFills(r = R_SPHERE, flat = CHAMFER, inset = PIXEL * 2) {
  const outer = snapPoly(diamondOctagon(r, flat));
  const inner = snapPoly(diamondOctagon(Math.max(PIXEL * 4, r - inset), Math.max(PIXEL, flat - inset / 2)));
  return outer.map((p, i) => {
    const q = outer[(i + 1) % 8], a = inner[i], b = inner[(i + 1) % 8];
    return { d: polylinePath([p, q, b, a]) + 'Z', fill: BEVEL[i] };
  });
}

const hash01 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// 0 = intact outline, 1 = fully consumed. Used by FX and tests.
export function consumeAmount(level) {
  const L = Number(level);
  if (!Number.isFinite(L) || L <= 0) return 0;
  return L >= 1 ? 1 : L;
}

// Subdivide the octagon and chew holes + crunchy outward jitter as level grows.
export function distortRim(level, t = 0, seed = 1, r = R_SPHERE, flat = CHAMFER) {
  const L = consumeAmount(level);
  const src = snapPoly(diamondOctagon(r, flat));
  const out = [];
  const per = 5, tick = Math.floor((Number(t) || 0) * 8);
  for (let i = 0; i < 8; i++) {
    const a = src[i], b = src[(i + 1) % 8];
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

export function distortPath(level, t = 0, seed = 1, r = R_SPHERE, flat = CHAMFER) {
  const pts = distortRim(level, t, seed, r, flat);
  return pts.length < 2 ? '' : polylinePath(pts);
}

// Pixel emboss: NW cream highlight, SE shadow, plus a cream outer stroke.
export function embossPaths(r = R_SPHERE, flat = CHAMFER) {
  const src = snapPoly(diamondOctagon(r, flat));
  const hi = snapPoly(src.map((p) => ({ x: p.x - PIXEL, y: p.y - PIXEL })));
  const sh = snapPoly(src.map((p) => ({ x: p.x + PIXEL, y: p.y + PIXEL })));
  return { highlight: polylinePath(hi) + 'Z', shadow: polylinePath(sh) + 'Z', outer: diamondPath(r + PIXEL, flat), ink: diamondPath(r, flat) };
}
