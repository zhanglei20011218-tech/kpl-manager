import { createRng, hashString } from './rng.js';
import { ALL_TEAMS, LPL_TEAMS, buildInitialPlayers, buildMarket, buildProspect, buildFreeAgent, startersOf, squadOf } from '../data/teams.js';
import { HEROES_BY_ROLE, HERO_BY_ID } from '../data/heroes.js';
import { generateSeasonMeta, createDraft, aiBan, aiPick, currentTurn, applyAction } from './match-draft.js';
import { simulateSeries, simulateGame } from './match.js';
import { computeTeamPower, teamConsistency } from './power.js';
import { developPlayer, shouldRetire, applyTraining, playerValue, salaryFromValue, currentAbility, formatMoney } from './player.js';
import { generateMarket, tickMarket, squadWarning, simulateAiTransfers } from './transfer.js';
import { settleSeason, salaryCapStatus } from './economy.js';
import {
  CALENDAR,
  COMPETITION_BY_ID,
  competitionForWeek,
  ensureYearEvents,
  weekLabel
} from './calendar.js';
import {
  createCompetition,
  matchesForWeek,
  isRegularComplete,
  isCompetitionDone,
  recordResult,
  startPlayoffs,
  startGroupKnockout,
  competitionStandings,
  competitionRank,
  intlTeamsFor,
  swissNextRound
} from './competition.js';
import { sortStandings } from './league.js';
import { checkEvent, resetSeasonFlags } from './events.js';
import { buildMatchStats, applyMatchStats, generateGameScoreboard } from './stats.js';
import { addNews, seedOpeningNews, addMatchNews, addTitleNews } from './news.js';
import { MATCH, ECONOMY, TRAINING, SCOUT } from '../data/constants.js';

export const SAVE_VERSION = 2;

/* ------------------------------------------------------------------ */
/* 新游戏                                                               */
/* ------------------------------------------------------------------ */

export function newGame({ teamId = 'ag', playerName = '教练', seed = Date.now() >>> 0, customTeam = null } = {}) {
  const rng = createRng(seed);
  const { players, duos } = buildInitialPlayers(hashString(String(seed)));

  const teams = ALL_TEAMS.map((t) => {
    const base = { ...t, facilities: { training: 1, analysis: 1, dorm: 1 } };
    if (customTeam && t.id === teamId) {
      return {
        ...base,
        name: customTeam.name,
        short: customTeam.short,
        cn: customTeam.name,
        color: customTeam.color,
        custom: true,
        inheritFrom: t.id
      };
    }
    return base;
  });

  const state = {
    version: SAVE_VERSION,
    seed,
    year: 2025,
    week: 1,
    playerTeamId: teamId,
    playerName,
    customTeam: customTeam || null,
    cash: ECONOMY.startCash,
    teams,
    players,
    duos,
    market: [],
    prospects: [],
    scoutRemaining: 2,
    meta: generateSeasonMeta(rng),
    phase: 'preseason',
    competitions: {},
    activeCompetitionId: null,
    playerResults: [],
    recentResults: [],
    teamStats: {},
    news: [],
    newsSeq: 0,
    seenEvents: {},
    pendingEvent: null,
    log: [],
    rng,
    lastSettlement: null,
    lastSeasonSummary: null,
    titleCount: 0,
    honors: [],
    fmvp: null,
    fmvpList: [],
    pendingFmvp: null,
    awards: null,
    awardsList: [],
    yearHistory: [],
    matchCount: 0
  };

  ensureStarters(state, teamId);
  state.market = generateMarket(rng, state.players, teamId);
  state.phase = 'preseason';
  for (const p of state.players) setDefaultTraining(p);
  seedOpeningNews(state);
  return state;
}

function ensureStarters(state, teamId) {
  const squad = squadOf(state.players, teamId);
  for (const role of ['TOP', 'JUG', 'MID', 'ADC', 'SUP']) {
    const cands = squad.filter((p) => p.role === role).sort((a, b) => currentAbility(b) - currentAbility(a));
    const starter = cands[0];
    if (!starter) continue;
    if (!starter.isStarter) {
      const current = squad.find((p) => p.isStarter && p.role === role);
      if (current) current.isStarter = false;
      starter.isStarter = true;
    }
  }
}

function setDefaultTraining(p) {
  if (p.trainingFocus) return;
  const map = { TOP: 'mechanics', JUG: 'gameSense', MID: 'mechanics', ADC: 'mechanics', SUP: 'gameSense' };
  p.trainingFocus = map[p.role];
}

/* ------------------------------------------------------------------ */
/* 年度 / 赛事推进                                                       */
/* ------------------------------------------------------------------ */

export function startYear(state) {
  state.year = 2025;
  state.week = 1;
  state.competitions = {};
  state.activeCompetitionId = null;
  state.playerResults = [];
  state.recentResults = [];
  state.phase = 'season';
  state.titleCount = 0;
  state.yearHistory = [];
  state.teamStats = {};
  startCompetition(state, CALENDAR[0]);
  seedOpeningNews(state);
  return state;
}

