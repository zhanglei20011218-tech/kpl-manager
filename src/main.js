import {
  newGame,
  startYear,
  startNextYear,
  prepareMatch,
  playPlayerMatch,
  playOneGame,
  settlePlayerSeries,
  quickSimPlayerMatches,
  endWeek,
  canEndWeek,
  checkEvent,
  teamName,
  playerTeam,
  playerMatchesThisWeek,
  currentCompetition,
  weekLabel,
  chooseFmvp
} from './core/game.js';
import { COMPETITION_BY_ID, eventDateLabel, weekDate } from './core/calendar.js';
import { createDraft, currentTurn, applyAction, aiBan, aiPick } from './core/match-draft.js';
import { rollTacticNodes, rollPeakHeroes } from './core/match.js';
import { resolveEvent } from './core/events.js';
import { newsById, NEWS_TYPES } from './core/news.js';
import {
  signPlayer,
  releasePlayer,
  renewContract,
  scoutProspects,
  signProspect,
  setStarter,
  tickMarket,
  poachPlayer
} from './core/transfer.js';
import { saveGame, loadGame, clearSave, exportSave, importSave } from './core/save.js';
import { FACILITIES, MAX_FACILITY_LEVEL, MATCH } from './data/constants.js';
import { HEROES, HERO_BY_ID } from './data/heroes.js';
import { createMinimap } from './ui/minimap.js';
import { drawLiveMap, hudHtml } from './ui/live.js';
import { createLiveMatch } from './core/live-match.js';
import { facilityUpgradeCost } from './core/economy.js';
import { renderIntro } from './ui/intro.js';
import { renderHome } from './ui/home.js';
import { renderSquad, renderPlayerSheet } from './ui/squad.js';
import { renderMatch } from './ui/match.js';
import { renderSchedule, renderDaySheet, monthOf, shiftMonth } from './ui/schedule.js';
import { renderTransfer, renderSignSheet, renderPoachSheet } from './ui/transfer.js';
import { renderMore } from './ui/more.js';
import { esc, money } from './ui/format.js';

const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const toasts = document.getElementById('toasts');

let state = null;
let ui = {
  screen: 'home',
  atMenu: false,
  match: null,
  sheet: null,
  transferTab: 'market',
  scheduleCompId: null,
  scheduleTab: 'matches',
  introMode: 'existing',
  introTeam: 'ag',
  introInherit: 'ig',
  introName: '',
  introTeamName: '',
  introTeamShort: '',
  introColor: '#2ee6c8',
  poachRegion: 'ALL',
  fmvpSel: null
};

/* ------------------------------------------------------------------ */
/* 启动                                                                 */
/* ------------------------------------------------------------------ */

function boot() {
  const saved = loadGame();
  if (saved && saved.version === 2) {
    state = saved;
    ui.screen = 'home';
    ui.scheduleCompId = state.activeCompetitionId;
  } else if (saved) {
    // 旧版本存档（10 队虚构联赛）不再兼容
    clearSave();
  }
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const check = () => reg.update().catch(() => {});
        check();
        // 定时检查 + 切回页面时检查
        setInterval(check, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) check();
        });
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              // 新版本就绪：弹窗要求刷新并清理缓存
              ui.updateReady = true;
              render();
            }
          });
        });
      })
      .catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* 渲染                                                                 */
/* ------------------------------------------------------------------ */

let liveTimer = null;
function stopLiveTicker() {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
}
function startLiveTicker() {
  stopLiveTicker();
  liveTimer = setInterval(() => {
    const m = ui.match;
    if (!m || m.step !== 'live' || !m.live) return stopLiveTicker();
    const st = m.live.state;
    if (st.done || st.pendingEvent) return stopLiveTicker();
    m.live.tick();
    const hud = document.getElementById('live-hud');
    if (hud) hud.innerHTML = hudHtml(st);
    const canvas = document.getElementById('live-map');
    if (canvas) drawLiveMap(canvas, ui);
    if (st.pendingEvent || st.done) {
      stopLiveTicker();
      render();
    }
  }, 170);
}
function enterLive() {
  const m = ui.match;
  if (!m || m.live || !m.draft || m.step !== 'draft') return;
  m.live = createLiveMatch({
    draft: m.draft,
    players: state.players,
    teamAId: state.playerTeamId,
    teamBId: m.opponentId,
    meta: state.meta,
    fmvp: state.fmvp,
    synergy: 70,
    rng: state.rng
  });
  m.step = 'live';
  render();
  startLiveTicker();
}

