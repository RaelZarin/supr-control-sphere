// Faceted pixel-diamond geometry. Motif from SUPR's pixel-art blue diamond
// (silhouette, step pattern, proportions, limited colors) — not the icon file.
import { R_SPHERE } from './layout.js';
import { polylinePath, isOctilinear } from './route.js';

export const PIXEL = 6;
export const VIEW = 348;
export const CHAMFER = 24; // width of the flat facets at N/E/S/W
// Motif swatches (icon look, not the file): void, sage, cream, stone, blue, deep.
export const MOTIF = { void: '#2c2449', sage: '#b4bda5', cream: '#e4d9aa', stone: '#93938f', blue: '#5294cd', deep: '#5963a3', ink: '#15132b', shadow: '#0c0a1d' };

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
const BEVEL = [MOTIF.cream, MOTIF.sage, MOTIF.blue, MOTIF.deep, MOTIF.shadow, MOTIF.deep, MOTIF.stone, MOTIF.sage];

export function facetFills(r = R_SPHERE, flat = CHAMFER, inset = PIXEL * 2) {
  const outer = snapPoly(diamondOctagon(r, flat));
  const inner = snapPoly(diamondOctagon(Math.max(PIXEL * 4, r - inset), Math.max(PIXEL, flat - inset / 2)));
  return outer.map((p, i) => {
    const q = outer[(i + 1) % 8], a = inner[i], b = inner[(i + 1) % 8];
    return { d: polylinePath([p, q, b, a]) + 'Z', fill: BEVEL[i] };
  });
}