function ensureCompetition(state, spec) {
  if (state.competitions[spec.id]) return state.competitions[spec.id];
  const teams = spec.type === 'lpl'
    ? (spec.teams && spec.teams.length ? spec.teams.slice() : LPL_TEAMS.map((t) => t.id))
    : spec.type === 'regional'
      ? spec.teams.slice()
      : resolveIntlTeams(state, spec);
  const comp = createCompetition(spec, teams, state.rng);
  comp.playerIn = teams.includes(state.playerTeamId);
  comp.spec = spec;
  state.competitions[spec.id] = comp;
  if (!comp.playerIn && spec.type !== 'regional') {
    autoSimCompetition(state, comp);
  }
  return comp;
}

function startCompetition(state, spec) {
  const comp = ensureCompetition(state, spec);
  state.activeCompetitionId = spec.id;
  state.week = Math.max(state.week, spec.startWeek);
  state.year = spec.season;
  state.phase = 'season';
  return comp;
}

function resolveIntlTeams(state, spec) {
  if (spec.teams && spec.teams.length) return spec.teams.slice();
  const qualified = lplQualifiedFor(state, spec.qualifier);
  const teams = intlTeamsFor(spec.id, qualified);
  return [...new Set(teams)];
}

function lplQualifiedFor(state, qualifier) {
  if (!qualifier) return [];
  // 年度积分前 8：春季赛 + 夏季赛累计
  if (qualifier.startsWith('year-points-')) {
    const year = Number(qualifier.split('-').pop());
    return yearPointsOf(state, year).slice(0, 8).map((x) => x.teamId);
  }
  // 挑战者杯：KPL 前 8 + K甲前 8（含主播队、全国大赛、外卡）
  if (qualifier.startsWith('challenger-')) {
    const year = Number(qualifier.split('-').pop());
    const kpl = yearPointsOf(state, year).slice(0, 8);
    const kjia = yearPointsOf(state, year, 'kjia-').slice(0, 8);
    return [...kpl, ...kjia].map((x) => x.teamId);
  }
  const parts = qualifier.split('-');
  const rule = parts.pop();
  const compId = parts.join('-');
  const comp = state.competitions[compId];
  if (!comp) return [];
  if (rule === 'champion') return comp.champion ? [comp.champion] : [];
  if (rule === 'top2') {
    const standings = comp.standings ? sortStandings(comp.standings) : [];
    return standings.slice(0, 2).map((s) => s.teamId);
  }
  if (rule === 'top4') {
    const standings = comp.standings ? sortStandings(comp.standings) : [];
    return standings.slice(0, 4).map((s) => s.teamId);
  }
  if (rule === 'top8') {
    if (comp.playoff) return comp.teams.slice(0, 8);
    const standings = comp.standings ? sortStandings(comp.standings) : [];
    return standings.slice(0, 8).map((s) => s.teamId);
  }
  return [];
}

export function currentCompetition(state) {
  if (!state.activeCompetitionId) return null;
  return state.competitions[state.activeCompetitionId] || null;
}

export function currentCompetitionSpec(state) {
  return COMPETITION_BY_ID[state.activeCompetitionId] || null;
}

/** 本周玩家尚未完成的比赛 */
export function playerMatchesThisWeek(state) {
  const comp = currentCompetition(state);
  if (!comp || !comp.playerIn) return [];
  const matches = matchesForWeek(comp, state.week);
  return matches.filter(
    (m) =>
      !m.result &&
      (m.home === state.playerTeamId || m.away === state.playerTeamId) &&
      comp.teams.includes(state.playerTeamId)
  );
}

export function prepareMatch(state) {
  if (state.phase !== 'season') return { ok: false, reason: '当前不是赛季进行中' };
  const comp = currentCompetition(state);
  if (!comp) return { ok: false, reason: '当前没有进行中的赛事' };
  if (!comp.playerIn) return { ok: false, reason: `未获得${comp.name}参赛资格` };

  const ready = squadWarning(state);
  if (!ready.ok) return { ok: false, reason: '首发阵容不完整，请先调整阵容' };

  const list = playerMatchesThisWeek(state);
  if (!list.length) {
    return { ok: false, reason: '本周比赛已全部结束，可以结算本周' };
  }
  const match = list[0];
  return {
    ok: true,
    match,
    comp,
    opponentId: match.home === state.playerTeamId ? match.away : match.home,
    isHome: match.home === state.playerTeamId,
    remaining: list.length
  };
}