function render() {
  const screenEl = document.querySelector('.screen');
  const scroll = screenEl ? screenEl.scrollTop : 0;

  if (!state || ui.atMenu) {
    app.innerHTML = `<div class="screen no-tab" style="padding-bottom:0">${renderIntro(ui, {
      canResume: !!state,
      resumeLabel: state ? `${playerTeam(state).name} · ${state.year} 赛季` : ''
    })}</div>`;
  } else {
    app.innerHTML = `<div class="screen">${renderScreen()}</div>${renderTabbar()}${renderCelebration()}${renderFmvpModal()}${renderUpdateModal()}`;
  }
  renderOverlay();
  // 观战页：渲染后绘制地图
  if (ui.match?.step === 'live') {
    const canvas = document.getElementById('live-map');
    if (canvas) drawLiveMap(canvas, ui);
  }
  // BP 结束（关门开门特效播完）自动进入小地图观战
  if (ui.match?.step === 'draft' && ui.match.draft?.laneLocked && !ui.match.live && !ui.match.livePending) {
    ui.match.livePending = true;
    setTimeout(() => {
      if (ui.match && ui.match.step === 'draft') enterLive();
      if (ui.match) ui.match.livePending = false;
    }, 900);
  }
  syncBpTimer();
  syncMinimap();

  requestAnimationFrame(() => {
    const el = document.querySelector('.screen');
    if (el) el.scrollTop = scroll;
  });
}

let mm = null;
let mmEl = null;

/** 赛中决策页挂载实时小地图；离开页面时销毁 */
function syncMinimap() {
  const canvas = document.querySelector('canvas.minimap');
  if (!canvas) {
    if (mm) {
      mm.destroy();
      mm = null;
      mmEl = null;
    }
    return;
  }
  if (mm && mmEl === canvas) return;
  if (mm) {
    mm.destroy();
    mm = null;
  }
  const m = ui.match;
  if (!m || !m.draft) return;

  const roles = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];
  const build = (ids) =>
    roles.map((role, i) => ({
      name: role,
      role,
      heroId: (ids || [])[i] || 'lianpo',
      power: 82
    }));

  mm = createMinimap(canvas, {
    blue: build(m.draft.picks.blue),
    red: build(m.draft.picks.red),
    onEnd: ({ winner }) => {
      m.mmWinner = winner;
    }
  });
  mm.setMode(ui.mmMode || 'balanced');
  mmEl = canvas;
}

let bpTimer = null;

function syncBpTimer() {
  if (bpTimer) {
    clearInterval(bpTimer);
    bpTimer = null;
  }
  if (!state || !ui.match || ui.match.step !== 'draft') return;
  const d = ui.match.draft;
  const turn = currentTurn(d);
  if (!turn || turn.side !== d.playerSide) return;

  const deadline = Date.now() + 30000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const el = document.querySelector('.bp-timer-text');
    if (el) el.textContent = String(left);
    if (left <= 0) {
      if (bpTimer) clearInterval(bpTimer);
      bpTimer = null;
      autoPickForPlayer();
    }
  };
  tick();
  bpTimer = setInterval(tick, 300);
}

function autoPickForPlayer() {
  if (!ui.match || ui.match.step !== 'draft') return;
  const d = ui.match.draft;
  const turn = currentTurn(d);
  if (!turn || turn.side !== d.playerSide) return;
  const id = turn.type === 'ban' ? aiBan(d, state.rng, state.players) : aiPick(d, state.rng, state.players);
  if (!id) return;
  applyAction(d, id);
  toast('时间到，已自动选择', 'err');
  render();
  pumpDraft();
}

function renderScreen() {
  switch (ui.screen) {
    case 'home': return renderHome(state);
    case 'squad': return renderSquad(state);
    case 'match': return renderMatch(state, ui);
    case 'schedule': return renderSchedule(state, ui);
    case 'transfer': return renderTransfer(state, ui);
    case 'more': return renderMore(state);
    default: return renderHome(state);
  }
}

function renderTabbar() {
  const tabs = [
    { key: 'home', icon: '🏠', label: '主页' },
    { key: 'squad', icon: '👥', label: '阵容' },
    { key: 'match', icon: '⚔️', label: '比赛' },
    { key: 'schedule', icon: '📅', label: '赛事' },
    { key: 'transfer', icon: '💰', label: '转会' },
    { key: 'more', icon: '⚙️', label: '俱乐部' }
  ];
  return `<nav class="tabbar">
    ${tabs.map((t) => `<button class="${ui.screen === t.key ? 'on' : ''}" data-action="tab" data-key="${t.key}">
      <span class="ico">${t.icon}</span>
      <span>${t.label}</span>
    </button>`).join('')}
  </nav>`;
}

