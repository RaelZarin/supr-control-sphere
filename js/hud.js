// In-game chrome: one bottom strip with vitals, the Beat Track (Ley + ticks), and Undo/Commit.
// The necked diamond is docked flush against Undo/Commit; Beat Track is 15% narrower than before.
import { h } from './ui.js';
import { SPHERE_W, SPHERE_H, VIEW, NECK_W, TIP, TOP_NECK, DOCK_ARM, DOCK_CAM_Y, DOCK_NODE_R, gemExtent } from './shape.js';
import { formatMomentum, momentumPips, paintReadout } from './momentum.js';

const LANE_H = 16;
const BASE_LANES = 2;
const DOCK_CHROME = 126; // text strip + momentum + ley + beat head + padding

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
  const pips = momentumPips().map((fill) => {
    const cls = fill >= 1 ? 'on' : (fill > 0 ? 'part' : '');
    return h('i', { class: cls, style: `--fill:${Math.round(fill * 100)}%` });
  });
  return h('div', { class: `beatPanel ${overflow}`, 'aria-label': 'Beat Track' },
    h('div', { class: 'hudText', id: 'hudText', 'aria-label': 'Move name and description' }),
    h('div', { class: 'momReadout', 'aria-label': `Momentum ${formatMomentum()}` },
      h('span', { class: 'momName' }, 'Momentum'),
      h('span', { class: 'momVal' }, formatMomentum()),
      h('span', { class: 'momPips' }, ...pips),
    ),
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


const VIEW_SPAN = VIEW * 2;

function ensureDockPanel(play) {
  let panel = play.querySelector('.dockPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'dockPanel';
    panel.setAttribute('aria-hidden', 'true');
    play.insertBefore(panel, play.querySelector('.stageWrap'));
  }
  return panel;
}

function parkMoveInfo(on) {
  const info = document.getElementById('moveInfo');
  const slot = document.getElementById('hudText');
  const play = document.querySelector('.playfield');
  if (!info) return;
  if (on && slot && info.parentElement !== slot) slot.appendChild(info);
  if (!on && play) {
    const wrap = play.querySelector('.stageWrap');
    if (wrap && info.parentElement !== play) wrap.after(info);
    info.style.left = info.style.top = info.style.right = info.style.bottom = info.style.width = '';
  }
}

function clearDockedSphere() {
  const wrap = document.querySelector('.stageWrap');
  const beat = document.querySelector('.beatPanel');
  const panel = document.querySelector('.dockPanel');
  if (wrap) {
    wrap.style.left = wrap.style.top = wrap.style.right = wrap.style.bottom = '';
    wrap.style.width = wrap.style.height = wrap.style.transform = '';
    wrap.style.removeProperty('--sphereS');
  }
  if (beat) { beat.style.width = ''; beat.style.flex = ''; }
  if (panel) panel.remove();
  parkMoveInfo(false);
}

// Place the corner panel, sit the unsquashed diamond inside it, and park hover text above the Beat Track.
export function layoutDockedSphere() {
  const on = document.body.classList.contains('inGame');
  const play = document.querySelector('.playfield');
  const wrap = document.querySelector('.stageWrap');
  const info = document.getElementById('moveInfo');
  const plate = document.querySelector('.hudPlate');
  const beat = document.querySelector('.beatPanel');
  const undo = document.querySelector('.dockActions');
  if (!on) { clearDockedSphere(); return; }
  if (!play || !wrap || !undo || !plate || !beat) return;

  const pr = play.getBoundingClientRect();
  const W = pr.width, H = pr.height;
  const hpW = plate.getBoundingClientRect().width;
  const undoW = undo.getBoundingClientRect().width;
  // Previous beat used leftover after HP, Undo, and a 47%-of-S + 48px diamond reserve.
  const oldS = Math.min(0.58 * window.innerHeight, 0.62 * window.innerWidth, 560);
  const oldBeat = Math.max(200, W - 8 - hpW - 8 - 8 - undoW - (oldS * 0.47 + 48));
  beat.style.flex = '0 0 auto';
  beat.style.width = Math.round(oldBeat * 0.85) + 'px';

  const ur = undo.getBoundingClientRect();
  // At least 25% bigger than the previous 402px dock (502 at 1280×800). Grow further
  // so the right tip runs off the edge while the left rim stays flush with Undo.
  const minS = 502 * Math.min(W / 1280, H / 748);
  const clip = 40;
  const x0 = -SPHERE_W, y0 = 0;
  const x1 = -NECK_W, y1 = -(SPHERE_H - TIP - TOP_NECK);
  const flushX = (centerY, unit) => {
    const yAt = (ur.top - pr.top - centerY) / unit;
    if (y1 !== y0 && yAt < 0 && yAt > y1) return x0 + ((yAt - y0) / (y1 - y0)) * (x1 - x0);
    return x0;
  };
  let S = minS, unit, halfW, halfH, centerX, centerY, xAt;
  for (let i = 0; i < 6; i++) {
    unit = S / VIEW_SPAN;
    halfH = SPHERE_H * unit;
    halfW = SPHERE_W * unit;
    centerY = ur.top - pr.top;
    xAt = flushX(centerY, unit);
    const need = ((W + clip) - (ur.right - pr.left) + 2) / (SPHERE_W - xAt) * VIEW_SPAN;
    S = Math.max(minS, need);
  }
  unit = S / VIEW_SPAN;
  halfW = SPHERE_W * unit;
  halfH = SPHERE_H * unit;
  // Keep the unsquashed size, sit the diamond in the corner panel, and leave a
  // left gutter so the d-pad's left icon fits between Undo and the rim.
  // Baseline is the Ley/momentum row, not Undo, so the reserved text strip can grow upward.
  const mom = document.querySelector('.momReadout') || document.querySelector('.leyLane');
  const baseY = ((mom || ur).getBoundingClientRect().top - pr.top);
  const panelLeft = (ur.right - pr.left) + 8;
  const iconRoom = 92;
  xAt = flushX(baseY, unit);
  centerX = panelLeft + iconRoom + halfW;
  centerY = baseY + 2 * halfH * 0.4;
  const dockBot = centerY + (DOCK_CAM_Y + DOCK_ARM + gemExtent(DOCK_NODE_R) + 8) * unit;
  if (dockBot > H - 8) centerY -= dockBot - (H - 8);

  wrap.style.setProperty('--sphereS', `${S}px`);
  wrap.style.width = wrap.style.height = `${S}px`;
  wrap.style.left = `${centerX - S / 2}px`;
  wrap.style.top = `${centerY - S / 2}px`;
  wrap.style.right = wrap.style.bottom = 'auto';
  wrap.style.transform = 'none';

  const panel = ensureDockPanel(play);
  const tipY = centerY - halfH;
  panel.style.left = `${panelLeft}px`;
  panel.style.right = '0px';
  panel.style.top = `${Math.max(8, tipY - 28)}px`;
  panel.style.bottom = '0px';

  parkMoveInfo(true);
  if (info) info.style.left = info.style.top = info.style.right = info.style.bottom = info.style.width = '';
}

function scheduleDockLayout() {
  requestAnimationFrame(layoutDockedSphere);
}

export function renderGameHud(el, settings = {}) {
  if (!el) return;
  parkMoveInfo(false);
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
  paintReadout(false);
  parkMoveInfo(document.body.classList.contains('inGame'));
  if (!reserve) return;
  reserve.classList.toggle('expand', overflow === 'expand');
  reserve.classList.toggle('scroll', overflow === 'scroll');
  const cap = 1 + Math.max(3, extras);
  const compact = DOCK_CHROME + BASE_LANES * LANE_H;
  const room = DOCK_CHROME + cap * LANE_H;
  reserve.style.setProperty('--hudReserveH', (overflow === 'expand' ? room : compact) + 'px');
  reserve.style.setProperty('--hudDockH', compact + 'px');
  scheduleDockLayout();
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
  if (!bootInGame.bound) {
    bootInGame.bound = true;
    window.addEventListener('resize', scheduleDockLayout);
  }
}