/** 逐局全局 BP：模拟系列赛中的一局（teamA=玩家=blue 侧） */
export function playOneGame(state, match, comp, opponentId, draft, tactic, gameIndex, seriesState, liveResult) {
  const game = simulateGame({
    players: state.players,
    teamAId: state.playerTeamId,
    teamBId: opponentId,
    draft,
    tactic: { ...(tactic || {}), fmvp: state.fmvp || null },
    rng: state.rng,
    gameIndex,
    bo: seriesState.bo,
    duos: state.duos,
    mmBias: tactic?.mmWinner || null
  });
  // 观战模式：用实时引擎的结果覆盖一次性模拟
  if (liveResult) {
    const blueWon = liveResult.winnerSide === 'blue';
    game.winner = blueWon ? state.playerTeamId : opponentId;
    game.winSide = liveResult.winnerSide;
    game.score = { blue: liveResult.score.blue, red: liveResult.score.red };
    game.log = [...(liveResult.log || []), `最终比分：${liveResult.score.blue} - ${liveResult.score.red}`];
    game.liveTicks = liveResult.ticks;
  }
  // 单局十人记分板：KDA + 英雄（英雄按选手位置直配）
  const roleOrder = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];
  const sortRole = (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
  const pickOf = (side, role) => (draft.picks[side] || [])[roleOrder.indexOf(role)] || '';
  const boardSide = (side, myKills, oppKills) => {
    const teamId = side === 'blue' ? state.playerTeamId : opponentId;
    const oppId2 = side === 'blue' ? opponentId : state.playerTeamId;
    const lineup = startersOf(state.players, teamId).slice().sort(sortRole);
    const kda = generateGameScoreboard(state.players, teamId, oppId2, myKills, oppKills, state.rng);
    const map = new Map(kda.map((x) => [x.playerId, x]));
    return lineup.map((p) => {
      const k = map.get(p.id) || { kills: 0, deaths: 0, assists: 0 };
      return { playerId: p.id, name: p.name, role: p.role, heroId: pickOf(side, p.role), kills: k.kills, deaths: k.deaths, assists: k.assists };
    });
  };
  game.board = {
    blue: boardSide('blue', game.score.blue, game.score.red),
    red: boardSide('red', game.score.red, game.score.blue)
  };

  const won = game.winner === 'blue';
  if (won) seriesState.winsA += 1;
  else seriesState.winsB += 1;
  seriesState.games.push(game);
  // 全局 BP：本局双方选过的英雄进入禁用池，后续局不能再选
  for (const id of [...(draft.picks.blue || []), ...(draft.picks.red || [])]) {
    if (!seriesState.used.includes(id)) seriesState.used.push(id);
  }
  seriesState.done = seriesState.winsA >= seriesState.need || seriesState.winsB >= seriesState.need;
  return { ok: true, game, won };
}

/** 系列赛结束后的结算：比分、统计、赛事推进 */
export function settlePlayerSeries(state, seriesState, match, comp, opponentId) {
  const series = {
    games: seriesState.games,
    score: { blue: seriesState.winsA, red: seriesState.winsB },
    winner: seriesState.winsA > seriesState.winsB ? 'blue' : 'red'
  };
  const playerWon = series.winner === 'blue';
  const isHome = match.home === state.playerTeamId;
  recordResult(
    comp,
    match,
    playerWon ? state.playerTeamId : opponentId,
    isHome ? series.score.blue : series.score.red,
    isHome ? series.score.red : series.score.blue
  );
  const gameResults = series.games.map((g) => ({
    homeKills: match.home === state.playerTeamId ? g.score.blue : g.score.red,
    awayKills: match.home === state.playerTeamId ? g.score.red : g.score.blue
  }));
  const stats = buildMatchStats(state, match.home, match.away, gameResults, state.rng);
  applyMatchStats(state, match, stats, comp);
  state.recentResults.push(playerWon ? 'W' : 'L');
  state.matchCount += 1;
  updatePlayerStats(state, series, playerWon);
  state.playerResults.push({
    compId: comp.id,
    compName: comp.name,
    week: state.week,
    opponentId,
    won: playerWon,
    score: series.score,
    games: series.games.slice(0, 3),
    mvp: series.games[0]?.mvp || null
  });
  if (state.playerResults.length > 40) state.playerResults.shift();
  state.log.push({
    type: 'match',
    text: `${comp.short} 第 ${state.week} 周：${playerWon ? '战胜' : '不敌'} ${teamName(state, opponentId)}（${series.score.blue}-${series.score.red}）`
  });
  if (comp.stage === 'playoff' || comp.type === 'intl') {
    addMatchNews(state, {
      comp,
      match,
      playerTeamId: state.playerTeamId,
      playerWon,
      playerScore: series.score.blue,
      oppScore: series.score.red,
      mvpName: series.games.find((g) => g.winner === 'blue')?.mvp?.name
    });
  }
  checkCompetitionProgress(state, comp);
  return { ok: true, series, playerWon, opponentId, comp };
}

export function playPlayerMatch(state, draft, tactic) {
  const prep = prepareMatch(state);
  if (!prep.ok) return { ok: false, reason: prep.reason };

  const { match, comp } = prep;
  const bo = comp.stage === 'playoff' ? MATCH.playoffBo : MATCH.regularBo;
  const series = simulateSeries({
    players: state.players,
    teamAId: state.playerTeamId,
    teamBId: prep.opponentId,
    draft,
    tactic,
    rng: state.rng,
    bo,
    duos: state.duos,
    peakDuel: tactic?.peakDuel || null,
    mmBias: tactic?.mmWinner || null
  });

  const playerWon = series.winner === 'blue';
  const isHome = match.home === state.playerTeamId;
  const playerGames = series.score.blue;
  const oppGames = series.score.red;
  recordResult(
    comp,
    match,
    playerWon ? state.playerTeamId : prep.opponentId,
    isHome ? playerGames : oppGames,
    isHome ? oppGames : playerGames
  );

  const gameResults = series.games.map((g) => ({
    homeKills: match.home === state.playerTeamId ? g.score.blue : g.score.red,
    awayKills: match.home === state.playerTeamId ? g.score.red : g.score.blue
  }));
  const stats = buildMatchStats(state, match.home, match.away, gameResults, state.rng);
  applyMatchStats(state, match, stats, comp);

  state.recentResults.push(playerWon ? 'W' : 'L');
  state.matchCount += 1;
  updatePlayerStats(state, series, playerWon);
  state.playerResults.push({
    compId: comp.id,
    compName: comp.name,
    week: state.week,
    opponentId: prep.opponentId,
    won: playerWon,
    score: series.score,
    games: series.games.slice(0, 3),
    mvp: series.games[0]?.mvp || null
  });
  if (state.playerResults.length > 40) state.playerResults.shift();

  state.log.push({
    type: 'match',
    text: `${comp.short} 第 ${state.week} 周：${playerWon ? '战胜' : '不敌'} ${teamName(state, prep.opponentId)}（${series.score.blue}-${series.score.red}）`
  });

  if (comp.stage === 'playoff' || comp.type === 'intl') {
    addMatchNews(state, {
      comp,
      match,
      playerTeamId: state.playerTeamId,
      playerWon,
      playerScore: series.score.blue,
      oppScore: series.score.red,
      mvpName: series.games.find((g) => g.winner === 'blue')?.mvp?.name
    });
  }

  checkCompetitionProgress(state, comp);
  return { ok: true, series, playerWon, opponentId: prep.opponentId, comp };
}

