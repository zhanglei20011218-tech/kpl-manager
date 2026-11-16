import { HEROES, HERO_BY_ID, HEROES_BY_ROLE, ROLES, hasSynergy, counters } from '../data/heroes.js';
import { startersOf } from '../data/teams.js';
import { playerPower } from './player.js';
import { BP, META_HOT, BAN_LIST } from '../data/constants.js';

/** 完整 BP 顺序：首段 Ban 各 2 → 首段 Pick 1-2-2-1 → 次段 Ban 各 2 → 次段 Pick 各 2 */
export const DRAFT_SEQUENCE = [
  // 首段 Ban：蓝红各 2
  { type: 'ban', side: 'blue' },
  { type: 'ban', side: 'red' },
  { type: 'ban', side: 'blue' },
  { type: 'ban', side: 'red' },
  // 首段 Pick：蓝 1 → 红 2 → 蓝 2 → 红 1
  { type: 'pick', side: 'blue' },
  { type: 'pick', side: 'red' },
  { type: 'pick', side: 'red' },
  { type: 'pick', side: 'blue' },
  { type: 'pick', side: 'blue' },
  { type: 'pick', side: 'red' },
  // 次段 Ban：蓝红各 2
  { type: 'ban', side: 'blue' },
  { type: 'ban', side: 'red' },
  { type: 'ban', side: 'blue' },
  { type: 'ban', side: 'red' },
  // 次段 Pick：蓝红各 2，补足 5v5
  { type: 'pick', side: 'blue' },
  { type: 'pick', side: 'red' },
  { type: 'pick', side: 'blue' },
  { type: 'pick', side: 'red' }
];

/** 第 n 个 pick 是第几步（用于槽位排序） */
export const PICK_STEPS = DRAFT_SEQUENCE.map((s, i) => (s.type === 'pick' ? i : -1)).filter((i) => i >= 0);

/** 每赛季版本强势：每个位置 2 名；30% 概率触发“版本骤变”重掷一个位置 */
export function generateSeasonMeta(rng) {
  // 强势就是强势：直接采用版本强势池全量，不做随机抽取（rng 参数保留以兼容旧调用）
  const strongByRole = {};
  for (const role of ROLES) {
    const pool = (META_HOT[role] || []).filter((id) => HERO_BY_ID[id] && HERO_BY_ID[id].role === role);
    strongByRole[role] = pool.length ? pool : HEROES_BY_ROLE[role].map((h) => h.id);
  }
  return { strongByRole, versionShift: null };
}

export function isStrong(heroId, meta) {
  const hero = HERO_BY_ID[heroId];
  return !!hero && (meta.strongByRole[hero.role] || []).includes(heroId);
}

export function createDraft({ blueTeamId, redTeamId, playerSide, meta, globalUsed = [] }) {
  return {
    blueTeamId,
    redTeamId,
    playerSide,
    meta,
    globalUsed: [...globalUsed],
    step: 0,
    bans: { blue: [], red: [] },
    picks: { blue: [], red: [] },
    log: [],
    done: false
  };
}

export function currentTurn(draft) {
  if (draft.step >= DRAFT_SEQUENCE.length) return null;
  return DRAFT_SEQUENCE[draft.step];
}

export function isPlayerTurn(draft) {
  const turn = currentTurn(draft);
  return !!turn && turn.side === draft.playerSide;
}

export function usedHeroes(draft) {
  return new Set([
    ...(draft.globalUsed || []),
    ...draft.bans.blue,
    ...draft.bans.red,
    ...draft.picks.blue,
    ...draft.picks.red
  ]);
}

export function availableHeroes(draft) {
  const used = usedHeroes(draft);
  return HEROES.filter((h) => !used.has(h.id));
}

export function applyAction(draft, heroId) {
  const turn = currentTurn(draft);
  if (!turn) return false;
  if (usedHeroes(draft).has(heroId)) return false;
  if (turn.type === 'ban') draft.bans[turn.side].push(heroId);
  else {
    // 每边 5 个 Pick 必须是 5 个不同分路：选人的时候就校验，不靠事后换位
    const hero = HERO_BY_ID[heroId];
    const myRoles = new Set(draft.picks[turn.side].map((id) => (HERO_BY_ID[id] || {}).role));
    if (hero && myRoles.has(hero.role)) return false;
    draft.picks[turn.side].push(heroId);
  }
  draft.step += 1;
  draft.done = draft.step >= DRAFT_SEQUENCE.length;
  return true;
}

