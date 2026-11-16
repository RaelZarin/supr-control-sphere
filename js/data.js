// Data: stances, default settings, and the momentum catalog (port of momentum_catalog.gd rules).
export const STANCES = {
  standing: { name: 'Whipping Reed', short: 'Standing', color: '#b9cde3', deep: '#3e6c9c', ink: '#232147' },
  crouch: { name: 'Crouching Tiger', short: 'Crouched', color: '#6e6f7d', deep: '#2a2540', ink: '#ede1a9' },
  midair: { name: 'Leaping Dragon', short: 'In air', color: '#f4eecf', deep: '#e8b84a', ink: '#232147' },
};
export const PALETTE = { panel: '#232147', stage: '#1a1830', text: '#ede1a9', primary: '#ede1a9', danger: '#ea5439', ap: '#e88a4a', heal: '#b4bda5', neutral: '#545a78' };
export const HEIGHTS = ['high', 'mid', 'low'];
export const CURVES = ['overshoot', 'spring', 'easeOut', 'snap', 'linear'];
export const DIRS = [ // Godot degrees: 0 = right, -90 = up (front)
  { id: 'auto', label: 'Auto (height sector)', deg: null }, { id: 'F', label: 'Forward', deg: -90 }, { id: 'FR', label: 'Forward-right', deg: -45 },
  { id: 'R', label: 'Right', deg: 0 }, { id: 'BR', label: 'Back-right', deg: 45 }, { id: 'B', label: 'Backward', deg: 90 },
  { id: 'BL', label: 'Back-left', deg: 135 }, { id: 'L', label: 'Left', deg: 180 }, { id: 'FL', label: 'Forward-left', deg: -135 },
];

export const DEFAULT_SETTINGS = {
  style: 'tree', placement: 'sectors', ringLabels: 'height', facing: 0, mirror: false,
  fx: { standing: 1, crouch: 1, midair: 1 }, fxStart: 1, fxFull: 5, fxMax: 1,
  glow: 0.7, speed: 1, curve: 'overshoot', overshoot: 1.6, bend: 0.35, travelMs: 320,
  line: 2, labels: true, stubs: true, breathe: 0.05, reducedMotion: false, rimDistortion: false,
};

export function mergeSettings(s) {
  const d = structuredClone(DEFAULT_SETTINGS);
  if (!s) return d;
  return { ...d, ...s, fx: { ...d.fx, ...(s.fx || {}) } };
}

export const IDLE = 'idle';

export function makeCatalog(tree) {
  const moves = new Map(tree.moves.map((m) => [m.id, m]));
  const move = (id) => moves.get(id) || { id, label: id, height: 'mid', stances: [] };
  const outgoing = (from, stance) => {
    const out = [];
    for (const e of tree.edges) {
      if (e.from !== from) continue;
      if (e.stance && e.stance !== stance) continue;
      if (!out.includes(e.to)) out.push(e.to);
    }
    return out;
  };
  // legal_next: outgoing edges from prev. Catalog enders still fall back to that stance's idle arms;
  // childless custom moves stay empty so a new branch is built by hand (optional link-back is an explicit edge).
  const legalNext = (stance, prev) => {
    const from = prev || IDLE;
    let f = outgoing(from, stance);
    if (!f.length && from !== IDLE && !move(from).custom) f = outgoing(IDLE, stance);
    return f;
  };
  const sourceOf = (stance, prev) => {
    if (prev && prev !== IDLE && (outgoing(prev, stance).length || move(prev).custom)) return prev;
    return IDLE;
  };
  const resultStance = (id, current) => {
    return move(id).result_stance || current; // Idle's data says standing: in air it means land

  };
  const layoutFor = (stance, prev) => tree.layouts?.[prev && tree.layouts[`after_${prev}`] ? `after_${prev}` : stance] || null;
  const linkKey = (from, to, stance) => (!from || from === IDLE ? `idle@${stance || 'standing'}>${to}` : `${from}>${to}`);
  return { moves, move, outgoing, sourceOf, legalNext, resultStance, layoutFor, linkKey, tree };
}

// Walk a path of move ids from Idle (standing) and return each step's context.
export function walk(cat, path) {
  const steps = [{ id: IDLE, stance: 'standing', prev: '' }];
  for (const id of path) {
    const last = steps[steps.length - 1];
    const stance = cat.resultStance(id, last.stance);
    steps.push({ id, stance, prev: id === IDLE ? '' : id, from: last });
  }
  return steps;
}