/** 玩家让 AI 代打本周剩余比赛 */
export function quickSimPlayerMatches(state) {
  const comp = currentCompetition(state);
  if (!comp) return { ok: false, reason: '当前没有赛事' };
  const list = playerMatchesThisWeek(state);
  if (!list.length) return { ok: false, reason: '没有待打的比赛' };

  for (const m of list) {
    const homePower = computeTeamPower(state.players, m.home, state.duos).total;
    const awayPower = computeTeamPower(state.players, m.away, state.duos).total;
    const bo = comp.stage === 'playoff' ? MATCH.playoffBo : MATCH.regularBo;
    const need = Math.ceil(bo / 2);
    let hw = 0;
    let aw = 0;
    const gameResults = [];
    while (hw < need && aw < need) {
      const perfH = state.rng.gauss(homePower, MATCH.sigma);
      const perfA = state.rng.gauss(awayPower, MATCH.sigma);
      const margin = Math.abs(perfH - perfA);
      const winKills = Math.min(38, 8 + Math.round(margin * 0.55) + Math.floor(state.rng.float(2, 9)));
      const loseKills = Math.max(3, winKills - Math.floor(state.rng.float(4, 13)));
      if (perfH >= perfA) {
        hw += 1;
        gameResults.push({ homeKills: winKills, awayKills: loseKills });
      } else {
        aw += 1;
        gameResults.push({ homeKills: loseKills, awayKills: winKills });
      }
    }
    const stats = buildMatchStats(state, m.home, m.away, gameResults, state.rng);
    recordResult(comp, m, hw > aw ? m.home : m.away, hw, aw);
    applyMatchStats(state, m, stats, comp);
    const playerWon = hw > aw ? m.home === state.playerTeamId : m.away === state.playerTeamId;
    state.recentResults.push(playerWon ? 'W' : 'L');
    state.matchCount += 1;
    if (comp.stage === 'playoff' || comp.type === 'intl') {
      const side = m.home === state.playerTeamId ? 'home' : 'away';
      const top = (stats[side]?.players || []).slice().sort((a, b) => b.kills - a.kills)[0];
      const mvp = state.players.find((p) => p.id === top?.playerId);
      addMatchNews(state, {
        comp,
        match: m,
        playerTeamId: state.playerTeamId,
        playerWon,
        playerScore: m.home === state.playerTeamId ? hw : aw,
        oppScore: m.home === state.playerTeamId ? aw : hw,
        mvpName: mvp?.name
      });
    }
  }
  checkCompetitionProgress(state, comp);
  return { ok: true, count: list.length };
}

/* ------------------------------------------------------------------ */
/* 一周结算                                                             */
/* ------------------------------------------------------------------ */

export function canEndWeek(state) {
  const comp = currentCompetition(state);
  if (!comp) return { ok: true };
  if (!comp.playerIn) return { ok: true };
  const left = playerMatchesThisWeek(state);
  if (left.length) return { ok: false, reason: `还有 ${left.length} 场你自己的比赛没打` };
  return { ok: true };
}

export function endWeek(state) {
  const gate = canEndWeek(state);
  if (!gate.ok) return gate;

  // 本周所有赛事一起推进（赛区联赛自动模拟，LPL 的玩家比赛已由 canEndWeek 保证打完）
  for (const spec of CALENDAR) {
    if (state.week >= spec.startWeek && state.week <= spec.endWeek) {
      const comp = ensureCompetition(state, spec);
      simulateWeekAi(state, comp);
    }
  }

  state.week += 1;
  syncWithCalendar(state);
  return { ok: true, week: state.week };
}

function simulateWeekAi(state, comp) {
  const matches = matchesForWeek(comp, state.week);
  for (const m of matches) {
    if (m.result) continue;
    if (m.home === state.playerTeamId || m.away === state.playerTeamId) continue;
    simulateAiMatch(state, comp, m);
  }
  checkCompetitionProgress(state, comp);
}