function renderOverlay() {
  if (!state || !ui.sheet) {
    overlay.innerHTML = '';
    return;
  }
  if (ui.sheet.type === 'player') overlay.innerHTML = renderPlayerSheet(state, ui.sheet.id);
  else if (ui.sheet.type === 'sign') overlay.innerHTML = renderSignSheet(state, ui.sheet.id);
  else if (ui.sheet.type === 'poach') overlay.innerHTML = renderPoachSheet(state, ui.sheet.id);
  else if (ui.sheet.type === 'news') overlay.innerHTML = renderNewsSheet();
  else if (ui.sheet.type === 'day') overlay.innerHTML = renderDaySheet(state, ui);
  else if (ui.sheet.type === 'event') overlay.innerHTML = renderEventSheet();
  else if (ui.sheet.type === 'summary') overlay.innerHTML = renderSummarySheet();
  else if (ui.sheet.type === 'text') overlay.innerHTML = renderTextSheet();
  else overlay.innerHTML = '';
}

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    ui.sheet = null;
    renderOverlay();
  }
});

/* ------------------------------------------------------------------ */
/* 事件委托                                                             */
/* ------------------------------------------------------------------ */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  handle(el.dataset.action, { id: el.dataset.id, key: el.dataset.key, el, dataset: el.dataset });
});

