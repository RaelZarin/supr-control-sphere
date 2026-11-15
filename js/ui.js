// Tiny DOM helpers shared by the controls and builder panels.
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') e.className = v;
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
export function slider(label, value, { min = 0, max = 1, step = 0.01, fmt = (v) => v, onInput }) {
  const out = h('output', {}, fmt(value));
  const inp = h('input', { type: 'range', min, max, step, value, onInput: (e) => { const v = Number(e.target.value); out.textContent = fmt(v); onInput(v); } });
  return h('label', { class: 'row' }, h('span', {}, label), inp, out);
}
export function select(label, value, options, onChange) {
  const s = h('select', { onChange: (e) => onChange(e.target.value) }, options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; const op = h('option', { value: v }, t); if (String(v) === String(value)) op.selected = true; return op; }));
  return h('label', { class: 'row' }, h('span', {}, label), s);
}
export function toggle(label, value, onChange) {
  return h('label', { class: 'row toggle' }, h('span', {}, label), h('input', { type: 'checkbox', checked: value, onChange: (e) => onChange(e.target.checked) }));
}
export function segmented(value, options, onChange) {
  return h('div', { class: 'seg', role: 'radiogroup' }, options.map(([v, t]) => h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': v === value ? 'true' : 'false', onClick: () => onChange(v) }, t)));
}
export function section(title, open, ...kids) {
  const d = h('details', { class: 'panelSec' }, h('summary', {}, title), ...kids); if (open) d.open = true; return d;
}
