// Block inherits Idle's live option set; both Sidesteps offer Lunge, Light attack, Deflect, Parry, and Block.
export const BLOCK_MIGRATION = 'block-sidestep-v1';

export const SIDE_FOLLOWS = [
  { id: 'lunge', label: 'Lunge', left: 135, right: 45, height: 'mid', tier: 2, windup: 0.5, recovery: 1.5, damage: 2 },
  { id: 'light_attack', label: 'Light attack', left: 180, right: 0, height: 'mid', tier: 0, windup: 0.25, recovery: 0.25, damage: 0 },
  { id: 'deflect', label: 'Deflect', left: 90, right: 90, height: 'mid', tier: 0, windup: 0.25, recovery: 0.25, stub: true },
  { id: 'parry', label: 'Parry', left: 225, right: -45, height: 'mid', tier: 1, windup: 0.25, recovery: 0.25, stub: true },
  { id: 'block', label: 'Block', left: 270, right: -90, height: 'mid', tier: 0, windup: 0.25, recovery: 0.25, stub: true },
];

const SIDES = [
  { id: 'sidestep_left', key: 'left' },
  { id: 'sidestep_right', key: 'right' },
];

// Walk aliasOptions without looping if two moves ever point at each other.
export function aliasRoot(moveFn, id, seen = new Set()) {
  let cur = id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const next = moveFn(cur)?.aliasOptions;
    if (!next || seen.has(next)) return cur;
    cur = next;
  }
  return cur;
}

export function withInherited(outgoing, moveFn, from, stance, ids) {
  const root = aliasRoot(moveFn, from);
  if (!root || root === from) return ids;
  const out = [...ids];
  for (const id of outgoing(root, stance)) if (!out.includes(id)) out.push(id);
  return out;
}

function upsertMove(tree, spec) {
  tree.moves ||= [];
  const cur = tree.moves.find((m) => m.id === spec.id);
  if (cur) return cur;
  const mv = { id: spec.id, label: spec.label, height: spec.height || 'mid', tier: spec.tier ?? 0, windup: spec.windup ?? 0.25, recovery: spec.recovery ?? 0.25, stances: ['standing'] };
  if (spec.damage != null) mv.damage = spec.damage;
  if (spec.stub) mv.stub = true;
  tree.moves.push(mv);
  return mv;
}

function addEdge(tree, from, to) {
  tree.edges ||= [];
  if (!tree.edges.some((e) => e.from === from && e.to === to)) tree.edges.push({ from, to });
}

export function ensureBlockAndSidestepFollows(tree, { rewire = false } = {}) {
  tree.moves ||= []; tree.edges ||= []; tree.placement ||= {}; tree.layouts ||= {};
  const block = tree.moves.find((m) => m.id === 'block');
  if (block && !block.custom && !block.aliasOptions) block.aliasOptions = 'idle';
  if (rewire && block && !block.custom) {
    tree.edges = tree.edges.filter((e) => !(e.from === 'block' && e.to === 'idle'));
  }
  for (const side of SIDES) {
    if (!tree.moves.some((m) => m.id === side.id)) continue;
    for (const fol of SIDE_FOLLOWS) {
      upsertMove(tree, fol);
      addEdge(tree, side.id, fol.id);
      const key = `${side.id}>${fol.id}`;
      if (tree.placement[key] == null || rewire) tree.placement[key] = fol[side.key];
    }
    const standing = tree.layouts.standing;
    const arm = standing?.arms?.find((a) => a.id === side.id);
    if (arm) {
      arm.next ||= [];
      for (const fol of SIDE_FOLLOWS) {
        const cur = arm.next.find((n) => n.id === fol.id);
        if (!cur) arm.next.push({ id: fol.id, angle: fol[side.key] });
        else if (rewire) cur.angle = fol[side.key];
      }
    }
  }
  return tree;
}