function handle(action, ctx) {
  switch (action) {
    case 'pick-team':
      ui.introTeam = ctx.id;
      ui.introInherit = ctx.id;
      render();
      break;
    case 'pick-inherit':
      ui.introInherit = ctx.id;
      render();
      break;
    case 'intro-mode':
      ui.introMode = ctx.key;
      render();
      break;
    case 'new-game':
      startNewGame();
      break;
    case 'resume-game':
      ui.atMenu = false;
      ui.screen = 'home';
      render();
      break;
    case 'exit-to-menu':
      ui.atMenu = true;
      ui.match = null;
      ui.sheet = null;
      render();
      break;
    case 'tab':
      switchTab(ctx.key);
      break;
    case 'start-year':
      state = startYear(state);
      save();
      toast(`${state.year} 赛季开始`);
      render();
      break;
    case 'end-week':
      doEndWeek();
      break;
    case 'prepare-match':
      openMatch();
      break;
    case 'quick-sim':
      doQuickSim();
      break;
    case 'next-year':
      state = startNextYear(state);
      save();
      toast(`${state.year} 季前准备开始`);
      ui.screen = 'home';
      render();
      break;
    case 'start-draft':
      beginDraft();
      break;
    case 'hero-filter':
      ui.match.heroFilter = ctx.key;
      render();
      break;
    case 'draft-pick':
      playerDraftPick(ctx.id);
      break;
    case 'auto-draft':
      autoCompleteDraft();
      break;
    case 'go-tactic': {
      const m = ui.match;
      if (!m || !m.draft) break;
      m.step = 'tactic';
      render();
      break;
    }
    case 'mm-mode': {
      ui.mmMode = ctx.dataset.mode || 'balanced';
      if (mm) mm.setMode(ui.mmMode);
      document.querySelectorAll('.mm-mode').forEach((b) => {
        b.classList.toggle('on', b.dataset.mode === ui.mmMode);
      });
      break;
    }
    case 'apply-update': {
      // 清理所有静态资源缓存 → 通知 SW 立即接管 → 刷新
      const done = () => location.reload();
      try {
        if (window.caches) {
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(async () => {
              const reg = await navigator.serviceWorker.getRegistration();
              reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
              done();
            })
            .catch(done);
        } else {
          done();
        }
      } catch (e) {
        done();
      }
      break;
    }
    case 'dismiss-update':
      ui.updateReady = false;
      render();
      break;
    case 'check-update': {
      if (!('serviceWorker' in navigator)) {
        toast('当前环境不支持更新检查', 'err');
        break;
      }
      toast('正在检查更新…');
      navigator.serviceWorker
        .getRegistration()
        .then(async (reg) => {
          if (!reg) {
            toast('离线缓存未启用，刷新页面后再试', 'err');
            return;
          }
          await reg.update();
          setTimeout(() => {
            if (reg.waiting || reg.installing) {
              ui.updateReady = true;
              render();
            } else {
              toast('已是最新版本');
            }
          }, 900);
        })
        .catch(() => toast('检查失败，请检查网络后重试', 'err'));
      break;
    }
    case 'live-decide': {
      const m = ui.match;
      if (!m || !m.live) break;
      m.live.decide(ctx.dataset.key);
      render();
      startLiveTicker();
      break;
    }
    case 'live-skip': {
      const m = ui.match;
      if (!m || !m.live) break;
      let guard = 0;
      while (!m.live.state.done && guard++ < 400) {
        if (m.live.state.pendingEvent) m.live.decide(m.live.state.pendingEvent.options[0].key);
        else m.live.tick();
      }
      render();
      break;
    }
    case 'live-result': {
      const m = ui.match;
      if (!m || !m.live) break;
      stopLiveTicker();
      const res = m.live.finish();
      const r = playOneGame(state, m.match, m.comp, m.opponentId, m.draft, m.tactic, m.series.gameIndex, m.series, res);
      if (!r.ok) {
        toast(r.reason, 'err');
        break;
      }
      m.series.gameIndex += 1;
      m.lastGame = r;
      m.step = 'game-result';
      m.live = null;
      save();
      render();
      break;
    }
    case 'next-game': {
      const m = ui.match;
      if (!m || !m.series) break;
      if (m.series.done) {
        const result = settlePlayerSeries(state, m.series, m.match, m.comp, m.opponentId);
        m.result = {
          series: result.series,
          playerWon: result.playerWon,
          opponentId: result.opponentId,
          comp: result.comp
        };
        m.step = 'result';
        save();
        render();
        break;
      }
      const draft = createDraft({
        blueTeamId: state.playerTeamId,
        redTeamId: m.opponentId,
        playerSide: 'blue',
        meta: state.meta,
        globalUsed: m.series.used
      });
      m.draft = draft;
      m.nodes = rollTacticNodes(state.rng, 3);
      m.peakDuel = rollPeakHeroes(state.rng);
      m.tactic = { choices: {} };
      m.swapSrc = null;
      m.mmWinner = null;
      m.step = 'draft';
      render();
      pumpDraft();
      break;
    }
    case 'choose-tactic':
      ui.match.tactic.choices[ctx.dataset.node] = ctx.key;
      render();
      break;
    case 'peak-reroll':
      ui.match.peakDuel = rollPeakHeroes(state.rng);
      render();
      break;
    case 'fmvp-player':
      ui.fmvpSel = { ...(ui.fmvpSel || {}), playerId: ctx.id, heroId: null };
      render();
      break;
    case 'fmvp-hero':
      ui.fmvpSel = { ...(ui.fmvpSel || {}), heroId: ctx.id };
      render();
      break;
    case 'confirm-fmvp': {
      if (!ui.fmvpSel?.playerId || !ui.fmvpSel?.heroId) break;
      const res = chooseFmvp(state, ui.fmvpSel.playerId, ui.fmvpSel.heroId);
      if (res.ok) {
        ui.fmvpSel = null;
        save();
        toast(`${res.record.playerName} 当选 FMVP`);
        render();
      }
      break;
    }
    case 'play-match':
      playMatch();
      break;
    case 'back-to-draft':
      ui.match.step = 'draft';
      render();
      break;
    case 'finish-match':
      finishMatch();
      break;
    case 'leave-match':
      ui.match = null;
      switchTab('home');
      break;
    case 'schedule-comp':
      ui.scheduleCompId = ctx.id;
      render();
      break;
    case 'schedule-group':
      ui.scheduleGroup = ctx.key;
      render();
      break;
    case 'schedule-tab':
      ui.scheduleTab = ctx.key;
      render();
      break;
    case 'calendar-prev':
      ui.calendarMonth = shiftMonth(ui.calendarMonth || monthOf(weekDate(state.week)), -1);
      render();
      break;
    case 'calendar-next':
      ui.calendarMonth = shiftMonth(ui.calendarMonth || monthOf(weekDate(state.week)), 1);
      render();
      break;
    case 'calendar-day':
      ui.sheet = { type: 'day', date: ctx.dataset.date };
      render();
      break;
    case 'open-competition':
      ui.scheduleCompId = ctx.id;
      ui.screen = 'schedule';
      render();
      break;
    case 'open-news':
      ui.sheet = { type: 'news', id: ctx.id };
      renderOverlay();
      break;
    case 'goto-transfer':
      switchTab('transfer');
      break;
    case 'player-detail':
      ui.sheet = { type: 'player', id: ctx.id };
      renderOverlay();
      break;
    case 'close-sheet':
      ui.sheet = null;
      renderOverlay();
      break;
    case 'set-training':
      setTraining(ctx.id, ctx.key);
      break;
    case 'set-starter':
      changeStarter(ctx.id, true);
      break;
    case 'set-bench':
      changeStarter(ctx.id, false);
      break;
    case 'transfer-tab':
      ui.transferTab = ctx.key;
      render();
      break;
    case 'poach-region':
      ui.poachRegion = ctx.key;
      render();
      break;
    case 'open-poach':
      ui.sheet = { type: 'poach', id: ctx.id };
      renderOverlay();
      break;
    case 'do-poach':
      doPoach(ctx.id);
      break;
    case 'open-sign':
      ui.sheet = { type: 'sign', id: ctx.id };
      renderOverlay();
      break;
    case 'sign-player':
      doSign(ctx.id, ctx.dataset.tier);
      break;
    case 'sign-prospect':
      doSignProspect(ctx.id);
      break;
    case 'scout':
      doScout();
      break;
    case 'release':
      doRelease(ctx.id);
      break;
    case 'renew':
      doRenew(ctx.id);
      break;
    case 'upgrade-facility':
      upgradeFacility(ctx.key);
      break;
    case 'export-save':
      doExport();
      break;
    case 'import-save':
      doImport();
      break;
    case 'delete-save':
      doDelete();
      break;
    case 'season-summary':
      ui.sheet = { type: 'summary' };
      renderOverlay();
      break;
    case 'resolve-event':
      doResolveEvent(ctx.key);
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* 动作                                                                 */
/* ------------------------------------------------------------------ */

function startNewGame() {
  if (state && !confirm('开始新游戏会覆盖当前存档，确定吗？')) return;
  const name = document.getElementById('coach-name')?.value?.trim() || '经理';
  if (ui.introMode === 'custom') {
    const teamName = document.getElementById('team-name')?.value?.trim();
    if (!teamName) {
      toast('请填写战队名称', 'err');
      return;
    }
    const short = (document.getElementById('team-short')?.value?.trim() || teamName.slice(0, 3)).toUpperCase();
    const color = document.getElementById('team-color')?.value || '#2ee6c8';
    state = newGame({
      teamId: ui.introInherit || 'ig',
      playerName: name,
      customTeam: { name: teamName, short, color }
    });
  } else {
    state = newGame({ teamId: ui.introTeam, playerName: name });
  }
  ui.screen = 'home';
  ui.atMenu = false;
  ui.scheduleCompId = null;
  save();
  toast(`欢迎来到 ${playerTeam(state).name}`);
  render();
}

function switchTab(key) {
  if (key === 'match') {
    ui.match = null;
  }
  if (key === 'schedule' && !ui.scheduleCompId) {
    ui.scheduleCompId = state.activeCompetitionId;
  }
  ui.screen = key;
  render();
}

function openMatch() {
  const prep = prepareMatch(state);
  if (!prep.ok) {
    toast(prep.reason, 'err');
    return;
  }
  ui.screen = 'match';
  ui.match = null;
  render();
}

function doEndWeek() {
  const gate = canEndWeek(state);
  if (!gate.ok) {
    toast(gate.reason, 'err');
    return;
  }
  const before = state.activeCompetitionId;
  const res = endWeek(state);
  if (!res.ok) {
    toast(res.reason, 'err');
    return;
  }
  save();
  if (state.activeCompetitionId && state.activeCompetitionId !== before) {
    const spec = COMPETITION_BY_ID[state.activeCompetitionId];
    if (spec) celebrate(spec);
  }
  if (state.phase === 'offseason') {
    toast(`${state.year} 赛季结束`);
  } else {
    const comp = currentCompetition(state);
    toast(`${weekLabel(state.week)} · ${comp ? comp.short : '休赛期'}`);
  }
  ui.screen = 'home';
  render();
}

let celebrationTimer = null;

function celebrate(spec) {
  if (celebrationTimer) clearTimeout(celebrationTimer);
  ui.celebration = {
    title: spec.name,
    sub: `${eventDateLabel(spec)} · ${spec.type === 'lpl' ? 'LPL' : '国际赛事'}`
  };
  celebrationTimer = setTimeout(() => {
    ui.celebration = null;
    celebrationTimer = null;
    if (ui.screen === 'home' && state) render();
  }, 2800);
}

function renderCelebration() {
  const c = ui.celebration;
  if (!c) return '';
  return `<div class="comp-banner">
    <div class="comp-banner-kicker">赛事开幕</div>
    <div class="comp-banner-title">${c.title}</div>
    <div class="comp-banner-sub">${c.sub}</div>
  </div>`;
}

// 新版本提示：要求刷新并清理旧缓存
function renderUpdateModal() {
  if (!ui.updateReady) return '';
  return `<div class="update-mask">
    <div class="update-card">
      <div class="uc-title">发现新版本</div>
      <p class="uc-desc">游戏已更新到新版本，需要刷新并清理旧缓存才能生效（存档不受影响）。</p>
      <div class="uc-actions">
        <button class="btn" data-action="apply-update">立即更新</button>
        <button class="btn ghost" data-action="dismiss-update">稍后</button>
      </div>
    </div>
  </div>`;
}

function renderFmvpModal() {
  if (!state?.pendingFmvp) return '';
  const pending = state.pendingFmvp;
  const players = pending.candidates
    .map((id) => state.players.find((p) => p.id === id))
    .filter(Boolean);
  const sel = ui.fmvpSel || {};
  const chosen = players.find((p) => p.id === sel.playerId);
  const heroes = (chosen?.champions || []).map((id) => HERO_BY_ID[id]).filter(Boolean);

  return `<div class="fmvp-mask">
    <div class="card fmvp-card">
      <div class="card-title"><span class="k">🏅 评选 FMVP</span><span class="v">${esc(pending.compName)}</span></div>
      <p class="tiny muted" style="margin-bottom:10px">选出决赛最有价值选手，并指定一个代表英雄。</p>
      <div class="section-label" style="margin-bottom:6px">选手</div>
      <div class="wrap">
        ${players.map((p) => `<button class="chip ${sel.playerId === p.id ? 'gold' : ''}" data-action="fmvp-player" data-id="${p.id}">${esc(p.name)}</button>`).join('')}
      </div>
      ${chosen ? `<div class="section-label" style="margin:12px 0 6px">代表英雄</div>
        <div class="wrap">
          ${heroes.map((h) => `<button class="chip ${sel.heroId === h.id ? 'gold' : ''}" data-action="fmvp-hero" data-id="${h.id}">${esc(h.name)}</button>`).join('')}
        </div>` : ''}
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-action="confirm-fmvp" ${sel.playerId && sel.heroId ? '' : 'disabled'}>
        ${sel.playerId && sel.heroId ? '确认 FMVP' : '先选选手和英雄'}
      </button>
    </div>
  </div>`;
}

function doQuickSim() {
  const res = quickSimPlayerMatches(state);
  if (!res.ok) {
    toast(res.reason, 'err');
    return;
  }
  save();
  toast(`快速模拟了 ${res.count} 场`);
  render();
}

function beginDraft() {
  const info = prepareMatch(state);
  if (!info.ok) {
    toast(info.reason, 'err');
    return;
  }
  const draft = createDraft({
    blueTeamId: state.playerTeamId,
    redTeamId: info.opponentId,
    playerSide: 'blue',
    meta: state.meta
  });
  const bo = info.comp.stage === 'playoff' ? MATCH.playoffBo : MATCH.regularBo;
  ui.match = {
    step: 'draft',
    draft,
    comp: info.comp,
    match: info.match,
    opponentId: info.opponentId,
    series: { bo, need: Math.ceil(bo / 2), winsA: 0, winsB: 0, games: [], used: [], gameIndex: 0, done: false },
    nodes: rollTacticNodes(state.rng, 3),
    peakDuel: rollPeakHeroes(state.rng),
    tactic: { choices: {} },
    heroFilter: ui.match?.heroFilter || 'ALL',
    busy: false
  };
  render();
  pumpDraft();
}

function pumpDraft() {
  if (!ui.match || ui.match.step !== 'draft') return;
  const d = ui.match.draft;
  const turn = currentTurn(d);
  if (!turn) {
    // BP 全部结束：停留 BP 板，玩家换完位后点「确认阵容」进入比赛
    ui.match.busy = false;
    render();
    return;
  }
  if (turn.side === d.playerSide || ui.match.busy) return;
  ui.match.busy = true;
  setTimeout(() => {
    const t = currentTurn(d);
    if (!t) {
      ui.match.busy = false;
      render();
      return;
    }
    const id = t.type === 'ban' ? aiBan(d, state.rng, state.players) : aiPick(d, state.rng, state.players);
    if (id) applyAction(d, id);
    ui.match.busy = false;
    render();
    pumpDraft();
  }, 850);
}

function playerDraftPick(heroId) {
  if (!ui.match || ui.match.busy) return;
  const d = ui.match.draft;
  const turn = currentTurn(d);
  if (!turn || turn.side !== d.playerSide) return;
  if (!applyAction(d, heroId)) return;
  render();
  pumpDraft();
}

function autoCompleteDraft() {
  if (!ui.match) return;
  const d = ui.match.draft;
  let guard = 0;
  while (currentTurn(d) && guard++ < 20) {
    const t = currentTurn(d);
    const id = t.type === 'ban' ? aiBan(d, state.rng, state.players) : aiPick(d, state.rng, state.players);
    if (!id) break;
    applyAction(d, id);
  }
  // 停在 BP 板：留给玩家手动调整英雄位置（点击两位选手交换英雄），换完再点「开始比赛」
  render();
}

function playMatch() {
  const m = ui.match;
  if (!m || !m.draft) return;
  const res = playOneGame(state, m.match, m.comp, m.opponentId, m.draft, {
    nodes: m.nodes,
    choices: m.tactic.choices,
    peakDuel: { blue: m.peakDuel },
    mmWinner: m.mmWinner || null
  }, m.series.gameIndex, m.series);
  if (!res.ok) {
    toast(res.reason, 'err');
    return;
  }
  m.series.gameIndex += 1;
  m.lastGame = res;
  m.swapSrc = null;
  m.step = 'game-result';
  save();
  render();
}

function finishMatch() {
  ui.match = null;
  const ev = checkEvent(state);
  if (ev) {
    ui.sheet = { type: 'event' };
    ui.screen = 'home';
    render();
    return;
  }
  ui.screen = 'home';
  render();
}

function setTraining(playerId, key) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || p.teamId !== state.playerTeamId) return;
  p.trainingFocus = key;
  save();
  ui.sheet = { type: 'player', id: playerId };
  render();
  toast('训练方向已更新');
}

