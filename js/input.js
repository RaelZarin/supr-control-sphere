// Input: tap a node, swipe/flick on the sphere (touch or mouse drag), arrow keys, Q/E rotate, Backspace or Ctrl/Cmd+Z undo, Esc reset.
export function bindInput(svg, r, act) {
  let down = null;
  const toView = (e) => { const b = svg.getBoundingClientRect(); return { x: e.clientX - b.left - b.width / 2, y: e.clientY - b.top - b.height / 2 }; };
  svg.addEventListener('pointerdown', (e) => {
    const node = e.target.closest('[data-id]');
    down = { p: toView(e), t: performance.now(), id: node?.dataset.id || null, node };
    if (node) node.querySelector('.body')?.classList.add('press');
    svg.setPointerCapture(e.pointerId);
  });
  const clear = () => { svg.querySelectorAll('.press').forEach((n) => n.classList.remove('press')); };
  svg.addEventListener('pointercancel', () => { clear(); down = null; });
  svg.addEventListener('pointerup', (e) => {
    clear(); if (!down) return;
    const p = toView(e); const dx = p.x - down.p.x, dy = p.y - down.p.y; const dist = Math.hypot(dx, dy);
    const id = down.id; down = null;
    if (dist < 14) {
      if (id === '__center') act.center(); else if (id) act.select(id);
      return;
    }
    if (dist > 26) { const o = r.optionAtAngle((Math.atan2(dy, dx) * 180) / Math.PI, 55); if (o) act.select(o.id); else act.miss(); }
  });
  svg.addEventListener('pointerover', (e) => { const n = e.target.closest('[data-id]'); if (n && n.dataset.id !== '__center') act.hover(n.dataset.id); });
  svg.addEventListener('pointerout', (e) => { const n = e.target.closest('[data-id]'); if (n && !n.contains(e.relatedTarget)) act.hover(null); });

  const DIR = { ArrowUp: -90, ArrowRight: 0, ArrowDown: 90, ArrowLeft: 180 };
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (DIR[e.key] != null) { e.preventDefault(); const o = r.optionAtAngle(DIR[e.key], 68); if (o) act.select(o.id); else act.miss(); }
    else if (e.key === 'q' || e.key === 'Q') act.rotate(-45);
    else if (e.key === 'e' || e.key === 'E') act.rotate(45);
    else if (e.key === 'Backspace' || ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey)) { e.preventDefault(); act.undo(); }
    else if (e.key === 'Escape') act.reset();
    else if (/^[1-9]$/.test(e.key)) { const o = r.model?.options[Number(e.key) - 1]; if (o) act.select(o.id); }
  });
}
