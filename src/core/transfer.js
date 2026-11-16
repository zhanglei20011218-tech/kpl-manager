import { createRng } from './rng.js';
import { buildMarket, buildFreeAgent, buildProspect, squadOf, TEAM_BY_ID } from '../data/teams.js';
import { playerValue, salaryFromValue, currentAbility, potentialLabel, formatMoney, clamp } from './player.js';
import { salaryTotal, salaryCapStatus } from './economy.js';
import { computeTeamPower } from './power.js';
import { addNews } from './news.js';
import { ECONOMY, TRANSFER, SCOUT } from '../data/constants.js';

/** 转会市场：从其他战队的替补里挂牌 8–12 人 */
export function generateMarket(rng, players, playerTeamId) {
  const count = rng.int(TRANSFER.marketSizeMin, TRANSFER.marketSizeMax);
  return buildMarket(players, rng, playerTeamId, count);
}

export function marketSalaryOptions(player) {
  const base = player.expectedSalary;
  return {
    low: Math.round(base * (1 - TRANSFER.salaryNegotiation)),
    mid: base,
    high: Math.round(base * (1 + TRANSFER.salaryNegotiation))
  };
}

/* ------------------------------------------------------------------ */
/* 强行挖角                                                             */
/* ------------------------------------------------------------------ */

/** 挖角报价：违约金、新薪资、成功率 */
export function poachQuote(state, playerId) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || !p.teamId || p.teamId === state.playerTeamId) return null;

  const myPower = computeTeamPower(state.players, state.playerTeamId, state.duos).total;
  const hisPower = computeTeamPower(state.players, p.teamId, state.duos).total;
  const region = TEAM_BY_ID[p.teamId]?.region || 'KPL';

  const salary = Math.round((p.salary * 1.35) / 1000) * 1000;
  const raise = salary / Math.max(1, p.salary) - 1;

  let willingness = 0.3;
  willingness += Math.min(0.35, raise * 0.8);
  willingness += (myPower - hisPower) / 150;
  willingness += p.satisfaction < 55 ? 0.12 : 0;
  willingness -= p.loyalty / 400;
  if (region !== 'KPL') willingness += 0.04;
  willingness = clamp(willingness, 0.05, 0.85);

  const fee = Math.round((p.value * (1.6 + 0.8 * (1 - willingness))) / 1000) * 1000;
  return {
    player: p,
    fee,
    salary,
    chance: Math.round(willingness * 100),
    region,
    myPower,
    hisPower,
    oldTeam: state.teams.find((t) => t.id === p.teamId) || null
  };
}

export function poachPlayer(state, playerId) {
  const quote = poachQuote(state, playerId);
  if (!quote) return { ok: false, reason: '无法挖角该选手' };

  const team = state.teams.find((t) => t.id === state.playerTeamId);
  const status = salaryCapStatus(state.players, team);
  if (state.cash < quote.fee) return { ok: false, reason: '资金不足，无法支付违约金' };
  if (status.total + quote.salary > status.cap) return { ok: false, reason: '超出薪资帽' };
  if (quote.salary > status.singleMax) {
    return { ok: false, reason: `单人薪资不得超过 ${(status.singleMax / 10000).toFixed(0)} 万` };
  }

  if (!state.rng.chance(quote.chance / 100)) {
    quote.player.loyalty = Math.min(100, quote.player.loyalty + 3);
    return { ok: false, reason: `${quote.player.name} 拒绝了你的邀约` };
  }

  state.cash -= quote.fee;
  const oldTeamId = quote.player.teamId;
  quote.player.teamId = team.id;
  quote.player.isStarter = false;
  quote.player.salary = quote.salary;
  quote.player.contractYears = 2;
  quote.player.loyalty = Math.max(20, quote.player.loyalty - 8);
  quote.player.originalTeamId = undefined;
  refillStarters(state, oldTeamId);

  state.log.push({
    type: 'transfer',
    text: `从 ${quote.oldTeam?.name || oldTeamId} 挖来 ${quote.player.name}，违约金 ${formatMoney(quote.fee)}`
  });
  addNews(state, {
    type: 'transfer',
    title: `${team.name} 挖来 ${quote.player.name}`,
    body: `从 ${quote.oldTeam?.name || oldTeamId} 支付 ${formatMoney(quote.fee)} 违约金，${quote.player.name} 加盟 ${team.name}。`
  });
  return { ok: true, player: quote.player, fee: quote.fee, oldTeamId };
}