function changeStarter(playerId, starter) {
  const res = setStarter(state, playerId, starter);
  if (!res.ok) {
    toast(res.reason, 'err');
    return;
  }
  save();
  ui.sheet = { type: 'player', id: playerId };
  render();
}

function doSign(freeAgentId, tier) {
  const res = signPlayer(state, freeAgentId, tier);
  if (!res.ok) {
    toast(res.reason, 'err');
    render();
    return;
  }
  tickMarket(state);
  save();
  ui.sheet = null;
  toast(`签下 ${res.player.name}`);
  render();
}

function doSignProspect(id) {
  const res = signProspect(state, id);
  if (!res.ok) {
    toast(res.reason, 'err');
    return;
  }
  save();
  toast(`青训签下 ${res.player.name}`);
  render();
}

function doScout() {
  const res = scoutProspects(state);
  if (!res.ok) {
    toast(res.reason, 'err');
    return;
  }
  save();
  toast(`球探带回了 ${res.prospects.length} 名新人`);
  render();
}

function doPoach(playerId) {
  const res = poachPlayer(state, playerId);
  if (!res.ok) {
    toast(res.reason, 'err');
    render();
    return;
  }
  save();
  ui.sheet = null;
  toast(`挖来 ${res.player.name}，违约金 ${money(res.fee)}`);
  render();
}

