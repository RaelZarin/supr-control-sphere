// Pixel-style move icons and short descriptions. Cream leads, coral for attacks, cerulean for accents.
const NS = 'http://www.w3.org/2000/svg';
const CREAM = '#ede1a9', INK = '#15132b', CORAL = '#ea5439', BLUE = '#3e6c9c', INDIGO = '#232147';
const el = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); for (const c of kids) if (c) e.append(c); return e; };

function cells(rows, color, ox = -4, oy = -4, s = 1) {
  const g = el('g', { 'shape-rendering': 'crispEdges' });
  String(rows).split('|').forEach((row, y) => {
    [...row].forEach((ch, x) => { if (ch !== '.') g.append(el('rect', { x: ox + x * s, y: oy + y * s, width: s, height: s, fill: ch === '#' ? color : ch === 'c' ? CREAM : ch === 'b' ? BLUE : INK })); });
  });
  return g;
}

// 8x8 grids, '.' empty, '#' main, 'c' cream, 'b' cerulean, 'k' ink.
export const ICONS = {
  slash: { color: CORAL, grid: '.......#|......##|.....##.|....##..|...##...|..##....|.##.....|#.......' },
  cut: { color: CORAL, grid: '......#.|.....###|....###.|...##.#.|..##..#.|.##...#.|#.....#.|........' },
  punch: { color: CORAL, grid: '........|..cccc..|.c####c.|.c#cc#c.|.c####c.|.c####c.|..cccc..|........' },
  kick: { color: CORAL, grid: '........|....##..|....##..|...##...|..####..|.##..##.|##......|........' },
  lunge: { color: CORAL, grid: '.......#|......##|b....##.|b...##..|bbbb#...|..##....|.##.....|#.......' },
  overhand: { color: CORAL, grid: '..####..|.##..##.|#.....##|......##|.....##.|....##..|...##...|..##....' },
  uppercut: { color: CORAL, grid: '...##...|..####..|.##..##.|##....#.|......#.|.....##.|....##..|...##...' },
  spike: { color: CORAL, grid: '...##...|...##...|..####..|..####..|.###.##.|.##...##|##.....#|........' },
  shield: { color: BLUE, grid: '...cc...|..cbbc..|.cb..bc.|.cb..bc.|.cb..bc.|.cbbbbc.|..cccc..|...cc...' },
  parry: { color: BLUE, grid: '#......#|.##..##.|..####..|...##...|...##...|..####..|.##..##.|#......#' },
  deflect: { color: BLUE, grid: '........|.....##.|....##c.|...##c..|..##c...|.##c....|##......|........' },
  leap: { color: CREAM, grid: '...cc...|..cccc..|...cc...|....c...|..#c#...|.##.##..|##...##.|........' },
  flip: { color: CREAM, grid: '.##.....|#..#..c.|#..#.c..|.##.c...|...c.##.|..c.#..#|.c..#..#|.....##.' },
  air: { color: CORAL, grid: '..c..c..|.c.c.c.c|c......c|..####..|.###.##.|##...##.|#......#|........' },
  fair: { color: CORAL, grid: '.....cc.|....c..c|......c.|...####.|..##.##.|.##...##|##......|#.......' },
  bair: { color: CORAL, grid: '.cc.....|c..c....|.c......|.####...|.##.##..|##...##.|......##|.......#' },
  roll: { color: BLUE, grid: '..cccc..|.c....c.|c..bb..c|c.b..b.c|c.b..b.c|c..bb..c|.c....c.|..cccc..' },
  hop: { color: BLUE, grid: '...cc...|..cccc..|.cc..cc.|cc....cc|...cc...|...cc...|...cc...|........' },
  stepL: { color: BLUE, grid: '...#....|..##....|.######c|#######c|.######c|..##....|...#....|........' },
  stepR: { color: BLUE, grid: '....#...|....##..|c######.|c#######|c######.|....##..|....#...|........' },
  run: { color: BLUE, grid: '........|.##..c..|####.c..|.##..c..|..##.cc.|####....|.##.....|........' },
  charge: { color: CORAL, grid: '......c.|....cccc|..######|#######c|..######|....cccc|......c.|........' },
  crouch: { color: BLUE, grid: '........|...cc...|..cccc..|.cbbbbc.|.b....b.|bbbbbbbb|........|........' },
  idle: { color: CREAM, grid: '...cc...|..cbbc..|.cbccbc.|.cbccbc.|..cbbc..|...cc...|..cccc..|...cc...' },
  land: { color: CREAM, grid: '...cc...|...cc...|...cc...|...cc...|#..cc..#|.##cc##.|..cccc..|...cc...' },
};

export const ICON_IDS = Object.keys(ICONS);

