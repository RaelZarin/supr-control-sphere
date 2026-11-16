// Data: stances, default settings, and the momentum catalog (port of momentum_catalog.gd rules).
import { AIR_MIGRATION, ensureAirStates, airStateOf, remainingAirTicks, filterAirIds } from './air.js';
import { BLOCK_MIGRATION, ensureBlockAndSidestepFollows, aliasRoot, withInherited } from './follow.js';
export { AIR_MIGRATION, JUMP_TICKS, remainingAirTicks, airStateOf } from './air.js';
export { BLOCK_MIGRATION } from './follow.js';
export const STANCES = {
  standing: { name: 'Whipping Reed', short: 'Standing', color: '#b9cde3', deep: '#3e6c9c', ink: '#232147', center: 'Idle', moving: 'Moving' },
  crouch: { name: 'Crouching Tiger', short: 'Crouched', color: '#6e6f7d', deep: '#2a2540', ink: '#ede1a9', center: 'Crouching', moving: 'Crouch moving' },
  midair: { name: 'Leaping Dragon', short: 'In air', color: '#f4eecf', deep: '#e8b84a', ink: '#232147', center: 'Jumping', moving: 'Jumping' },
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

// Stance center: Tiger idles on Crouch, Dragon on Jumping, Reed on Idle.
export function stanceRoot(stance) {
  if (stance === 'crouch') return 'crouch';
  if (stance === 'midair') return 'jumping';
  return IDLE;
}

export function isMoving(move) { return !!(move && (move.moving || move.locomotion || move.state)); }
export function isStateMove(move) { return !!(move && move.state); }

export function centerLabel(cat, id, stance) {
  const st = STANCES[stance] || STANCES.standing;
  const mv = cat.move(id);
  if (stance === 'midair') return airStateOf(mv, id) === 'flipping' ? 'Flipping' : 'Jumping';
  if (!id || id === IDLE || id === stanceRoot(stance)) return st.center;
  if (isMoving(mv)) return mv.center || st.moving;
  return mv.label || id;
}

export function optionLabel(cat, id, stance) {
  const st = STANCES[stance] || STANCES.standing;
  if (!id || id === IDLE || id === stanceRoot(stance)) return st.center;
  return cat.move(id).label || id;
}

export function raelPoseFor(cat, id, stance) {
  const mv = cat.move(id);
  const moving = isMoving(mv);
  if (stance === 'midair') return airStateOf(mv, id) === 'flipping' ? 'flipping' : 'jumping';
  if (stance === 'crouch') return moving ? 'crouch_moving' : (id === IDLE || id === stanceRoot(stance) || id === 'crouch' ? 'crouch' : 'idle');
  if (moving && (mv.center === 'Running' || id === 'running')) return 'running';
  if (moving) return 'moving';
  return 'idle';
}

export function wheelNext(cat, stance, prev) {
  return cat.legalNext(stance, prev).filter((id) => cat.move(id).wheel !== false);
}

export function centerChoices(cat, stance) {
  const st = STANCES[stance] || STANCES.standing;
  const root = stanceRoot(stance);
  const base = { id: root, stance, label: st.center, kind: 'root' };
  const ids = cat.legalNext(stance, root === IDLE ? '' : root);
  const states = ids.filter((id) => {
    const mv = cat.move(id);
    return isStateMove(mv) && (mv.result_stance || stance) === stance;
  }).map((id) => {
    const mv = cat.move(id);
    return { id, stance, label: mv.center || st.moving, kind: 'state' };
  });
  return [base, ...states];
}

function treeKids(cat, id, stance) {
  const kids = [];
  const add = (x) => { if (x && !kids.includes(x)) kids.push(x); };
  for (const e of cat.tree.edges) if (e.from === id) add(e.to);
  if (stance) for (const n of cat.legalNext(stance, id)) add(n);
  return kids;
}

function shortest(cat, start, target, stance) {
  if (start === target) return 0;
  const seen = new Set([start]);
  const q = [[start, 0]];
  while (q.length) {
    const [id, d] = q.shift();
    for (const n of treeKids(cat, id, stance)) {
      if (n === target) return d + 1;
      if (!seen.has(n)) { seen.add(n); q.push([n, d + 1]); }
    }
  }
  return null;
}

// Branch steps from the current stance's idle root to this node (shortest tree path), not combo length.
export function branchDepth(cat, nodeId, stance) {
  const root = stanceRoot(stance);
  if (!nodeId || nodeId === root || nodeId === IDLE) return 0;
  const d = shortest(cat, root, nodeId, stance);
  if (d != null) return d;
  if (root !== IDLE) {
    const d2 = shortest(cat, IDLE, nodeId, null);
    if (d2 != null) return d2;
  }
  return 0;
}


export const SPHERE_MIGRATION = 'reed-sidesteps-v1';
export const CENTER_MIGRATION = 'center-states-v1';

const SIDE_STEPS = [
  { id: 'sidestep_left', label: 'Sidestep left', dir: 'L', deg: 180, next: [{ id: 'lunge', angle: 166 }, { id: 'parry', angle: 194 }] },
  { id: 'sidestep_right', label: 'Sidestep right', dir: 'R', deg: 0, next: [{ id: 'lunge', angle: -14 }, { id: 'parry', angle: 14 }] },
];

function isIdleRunning(e) { return e.from === 'idle' && e.to === 'running' && (!e.stance || e.stance === 'standing'); }
function isIdleSidestep(e) { return e.from === 'idle' && e.to === 'sidestep' && (!e.stance || e.stance === 'standing'); }

// Sidestep left/right on the Reed root; Running is catalog-only and is not an idle option on the sphere.
function ensureSideSteps(tree) {
  tree.moves ||= []; tree.edges ||= []; tree.placement ||= {}; tree.layouts ||= {};
  const src = tree.moves.find((m) => m.id === 'sidestep') || { height: 'mid', tier: 0, windup: 0.25, recovery: 0.25, stances: ['standing'] };
  for (const side of SIDE_STEPS) {
    if (!tree.moves.some((m) => m.id === side.id)) {
      tree.moves.push({
        id: side.id, label: side.label, height: src.height || 'mid', tier: src.tier ?? 0,
        windup: src.windup ?? 0.25, recovery: src.recovery ?? 0.25,
        stances: src.stances ? [...src.stances] : ['standing'], dir: side.dir,
      });
    }
    if (!tree.edges.some((e) => e.from === 'idle' && e.to === side.id && e.stance === 'standing')) {
      tree.edges.push({ from: 'idle', to: side.id, stance: 'standing' });
    }
    for (const n of ['lunge', 'parry']) {
      if (tree.moves.some((m) => m.id === n) && !tree.edges.some((e) => e.from === side.id && e.to === n)) {
        tree.edges.push({ from: side.id, to: n });
      }
    }
    const key = `idle@standing>${side.id}`;
    if (tree.placement[key] == null) tree.placement[key] = side.deg;
  }
  const standing = tree.layouts.standing;
  if (standing && Array.isArray(standing.arms)) {
    standing.arms = standing.arms.filter((a) => a.id !== 'sidestep' && a.id !== 'running');
    for (const side of SIDE_STEPS) {
      if (!standing.arms.some((a) => a.id === side.id)) standing.arms.push({ id: side.id, angle: side.deg, next: side.next });
    }
  }
  return tree;
}


const LOCO_FLAGS = {
  running: { moving: true, state: true, center: 'Running', wheel: false },
  sidestep: { moving: true },
  sidestep_left: { moving: true },
  sidestep_right: { moving: true },
  roll: { moving: true },
  hop: { moving: true },
};

function ensureLocomotion(tree) {
  tree.moves ||= []; tree.edges ||= [];
  for (const [id, patch] of Object.entries(LOCO_FLAGS)) {
    const m = tree.moves.find((x) => x.id === id);
    if (m && !m.custom) Object.assign(m, patch);
  }
  const stockRun = tree.moves.find((m) => m.id === 'running' && !m.custom);
  if (stockRun && !tree.edges.some(isIdleRunning)) tree.edges.push({ from: 'idle', to: 'running', stance: 'standing' });
  if (tree.moves.some((m) => m.id === 'charge') && !tree.edges.some((e) => e.from === 'running' && e.to === 'charge')) {
    tree.edges.push({ from: 'running', to: 'charge' });
  }
  return tree;
}

export function applySphereUi(tree) {
  tree.edges = (tree.edges || []).filter((e) => !isIdleSidestep(e));
  ensureSideSteps(tree);
  ensureLocomotion(tree);
  const seen = new Set(tree.migrations || []);
  ensureAirStates(tree, { rewire: !seen.has(AIR_MIGRATION) });
  ensureBlockAndSidestepFollows(tree, { rewire: !seen.has(BLOCK_MIGRATION) });
  tree.migrations = [...new Set([...(tree.migrations || []), SPHERE_MIGRATION, CENTER_MIGRATION, AIR_MIGRATION, BLOCK_MIGRATION])];
  return tree;
}

// Fold new default sphere options into a saved tree without dropping custom moves or later user edits.
export function mergeDefaultTree(saved, _defaults) {
  const tree = structuredClone(saved);
  tree.moves ||= []; tree.edges ||= []; tree.placement ||= {}; tree.layouts ||= {};
  const seen = new Set(tree.migrations || []);
  if (!seen.has(SPHERE_MIGRATION)) {
    const sidestep = tree.moves.find((m) => m.id === 'sidestep');
    if (!sidestep?.custom) tree.edges = tree.edges.filter((e) => !isIdleSidestep(e));
    seen.add(SPHERE_MIGRATION);
  }
  if (!seen.has(CENTER_MIGRATION)) seen.add(CENTER_MIGRATION);
  const rewireAir = !seen.has(AIR_MIGRATION);
  if (rewireAir) seen.add(AIR_MIGRATION);
  const rewireBlock = !seen.has(BLOCK_MIGRATION);
  if (rewireBlock) seen.add(BLOCK_MIGRATION);
  tree.migrations = [...seen];
  return ensureBlockAndSidestepFollows(ensureAirStates(ensureLocomotion(ensureSideSteps(tree)), { rewire: rewireAir }), { rewire: rewireBlock });
}

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
    f = withInherited(outgoing, move, from, stance, f);
    if (!f.length && from !== IDLE && !move(from).custom) {
      const home = stance === 'midair' ? airStateOf(move(from), from) : IDLE;
      f = outgoing(home, stance);
    }
    const self = { move };
    return filterAirIds(f, self, stance, from);
  };
  const sourceOf = (stance, prev) => {
    const alias = prev ? aliasRoot(move, prev) : '';
    if (alias && alias !== prev && !move(prev).custom) return alias;
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