function otherSide(side) {
  return side === 'blue' ? 'red' : 'blue';
}

function teamIdForSide(draft, side) {
  return side === 'blue' ? draft.blueTeamId : draft.redTeamId;
}

/** AI 的 Ban：优先对方战力最高选手的招牌（60%），否则 Ban 版本强势 */
export function aiBan(draft, rng, players) {
  const turn = currentTurn(draft);
  const side = turn.side;
  const oppId = teamIdForSide(draft, otherSide(side));
  const oppStarters = startersOf(players, oppId);
  const used = usedHeroes(draft);

  // 1) 优先 Ban 高 Ban 率英雄（版本 Ban 榜里未被用掉、仍可 Ban 的）
  const hotBans = (BAN_LIST || []).filter((id) => !used.has(id) && availableHeroes(draft).some((h) => h.id === id));
  if (hotBans.length) return rng.pick(hotBans);

  // 2) 其次 Ban 对方核心选手的招牌（60%）
  const ranked = oppStarters.slice().sort((a, b) => playerPower(b) - playerPower(a));
  if (ranked.length && rng.chance(0.6)) {
    const star = ranked[0];
    const candidates = star.champions.filter((c) => !used.has(c));
    if (candidates.length) return rng.pick(candidates);
  }
  const strong = availableHeroes(draft).filter((h) => isStrong(h.id, draft.meta));
  if (strong.length) return rng.pick(strong).id;
  return rng.pick(availableHeroes(draft)).id;
}

/** AI 的 Pick：招牌 > 版本强势 > 联动 > 随机 */
export function aiPick(draft, rng, players) {
  const turn = currentTurn(draft);
  const side = turn.side;
  const myId = teamIdForSide(draft, side);
  const starters = startersOf(players, myId);
  const used = usedHeroes(draft);
  const picked = draft.picks[side];
  const pickedRoles = new Set(picked.map((id) => (HERO_BY_ID[id] || {}).role));
  // 每个分路只能有一个英雄：候选池排除本边已选分路
  const pool = availableHeroes(draft).filter((h) => !pickedRoles.has(h.role));
  if (!pool.length) return null;

  const score = (hero) => {
    let s = rng.next() * 0.4;
    if (isStrong(hero.id, draft.meta)) s += 3.2;
    const owner = starters.find((p) => p.role === hero.role);
    if (owner && owner.champions.includes(hero.id)) s += 2.6;
    if (picked.some((id) => hasSynergy(id, hero.id))) s += 1.4;
    if (!pickedRoles.has(hero.role)) s += 0.8;
    return s;
  };

  return pool.slice().sort((a, b) => score(b) - score(a))[0].id;
}

/** 解析一方的阵容：3 个 pick + 未选位置使用选手首选英雄 */
export function resolveLineup(draft, side, players) {
  const teamId = teamIdForSide(draft, side);
  const starters = startersOf(players, teamId);
  const usedPlayers = new Set();
  const lineup = [];

  for (const heroId of draft.picks[side]) {
    const hero = HERO_BY_ID[heroId];
    if (!hero) continue;
    let owner = starters.find((p) => p.role === hero.role && !usedPlayers.has(p.id));
    if (!owner) owner = starters.find((p) => !usedPlayers.has(p.id));
    if (owner) usedPlayers.add(owner.id);
    lineup.push({ heroId, playerId: owner ? owner.id : null, isPick: true });
  }
  for (const p of starters) {
    if (usedPlayers.has(p.id)) continue;
    const first = p.champions?.[0];
    const fallback = first && HERO_BY_ID[first] ? first : HEROES_BY_ROLE[p.role][0].id;
    lineup.push({ heroId: fallback, playerId: p.id, isPick: false });
  }
  return lineup;
}