function doRelease(playerId) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return;
  if (!confirm(`确定出售 ${p.name}？将获得约 ${money(p.value * 0.9)}。`)) return;
  const res = releasePlayer(state, playerId);
  if (!res.ok) {
    toast(res.reason, 'err');
    return;
  }
  tickMarket(state);
  save();
  toast(`出售 ${p.name}，收入 ${money(res.fee)}`);
  render();
}

function doRenew(playerId) {
  const res = renewContract(state, playerId);
  if (!res.ok) {
    toast(res.reason, 'err');
    return;
  }
  save();
  toast(`续约完成，新薪资 ${money(res.salary)}`);
  render();
}

function upgradeFacility(key) {
  const team = playerTeam(state);
  const def = FACILITIES[key];
  const level = team.facilities[key];
  if (level >= MAX_FACILITY_LEVEL) return;
  const cost = facilityUpgradeCost(team, key);
  if (state.cash < cost) {
    toast('资金不足', 'err');
    return;
  }
  state.cash -= cost;
  team.facilities[key] += 1;
  save();
  toast(`${def.name} 升级到 Lv.${team.facilities[key]}`);
  render();
}

function doResolveEvent(choiceKey) {
  const res = resolveEvent(state, choiceKey);
  if (!res.ok) return;
  ui.sheet = null;
  save();
  toast('事件已处理');
  render();
  if (res.text) showText('事件结果', res.text);
}

