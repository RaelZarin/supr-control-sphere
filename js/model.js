// Model: turns (tree, settings, path) into what the renderer draws — world positions, current options, depth and FX level.
import { walk, IDLE, mergeSettings, branchDepth } from './data.js';
import { placeOptions, polar, R_INNER } from './layout.js';

export function linkStyle(cat, settings, from, to, stance) {
  const o = cat.tree.links?.[cat.linkKey(from, to, stance)] || {};
  return { curve: o.curve || settings.curve, ms: o.ms ?? settings.travelMs, bend: o.bend ?? settings.bend, custom: !!cat.tree.links?.[cat.linkKey(from, to, stance)] };
}

function optionsAt(cat, settings, step) {
  let ids = cat.legalNext(step.stance, step.prev);
  if (!settings.stubs) ids = ids.filter((id) => !cat.move(id).stub);
  return placeOptions(cat, ids, step.stance, step.prev, settings, cat.sourceOf(step.stance, step.prev));
}

export function fxFromDepth(depth, settings, stance) {
  const span = Math.max(1, settings.fxFull - settings.fxStart + 1);
  const ramp = Math.min(1, Math.max(0, (depth - settings.fxStart + 1) / span));
  const level = ramp * settings.fxMax * (settings.fx[stance] ?? 1);
  const depthLevel = Math.min(1, depth / Math.max(1, settings.fxFull));
  return { level, depthLevel };
}

export function buildModel(cat, settingsIn, path) {
  const settings = mergeSettings(settingsIn);
  const steps = walk(cat, path);
  const pos = [{ x: 0, y: 0 }];
  for (let k = 1; k < steps.length; k++) {
    const opts = optionsAt(cat, { ...settings, stubs: true }, steps[k - 1]);
    const o = opts.find((p) => p.id === steps[k].id) || polar(settings.facing - 90, R_INNER);
    pos.push({ x: pos[k - 1].x + o.x, y: pos[k - 1].y + o.y });
  }
  const cur = steps[steps.length - 1];
  const depth = branchDepth(cat, cur.id, cur.stance);
  const options = optionsAt(cat, settings, cur).map((o) => {
    const rs = cat.resultStance(o.id, cur.stance);
    const nextStep = { id: o.id, stance: rs, prev: o.id === IDLE ? '' : o.id };
    const twigs = o.id === IDLE ? [] : cat.legalNext(rs, nextStep.prev).slice(0, 6).map((id) => ({ id, stance: cat.resultStance(id, rs) }));
    return { ...o, move: cat.move(o.id), resultStance: rs, link: linkStyle(cat, settings, cat.sourceOf(cur.stance, cur.prev), o.id, cur.stance), twigs };
  });
  const { level, depthLevel } = fxFromDepth(depth, settings, cur.stance);
  return { cat, settings, steps, pos, cur, cam: pos[pos.length - 1], options, depth, level, depthLevel, empty: options.length === 0 };
}