function simulateAiMatch(state, comp, m) {
  const homePower = computeTeamPower(state.players, m.home, state.duos).total;
  const awayPower = computeTeamPower(state.players, m.away, state.duos).total;
  const bo = comp.stage === 'playoff' ? MATCH.playoffBo : MATCH.regularBo;
  const need = Math.ceil(bo / 2);
  let hw = 0;
  let aw = 0;
  const gameResults = [];

  while (hw < need && aw < need) {
    const perfH = state.rng.gauss(homePower, MATCH.sigma);
    const perfA = state.rng.gauss(awayPower, MATCH.sigma);
    const margin = Math.abs(perfH - perfA);
    const winKills = Math.min(38, 8 + Math.round(margin * 0.55) + Math.floor(state.rng.float(2, 9)));
    const loseKills = Math.max(3, winKills - Math.floor(state.rng.float(4, 13)));
    if (perfH >= perfA) {
      hw += 1;
      gameResults.push({ homeKills: winKills, awayKills: loseKills });
    } else {
      aw += 1;
      gameResults.push({ homeKills: loseKills, awayKills: winKills });
    }
  }

  const stats = buildMatchStats(state, m.home, m.away, gameResults, state.rng);
  recordResult(comp, m, hw > aw ? m.home : m.away, hw, aw);
  applyMatchStats(state, m, stats, comp);
}

function checkCompetitionProgress(state, comp) {
  if (!comp) return;

  if (comp.stage === 'swiss') {
    const round = comp.swiss.rounds[comp.swiss.rounds.length - 1];
    if (!round || round.matches.every((m) => m.result)) {
      const next = swissNextRound(comp);
      if (!next) startGroupKnockout(comp);
    }
  }

  if ((comp.stage === 'regular' || comp.stage === 'group') && isRegularComplete(comp)) {
    if (comp.groups) {
      startGroupKnockout(comp);
    } else if (comp.format === 'rr+playoff') {
      if (!comp.regularAwards) comp.regularAwards = computeStageAwards(state, comp);
      startPlayoffs(comp, comp.playoffSize || 8);
    } else if (comp.format === 'group+final') {
      comp.stage = 'playoff';
      const sorted = sortStandings(comp.standings);
      const seeds = sorted.slice(0, 2).map((s) => s.teamId);
      comp.playoff = {
        rounds: [{ index: 0, name: '决赛', matches: [{ home: seeds[0], away: seeds[1], result: null }] }],
        names: ['决赛'],
        champion: null
      };
    }
  }

  if (comp.playoff && comp.playoff.champion && !comp.champion) {
    comp.champion = comp.playoff.champion;
    const finalRound = comp.playoff.rounds[comp.playoff.rounds.length - 1];
    const finalMatch = finalRound.matches[0];
    comp.runnerUp = finalMatch
      ? finalMatch.home === comp.champion
        ? finalMatch.away
        : finalMatch.home
      : null;
    settleCompetition(state, comp);
  }
}

/** 国际赛玩家不参赛时，直接跑完 */
function autoSimCompetition(state, comp) {
  let guard = 0;
  while (!comp.champion && guard++ < 400) {
    if (comp.stage === 'regular') {
      for (const m of allMatchesSafe(comp)) {
        if (!m.result) simulateAiMatch(state, comp, m);
      }
      checkCompetitionProgress(state, comp);
    } else if (comp.playoff) {
      const pending = comp.playoff.rounds.flatMap((r) => r.matches).filter((m) => !m.result);
      if (!pending.length) break;
      for (const m of pending) simulateAiMatch(state, comp, m);
      checkCompetitionProgress(state, comp);
    } else {
      break;
    }
  }
}

function allMatchesSafe(comp) {
  if (comp.groups) return comp.groups.flatMap((g) => g.rounds.flatMap((r) => r.matches));
  if (comp.rounds) return comp.rounds.flatMap((r) => r.matches);
  return [];
}

function settleCompetition(state, comp) {
  const placement = placementOf(comp, state.playerTeamId);
  const prizeTable = comp.prize || {};
  const amount = (prizeTable[placement] || 0) * 10000;
  if (amount > 0) {
    state.cash += amount;
    state.log.push({
      type: 'prize',
      text: `${comp.name} ${placementLabel(placement)}，奖金 ${formatMoney(amount)}`
    });
  }
  if (comp.champion === state.playerTeamId) {
    state.titleCount += 1;
    state.honors = state.honors || [];
    state.honors.push({
      season: comp.season,
      compId: comp.id,
      name: comp.name,
      short: comp.short || comp.name,
      type: comp.type,
      week: state.week
    });

    // 年度总决赛 / 挑战者杯 / 亚运会夺冠后，选出一名 FMVP
    if (comp.type === 'intl' || String(comp.id).includes('challenger')) {
      const starters = startersOf(state.players, state.playerTeamId);
      state.pendingFmvp = {
        compId: comp.id,
        compName: comp.name,
        season: comp.season,
        candidates: starters.map((p) => p.id)
      };
    }
  }
  if (comp.champion) {
    const finalMatch = comp.playoff?.rounds.at(-1)?.matches[0];
    const finalScore = finalMatch?.result
      ? `${finalMatch.result.homeGames}-${finalMatch.result.awayGames}`
      : '';
    addTitleNews(state, {
      comp,
      championName: teamName(state, comp.champion),
      finalScore
    });
  }

  // 每个 LPL 赛段结束成长一次
  if (comp.type === 'lpl') {
    developAllPlayers(state);
  }
}