/** 被挖走首发后，AI 队伍自动从替补补位 */
function refillStarters(state, teamId) {
  const squad = squadOf(state.players, teamId);
  const starters = squad.filter((p) => p.isStarter);
  if (starters.length >= 5) return;
  for (const role of ['TOP', 'JUG', 'MID', 'ADC', 'SUP']) {
    if (starters.some((p) => p.role === role)) continue;
    const cand = squad.find((p) => !p.isStarter && p.role === role) || squad.find((p) => !p.isStarter);
    if (cand) {
      cand.isStarter = true;
      starters.push(cand);
    }
  }
}

/** 赛季间的 AI 转会：同赛区内随机换队 */
export function simulateAiTransfers(state) {
  const rng = state.rng;
  const pool = state.players.filter((p) => p.teamId && p.teamId !== state.playerTeamId);
  const count = rng.int(4, 10);
  let moved = 0;

  for (let i = 0; i < count; i++) {
    const p = rng.pick(pool);
    if (!p || !p.teamId) continue;
    const region = TEAM_BY_ID[p.teamId]?.region;
    if (!region) continue;
    const targets = state.teams.filter((t) => t.id !== p.teamId && t.region === region && t.id !== state.playerTeamId);
    if (!targets.length) continue;
    const target = rng.pick(targets);
    const oldTeamId = p.teamId;
    p.teamId = target.id;
    p.isStarter = false;
    p.contractYears = 2;
    refillStarters(state, oldTeamId);
    moved += 1;
  }

  if (moved) {
    state.log.push({ type: 'transfer', text: `转会期：其他战队完成 ${moved} 笔转会` });
    addNews(state, {
      type: 'transfer',
      title: `转会期：${moved} 笔交易完成`,
      body: '多支战队完成阵容调整，新赛季的竞争格局正在变化。'
    });
  }
  return moved;
}

/**
 * 签约。tier: 'low' | 'mid' | 'high'
 * 返回 { ok, reason, player, cost }
 */
