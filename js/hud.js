// In-game chrome: one bottom strip with vitals, the Beat Track (Ley + ticks), and Undo/Commit.
// The necked diamond is docked and cropped in the bottom-right via CSS. Enemy lanes reserved above.
import { h } from './ui.js';

const LANE_H = 16;
const BASE_LANES = 2;
const DOCK_CHROME = 58; // beat head + ley row + panel padding

function pips(n, max, fill, empty = '#15132b') {
  return h('span', { class: 'hudPips' }, ...Array.from({ length: max }, (_, i) =>
    h('i', { class: i < n ? 'on' : '', style: `--pip:${i < n ? fill : empty}` })));
}

function ico(kind) {
  return h('span', { class: 'hudIco ' + kind, 'aria-hidden': 'true' }, kind === 'heart' ? '♥' : '⚡');
}

function enemyLanes(count) {
  const foes = ['Foe', 'Brute', 'Archer', 'Wisp', 'Captain', 'Scout'];
  return foes.slice(0, Math.max(0, count)).map((name, i) => ({
    lane: name === 'Foe' && i === 0 ? 'Foe' : name,
    blocks: i === 0
      ? [{ kind: 'step', label: 'Step', t: 1, w: 1 }, { kind: 'action', label: 'Swing', t: 5, w: 2 }]
      : [{ kind: 'step', label: 'Step', t: (i + 1) % 6, w: 1 }, { kind: 'action', label: 'Hit', t: (i * 2 + 3) % 6, w: 2 }],
  }));
}

function beats(settings) {
  const extras = Math.max(0, Math.round(settings?.timelineEnemies ?? 3));
  const overflow = settings?.timelineOverflow === 'scroll' ? 'scroll' : 'expand';
  const rael = [
    { kind: 'move', label: 'Leap', t: 0, w: 2 },
    { kind: 'action', label: 'Nair', t: 2, w: 2 },
    { kind: 'action', label: 'Flip', t: 4, w: 2 },
  ];
  const lanes = [{ lane: 'Rael', blocks: rael }, ...enemyLanes(extras)];
  const span = 8;
  return h('div', { class: `beatPanel ${overflow}`, 'aria-label': 'Beat Track' },
    h('div', { class: 'leyLane', 'aria-label': 'Ley bar' },
      h('span', { class: 'beatName' }, 'Ley'),
      h('div', { class: 'leyTrack' },
        h('i', { class: 'leyFill', style: 'width:60%' }),
        h('i', { class: 'leyGhost', style: 'width:75%' }),
        h('span', { class: 'leyVal' }, '12'),
      ),
    ),
    h('div', { class: `beatTrack ${overflow}` },
      h('div', { class: 'beatHead' }, h('b', {}, 'BEAT'), ...Array.from({ length: span }, (_, i) => h('span', { class: 'beatTick' }, String(i)))),
      ...lanes.map((ln) => h('div', { class: 'beatLane' },
        h('span', { class: 'beatName' }, ln.lane),
        h('div', { class: 'beatRow' },
          ...ln.blocks.map((b) => h('i', {
            class: `beatBlock ${b.kind}`,
            style: `left:${(b.t / span) * 100}%;width:${(b.w / span) * 100}%`,
            title: b.label,
          }, b.label))),
      )),
    ),
  );
}

export function renderGameHud(el, settings = {}) {
  if (!el) return;
  el.replaceChildren(
    h('div', { class: 'hudPlate', 'aria-label': 'Rael vitals' },
      h('div', { class: 'hudMeter' }, ico('heart'), pips(14, 18, '#ea5439')),
      h('div', { class: 'hudMeter' }, ico('bolt'), pips(6, 8, '#ede1a9')),
    ),
    beats(settings),
    h('div', { class: 'dockActions' },
      h('button', { type: 'button', 'data-dock': 'undo', title: 'Undo (Backspace or Ctrl/Cmd+Z)' }, 'Undo'),
      h('button', { type: 'button', 'data-dock': 'commit', title: 'Commit this route' }, 'Commit'),
    ),
  );
}

function bindDock(app) {
  const hud = document.getElementById('gameHud');
  if (!hud || hud.dataset.bound) return;
  hud.dataset.bound = '1';
  hud.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dock]'); if (!b) return;
    if (b.dataset.dock === 'undo') app.undo?.();
    if (b.dataset.dock === 'commit') app.commit?.();
  });
}

export function refreshGameHud(app) {
  const hud = document.getElementById('gameHud');
  const reserve = document.getElementById('hudReserve');
  if (!hud || !app) return;
  const s = app.settings || {};
  const overflow = s.timelineOverflow === 'scroll' ? 'scroll' : 'expand';
  const extras = Math.max(0, Math.round(s.timelineEnemies ?? 3));
  renderGameHud(hud, s);
  bindDock(app);
  if (!reserve) return;
  reserve.classList.toggle('expand', overflow === 'expand');
  reserve.classList.toggle('scroll', overflow === 'scroll');
  const cap = 1 + Math.max(3, extras);
  const compact = DOCK_CHROME + BASE_LANES * LANE_H;
  const room = DOCK_CHROME + cap * LANE_H;
  reserve.style.setProperty('--hudReserveH', (overflow === 'expand' ? room : compact) + 'px');
  reserve.style.setProperty('--hudDockH', compact + 'px');
}

export function setInGame(on, app) {
  document.body.classList.toggle('inGame', !!on);
  const hud = document.getElementById('gameHud');
  if (hud) hud.hidden = !on;
  const btn = document.getElementById('viewBtn');
  if (btn) { btn.classList.toggle('on', !!on); btn.textContent = on ? '▣ In-game' : '▣ In-game frame'; }
  if (app) {
    app.inGame = !!on;
    refreshGameHud(app);
    app.redraw?.();
  }
}

export function bootInGame(app) {
  const want = new URLSearchParams(location.search).get('view') === 'game';
  app.inGame = want;
  setInGame(want, app);
  document.getElementById('viewBtn')?.addEventListener('click', () => {
    app.inGame = !app.inGame;
    setInGame(app.inGame, app);
  });
}
