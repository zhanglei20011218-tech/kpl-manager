import { createStandings, applyResult, sortStandings } from './league.js';
import { createRng } from './rng.js';

/* ------------------------------------------------------------------ */
/* 赛程生成                                                             */
/* ------------------------------------------------------------------ */

/** 单循环：n 支队伍 → n-1 轮，每轮 n/2 场 */
export function roundRobin(teamIds) {
  const arr = teamIds.slice();
  if (arr.length % 2) arr.push(null);
  const n = arr.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (!a || !b) continue;
      matches.push(r % 2 === 0 ? { home: a, away: b, result: null } : { home: b, away: a, result: null });
    }
    rounds.push({ index: r, matches });
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

/** 小组赛：分成若干组，每组单循环 */
export function groupRounds(teamIds, groupCount) {
  const groups = Array.from({ length: groupCount }, () => []);
  teamIds.forEach((id, i) => groups[i % groupCount].push(id));
  return groups.map((teams, gi) => ({
    name: String.fromCharCode(65 + gi),
    teams,
    rounds: roundRobin(teams),
    standings: createStandings(teams)
  }));
}

function seedOrder(n) {
  let order = [0];
  while (order.length < n) {
    const len = order.length * 2;
    const next = [];
    for (const x of order) {
      next.push(x);
      next.push(len - 1 - x);
    }
    order = next;
  }
  return order;
}

function seedPairs(seeds) {
  const order = seedOrder(seeds.length);
  const pairs = [];
  for (let i = 0; i < order.length; i += 2) {
    pairs.push({ home: seeds[order[i]], away: seeds[order[i + 1]], result: null });
  }
  return pairs;
}

/* ------------------------------------------------------------------ */
/* 瑞士轮                                                               */
/* ------------------------------------------------------------------ */

export function createSwiss(teams) {
  const records = {};
  for (const id of teams) records[id] = { w: 0, l: 0 };
  return {
    records,
    played: [],
    rounds: [],
    qualified: [],
    eliminated: []
  };
}

export function swissStandings(comp) {
  return comp.teams
    .map((id) => ({ teamId: id, ...comp.swiss.records[id] }))
    .sort((a, b) => b.w - a.w || a.l - b.l);
}

/** 生成下一轮瑞士轮配对；返回 null 表示瑞士轮结束 */
export function swissNextRound(comp) {
  const sw = comp.swiss;

  // 结算：3 胜晋级、3 负淘汰
  for (const id of comp.teams) {
    const r = sw.records[id];
    if (r.w >= 3 && !sw.qualified.includes(id)) sw.qualified.push(id);
    if (r.l >= 3 && !sw.eliminated.includes(id)) sw.eliminated.push(id);
  }

  if (sw.qualified.length >= 8) return null;

  const active = comp.teams.filter((id) => !sw.qualified.includes(id) && !sw.eliminated.includes(id));
  if (active.length < 2) return null;

  const sorted = active.slice().sort((a, b) => {
    const ra = sw.records[a];
    const rb = sw.records[b];
    return rb.w - ra.w || ra.l - rb.l;
  });

  const pairs = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    let a = sorted[i];
    let b = sorted[i + 1];
    if (sw.played.includes(`${a}|${b}`) && i + 2 < sorted.length) {
      const tmp = b;
      b = sorted[i + 2];
      sorted[i + 2] = tmp;
    }
    pairs.push({ home: a, away: b, result: null });
  }

  const round = {
    index: sw.rounds.length,
    name: `瑞士轮第 ${sw.rounds.length + 1} 轮`,
    matches: pairs
  };
  sw.rounds.push(round);
  return round;
}

export function createBracket(seeds, roundNames) {
  return {
    rounds: [{ index: 0, name: roundNames[0], matches: seedPairs(seeds) }],
    names: roundNames,
    champion: null
  };
}

/* ------------------------------------------------------------------ */
/* 创建赛事                                                             */
/* ------------------------------------------------------------------ */

