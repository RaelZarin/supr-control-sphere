// Player momentum readout data. Cap is authored here (Rashad, Nov 18 2026).
export const MOMENTUM_CAP = 3;
export const MOMENTUM_STEP = 0.25;

let amount = 1.25;

export function momentumAmount() { return amount; }

export function formatMomentum(value = amount, cap = MOMENTUM_CAP) {
  const snapped = Math.round(Math.max(0, value) / MOMENTUM_STEP) * MOMENTUM_STEP;
  const n = Number(snapped.toFixed(2));
  const text = Number.isInteger(n) ? String(n) : String(n);
  return `${text}/${cap}`;
}

// How full each of the three tier pips is, in 0.25 steps (0, 0.25, 0.5, 0.75, 1).
export function momentumPips(value = amount, cap = MOMENTUM_CAP) {
  const out = [];
  for (let i = 0; i < cap; i++) {
    const fill = Math.max(0, Math.min(1, value - i));
    out.push(Math.round(fill / MOMENTUM_STEP) * MOMENTUM_STEP);
  }
  return out;
}

export function setMomentum(value, pop = true) {
  const next = Math.max(0, Math.min(MOMENTUM_CAP, Math.round(value / MOMENTUM_STEP) * MOMENTUM_STEP));
  const changed = Math.abs(next - amount) > 0.001;
  amount = next;
  paintReadout(pop && changed);
  return amount;
}

export function bumpMomentum(delta = MOMENTUM_STEP) {
  return setMomentum(amount + delta, true);
}

export function paintReadout(pop = false) {
  if (typeof document === 'undefined') return;
  const el = document.querySelector('.momReadout');
  if (!el) return;
  const val = el.querySelector('.momVal');
  if (val) val.textContent = formatMomentum();
  el.setAttribute('aria-label', `Momentum ${formatMomentum()}`);
  const pips = el.querySelectorAll('.momPips i');
  momentumPips().forEach((fill, i) => {
    if (!pips[i]) return;
    pips[i].classList.toggle('on', fill >= 1);
    pips[i].classList.toggle('part', fill > 0 && fill < 1);
    pips[i].style.setProperty('--fill', `${Math.round(fill * 100)}%`);
  });
  if (pop) {
    el.classList.remove('momPop');
    void el.offsetWidth;
    el.classList.add('momPop');
  }
}
