// Stance bar: one button per stance under the sphere. Lit = current, enabled = a legal option leads there, greyed = not reachable now.
import { STANCES, centerChoices } from './data.js';
import { h } from './ui.js';

// Pick the plainest legal option that ends in `stance`: pure transitions (no damage) first, then the quickest windup.
export function stanceRoutes(model) {
  const routes = {};
  for (const o of model.options) {
    const k = o.resultStance; if (k === model.cur.stance) continue;
    const mv = o.move || {}; const score = (mv.damage ? 10 : 0) + (mv.stub ? 5 : 0) + (mv.windup ?? 1);
    if (!routes[k] || score < routes[k].score) routes[k] = { id: o.id, label: mv.label || o.id, score };
  }
  return routes;
}

export function renderStanceBar(el, model, onPick) {
  const routes = stanceRoutes(model); const cur = model.cur.stance;
  el.replaceChildren(...Object.entries(STANCES).map(([k, st]) => {
    const r = routes[k]; const on = k === cur; const ok = on || !!r;
    const b = h('button', {
      type: 'button', class: `stanceBtn ${k}${on ? ' on' : ''}${r ? ' ready' : ''}`, disabled: !ok,
      style: `--st:${st.color};--deep:${st.deep}`,
      title: on ? `${st.name}: current stance` : r ? `Switch to ${st.name} via ${r.label}` : `${st.name}: no move from here leads there`,
      onClick: () => { if (on || !r) return; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); onPick(r.id); },
    }, h('span', { class: 'glyph' }), h('b', {}, st.name), h('small', {}, on ? 'Current' : r ? `via ${r.label}` : 'Not available'));
    return b;
  }));
}

export function renderCenterBar(el, model, onPick) {
  const stance = model.cur.stance;
  const choices = centerChoices(model.cat, stance);
  const curId = model.cur.id;
  el.replaceChildren(...choices.map((c) => {
    const on = stance === 'midair'
      ? (c.kind === 'root' ? model.airState !== 'flipping' : model.airState === 'flipping' || curId === c.id)
      : c.id === curId;
    const b = h('button', {
      type: 'button', class: `centerBtn${on ? ' on' : ''}`, 'data-center': c.id,
      title: on ? `${c.label}: current center` : `Enter ${c.label}`,
      onClick: () => { if (on) return; onPick(c); },
    }, c.label);
    return b;
  }));
  el.hidden = choices.length < 2 && choices[0]?.kind === 'root';
}