export function createCompetition(spec, teamIds, rng) {
  const base = {
    id: spec.id,
    name: spec.name,
    short: spec.short,
    type: spec.type,
    format: spec.format,
    startWeek: spec.startWeek,
    endWeek: spec.endWeek,
    startsAt: spec.startsAt,
    endsAt: spec.endsAt,
    prize: spec.prize || {},
    season: spec.season,
    teams: teamIds.slice(),
    stage: 'regular',
    rounds: [],
    groups: null,
    playoff: null,
    standings: null,
    champion: null,
    runnerUp: null,
    qualifiedPlayer: false
  };

  if (spec.format === 'rr' || spec.format === 'rr+playoff') {
    base.rounds = roundRobin(teamIds);
    base.standings = createStandings(teamIds);
  } else if (spec.format === 'group+final') {
    base.stage = 'group';
    base.groups = [{ name: 'A', teams: teamIds.slice(), rounds: roundRobin(teamIds), standings: createStandings(teamIds) }];
  } else if (spec.format === 'swiss+ko') {
    base.stage = 'swiss';
    base.swiss = createSwiss(teamIds);
    base.swissRounds = 5;
    // 立即生成第 1 轮，保证开赛当周就有比赛可打
    swissNextRound(base);
  } else if (spec.format === 'groups+ko') {
    base.stage = 'group';
    const groupCount = teamIds.length >= 16 ? 4 : 2;
    base.groups = groupRounds(teamIds, groupCount);
  } else if (spec.format === 'ko') {
    base.stage = 'playoff';
    const size = 2 ** Math.floor(Math.log2(Math.max(2, teamIds.length)));
    const seeds = teamIds.slice(0, size);
    base.teams = seeds;
    base.playoff = createBracket(seeds, bracketNames(size));
  }
  return base;
}

function bracketNames(size) {
  if (size >= 16) return ['十六强', '八强', '半决赛', '决赛'];
  if (size >= 8) return ['八强', '半决赛', '决赛'];
  if (size >= 4) return ['半决赛', '决赛'];
  return ['决赛'];
}

/* ------------------------------------------------------------------ */
/* 查询                                                                 */
/* ------------------------------------------------------------------ */

export function allMatches(comp) {
  if (comp.groups) return comp.groups.flatMap((g) => g.rounds.flatMap((r) => r.matches));
  if (comp.rounds) return comp.rounds.flatMap((r) => r.matches);
  return [];
}

export function matchesForWeek(comp, week) {
  if (!comp) return [];
  const offset = week - comp.startWeek;
  if (offset < 0) return [];

  // 进入淘汰赛阶段后，优先返回当前轮次
  if (comp.stage === 'playoff' && comp.playoff) {
    return playoffMatchesForWeek(comp);
  }

  if (comp.swiss) {
    const current = comp.swiss.rounds.find((r) => r.matches.some((m) => !m.result));
    return current ? current.matches.filter((m) => !m.result) : [];
  }

  if (comp.groups) {
    const perGroup = comp.groups[0].rounds;
    const round = perGroup[offset];
    if (!round) return [];
    return comp.groups.flatMap((g) => (g.rounds[offset] ? g.rounds[offset].matches : []));
  }
  if (comp.rounds && comp.rounds.length) {
    const perWeek = comp.type === 'lpl' || comp.type === 'regional' ? 2 : 1;
    const start = offset * perWeek;
    return comp.rounds.slice(start, start + perWeek).flatMap((r) => r.matches);
  }
  return [];
}

function playoffMatchesForWeek(comp) {
  const p = comp.playoff;
  if (!p || p.champion) return [];
  const current = p.rounds.find((r) => r.matches.some((m) => !m.result));
  if (!current) return [];
  return current.matches.filter((m) => !m.result);
}

export function isRegularComplete(comp) {
  if (comp.swiss) return comp.swiss.qualified.length >= 8;
  if (comp.groups) return comp.groups.every((g) => g.rounds.every((r) => r.matches.every((m) => m.result)));
  if (comp.rounds && comp.rounds.length) return comp.rounds.every((r) => r.matches.every((m) => m.result));
  return true;
}

