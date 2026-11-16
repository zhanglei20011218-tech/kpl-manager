import {
  ROLE_WEIGHTS,
  AGE_POWER_MOD,
  GROWTH_TAGS,
  ageValueCoef,
  abilityValueCoef,
  ROLE_VALUE_COEF,
  VALUE_UNIT,
  RETIRE,
  TRAINING
} from '../data/constants.js';

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const round1 = (v) => Math.round(v * 10) / 10;

export function ageMod(age) {
  return (AGE_POWER_MOD.find((r) => age <= r.max) || AGE_POWER_MOD.at(-1)).mod;
}

/** 当前能力：四维加权（0–100），用于身价、OVR 与新闻文案 */
export function currentAbility(p) {
  const w = ROLE_WEIGHTS[p.role];
  return clamp(
    p.mechanics * w.mechanics +
      p.gameSense * w.gameSense +
      p.championPool * w.championPool +
      p.consistency * w.consistency,
    1,
    100
  );
}

export function overall(p) {
  return Math.round(currentAbility(p));
}

/** 选手战力 = 加权属性 × 年龄修正 */
export function playerPower(p) {
  return currentAbility(p) * ageMod(p.age) * (1 + (p.form || 0) / 100);
}

/** 身价（元） */
export function playerValue(p) {
  const ability = currentAbility(p);
  const tag = GROWTH_TAGS[p.growthTag] || GROWTH_TAGS.normal;
  const potentialCoef = 1 + (p.potential - ability) / 200;
  const value =
    ability *
    abilityValueCoef(ability) *
    ageValueCoef(p.age) *
    potentialCoef *
    tag.valueCoef *
    ROLE_VALUE_COEF[p.role];
  return Math.round((value * VALUE_UNIT) / 1000) * 1000;
}

export function salaryFromValue(value, ratio = 0.1) {
  return Math.round((value * ratio) / 1000) * 1000;
}

export function growthTagFor(potential, age) {
  if (potential >= 88 && age <= 21) return 'genius';
  if (potential >= 78) return 'normal';
  return 'ordinary';
}

/** 稳定性区间显示（如 65–78） */
export function consistencyBand(p) {
  const spread = Math.round(8 + (100 - p.consistency) * 0.22);
  const lo = Math.round(clamp(p.consistency - spread, 1, 99));
  const hi = Math.round(clamp(p.consistency + Math.round(spread * 0.4), 1, 100));
  return `${lo}–${hi}`;
}

/** 潜力模糊标签 */
export function potentialLabel(potential) {
  if (potential >= 88) return '有望成为核心';
  if (potential >= 78) return '优质首发';
  if (potential >= 68) return '轮换级别';
  return '难堪大用';
}

export function potentialShort(potential) {
  if (potential >= 88) return '天才';
  if (potential >= 78) return '优质';
  return '普通';
}

/** 赛季成长 / 巅峰 / 衰退。返回本次变化描述文本数组。 */
export function developPlayer(p, rng, { facilityLevel = 1, satisfaction = p.satisfaction, growthScale = 1 } = {}) {
  const notes = [];
  const ability = currentAbility(p);
  const peakEnd = p.peakAge + p.peakDuration;

  if (p.age < p.peakAge) {
    if (ability >= p.potential) {
      notes.push(`${p.name} 已触到潜力上限`);
    } else {
      const tag = GROWTH_TAGS[p.growthTag] || GROWTH_TAGS.normal;
      const gap = Math.max(0, p.potential - ability);
      const efficiency = 1 + facilityLevel * 0.1 + satisfaction / 200;
      let points = tag.rate * (1 + gap / 60) * efficiency * growthScale;
      points = clamp(points, 0.4, tag.rate * 2.4);
      distributeGrowth(p, points, rng);
      notes.push(`${p.name} 成长 +${round1(points)}`);
    }
  } else if (p.age <= peakEnd) {
    notes.push(`${p.name} 处于巅峰期`);
  } else {
    const decline = p.age >= 30 ? 1.6 : 1;
    const mechLoss = (rng.float(2, 3)) * decline;
    p.mechanics = clamp(p.mechanics - mechLoss, 5, 100);
    p.gameSense = clamp(p.gameSense - 1 * decline, 5, 100);
    p.championPool = clamp(p.championPool - 1, 5, 100);
    if (rng.chance(0.5)) p.consistency = clamp(p.consistency + 0.5, 1, 100);
    notes.push(`${p.name} 状态下滑`);
  }

  // 潜力上限硬约束
  capToPotential(p);
  return notes;
}