/** 选定 FMVP：选手 + 代表英雄 */
export function chooseFmvp(state, playerId, heroId) {
  if (!state.pendingFmvp) return { ok: false, reason: '没有待选的 FMVP' };
  const pending = state.pendingFmvp;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: '选手不存在' };
  const hero = HERO_BY_ID[heroId];
  if (!hero) return { ok: false, reason: '英雄不存在' };

  const record = {
    playerId,
    playerName: player.name,
    heroId,
    heroName: hero.name,
    compId: pending.compId,
    compName: pending.compName,
    season: pending.season
  };
  state.fmvp = record;
  state.fmvpList = state.fmvpList || [];
  state.fmvpList.push(record);
  state.pendingFmvp = null;

  addNews(state, {
    type: 'title',
    title: `${player.name} 当选 ${pending.compName} FMVP`,
    body: `代表英雄 ${hero.name}，${pending.season} 赛季的最高个人荣誉。`,
    season: pending.season,
    week: state.week
  });

  return { ok: true, record };
}

function placementOf(comp, teamId) {
  const p = comp.playoff;
  if (!p) return null;
  if (p.champion === teamId) return 'champion';
  let lastRound = -1;
  for (const r of p.rounds) {
    for (const m of r.matches) {
      if (m.result && m.result.winnerId !== teamId && (m.home === teamId || m.away === teamId)) {
        lastRound = r.index;
      }
    }
  }
  if (lastRound < 0) return null;
  const total = p.rounds.length;
  if (lastRound >= total - 1) return 'runnerUp';
  if (lastRound >= total - 2) return 'top4';
  return 'top8';
}

function placementLabel(p) {
  return { champion: '冠军', runnerUp: '亚军', top4: '四强', top8: '八强' }[p] || '参赛';
}

/** 单个赛事的名次积分 */
function pointsForPlacement(comp, teamId) {
  if (!comp) return 0;
  const p = placementOf(comp, teamId);
  if (p === 'champion') return 100;
  if (p === 'runnerUp') return 80;
  if (p === 'top4') return 60;
  if (p === 'top8') return 30;
  const rank = competitionRank(comp, teamId);
  return rank ? Math.max(5, 25 - rank) : 0;
}

/** 年度积分：春季赛 + 夏季赛，按总分降序；前 8 进年度总决赛 */
export function yearPointsOf(state, year, prefix = '') {
  const spring = state.competitions[`${prefix}spring-${year}`];
  const summer = state.competitions[`${prefix}summer-${year}`];
  const teamIds = (spring && spring.teams) || (summer && summer.teams) || LPL_TEAM_IDS;
  return teamIds
    .map((teamId) => {
      const s = pointsForPlacement(spring, teamId);
      const u = pointsForPlacement(summer, teamId);
      return { teamId, spring: s, summer: u, total: s + u };
    })
    .sort((a, b) => b.total - a.total || b.summer - a.summer);
}

function developAllPlayers(state) {
  for (const p of state.players) {
    if (!p.teamId) continue;
    const team = state.teams.find((t) => t.id === p.teamId);
    const fac = team ? team.facilities.training : 1;
    setDefaultTraining(p);
    applyTraining(p, p.trainingFocus, state.rng, {
      facilityLevel: fac,
      satisfaction: p.satisfaction,
      heroPool: HEROES_BY_ROLE[p.role].map((h) => h.id)
    });
    developPlayer(p, state.rng, { facilityLevel: fac, satisfaction: p.satisfaction, growthScale: 0.5 });
  }
}

/* ------------------------------------------------------------------ */
/* 日历同步                                                             */
/* ------------------------------------------------------------------ */

function syncWithCalendar(state) {
  const comp = currentCompetition(state);

  // 赛程周已过但淘汰赛还没打完：直接快进，避免卡在空周
  if (comp && !isCompetitionDone(comp) && state.week > comp.endWeek) {
    autoSimCompetition(state, comp);
  }

  if (comp && isCompetitionDone(comp)) {
    const idx = CALENDAR.findIndex((c) => c.id === comp.id);
    const next = CALENDAR.slice(idx + 1).find((c) => c.type !== 'regional');
    if (!next || next.season !== comp.season) {
      finishYear(state);
      return;
    }
    startCompetition(state, next);
    return;
  }

  const scheduled = CALENDAR.find(
    (c) => c.type !== 'regional' && state.week >= c.startWeek && state.week <= c.endWeek
  );
  if (!scheduled) {
    // 休赛周：跳到下一个赛事；跨年则先做年度结算
    const next = CALENDAR.find((c) => c.type !== 'regional' && c.startWeek >= state.week);
    if (!next) {
      finishYear(state);
      return;
    }
    if (next.season !== state.year) {
      finishYear(state);
      return;
    }
    state.week = next.startWeek;
    startCompetition(state, next);
  } else if (state.activeCompetitionId !== scheduled.id) {
    startCompetition(state, scheduled);
  }
}

export function isSeasonOver(state) {
  return state.phase === 'offseason';
}

/* ------------------------------------------------------------------ */
/* 年度结算                                                             */
/* ------------------------------------------------------------------ */

