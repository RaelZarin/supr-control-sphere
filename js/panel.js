// Corner-panel outline: a flat-topped house of straight segments, plus convex inset and hit tests.
export const PANEL_NORM = [
  [0, 1],
  [0, 0.45],
  [0.23, 0],
  [0.76, 0],
  [1, 0.49],
  [1, 1],
];
export const PANEL_PAD_PX = 6;
export const PANEL_STROKE = 5;

export function panelVertsFromBox(box) {
  const { l, t, r, b } = box;
  return PANEL_NORM.map(([u, v]) => ({ x: l + u * (r - l), y: t + v * (b - t) }));
}

export function panelPath(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + 'Z';
}

export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
  }
  return inside;
}

export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function signedClearance(x, y, pts) {
  if (!pointInPoly(x, y, pts)) return -1;
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    best = Math.min(best, distToSeg(x, y, pts[j].x, pts[j].y, pts[i].x, pts[i].y));
  }
  return best;
}

export function diskInPanel(x, y, r, pad = 0, pts = dockPanelVerts()) {
  return signedClearance(x, y, pts) + 1e-6 >= r + pad;
}

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function intersect(a1, a2, b1, b2) {
  const dax = a2.x - a1.x, day = a2.y - a1.y, dbx = b2.x - b1.x, dby = b2.y - b1.y;
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < 1e-9) return { x: (a2.x + b1.x) / 2, y: (a2.y + b1.y) / 2 };
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / den;
  return { x: a1.x + t * dax, y: a1.y + t * day };
}

export function insetConvex(pts, d) {
  if (!d) return pts.map((p) => ({ ...p }));
  const c = centroid(pts);
  const off = [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    let nx = dy / len, ny = -dx / len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if ((c.x - mx) * nx + (c.y - my) * ny < 0) { nx = -nx; ny = -ny; }
    off.push({ a: { x: a.x + nx * d, y: a.y + ny * d }, b: { x: b.x + nx * d, y: b.y + ny * d } });
  }
  return off.map((e, i) => {
    const p = off[(i + 1) % off.length];
    return intersect(e.a, e.b, p.a, p.b);
  });
}

let liveVerts = null;
let livePad = 8;
export function setDockPanel(verts, padView) {
  liveVerts = verts ? verts.map((p) => ({ x: p.x, y: p.y })) : null;
  if (padView != null) livePad = padView;
}
export function dockPanelVerts() { return liveVerts; }
export function dockPanelPad() { return livePad; }
export function panelAabb(pts) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
}
