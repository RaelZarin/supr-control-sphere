// In-game chrome mock: compact bottom dock with HP, stamina, Ley, and the Beat Track.
import { h } from './ui.js';

function pips(n, max, fill, empty = '#15132b') {
  return h('span', { class: 'hudPips' }, ...Array.from({ length: max }, (_, i) =>
    h('i', { class: i < n ? 'on' : '', style: `--pip:${i < n ? fill : empty}` })));
}

function beats() {
  // Decorative planning blocks so the dock reads as a Beat Track, not a live sim.
  const blocks = [
    { lane: 'Rael', kind: 'move', label: 'Leap', t: 0, w: 2 },
    { lane: 'Rael', kind: 'action', label: 'Nair', t: 2, w: 2 },
    { lane: 'Rael', kind: 'action', label: 'Flip', t: 4, w: 2 },
    { lane: 'Foe', kind: 'step', label: 'Step', t: 1, w: 1 },
    { lane: 'Foe', kind: 'action', label: 'Swing', t: 5, w: 2 },
  ];
  const lanes = ['Rael', 'Foe'];
  const span = 8;
  return h('div', { class: 'beatTrack', 'aria-label': 'Beat Track' },
    h('div', { class: 'beatHead' }, h('b', {}, 'BEAT'), ...Array.from({ length: span }, (_, i) => h('span', { class: 'beatTick' }, String(i)))),
    ...lanes.map((lane) => h('div', { class: 'beatLane' },
      h('span', { class: 'beatName' }, lane),
      h('div', { class: 'beatRow' },
        ...blocks.filter((b) => b.lane === lane).map((b) => h('i', {
          class: `beatBlock ${b.kind}`,
          style: `left:${(b.t / span) * 100}%;width:${(b.w / span) * 100}%`,
          title: b.label,
        }, b.label))),
    )),
  );
}

export function renderGameHud(el) {
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
    beats(),
  );
}

export function setInGame(on) {
  document.body.classList.toggle('inGame', !!on);
  const hud = document.getElementById('gameHud');
  if (hud) hud.hidden = !on;
  const btn = document.getElementById('viewBtn');
  if (btn) { btn.classList.toggle('on', !!on); btn.textContent = on ? '▣ In-game' : '▣ In-game frame'; }
}

export function bootInGame(app) {
  const want = new URLSearchParams(location.search).get('view') === 'game';
  app.inGame = want;
  renderGameHud(document.getElementById('gameHud'));
  setInGame(want);
  document.getElementById('viewBtn')?.addEventListener('click', () => {
    app.inGame = !app.inGame;
    setInGame(app.inGame);
  });
}
