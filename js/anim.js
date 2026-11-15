// Motion: easing curves, quadratic-bezier travel paths and a single rAF loop shared by tweens and per-frame hooks.
export function curveFn(name, overshoot = 1.6) {
  switch (name) {
    case 'linear': return (t) => t;
    case 'easeOut': return (t) => 1 - Math.pow(1 - t, 3);
    case 'snap': return (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    case 'spring': return (t) => (t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(t * (4 + overshoot * 3) * Math.PI / 2));
    default: { const s = overshoot; return (t) => { const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; }; }
  }
}

// Point on a quadratic bezier from a to b, bowed sideways by `bend` (fraction of the length).
export function bezierCtrl(a, b, bend) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const dx = b.x - a.x, dy = b.y - a.y;
  return { x: mx - dy * bend * 0.5, y: my + dx * bend * 0.5 };
}
export function bezierAt(a, c, b, t) {
  const u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}
export function bezierPath(a, b, bend) { const c = bezierCtrl(a, b, bend); return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`; }

const tweens = new Set(); const hooks = new Set(); let running = false;
export const clock = { now: 0 };
function frame(ts) {
  clock.now = ts;
  for (const tw of [...tweens]) {
    const p = Math.min(1, (ts - tw.start) / tw.dur);
    if (p >= 0) tw.update(p);
    if (p >= 1) { tweens.delete(tw); tw.done && tw.done(); }
  }
  for (const h of hooks) h(ts / 1000);
  requestAnimationFrame(frame);
}
export function startLoop() { if (!running) { running = true; requestAnimationFrame(frame); } }
export function tween(dur, update, { delay = 0, done } = {}) {
  if (dur <= 0) { update(1); done && done(); return null; }
  const tw = { start: performance.now() + delay, dur, update, done }; tweens.add(tw); return tw;
}
export function cancelAll() { for (const tw of tweens) { tw.update(1); } tweens.clear(); }
export function onFrame(fn) { hooks.add(fn); return () => hooks.delete(fn); }
