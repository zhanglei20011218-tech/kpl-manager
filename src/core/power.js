import { playerPower } from './player.js';
import { startersOf, squadOf } from '../data/teams.js';
import { BOND } from '../data/constants.js';

/** 战队战力 = 5 名首发选手战力均值 × (1 + 羁绊)。用均值而非总和，才能让 sigma=6.0 与 +4/-3 的决策修正在同一尺度上成立。 */
export function computeTeamPower(players, teamId, duos = []) {
  const starters = startersOf(players, teamId);
  if (!starters.length) return { base: 0, bond: 0, total: 0, starters };
  const base = starters.reduce((s, p) => s + playerPower(p), 0) / starters.length;
  const bond = computeBond(players, teamId, starters, duos);
  return { base, bond, total: base * (1 + bond), starters };
}

export function computeBond(players, teamId, starters, duos = []) {
  let bond = 0;

  const natCount = {};
  for (const p of starters) natCount[p.nationality] = (natCount[p.nationality] || 0) + 1;
  const maxNat = Math.max(0, ...Object.values(natCount));
  if (maxNat >= 5) bond += BOND.sameNationality5;
  else if (maxNat >= 3) bond += BOND.sameNationality3;

  const duo = duos.find((d) => d.teamId === teamId);
  if (duo) {
    const set = new Set(starters.map((p) => p.id));
    if (duo.duo.every((id) => set.has(id))) bond += BOND.duo;
  }

  const subs = squadOf(players, teamId).filter((p) => !p.isStarter);
  const hasMatchingSub = subs.some((sub) =>
    starters.some((st) => st.role === sub.role && st.nationality === sub.nationality)
  );
  if (hasMatchingSub) bond += BOND.subSameNationality;

  return Math.min(bond, BOND.cap);
}

export function bondLabel(bond) {
  return `+${(bond * 100).toFixed(1)}%`;
}

/** 队伍稳定性均值 */
export function teamConsistency(starters) {
  if (!starters.length) return 50;
  return starters.reduce((s, p) => s + p.consistency, 0) / starters.length;
}

/** 基于稳定性的单局标准差 */
export function sigmaFor(starters, extra = 0) {
  const avg = teamConsistency(starters);
  let sigma = 6.0;
  if (avg >= 80) sigma = 5.0;
  else if (avg <= 60) sigma = 7.5;
  return sigma + extra;
}
