import { ECONOMY, FACILITIES } from '../data/constants.js';
import { squadOf } from '../data/teams.js';

export function facilityUpkeep(team) {
  const levels = Object.values(team.facilities).reduce((s, v) => s + v, 0);
  return levels * ECONOMY.facilityUpkeepPerLevel;
}

export function salaryTotal(players, teamId) {
  return squadOf(players, teamId).reduce((s, p) => s + (p.salary || 0), 0);
}

export function salaryCapStatus(players, team) {
  const total = salaryTotal(players, team.id);
  const cap = ECONOMY.salaryCap;
  const singleMax = cap * ECONOMY.singleSalaryCapRatio;
  const squad = squadOf(players, team.id);
  const top = squad.slice().sort((a, b) => b.salary - a.salary)[0];
  return {
    total,
    cap,
    ratio: total / cap,
    over: total > cap,
    singleMax,
    topSalary: top?.salary || 0,
    topName: top?.name || ''
  };
}

export function winRate(standing) {
  if (!standing) return 0.5;
  const total = standing.wins + standing.losses;
  return total ? standing.wins / total : 0.5;
}

/**
 * 赛季结算。返回明细与净收支（不直接改 state，由调用方应用）。
 */
export function settleSeason({ players, team, standing, finish, championTeamId }) {
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const rate = wins + losses ? wins / (wins + losses) : 0.5;

  const leagueShare = ECONOMY.leagueShare;
  const sponsor = Math.round(ECONOMY.sponsorBase + rate * ECONOMY.sponsorWinRateCoef * 100 * 10000);

  let prize = 0;
  let prizeLabel = '无奖金';
  if (championTeamId === team.id) {
    prize = ECONOMY.prizeChampion;
    prizeLabel = '联赛冠军';
  } else if (finish === '亚军') {
    prize = ECONOMY.prizeRunnerUp;
    prizeLabel = '亚军';
  } else if (finish === '四强') {
    prize = ECONOMY.prizeTop4;
    prizeLabel = '四强';
  } else if (finish === '六强') {
    prize = ECONOMY.prizeTop6;
    prizeLabel = '六强';
  }

  const salaries = salaryTotal(players, team.id);
  const operating = ECONOMY.operatingCost;
  const upkeep = facilityUpkeep(team);

  const income = leagueShare + sponsor + prize;
  const expense = salaries + operating + upkeep;
  const net = income - expense;

  return {
    items: [
      { key: 'league', label: '联赛分成', amount: leagueShare, kind: 'income' },
      { key: 'sponsor', label: `赞助收入（胜率 ${(rate * 100).toFixed(0)}%）`, amount: sponsor, kind: 'income' },
      { key: 'prize', label: `赛事奖金 · ${prizeLabel}`, amount: prize, kind: 'income' },
      { key: 'salary', label: '选手薪资', amount: -salaries, kind: 'expense' },
      { key: 'operating', label: '基础运营', amount: -operating, kind: 'expense' },
      { key: 'upkeep', label: '设施维护', amount: -upkeep, kind: 'expense' }
    ],
    income,
    expense,
    net,
    rate,
    prizeLabel
  };
}

export function facilityUpgradeCost(team, key) {
  const def = FACILITIES[key];
  const level = team.facilities[key];
  return def.cost(level);
}

export function canUpgradeFacility(team, key) {
  return team.facilities[key] < 5;
}