export function isCompetitionDone(comp) {
  if (!comp) return true;
  if (comp.champion) return true;
  if (comp.playoff?.champion) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* 写入结果                                                             */
/* ------------------------------------------------------------------ */

export function recordResult(comp, match, winnerId, homeGames, awayGames) {
  const homeWon = winnerId === match.home;
  match.result = { winnerId, homeWon, homeGames, awayGames };

  if (comp.swiss) {
    const rh = comp.swiss.records[match.home];
    const ra = comp.swiss.records[match.away];
    if (rh && ra) {
      if (homeWon) {
        rh.w += 1;
        ra.l += 1;
      } else {
        ra.w += 1;
        rh.l += 1;
      }
      comp.swiss.played.push(`${match.home}|${match.away}`);
    }
  } else if (comp.groups) {
    const g = comp.groups.find((x) => x.teams.includes(match.home));
    if (g) applyResult(g.standings, match.home, match.away, homeWon, homeGames, awayGames);
  } else if (comp.standings) {
    applyResult(comp.standings, match.home, match.away, homeWon, homeGames, awayGames);
  }

  // 淘汰赛推进
  if (comp.playoff) {
    const round = comp.playoff.rounds.find((r) => r.matches.includes(match));
    if (round && round.matches.every((m) => m.result)) {
      advanceBracket(comp);
    }
  }
}

function advanceBracket(comp) {
  const p = comp.playoff;
  const last = p.rounds[p.rounds.length - 1];
  if (!last || !last.matches.every((m) => m.result)) return;

  const winners = last.matches.map((m) => m.result.winnerId);
  if (winners.length === 1) {
    p.champion = winners[0];
    // comp.champion 由 game.js 的 checkCompetitionProgress 统一设置并结算
    return;
  }

  const nextMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({ home: winners[i], away: winners[i + 1], result: null });
  }
  const name = p.names[p.rounds.length] || `第 ${p.rounds.length + 1} 轮`;
  p.rounds.push({ index: p.rounds.length, name, matches: nextMatches });
}

/** 常规赛/小组赛结束后生成淘汰赛 */
export function startPlayoffs(comp, size = 8) {
  if (comp.playoff) return comp.playoff;
  const seeds = sortStandings(comp.standings).slice(0, size).map((s) => s.teamId);
  comp.stage = 'playoff';
  comp.playoff = createBracket(seeds, bracketNames(size));
  return comp.playoff;
}

/** 小组赛结束 → 各组前二进入淘汰赛 */
export function startGroupKnockout(comp) {
  if (comp.playoff) return comp.playoff;
  let seeds = [];
  if (comp.swiss) {
    seeds = comp.swiss.qualified.slice(0, 8);
  } else if (comp.groups) {
    for (const g of comp.groups) {
      const sorted = sortStandings(g.standings);
      seeds.push(sorted[0]?.teamId, sorted[1]?.teamId);
    }
  }
  const clean = seeds.filter(Boolean);
  comp.stage = 'playoff';
  comp.playoff = createBracket(clean, bracketNames(clean.length));
  return comp.playoff;
}

/* ------------------------------------------------------------------ */
/* 排名                                                                 */
/* ------------------------------------------------------------------ */

export function competitionRank(comp, teamId) {
  if (comp.groups) {
    const g = comp.groups.find((x) => x.teams.includes(teamId));
    if (!g) return null;
    return sortStandings(g.standings).findIndex((s) => s.teamId === teamId) + 1;
  }
  if (comp.standings) return sortStandings(comp.standings).findIndex((s) => s.teamId === teamId) + 1;
  return null;
}

export function competitionStandings(comp) {
  if (comp.groups) return comp.groups.map((g) => ({ name: g.name, standings: sortStandings(g.standings) }));
  return sortStandings(comp.standings || []);
}

/* ------------------------------------------------------------------ */
/* 国际赛参赛队：KPL 版世冠由秋季赛前 8 名出战                           */
/* ------------------------------------------------------------------ */

export function intlTeamsFor(compId, qualified) {
  return [...qualified];
}

export function friendlyDate(comp) {
  return `${comp.startsAt} – ${comp.endsAt}`;
}