export function signPlayer(state, freeAgentId, tier = 'mid') {
  if (state.phase === 'season') return { ok: false, reason: '赛季中无法签约，请等转会窗开放' };
  const fa = state.market.find((p) => p.id === freeAgentId);
  if (!fa) return { ok: false, reason: '该选手已不在市场上' };

  const team = state.teams.find((t) => t.id === state.playerTeamId);
  const squad = squadOf(state.players, team.id);
  if (squad.length >= 10) return { ok: false, reason: '阵容已满（最多 10 人）' };

  const salaryMap = marketSalaryOptions(fa);
  const salary = salaryMap[tier];
  const value = fa.askingValue;

  if (state.cash < value) return { ok: false, reason: '资金不足，无法支付转会费' };

  const status = salaryCapStatus(state.players, team);
  if (status.total + salary > status.cap) {
    return { ok: false, reason: `超出薪资帽（${(status.cap / 10000).toFixed(0)} 万），需先出售或降薪` };
  }
  if (salary > status.singleMax) {
    return { ok: false, reason: `单人薪资不得超过 ${(status.singleMax / 10000).toFixed(0)} 万` };
  }

  // 谈判：压价过低可能直接被拒
  if (tier === 'low' && state.rng.chance(0.55)) {
    state.market = state.market.filter((p) => p.id !== fa.id);
    return { ok: false, reason: `${fa.name} 拒绝了压价报价，转投他队` };
  }
  if (tier === 'low' && state.rng.chance(0.3)) {
    return { ok: false, reason: `${fa.name} 的经纪人不接受这个价格` };
  }

  // 市场上的选手来自其他战队的替补：直接把原对象转过来
  const original = state.players.find((p) => p.id === fa.id);
  let player;
  if (original) {
    original.teamId = team.id;
    original.isStarter = false;
    original.salary = salary;
    original.contractYears = state.rng.int(TRANSFER.contractYearsMin, TRANSFER.contractYearsMax);
    original.satisfaction = Math.min(100, original.satisfaction + (tier === 'high' ? 8 : 0));
    original.originalTeamId = undefined;
    original.askingValue = undefined;
    original.expectedSalary = undefined;
    player = original;
  } else {
    player = {
      ...fa,
      teamId: team.id,
      isStarter: false,
      salary,
      contractYears: state.rng.int(TRANSFER.contractYearsMin, TRANSFER.contractYearsMax),
      satisfaction: Math.min(100, fa.satisfaction + (tier === 'high' ? 8 : 0))
    };
    state.players.push(player);
  }
  state.cash -= value;
  state.market = state.market.filter((p) => p.id !== fa.id);
  state.log.push({ type: 'transfer', text: `签下 ${fa.name}（${fa.role}），转会费 ${(value / 10000).toFixed(0)} 万` });
  addNews(state, {
    type: 'transfer',
    title: `${team.name} 签下 ${fa.name}`,
    body: `${team.name} 官方宣布签下 ${fa.name}（${fa.role}），转会费 ${formatMoney(value)}。`
  });
  return { ok: true, player, cost: value };
}

export function releasePlayer(state, playerId) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || p.teamId !== state.playerTeamId) return { ok: false, reason: '选手不存在' };
  if (p.isStarter) return { ok: false, reason: '首发选手请先调整阵容' };

  const fee = Math.round(playerValue(p) * 0.9);
  p.teamId = null;
  state.cash += fee;
  state.log.push({ type: 'transfer', text: `出售 ${p.name}，收入 ${(fee / 10000).toFixed(0)} 万` });
  return { ok: true, fee };
}

export function renewContract(state, playerId) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || p.teamId !== state.playerTeamId) return { ok: false, reason: '选手不存在' };

  const team = state.teams.find((t) => t.id === state.playerTeamId);
  const dorm = team.facilities.dorm;
  const loyaltyRoll = p.loyalty + dorm * 5 + (p.satisfaction - 50) * 0.4;
  const value = playerValue(p);
  const base = salaryFromValue(value, 0.1);
  const raise = loyaltyRoll >= 75 ? 0.9 : loyaltyRoll >= 55 ? 1.0 : 1.15;
  const newSalary = Math.round((base * raise) / 1000) * 1000;

  const status = salaryCapStatus(state.players, team);
  const delta = newSalary - p.salary;
  if (status.total + delta > status.cap) {
    return { ok: false, reason: '续约后超出薪资帽，需要先清理薪资空间' };
  }
  if (newSalary > status.singleMax) {
    return { ok: false, reason: `单人薪资不得超过 ${(status.singleMax / 10000).toFixed(0)} 万` };
  }
  if (loyaltyRoll < 35 && state.rng.chance(0.4)) {
    return { ok: false, reason: `${p.name} 暂时不想谈续约` };
  }

  p.salary = newSalary;
  p.contractYears += 2;
  p.loyalty = Math.min(100, p.loyalty + 4);
  state.log.push({
    type: 'transfer',
    text: `与 ${p.name} 续约 2 年，薪资 ${(newSalary / 10000).toFixed(1)} 万`
  });
  return { ok: true, salary: newSalary };
}

