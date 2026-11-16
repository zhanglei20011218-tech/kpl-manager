import { SEASON_LENGTH, PLAYOFF_TEAMS } from '../data/constants.js';

/** 单循环赛程（圆桌法），返回 9 轮 × 5 场 */
export function buildSchedule(teamIds, rng) {
  const arr = teamIds.slice();
  if (arr.length % 2) arr.push(null);
  const n = arr.length;
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) {
        // 随机主客，玩家固定在列表里的位置不影响
        const flip = rng.chance(0.5);
        matches.push(flip ? { home: b, away: a } : { home: a, away: b });
      }
    }
    rounds.push(matches);
    // 固定第一个，其余轮转
    const last = arr.pop();
    arr.splice(1, 0, last);
  }

  return rounds.slice(0, SEASON_LENGTH);
}

export function createStandings(teamIds) {
  return teamIds.map((teamId) => ({
    teamId,
    wins: 0,
    losses: 0,
    gameWins: 0,
    gameLosses: 0,
    points: 0
  }));
}

export function applyResult(standings, homeId, awayId, homeWon, homeGames, awayGames) {
  const home = standings.find((s) => s.teamId === homeId);
  const away = standings.find((s) => s.teamId === awayId);
  if (!home || !away) return;
  if (homeWon) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
    away.points += 1;
  } else {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
    home.points += 1;
  }
  home.gameWins += homeGames;
  home.gameLosses += awayGames;
  away.gameWins += awayGames;
  away.gameLosses += homeGames;
}

export function sortStandings(standings) {
  return standings.slice().sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const dA = a.gameWins - a.gameLosses;
    const dB = b.gameWins - b.gameLosses;
    if (dB !== dA) return dB - dA;
    return b.points - a.points;
  });
}

export function teamRank(standings, teamId) {
  const sorted = sortStandings(standings);
  return sorted.findIndex((s) => s.teamId === teamId) + 1;
}

/* ------------------------------------------------------------------ */
/* 季后赛：前 6 名冒泡赛 6v5 → 胜者 vs 4 → vs 3 → vs 2 → vs 1            */
/* ------------------------------------------------------------------ */
export function createPlayoffBracket(standings) {
  const seeds = sortStandings(standings).slice(0, PLAYOFF_TEAMS).map((s) => s.teamId);
  return {
    seeds,
    stage: 0,
    challenger: seeds[5],
    champion: null,
    results: []
  };
}

export function nextPlayoffMatch(bracket) {
  if (!bracket || bracket.stage >= PLAYOFF_TEAMS - 1) return null;
  const opponent = bracket.seeds[PLAYOFF_TEAMS - 2 - bracket.stage];
  const labels = ['六进五', '五进四', '四进三', '三进二', '总决赛'];
  return {
    home: bracket.challenger,
    away: opponent,
    stage: bracket.stage,
    label: labels[bracket.stage] || `第 ${bracket.stage + 1} 轮`
  };
}

export function advancePlayoff(bracket, winnerId) {
  const match = nextPlayoffMatch(bracket);
  if (!match) return bracket;
  bracket.results.push({ ...match, winner: winnerId });
  bracket.challenger = winnerId;
  bracket.stage += 1;
  if (bracket.stage >= PLAYOFF_TEAMS - 1) bracket.champion = winnerId;
  return bracket;
}

export function playoffFinishLabel(stage, champion, teamId) {
  if (champion === teamId) return '冠军';
  if (stage >= 4) return '亚军';
  if (stage >= 3) return '四强';
  if (stage >= 1) return '六强';
  return '常规赛';
}