/* ------------------------------------------------------------------ */
/* 存档                                                                 */
/* ------------------------------------------------------------------ */

function save() {
  if (!state) return;
  saveGame(state);
}

function doExport() {
  try {
    const text = exportSave(state);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('存档文本已复制到剪贴板'),
        () => showText('存档文本', text)
      );
    } else {
      showText('存档文本', text);
    }
  } catch (err) {
    toast('导出失败', 'err');
  }
}

function doImport() {
  const text = prompt('粘贴存档文本：');
  if (!text) return;
  try {
    state = importSave(text);
    save();
    ui.screen = 'home';
    ui.match = null;
    toast('存档已导入');
    render();
  } catch (err) {
    toast('存档格式不正确', 'err');
  }
}

function doDelete() {
  if (!confirm('确定删除存档并重新开始？此操作不可撤销。')) return;
  clearSave();
  state = null;
  ui = { ...ui, screen: 'home', atMenu: false, match: null, sheet: null };
  render();
}

/* ------------------------------------------------------------------ */
/* 弹层内容                                                             */
/* ------------------------------------------------------------------ */

function renderEventSheet() {
  const ev = state.pendingEvent;
  if (!ev) return '';
  return `<div class="sheet">
    <div class="grab"></div>
    <div class="row" style="margin-bottom:8px">
      <h2>${esc(ev.icon)} ${esc(ev.title)}</h2>
      <span class="chip gold">事件</span>
    </div>
    <p class="small dim" style="line-height:1.7;margin-bottom:14px">${esc(ev.desc)}</p>
    <div class="stack-sm">
      ${ev.options.map((o) => `<button class="decision" data-action="resolve-event" data-key="${o.key}">
        <div class="dh"><span style="font-weight:700">${esc(o.label)}</span></div>
        <div class="dd">${esc(o.desc)}</div>
      </button>`).join('')}
    </div>
  </div>`;
}