// Stock chrome: icon id + one-line description. Attacks stay short; targeting lives in the game, not here.
export const STOCK_CHROME = {
  light_attack: { icon: 'slash', desc: 'A quick mid strike.' },
  medium_attack: { icon: 'cut', desc: 'A heavier follow-up cut.' },
  light_punch: { icon: 'punch', desc: 'A short, close punch.' },
  light_strike: { icon: 'slash', desc: 'A light blade strike.' },
  reverse_stroke: { icon: 'cut', desc: 'A reversing blade stroke.' },
  lunge: { icon: 'lunge', desc: 'A stepping mid thrust.' },
  overhand: { icon: 'overhand', desc: 'A high downward cut.' },
  uppercut: { icon: 'uppercut', desc: 'A rising blow that stands you up.' },
  roll: { icon: 'roll', desc: 'A short dive that keeps you low.' },
  hop: { icon: 'hop', desc: 'A small hop to shift your feet.' },
  sidestep: { icon: 'stepR', desc: 'A sidestep off the line.' },
  sidestep_left: { icon: 'stepL', desc: 'Step left off the line.' },
  sidestep_right: { icon: 'stepR', desc: 'Step right off the line.' },
  kick: { icon: 'kick', desc: 'A mid kick.' },
  sweep_kick: { icon: 'kick', desc: 'A low sweeping kick.' },
  running: { icon: 'run', desc: 'Break into a run.' },
  charge: { icon: 'charge', desc: 'A running crash into the foe.' },
  block: { icon: 'shield', desc: 'Guard, then act from Idle\'s options.' },
  parry: { icon: 'parry', desc: 'A timed parry.' },
  deflect: { icon: 'deflect', desc: 'Turn a hit aside.' },
  neutral_air: { icon: 'air', desc: 'A midair strike around you.' },
  forward_air: { icon: 'fair', desc: 'A midair strike out in front.' },
  back_air: { icon: 'bair', desc: 'A midair strike behind you.' },
  down_air: { icon: 'spike', desc: 'A downward midair attack.' },
  kick_off: { icon: 'kick', desc: 'Kick off in the air.' },
  crouch: { icon: 'crouch', desc: 'Drop into Crouching Tiger.' },
  jumping: { icon: 'leap', desc: 'Leap into the air for a tick window.' },
  flipping: { icon: 'flip', desc: 'Flip over a foe to strike down.' },
  idle: { icon: 'idle', desc: 'Return to a standing idle.' },
};

// 3x5 bitmaps for a first-letter fallback, bits packed left-to-right, top-to-bottom (15 bits).
const FONT = {
  A: 0b010101111101101, B: 0b110101110101110, C: 0b011100100100011, D: 0b110101101101110,
  E: 0b111100110100111, F: 0b111100110100100, G: 0b011100101101011, H: 0b101101111101101,
  I: 0b111010010010111, J: 0b001001001101010, K: 0b101110110101101, L: 0b100100100100111,
  M: 0b101111111101101, N: 0b101111111111101, O: 0b010101101101010, P: 0b110101110100100,
  Q: 0b010101101111011, R: 0b110101110101101, S: 0b011100010001110, T: 0b111010010010010,
  U: 0b101101101101111, V: 0b101101101101010, W: 0b101101111111101, X: 0b101101010101101,
  Y: 0b101101010010010, Z: 0b111001010100111, '?': 0b010001010010010,
};

function letterGrid(ch) {
  const bits = FONT[String(ch || '?').toUpperCase()] ?? FONT['?'];
  const rows = [];
  for (let y = 0; y < 5; y++) {
    let row = '';
    for (let x = 0; x < 3; x++) row += (bits >> (14 - (y * 3 + x))) & 1 ? '#' : '.';
    rows.push(`..${row}..`);
  }
  return `........|${rows.join('|')}|........|........`;
}

export function iconIdFor(move) {
  if (move?.icon && ICONS[move.icon]) return move.icon;
  const stock = STOCK_CHROME[move?.id];
  if (stock && ICONS[stock.icon]) return stock.icon;
  return null;
}

export function moveBlurb(move, label) {
  const name = label || move?.label || move?.id || '';
  const desc = (move?.desc || STOCK_CHROME[move?.id]?.desc || '').trim();
  return { name, desc };
}

export function moveIcon(move, scale = 1.6, label) {
  const id = iconIdFor(move);
  const spec = id ? ICONS[id] : null;
  const grid = spec ? spec.grid : letterGrid((label || move?.label || move?.id || '?').trim().charAt(0) || '?');
  const color = spec ? spec.color : CREAM;
  const g = el('g', { class: 'moveIcon', transform: `scale(${scale})`, 'pointer-events': 'none' });
  g.append(cells(grid, color, -4, -4, 1));
  return g;
}

export function ensureMoveChrome(tree) {
  for (const mv of tree.moves || []) {
    if (mv.custom) continue;
    const stock = STOCK_CHROME[mv.id];
    if (!stock) continue;
    if (!mv.icon) mv.icon = stock.icon;
    if (!mv.desc) mv.desc = stock.desc;
  }
  return tree;
}