/** 赛段常规赛最佳：常规赛打完、季后赛开始前评选 */
function computeStageAwards(state, comp) {
  const stats = comp.playerStats || {};
  const entries = Object.entries(stats)
    .map(([playerId, s]) => {
      const p = state.players.find((x) => x.id === playerId);
      if (!p || !p.teamId) return null;
      const games = s.games || 0;
      if (games < 3) return null;
      const kda = (s.kills + s.assists) / Math.max(1, s.deaths);
      return { playerId, name: p.name, teamId: p.teamId, role: p.role, kda: Math.round(kda * 10) / 10, games };
    })
    .filter(Boolean);

  const best = entries.slice().sort((a, b) => b.kda - a.kda)[0] || null;
  const lineup = {};
  for (const role of ['TOP', 'JUG', 'MID', 'ADC', 'SUP']) {
    lineup[role] = entries.filter((e) => e.role === role).sort((a, b) => b.kda - a.kda)[0] || null;
  }
  return { mvp: best, lineup };
}

/** 年度颁奖：参考 KPL 年度颁奖典礼的奖项设置 */
function computeAwards(state) {
  const year = state.year;
  const kplComps = CALENDAR.filter((c) => c.type === 'lpl' && c.season === year)
    .map((c) => state.competitions[c.id])
    .filter(Boolean);
  const championComp = kplComps.find((c) => c.champion);
  const championTeam = championComp?.champion || null;

  const eligible = state.players.filter((p) => p.teamId && p.season?.games >= 3);
  const scoreOf = (p) => (p.season.ratingSum / p.season.games) + (p.season.mvps || 0) * 0.5;

  const best = eligible.slice().sort((a, b) => scoreOf(b) - scoreOf(a))[0] || null;
  const lineup = {};
  for (const role of ['TOP', 'JUG', 'MID', 'ADC', 'SUP']) {
    lineup[role] = eligible.filter((p) => p.role === role).sort((a, b) => scoreOf(b) - scoreOf(a))[0] || null;
  }

  const rookie = eligible.filter((p) => p.age <= 20).sort((a, b) => scoreOf(b) - scoreOf(a))[0] || null;
  const championObj = championTeam ? state.teams.find((t) => t.id === championTeam) : null;

  const toRef = (p) => (p ? { playerId: p.id, name: p.name, teamId: p.teamId, role: p.role } : null);

  return {
    year,
    mvp: toRef(best),
    rookie: toRef(rookie),
    coach: championObj?.coach || '—',
    championTeam,
    championName: championObj?.name || '—',
    lineup: Object.fromEntries(Object.entries(lineup).map(([k, p]) => [k, toRef(p)])),
    popularTeam: championTeam || state.playerTeamId,
    popularPlayer: toRef(best)
  };
}

export function finishYear(state) {
  const team = playerTeam(state);
  const lplComps = CALENDAR.filter((c) => c.type === 'lpl' && c.season === state.year)
    .map((c) => state.competitions[c.id])
    .filter(Boolean);
  let wins = 0;
  let losses = 0;
  for (const c of lplComps) {
    const st = c.standings?.find((s) => s.teamId === state.playerTeamId);
    if (st) {
      wins += st.wins;
      losses += st.losses;
    }
  }
  const rate = wins + losses ? wins / (wins + losses) : 0.5;
  const sponsor = Math.round(ECONOMY.sponsorBase + rate * ECONOMY.sponsorWinRateCoef * 100 * 10000);
  const salaries = squadOf(state.players, state.playerTeamId).reduce((s, p) => s + p.salary, 0);
  const upkeep = Object.values(team.facilities).reduce((s, v) => s + v, 0) * ECONOMY.facilityUpkeepPerLevel;
  const income = ECONOMY.leagueShare + sponsor;
  const expense = salaries + ECONOMY.operatingCost + upkeep;
  state.cash += income - expense;

  state.lastSettlement = {
    items: [
      { key: 'league', label: '年度联赛分成', amount: ECONOMY.leagueShare, kind: 'income' },
      { key: 'sponsor', label: `年度赞助（胜率 ${(rate * 100).toFixed(0)}%）`, amount: sponsor, kind: 'income' },
      { key: 'salary', label: '选手薪资', amount: -salaries, kind: 'expense' },
      { key: 'operating', label: '基础运营', amount: -ECONOMY.operatingCost, kind: 'expense' },
      { key: 'upkeep', label: '设施维护', amount: -upkeep, kind: 'expense' }
    ],
    income,
    expense,
    net: income - expense,
    rate
  };

  const titles = lplComps.filter((c) => c.champion === state.playerTeamId).length;
  state.lastSeasonSummary = {
    year: state.year,
    wins,
    losses,
    titles,
    finish: titles > 0 ? '联赛冠军' : wins >= 30 ? '季后赛常客' : ' rebuilding',
    settlement: state.lastSettlement
  };

  state.awards = computeAwards(state);
  state.awardsList = state.awardsList || [];
  state.awardsList.push(state.awards);

  state.phase = 'offseason';
  state.scoutRemaining = 2;
  simulateAiTransfers(state);
  state.market = generateMarket(state.rng, state.players, state.playerTeamId);
  state.prospects = [];
  state.log.push({ type: 'season', text: `${state.year} 赛季结束` });
  addNews(state, {
    type: 'league',
    title: `${state.year} 赛季结束`,
    body: `${playerTeam(state).name} 全年 ${wins} 胜 ${losses} 负，冠军 ${titles} 个。`
  });
  const retired = state.players.filter((p) => p.retiredAt === state.year);
  if (retired.length) {
    for (const p of retired.slice(0, 3)) {
      addNews(state, {
        type: 'player',
        title: `${p.name} 宣布退役`,
        body: `${p.name}（${p.role}）结束了自己的职业生涯。`
      });
    }
  }
  return state.lastSettlement;
}

