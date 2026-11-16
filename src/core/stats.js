import { startersOf } from '../data/teams.js';
import { currentAbility } from './player.js';

const KILL_W = { TOP: 0.18, JUG: 0.20, MID: 0.24, ADC: 0.26, SUP: 0.12 };
const DEATH_W = { TOP: 0.22, JUG: 0.20, MID: 0.18, ADC: 0.16, SUP: 0.24 };
const ASSIST_W = { TOP: 0.16, JUG: 0.22, MID: 0.22, ADC: 0.18, SUP: 0.22 };

/** 把 total 按权重拆成整数，余数给小数部分最大的 */
function splitTotal(total, items, weightFn, rng) {
  if (!items.length) return [];
  const weights = items.map((p) => Math.max(0.01, weightFn(p) * (0.7 + rng.next() * 0.6)));
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map((v) => Math.floor(v));
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (rest > 0) {
    floors[order[k % order.length].i] += 1;
    rest -= 1;
    k += 1;
  }
  return floors;
}

/** 单局记分板：保证队伍总击杀/总死亡与比分一致 */
export function generateGameScoreboard(players, teamId, oppTeamId, teamKills, oppKills, rng) {
  const starters = startersOf(players, teamId);
  if (!starters.length) return [];
  const kills = splitTotal(teamKills, starters, (p) => KILL_W[p.role] * (0.75 + currentAbility(p) / 140), rng);
  const deaths = splitTotal(oppKills, starters, (p) => DEATH_W[p.role], rng);
  const assists = splitTotal(Math.round(teamKills * 2.2), starters, (p) => ASSIST_W[p.role], rng);
  return starters.map((p, i) => ({
    playerId: p.id,
    kills: kills[i],
    deaths: deaths[i],
    assists: assists[i]
  }));
}

/** 一场 BO3/BO5 的累计数据 */
export function buildMatchStats(state, homeId, awayId, gameResults, rng) {
  const home = { kills: 0, deaths: 0, assists: 0, players: {} };
  const away = { kills: 0, deaths: 0, assists: 0, players: {} };

  for (const g of gameResults) {
    home.kills += g.homeKills;
    home.deaths += g.awayKills;
    away.kills += g.awayKills;
    away.deaths += g.homeKills;

    const homeBoard = generateGameScoreboard(state.players, homeId, awayId, g.homeKills, g.awayKills, rng);
    const awayBoard = generateGameScoreboard(state.players, awayId, homeId, g.awayKills, g.homeKills, rng);

    for (const row of homeBoard) {
      const cur = (home.players[row.playerId] ||= { playerId: row.playerId, kills: 0, deaths: 0, assists: 0, games: 0 });
      cur.kills += row.kills;
      cur.deaths += row.deaths;
      cur.assists += row.assists;
      cur.games += 1;
      home.assists += row.assists;
    }
    for (const row of awayBoard) {
      const cur = (away.players[row.playerId] ||= { playerId: row.playerId, kills: 0, deaths: 0, assists: 0, games: 0 });
      cur.kills += row.kills;
      cur.deaths += row.deaths;
      cur.assists += row.assists;
      cur.games += 1;
      away.assists += row.assists;
    }
  }

  return {
    home: { ...home, players: Object.values(home.players) },
    away: { ...away, players: Object.values(away.players) }
  };
}

/** 写入选手与战队累计数据（全局 + 当前赛事） */
export function applyMatchStats(state, match, stats, comp = null) {
  if (!stats) return;
  state.teamStats = state.teamStats || {};
  if (comp) {
    comp.teamStats = comp.teamStats || {};
    comp.playerStats = comp.playerStats || {};
  }

  const sides = [
    ['home', match.home],
    ['away', match.away]
  ];

  for (const [side, teamId] of sides) {
    const s = stats[side];
    if (!s) continue;

    const team = (state.teamStats[teamId] ||= { kills: 0, deaths: 0, assists: 0, games: 0 });
    team.kills += s.kills;
    team.deaths += s.deaths;
    team.assists += s.assists;

    const cTeam = comp ? (comp.teamStats[teamId] ||= { kills: 0, deaths: 0, assists: 0, games: 0 }) : null;
    if (cTeam) {
      cTeam.kills += s.kills;
      cTeam.deaths += s.deaths;
      cTeam.assists += s.assists;
    }

    for (const row of s.players) {
      const p = state.players.find((x) => x.id === row.playerId);
      if (!p) continue;
      p.season = p.season || { games: 0, wins: 0, mvps: 0, ratingSum: 0 };
      p.season.games = (p.season.games || 0) + 1;
      p.season.kills = (p.season.kills || 0) + row.kills;
      p.season.deaths = (p.season.deaths || 0) + row.deaths;
      p.season.assists = (p.season.assists || 0) + row.assists;
      p.career = p.career || { seasons: 0, titles: 0, kills: 0, deaths: 0, assists: 0, games: 0 };
      p.career.kills = (p.career.kills || 0) + row.kills;
      p.career.deaths = (p.career.deaths || 0) + row.deaths;
      p.career.assists = (p.career.assists || 0) + row.assists;
      p.career.games = (p.career.games || 0) + row.games;

      if (comp) {
        const cp = (comp.playerStats[row.playerId] ||= { kills: 0, deaths: 0, assists: 0, games: 0 });
        cp.games += 1;
        cp.kills += row.kills;
        cp.deaths += row.deaths;
        cp.assists += row.assists;
      }
    }
    const games = s.players.reduce((max, row) => Math.max(max, row.games), 0);
    team.games += games;
    if (cTeam) cTeam.games += games;
  }
}

export function kdaOf(p) {
  const d = p.season?.deaths || 0;
  const k = p.season?.kills || 0;
  const a = p.season?.assists || 0;
  return d === 0 ? k + a : (k + a) / d;
}

export function getLeaderboards(state, compId = null, minGames = 1) {
  let pool;
  if (compId) {
    const comp = state.competitions?.[compId];
    const source = comp?.playerStats || {};
    pool = Object.entries(source)
      .map(([id, s]) => {
        const p = state.players.find((x) => x.id === id);
        if (!p) return null;
        return { ...p, season: { ...p.season, ...s } };
      })
      .filter(Boolean)
      .filter((p) => (p.season.games || 0) >= minGames);
  } else {
    pool = state.players.filter((p) => p.teamId && (p.season?.games || 0) >= minGames);
  }

  const kills = pool.slice().sort((a, b) => (b.season.kills || 0) - (a.season.kills || 0)).slice(0, 20);
  const assists = pool.slice().sort((a, b) => (b.season.assists || 0) - (a.season.assists || 0)).slice(0, 20);
  const kda = pool
    .slice()
    .sort((a, b) => kdaOf(b) - kdaOf(a))
    .slice(0, 20);
  return { kills, assists, kda };
}

export function getTeamBoard(state, compId = null) {
  const comp = compId ? state.competitions?.[compId] : null;
  const source = compId ? comp?.teamStats || {} : state.teamStats || {};
  const rows = Object.entries(source)
    .map(([teamId, s]) => ({
      teamId,
      ...s,
      kd: s.deaths ? s.kills / s.deaths : s.kills,
      avgKills: s.games ? s.kills / s.games : 0
    }))
    .filter((r) => r.games > 0);
  return rows.sort((a, b) => b.kd - a.kd || b.kills - a.kills);
}
