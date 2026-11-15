// Octilinear routing: straight horizontal, vertical, and 45° segments only. No bezier smoothing.
export const OCT_DEGS = [0, 45, 90, 135, 180, 225, 270, 315];

const eps = (a, b, t = 0.51) => Math.abs(a - b) < t;
const near = (p, q, t = 0.51) => eps(p.x, q.x, t) && eps(p.y, q.y, t);
const copy = (p) => ({ x: p.x, y: p.y });

export function segmentAngle(dx, dy) {
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 0;
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
}

export function isOctilinear(dx, dy, tol = 0.51) {
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < tol || ady < tol) return true;
  return Math.abs(adx - ady) < tol;
}

export function isOctilinearDeg(deg, tol = 0.51) {
  const d = ((deg % 360) + 360) % 360;
  return OCT_DEGS.some((a) => Math.min(Math.abs(d - a), 360 - Math.abs(d - a)) < tol);
}

// Polyline a→b with at most one elbow. `bend` (saved link/settings value) picks the family:
//   ≥ 0.15  diagonal first, then the leftover H or V  (default 0.35, tree-like)
//   > -0.15 leftover ortho first, then a 45° diagonal
//   < -0.15 pure H/V elbow; more negative prefers horizontal-first
export function octilinearRoute(a, b, bend = 0) {
  const ax = a.x, ay = a.y, bx = b.x, by = b.y;
  const dx = bx - ax, dy = by - ay;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 0.51 && ady < 0.51) return [copy(a), copy(b)];
  if (isOctilinear(dx, dy)) return [copy(a), copy(b)];
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const min = Math.min(adx, ady), rem = Math.abs(adx - ady);
  const midDiag = { x: ax + sx * min, y: ay + sy * min };
  const midOrtho = adx > ady ? { x: ax + sx * rem, y: ay } : { x: ax, y: ay + sy * rem };
  const midHV = { x: bx, y: ay };
  const midVH = { x: ax, y: by };
  let mid;
  if (bend >= 0.15) mid = midDiag;
  else if (bend > -0.15) mid = midOrtho;
  else mid = bend < -0.5 ? midHV : midVH;
  if (near(mid, a) || near(mid, b)) mid = near(mid, midDiag) ? midOrtho : midDiag;
  return [copy(a), mid, copy(b)];
}

export function polylineLength(pts) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
}

export function polylineAt(pts, t) {
  if (!pts.length) return { x: 0, y: 0 };
  if (pts.length === 1 || t <= 0) return copy(pts[0]);
  if (t >= 1) return copy(pts[pts.length - 1]);
  const total = polylineLength(pts), goal = total * t;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + len >= goal || i === pts.length - 1) {
      const u = len < 1e-9 ? 1 : (goal - acc) / len;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u };
    }
    acc += len;
  }
  return copy(pts[pts.length - 1]);
}

export function polylinePath(pts) {
  if (!pts.length) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
  return d;
}

export function partialPolyline(pts, t) {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0 || pts.length < 2) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  if (clamped >= 1) return polylinePath(pts);
  const end = polylineAt(pts, clamped);
  const total = polylineLength(pts), goal = total * clamped;
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + len >= goal) { out.push(end); break; }
    out.push(pts[i]); acc += len;
  }
  return polylinePath(out);
}

export function pathCommands(d) { return (String(d).match(/[A-Za-z]/g) || []); }

export function routeIsOctilinear(pts, tol = 0.51) {
  if (!Array.isArray(pts) || pts.length < 2) return false;
  for (let i = 1; i < pts.length; i++) {
    if (!isOctilinear(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, tol)) return false;
  }
  return true;
}