export function startNextYear(state) {
  const nextSeason = state.year + 1;
  // 日历静态部分用完后按需生成，保证年份一直往后推（不会卡在最后一年原地循环）
  ensureYearEvents(nextSeason);
  const first = CALENDAR.find((c) => c.season === nextSeason);
  if (!first) return state;

  state.year = nextSeason;
  state.week = first.startWeek;
  state.competitions = {};
  state.activeCompetitionId = null;
  state.playerResults = [];
  state.recentResults = [];
  state.phase = 'preseason';
  state.titleCount = 0;
  state.lastSettlement = null;
  state.teamStats = {};
  state.meta = generateSeasonMeta(state.rng);
  state.market = generateMarket(state.rng, state.players, state.playerTeamId);
  state.prospects = [];
  state.scoutRemaining = 2;
  resetSeasonFlags(state);
  for (const p of state.players) {
    p.season = { games: 0, wins: 0, mvps: 0, ratingSum: 0, kills: 0, deaths: 0, assists: 0 };
    p.form = 0;
    setDefaultTraining(p);
  }
  return state;
}

/* ------------------------------------------------------------------ */
/* 比赛记录 / 数据                                                       */
/* ------------------------------------------------------------------ */

function updatePlayerStats(state, series, playerWon) {
  const starters = startersOf(state.players, state.playerTeamId);
  for (const p of starters) {
    if (playerWon) p.season.wins += 1;
    const base = playerWon ? 6.6 : 4.8;
    const rating = Math.max(1, Math.min(10, base + state.rng.float(0, 3) + (currentAbility(p) - 70) * 0.04));
    p.season.ratingSum += rating;
    p.form = Math.max(-10, Math.min(10, (p.form || 0) + (playerWon ? 2.2 : -2.2) + state.rng.float(-1, 1)));
  }
  for (const g of series.games) {
    if (g.winner === 'blue' && g.mvp) {
      const p = state.players.find((x) => x.id === g.mvp.playerId);
      if (p && p.season) p.season.mvps += 1;
    }
  }
}

export function teamName(state, teamId) {
  return state.teams.find((t) => t.id === teamId)?.name || teamId;
}

export function teamShort(state, teamId) {
  return state.teams.find((t) => t.id === teamId)?.short || teamId;
}

export function playerTeam(state) {
  return state.teams.find((t) => t.id === state.playerTeamId);
}

export function currentStanding(state) {
  const comp = currentCompetition(state);
  if (!comp) return null;
  if (comp.standings) return comp.standings.find((s) => s.teamId === state.playerTeamId) || null;
  return null;
}

export function nextOpponent(state) {
  const prep = prepareMatch(state);
  return prep.ok ? prep.opponentId : null;
}

export function seasonProgress(state) {
  const comp = currentCompetition(state);
  if (!comp) return { done: 0, total: 1, label: '休赛期' };
  const total = allMatchesSafe(comp).length + (comp.playoff ? comp.playoff.rounds.flatMap((r) => r.matches).length : 0);
  const done = allMatchesSafe(comp).filter((m) => m.result).length;
  return { done, total, label: comp.name };
}

export function autoDraft(state, blueId, redId, side = 'blue') {
  const draft = createDraft({ blueTeamId: blueId, redTeamId: redId, playerSide: side, meta: state.meta });
  let guard = 0;
  while (currentTurn(draft) && guard++ < 20) {
    const turn = currentTurn(draft);
    const id = turn.type === 'ban' ? aiBan(draft, state.rng, state.players) : aiPick(draft, state.rng, state.players);
    if (!id) break;
    applyAction(draft, id);
  }
  return draft;
}

export function serialize(state) {
  const { rng, ...rest } = state;
  return { ...rest, rngState: rng.state, savedAt: Date.now() };
}

export function deserialize(raw) {
  const { rngState, ...rest } = raw;
  const state = { ...rest };
  state.rng = createRng(rngState ?? raw.seed ?? 1);
  state.playerResults = state.playerResults || [];
  state.competitions = state.competitions || {};
  state.log = state.log || [];
  state.seenEvents = state.seenEvents || {};
  state.market = state.market || [];
  state.prospects = state.prospects || [];
  state.honors = state.honors || [];
  state.fmvp = state.fmvp || null;
  state.fmvpList = state.fmvpList || [];
  state.pendingFmvp = state.pendingFmvp || null;
  state.awards = state.awards || null;
  state.awardsList = state.awardsList || [];
  return state;
}

export function squadOfTeam(state, teamId) {
  return squadOf(state.players, teamId);
}

export function allCompetitions(state) {
  return CALENDAR.map((c) => state.competitions[c.id]).filter(Boolean);
}

export function playerPlacement(state, comp) {
  return placementOf(comp, state.playerTeamId);
}

export { checkEvent, weekLabel, CALENDAR };