/** 青训：返回 1–2 名新人，已带上模糊球探报告 */
export function scoutProspects(state) {
  if (state.scoutRemaining <= 0) return { ok: false, reason: '本赛季的青训机会已用完' };
  state.scoutRemaining -= 1;
  const count = state.rng.int(1, 2);
  const prospects = [];
  for (let i = 0; i < count; i++) {
    const id = `sc-${state.seasonNo}-${state.scoutRemaining}-${i}`;
    const p = buildProspect(state.rng, id);
    p.scoutLabel = potentialLabel(p.potential);
    p.askingValue = 0;
    p.expectedSalary = salaryFromValue(p.value, SCOUT.salaryRatio);
    prospects.push(p);
  }
  state.prospects = prospects;
  return { ok: true, prospects };
}

export function signProspect(state, prospectId) {
  const p = state.prospects.find((x) => x.id === prospectId);
  if (!p) return { ok: false, reason: '该新人已不在名单中' };
  const team = state.teams.find((t) => t.id === state.playerTeamId);
  const squad = squadOf(state.players, team.id);
  if (squad.length >= 10) return { ok: false, reason: '阵容已满（最多 10 人）' };

  const status = salaryCapStatus(state.players, team);
  if (status.total + p.salary > status.cap) {
    return { ok: false, reason: '超出薪资帽' };
  }

  const player = { ...p, teamId: team.id, isStarter: false, contractYears: 2 };
  state.players.push(player);
  state.prospects = state.prospects.filter((x) => x.id !== p.id);
  state.log.push({ type: 'scout', text: `青训签下 ${p.name}（${p.role}，${p.age} 岁）` });
  return { ok: true, player };
}

/** 转会窗推进：AI 有概率抢走市场上的选手 */
export function aiPoach(state) {
  if (!state.market.length) return null;
  if (!state.rng.chance(0.18)) return null;
  const victim = state.rng.pick(state.market);
  state.market = state.market.filter((p) => p.id !== victim.id);
  state.log.push({ type: 'transfer', text: `${victim.name} 被其他战队抢先签下` });
  return victim;
}

/** 玩家操作后调用：制造轻度稀缺感 */
export function tickMarket(state) {
  const poached = aiPoach(state);
  if (poached) return { poached };
  // 偶尔补充新人，保持市场 8 人以上
  if (state.market.length < 8) {
    const names = new Set(state.players.map((p) => p.name));
    const extra = buildFreeAgents(state.rng, 1, names);
    state.market.push(
      ...extra.map((p) => ({
        ...p,
        askingValue: Math.round(playerValue(p) * 0.9),
        expectedSalary: Math.round(playerValue(p) * state.rng.float(0.08, 0.12)),
        interest: state.rng.int(20, 95)
      }))
    );
  }
  return {};
}

/** 首发/替补切换（保证 5 个位置各 1 人） */
export function setStarter(state, playerId, starter) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || p.teamId !== state.playerTeamId) return { ok: false, reason: '选手不存在' };
  const squad = squadOf(state.players, state.playerTeamId);

  if (starter) {
    const current = squad.find((x) => x.isStarter && x.role === p.role && x.id !== p.id);
    if (current) {
      current.isStarter = false;
      p.isStarter = true;
      return { ok: true, swappedWith: current.id };
    }
    const starters = squad.filter((x) => x.isStarter);
    if (starters.length >= 5) {
      return { ok: false, reason: '首发已满，请先调整同位置选手' };
    }
    p.isStarter = true;
    return { ok: true };
  }

  if (!p.isStarter) return { ok: false, reason: '该选手已是替补' };
  const starters = squad.filter((x) => x.isStarter && x.id !== p.id);
  if (starters.length < 4) return { ok: false, reason: '首发不能少于 5 人' };
  p.isStarter = false;
  return { ok: true };
}

export function squadWarning(state) {
  const squad = squadOf(state.players, state.playerTeamId);
  const starters = squad.filter((p) => p.isStarter);
  const roles = new Set(starters.map((p) => p.role));
  const missing = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'].filter((r) => !roles.has(r));
  return {
    starters: starters.length,
    missing,
    ok: starters.length === 5 && missing.length === 0
  };
}
