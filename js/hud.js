// In-game chrome mock: compact bottom dock with HP, stamina, Ley, and the Beat Track.
// Reserved space above the dock expands for extra enemy lanes, or the track scrolls instead.
import { h } from './ui.js';

const LANE_H = 16;
const BASE_LANES = 2;
const DOCK_CHROME = 72; // plate + ley + beat head, compact

function pips(n, max, fill, empty = '#15132b') {
  return h('span', { class: 'hudPips' }, ...Array.from({ length: max }, (_, i) =>
    h('i', { class: i < n ? 'on' : '', style: `--pip:${i < n ? fill : empty}` })));
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
  return h('div', { class: `beatTrack ${overflow}`, 'aria-label': 'Beat Track' },
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
  );
}

export function renderGameHud(el, settings = {}) {
  if (!el) return;
  el.replaceChildren(
    h('div', { class: 'hudPlate', 'aria-label': 'Rael vitals' },
      h('div', { class: 'hudWho' }, h('b', {}, 'RAEL'), h('span', { class: 'muted' }, 'Whipping Reed')),
      h('div', { class: 'hudMeter' }, h('span', { class: 'hudTag' }, 'HP'), pips(14, 18, '#ea5439')),
      h('div', { class: 'hudMeter' }, h('span', { class: 'hudTag' }, 'STA'), pips(6, 8, '#b4bda5')),
    ),
    h('div', { class: 'leyBar', 'aria-label': 'Ley bar' },
      h('div', { class: 'leyHead' }, h('b', {}, 'LEY'), h('span', { class: 'leyVal' }, '12')),
      h('div', { class: 'leyTrack' },
        h('i', { class: 'leyFill', style: 'width:60%' }),
        h('i', { class: 'leyGhost', style: 'width:75%' }),
      ),
    ),
    beats(settings),
  );
}

export function refreshGameHud(app) {
  const hud = document.getElementById('gameHud');
  const reserve = document.getElementById('hudReserve');
  if (!hud || !app) return;
  const s = app.settings || {};
  const overflow = s.timelineOverflow === 'scroll' ? 'scroll' : 'expand';
  const extras = Math.max(0, Math.round(s.timelineEnemies ?? 3));
  renderGameHud(hud, s);
  if (!reserve) return;
  reserve.classList.toggle('expand', overflow === 'expand');
  reserve.classList.toggle('scroll', overflow === 'scroll');
  const cap = 1 + Math.max(3, extras); // Rael plus at least three enemy slots
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
  if (app) refreshGameHud(app);
}

export function bootInGame(app) {
  const want = new URLSearchParams(location.search).get('view') === 'game';
  app.inGame = want;
  refreshGameHud(app);
  setInGame(want, app);
  document.getElementById('viewBtn')?.addEventListener('click', () => {
    app.inGame = !app.inGame;
    setInGame(app.inGame, app);
  });
}