function distributeGrowth(p, points, rng) {
  const w = ROLE_WEIGHTS[p.role];
  const weights = [
    ['mechanics', w.mechanics],
    ['gameSense', w.gameSense],
    ['championPool', w.championPool]
  ];
  const total = weights.reduce((s, [, x]) => s + x, 0);
  for (const [stat, weight] of weights) {
    const add = (points * weight) / total;
    p[stat] = clamp(p[stat] + add, 1, 100);
  }
  // 稳定性随年龄与训练经验缓慢变化
  if (rng.chance(0.4)) p.consistency = clamp(p.consistency + 0.3, 1, 100);
}

function capToPotential(p) {
  // 只对“可成长的三项”做软上限：潜力决定上限，意识/操作/英雄池的平均不超过潜力
  const core = (p.mechanics + p.gameSense + p.championPool) / 3;
  if (core > p.potential) {
    const scale = p.potential / core;
    p.mechanics = clamp(p.mechanics * scale, 1, 100);
    p.gameSense = clamp(p.gameSense * scale, 1, 100);
    p.championPool = clamp(p.championPool * scale, 1, 100);
  }
}

/** 训练：返回本次实际提升 */
export function applyTraining(p, focus, rng, { facilityLevel = 1, satisfaction = p.satisfaction, heroPool = [] } = {}) {
  const def = TRAINING.focuses[focus];
  if (!def) return null;
  const baseEfficiency =
    (1 + facilityLevel * 0.1 + satisfaction / 200) * (satisfaction < TRAINING.lowSatisfactionThreshold ? 0.5 : 1);

  if (focus === 'team') {
    const before = p.satisfaction;
    p.satisfaction = clamp(p.satisfaction + Math.round(3 * baseEfficiency), 0, 100);
    return { stat: 'satisfaction', delta: p.satisfaction - before, newHero: null };
  }

  const stat = def.stat;
  const room = p.potential - currentAbility(p);
  if (room <= 0) return { stat, delta: 0, newHero: null, capped: true };

  const raw = rng.float(1, 2) * baseEfficiency * (room > 8 ? 1 : room / 8);
  const before = p[stat];
  p[stat] = clamp(p[stat] + raw, 1, 100);
  capToPotential(p);
  const delta = p[stat] - before;

  let newHero = null;
  if (focus === 'championPool' && rng.chance(0.35)) {
    newHero = unlockChampion(p, rng, heroPool);
  }
  return { stat, delta, newHero };
}

function unlockChampion(p, rng, pool = []) {
  const known = new Set(p.champions || []);
  const candidates = pool.filter((id) => !known.has(id));
  if (!candidates.length) return null;
  const id = rng.pick(candidates);
  p.champions = [...(p.champions || []), id];
  return id;
}

/** 退役判定 */
export function shouldRetire(p, rng) {
  const ability = currentAbility(p);
  if (p.age >= RETIRE.hardAge) return rng.chance(RETIRE.hardChance);
  if (p.age >= RETIRE.ageSoftCap && ability < RETIRE.abilityThreshold) return rng.chance(RETIRE.softChance);
  return false;
}

export function formatMoney(n) {
  const abs = Math.abs(n);
  if (abs >= 10000) {
    const wan = n / 10000;
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)} 万`;
  }
  return `${Math.round(n)}`;
}

export function formatMoneyShort(n) {
  const wan = n / 10000;
  if (Math.abs(wan) >= 10000) return `${(wan / 10000).toFixed(2)} 亿`;
  return `${wan.toFixed(wan >= 100 ? 0 : 1)} 万`;
}