function renderNewsSheet() {
  const n = newsById(state, ui.sheet.id);
  if (!n) return '';
  const t = NEWS_TYPES[n.type] || NEWS_TYPES.league;
  return `<div class="sheet">
    <div class="grab"></div>
    <div class="row" style="margin-bottom:8px">
      <h2>${t.icon} ${esc(n.title)}</h2>
      <span class="chip ${t.tone}">${t.label}</span>
    </div>
    <div class="sheet-sub">${n.season} 赛季 · 第 ${n.week} 周</div>
    <p class="small dim news-body">${esc(n.body)}</p>
    ${n.caster ? `<div class="caster-note">
      <span class="avatar sm">${esc(n.caster.name[0])}</span>
      <div class="grow">
        <div class="caster-name">${esc(n.caster.name)} <span class="chip gold" style="font-size:9px;padding:1px 6px">解说席</span></div>
        <p class="caster-quote">“${esc(n.caster.text)}”</p>
      </div>
    </div>` : ''}
    <button class="btn btn-block" style="margin-top:16px" data-action="close-sheet">关闭</button>
  </div>`;
}

function renderSummarySheet() {  const s = state.lastSeasonSummary;
  if (!s) return '';
  const st = s.settlement;
  return `<div class="sheet">
    <div class="grab"></div>
    <h2>${s.year} 赛季结算</h2>
    <div class="sheet-sub">全年 ${s.wins} 胜 ${s.losses} 负 · 冠军 ${s.titles} 个</div>
    <div class="card tight" style="margin-bottom:12px">
      ${st.items.map((i) => `<div class="kv">
        <span class="k">${esc(i.label)}</span>
        <span class="v" style="color:${i.kind === 'income' ? 'var(--green)' : 'var(--red)'}">
          ${i.amount >= 0 ? '+' : ''}${money(i.amount)}
        </span>
      </div>`).join('')}
      <div class="kv" style="border-top:1px solid var(--line);margin-top:4px;padding-top:8px">
        <span class="k" style="font-weight:700">净收支</span>
        <span class="v" style="color:${st.net >= 0 ? 'var(--green)' : 'var(--red)'};font-size:16px">${st.net >= 0 ? '+' : ''}${money(st.net)}</span>
      </div>
    </div>
    <button class="btn btn-primary btn-block" data-action="close-sheet">知道了</button>
  </div>`;
}

function renderTextSheet() {
  return `<div class="sheet">
    <div class="grab"></div>
    <h2>${esc(ui.sheet.title || '')}</h2>
    <div class="sheet-sub">长按全选复制</div>
    <textarea class="card" style="width:100%;height:180px;resize:none;font-size:12px;font-family:monospace" readonly>${esc(ui.sheet.text || '')}</textarea>
    <button class="btn btn-block" style="margin-top:12px" data-action="close-sheet">关闭</button>
  </div>`;
}

function showText(title, text) {
  ui.sheet = { type: 'text', title, text };
  renderOverlay();
}

/* ------------------------------------------------------------------ */
/* toast                                                                */
/* ------------------------------------------------------------------ */

function toast(message, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  toasts.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

boot();

// BP 槽位归位完成 → 重绘（render 末尾会检测 laneLocked 并自动进入观战）
window.addEventListener('bp-lane-locked', () => {
  if (state && ui.match) render();
});

// BP 板吸顶压缩：往下滚进英雄池选人时收起 10 个槽位，只留 Ban 区 + 状态条，避免遮住英雄池
window.addEventListener(
  'scroll',
  () => {
    const el = document.querySelector('.bp-sticky');
    if (el) el.classList.toggle('compact', window.scrollY > 130);
  },
  { passive: true }
);

// 启动即后台预加载全部英雄头像：Service Worker 对 /assets/heroes/ 是缓存优先，
// 这次下载完成后存进缓存，之后进入 BP/小地图都不用再走网络。
if (typeof window !== 'undefined') {
  for (const h of HEROES) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `./assets/heroes/${h.id}.jpg`;
  }
}