/** 计算 BP 修正（乘数）与标签明细 */
export function evaluateDraft(draft, side, players) {
  const teamId = teamIdForSide(draft, side);
  const oppSide = otherSide(side);
  const starters = startersOf(players, teamId);
  const myPicks = draft.picks[side];
  const oppPicks = draft.picks[oppSide];
  const lineup = resolveLineup(draft, side, players);
  const tags = [];
  let pct = 0;

  // 版本强势
  for (const id of myPicks) {
    if (isStrong(id, draft.meta)) {
      pct += BP.strong;
      tags.push({ key: 'strong', label: `版本强势 · ${HERO_BY_ID[id].name}`, value: BP.strong });
    }
  }

  // 招牌
  const signatureUsed = new Set();
  for (const id of myPicks) {
    const hero = HERO_BY_ID[id];
    const owner = starters.find((p) => p.role === hero.role && p.champions.includes(id) && !signatureUsed.has(p.id));
    if (owner) {
      signatureUsed.add(owner.id);
      pct += BP.signature;
      tags.push({ key: 'signature', label: `招牌 · ${owner.name} 的 ${hero.name}`, value: BP.signature });
    }
  }

  // 克制（最多 2 层）
  let counterStacks = 0;
  const counterPairs = [];
  outer: for (const mine of myPicks) {
    for (const theirs of oppPicks) {
      const a = HERO_BY_ID[mine];
      const b = HERO_BY_ID[theirs];
      if (a && b && counters(a.category, b.category)) {
        counterStacks = Math.min(BP.counterMaxStacks, counterStacks + 1);
        counterPairs.push(`${a.name} 克制 ${b.name}`);
        if (counterStacks >= BP.counterMaxStacks) break outer;
      }
    }
  }
  if (counterStacks > 0) {
    pct += BP.counter * counterStacks;
    tags.push({ key: 'counter', label: `克制 ×${counterStacks} · ${counterPairs.join('，')}`, value: BP.counter * counterStacks });
  }

  // 联动（最多 2 层）
  let synergyStacks = 0;
  const synergyNames = [];
  for (let i = 0; i < myPicks.length; i++) {
    for (let j = i + 1; j < myPicks.length; j++) {
      if (hasSynergy(myPicks[i], myPicks[j])) {
        synergyStacks = Math.min(BP.synergyMaxStacks, synergyStacks + 1);
        synergyNames.push(`${HERO_BY_ID[myPicks[i]].name}+${HERO_BY_ID[myPicks[j]].name}`);
      }
    }
  }
  if (synergyStacks > 0) {
    pct += BP.synergy * synergyStacks;
    tags.push({ key: 'synergy', label: `联动 ×${synergyStacks} · ${synergyNames.join('，')}`, value: BP.synergy * synergyStacks });
  }

  // 被 Ban 招牌：某选手的全部招牌都被 Ban
  const myBans = new Set(draft.bans[oppSide]);
  for (const p of starters) {
    if (p.champions.length && p.champions.every((c) => myBans.has(c))) {
      pct += BP.bannedSignature;
      tags.push({ key: 'banned', label: `招牌被封锁 · ${p.name}`, value: BP.bannedSignature });
    }
  }

  pct = Math.max(-BP.cap, Math.min(BP.cap, pct));
  return { pct, tags, lineup, teamId };
}

/** 分析室等级 → 可显示的对手标签 */
export function analysisUnlock(level) {
  return {
    strong: level >= 1,
    counter: level >= 3,
    synergy: level >= 5
  };
}

/** 对手已选英雄的标签（供 BP 界面展示） */
export function opponentHeroTags(draft, side, level) {
  const unlock = analysisUnlock(level);
  const oppPicks = draft.picks[otherSide(side)];
  return oppPicks.map((id) => {
    const hero = HERO_BY_ID[id];
    const tags = [];
    if (unlock.strong && isStrong(id, draft.meta)) tags.push('强势');
    if (unlock.counter) tags.push('克制');
    if (unlock.synergy && oppPicks.some((o) => o !== id && hasSynergy(o, id))) tags.push('联动');
    return { hero, tags };
  });
}
