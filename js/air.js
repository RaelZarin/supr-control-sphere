// Air states for Leaping Dragon: Jumping (tick window + aerials) and Flipping (down attacks).
export const AIR_MIGRATION = 'air-states-v1';
export const JUMP_TICKS = 8;
export const AERIAL_TICKS = 2;

const STOCK_TICKS = {
  jumping: JUMP_TICKS,
  flipping: AERIAL_TICKS,
  neutral_air: AERIAL_TICKS,
  forward_air: AERIAL_TICKS,
  back_air: AERIAL_TICKS,
  overhand: AERIAL_TICKS,
  kick_off: AERIAL_TICKS,
  down_air: AERIAL_TICKS,
};

const STOCK_REQUIRE = {
  neutral_air: 'jumping',
  forward_air: 'jumping',
  back_air: 'jumping',
  overhand: 'jumping',
  kick_off: 'jumping',
  down_air: 'flipping',
};

const JUMP_ARMS = [
  { id: 'forward_air', angle: -18 },
  { id: 'neutral_air', angle: 18 },
  { id: 'back_air', angle: 54 },
  { id: 'overhand', angle: -90 },
  { id: 'kick_off', angle: -54 },
  { id: 'flipping', angle: 0 },
  { id: 'idle', angle: 90 },
];

const FLIP_ARMS = [
  { id: 'down_air', angle: -90 },
  { id: 'idle', angle: 90 },
];

// Stock edges that used to offer down attacks from Jumping; retired once on first migration.
const RETIRE_DOWN = [
  { from: 'idle', to: 'down_air', stance: 'midair' },
  { from: 'forward_air', to: 'down_air' },
  { from: 'back_air', to: 'down_air' },
];

export function airStateOf(move, id) {
  if (id === 'flipping' || move?.center === 'Flipping' || move?.require === 'flipping' || move?.enter === 'flipping') return 'flipping';
  return 'jumping';
}

export function airHome(move, id) {
  return airStateOf(move, id);
}

export function remainingAirTicks(cat, steps) {
  const air = (steps || []).filter((s) => s.stance === 'midair');
  if (!air.length) return null;
  let grant = JUMP_TICKS;
  let start = 0;
  const first = cat.move(air[0].id);
  if (air[0].id === 'jumping' || air[0].id === 'leap') {
    if (first.ticks != null) grant = first.ticks;
    start = 1;
  }
  let left = grant;
  for (const s of air.slice(start)) {
    const t = cat.move(s.id).ticks;
    if (t) left -= t;
  }
  return Math.max(0, left);
}

function upsertMove(tree, id, patch) {
  tree.moves ||= [];
  let m = tree.moves.find((x) => x.id === id);
  if (!m) { m = { id, ...patch }; tree.moves.push(m); return m; }
  if (!m.custom) {
    for (const [k, v] of Object.entries(patch)) if (m[k] == null) m[k] = v;
  }
  return m;
}

function hasEdge(tree, from, to, stance) {
  return (tree.edges || []).some((e) => e.from === from && e.to === to && (stance ? e.stance === stance : true) && (from !== 'idle' || !stance || !e.stance || e.stance === stance));
}

function addEdge(tree, from, to, stance) {
  tree.edges ||= [];
  if (hasEdge(tree, from, to, stance)) return;
  const e = { from, to }; if (stance) e.stance = stance;
  tree.edges.push(e);
}

function place(tree, key, deg) {
  tree.placement ||= {};
  if (tree.placement[key] == null) tree.placement[key] = deg;
}

function setLayout(tree, key, center, arms) {
  tree.layouts ||= {};
  const cur = tree.layouts[key];
  if (cur && cur.custom) return;
  const keep = (cur && Array.isArray(cur.arms)) ? cur.arms.filter((a) => a.custom || !arms.some((n) => n.id === a.id)) : [];
  const merged = [...arms];
  for (const a of keep) if (!merged.some((n) => n.id === a.id)) merged.push(a);
  tree.layouts[key] = { center, arms: merged };
}

export function ensureAirStates(tree, { rewire = false } = {}) {
  tree.moves ||= []; tree.edges ||= [];
  upsertMove(tree, 'jumping', {
    id: 'jumping', label: 'Leap', height: 'mid', tier: 0, windup: 0.25, recovery: 0.25,
    stances: ['standing', 'midair'], result_stance: 'midair', state: true, center: 'Jumping', ticks: JUMP_TICKS,
  });
  upsertMove(tree, 'flipping', {
    id: 'flipping', label: 'Flip over', height: 'mid', tier: 0, windup: 0.25, recovery: 0.25,
    stances: ['midair'], result_stance: 'midair', state: true, center: 'Flipping', ticks: AERIAL_TICKS,
  });
  for (const [id, ticks] of Object.entries(STOCK_TICKS)) {
    const m = tree.moves.find((x) => x.id === id);
    if (m && !m.custom && m.ticks == null) m.ticks = ticks;
  }
  for (const [id, req] of Object.entries(STOCK_REQUIRE)) {
    const m = tree.moves.find((x) => x.id === id);
    if (m && !m.custom && !m.require) m.require = req;
  }

  addEdge(tree, 'idle', 'jumping', 'standing');
  place(tree, 'idle@standing>jumping', -150);
  for (const arm of JUMP_ARMS) {
    addEdge(tree, 'jumping', arm.id, null);
    place(tree, `jumping>${arm.id}`, arm.angle);
  }
  for (const arm of FLIP_ARMS) {
    addEdge(tree, 'flipping', arm.id, null);
    place(tree, `flipping>${arm.id}`, arm.angle);
  }
  for (const id of ['neutral_air', 'forward_air', 'back_air', 'overhand', 'kick_off']) {
    if (tree.moves.some((m) => m.id === id)) addEdge(tree, id, 'flipping', null);
  }

  if (rewire) {
    const stockDown = tree.moves.find((m) => m.id === 'down_air');
    if (!stockDown?.custom) {
      tree.edges = (tree.edges || []).filter((e) => !RETIRE_DOWN.some((r) => e.from === r.from && e.to === r.to && (!r.stance || e.stance === r.stance)));
    }
  }

  setLayout(tree, 'midair', 'jumping', JUMP_ARMS);
  setLayout(tree, 'after_flipping', 'flipping', FLIP_ARMS);
  const standing = tree.layouts?.standing;
  if (standing && Array.isArray(standing.arms) && !standing.arms.some((a) => a.id === 'jumping')) {
    standing.arms.push({ id: 'jumping', angle: -150 });
  }
  return tree;
}

export function filterAirIds(ids, cat, stance, fromId) {
  if (stance !== 'midair') return ids;
  const state = airStateOf(cat.move(fromId), fromId);
  return ids.filter((id) => {
    const req = cat.move(id).require;
    return !req || req === state;
  });
}
