import { HERO_BY_ID, ROLE_CN, HEROES } from '../data/heroes.js';
import { startersOf } from '../data/teams.js';
import { computeTeamPower, teamConsistency } from './power.js';
import { evaluateDraft, resolveLineup } from './match-draft.js';
import { currentAbility } from './player.js';
import { MATCH } from '../data/constants.js';

/* ------------------------------------------------------------------ */
/* 阵容特征                                                             */
/* ------------------------------------------------------------------ */

function heroForRole(lineup, players, role) {
  for (const slot of lineup) {
    const p = players.find((x) => x.id === slot.playerId);
    if (p && p.role === role) return HERO_BY_ID[slot.heroId];
  }
  return null;
}

function lineupHeroes(lineup, players) {
  return lineup.map((slot) => ({ hero: HERO_BY_ID[slot.heroId], player: players.find((p) => p.id === slot.playerId) })).filter((x) => x.hero);
}

/** 节点 1：第一条小龙（08–10 分钟） */
export function node1Options({ starters, oppStarters, lineup, oppLineup, players }) {
  const phaseCount = ['TOP', 'JUG', 'MID'].filter((role) => {
    const h = heroForRole(lineup, players, role);
    return h && h.phase === 'early';
  }).length;
  const senseSum = starters.reduce((s, p) => s + p.gameSense, 0);
  const oppSenseSum = oppStarters.reduce((s, p) => s + p.gameSense, 0);
  const earlyMet = phaseCount >= 2 || senseSum > oppSenseSum;

  const adc = starters.find((p) => p.role === 'ADC');
  const oppJug = oppStarters.find((p) => p.role === 'JUG');
  const counterMet = (adc && adc.mechanics >= 80) || (oppJug && oppJug.gameSense < 75);

  const avgConsistency = starters.reduce((s, p) => s + p.consistency, 0) / (starters.length || 1);
  const pullMet = avgConsistency >= 75;

  return [
    { key: 'A', name: '强行接团', desc: '上中野至少 2 人是前期英雄，或全队意识总和高于对方', met: earlyMet, good: 4, bad: -3 },
    { key: 'B', name: '放龙换镀层', desc: '下路操作 ≥ 80，或对方打野意识 < 75', met: counterMet, good: 2, bad: 0 },
    { key: 'C', name: '拉扯试探', desc: '全队稳定性平均 ≥ 75', met: pullMet, good: 1, bad: -2 }
  ];
}

/** 节点 2：中期节奏（20–25 分钟） */
export function node2Options({ starters, lineup, players, powerDiff, economyDiff }) {
  const heroes = lineupHeroes(lineup, players);
  const teamfightCount = heroes.filter((x) => ['tank', 'marksman', 'mage'].includes(x.hero.category)).length;
  const teamfightMet = teamfightCount >= 3 || powerDiff > 5;

  const carryMet = heroes.some(
    (x) => ['fighter', 'assassin'].includes(x.hero.category) && x.player && x.player.mechanics >= 82
  );

  const lateCount = heroes.filter(
    (x) => x.hero.phase === 'late' && ['marksman', 'mage'].includes(x.hero.category)
  ).length;
  const lateMet = lateCount >= 2 || economyDiff <= -3;

  return [
    { key: 'A', name: '抱团推中', desc: '阵容团战强势（坦克+射手+法师 ≥ 3），或当前战力差 > +5', met: teamfightMet, good: 5, bad: -4 },
    { key: 'B', name: '分带拉扯', desc: '有战士/刺客英雄且该选手操作 ≥ 82', met: carryMet, good: 3, bad: -2 },
    { key: 'C', name: '发育等装备', desc: '阵容后期强势（射手/法师后期英雄 ≥ 2），或经济差 ≤ -3', met: lateMet, good: 2, bad: -3 }
  ];
}

/** 节点：峡谷先锋（10–12 分钟） */
export function nodeHeraldOptions({ starters, lineup, players, powerDiff }) {
  const jug = starters.find((p) => p.role === 'JUG');
  const top = starters.find((p) => p.role === 'TOP');
  const earlyCount = lineupHeroes(lineup, players).filter((x) => x.hero.phase === 'early').length;
  const fastMet = earlyCount >= 2 || (jug && jug.mechanics >= 85);
  const tradeMet = powerDiff > 3 || (top && top.mechanics >= 80);
  const giveMet = starters.reduce((s, p) => s + p.consistency, 0) / (starters.length || 1) >= 72;

  return [
    { key: 'A', name: '抢先开先锋', desc: '前期英雄 ≥ 2，或打野操作 ≥ 85', met: fastMet, good: 3, bad: -3 },
    { key: 'B', name: '换线推塔', desc: '当前战力差 > +3，或对抗路操作 ≥ 80', met: tradeMet, good: 2, bad: -1 },
    { key: 'C', name: '放弃先锋', desc: '全队稳定性平均 ≥ 72', met: giveMet, good: 1, bad: -2 }
  ];
}

/** 节点：大龙决策（25–30 分钟） */
export function nodeBaronOptions({ starters, lineup, players, powerDiff, economyDiff }) {
  const visionMet = starters.filter((p) => p.gameSense >= 80).length >= 2;
  const fightMet = powerDiff > 2 || economyDiff > 3;
  const splitMet = lineupHeroes(lineup, players).some(
    (x) => ['fighter', 'assassin'].includes(x.hero.category) && x.player && x.player.mechanics >= 80
  );

  return [
    { key: 'A', name: '做视野强开', desc: '至少 2 人意识 ≥ 80', met: visionMet, good: 4, bad: -4 },
    { key: 'B', name: '逼团拿龙', desc: '战力差 > +2 或经济领先 > 3k', met: fightMet, good: 3, bad: -3 },
    { key: 'C', name: '分带牵制', desc: '有战士/刺客且操作 ≥ 80', met: splitMet, good: 2, bad: -2 }
  ];
}

/** 节点：决胜团（30 分钟以后） */
export function nodeFinalOptions({ starters }) {
  const n = starters.length || 1;
  const mech = starters.reduce((s, p) => s + p.mechanics, 0) / n;
  const sense = starters.reduce((s, p) => s + p.gameSense, 0) / n;
  const stab = starters.reduce((s, p) => s + p.consistency, 0) / n;

  return [
    { key: 'A', name: '正面硬开', desc: '全队操作平均 ≥ 82', met: mech >= 82, good: 5, bad: -5 },
    { key: 'B', name: '拉扯找机会', desc: '全队意识平均 ≥ 82', met: sense >= 82, good: 3, bad: -3 },
    { key: 'C', name: '稳住等失误', desc: '全队稳定性平均 ≥ 78', met: stab >= 78, good: 2, bad: -4 }
  ];
}

/** 节点：一血团（03–05 分钟） */
export function nodeFirstBloodOptions({ starters, lineup, players }) {
  const jug = starters.find((p) => p.role === 'JUG');
  const mid = starters.find((p) => p.role === 'MID');
  const earlyCount = lineupHeroes(lineup, players).filter((x) => x.hero.phase === 'early').length;
  const stab = starters.reduce((s, p) => s + p.consistency, 0) / (starters.length || 1);

  return [
    { key: 'A', name: '一级入侵', desc: '打野操作 ≥ 82，或前期英雄 ≥ 1', met: (jug && jug.mechanics >= 82) || earlyCount >= 1, good: 3, bad: -3 },
    { key: 'B', name: '中路抓机会', desc: '中单操作 ≥ 80 且意识 ≥ 78', met: !!mid && mid.mechanics >= 80 && mid.gameSense >= 78, good: 3, bad: -2 },
    { key: 'C', name: '稳线发育', desc: '全队稳定性平均 ≥ 70', met: stab >= 70, good: 1, bad: -1 }
  ];
}

/** 节点：野区入侵（06–08 分钟） */
export function nodeInvadeOptions({ starters, powerDiff }) {
  const jug = starters.find((p) => p.role === 'JUG');
  const sup = starters.find((p) => p.role === 'SUP');

  return [
    { key: 'A', name: '反野压制', desc: '打野操作 ≥ 85，或战力差 > +4', met: (jug && jug.mechanics >= 85) || powerDiff > 4, good: 4, bad: -4 },
    { key: 'B', name: '换野区', desc: '辅助意识 ≥ 80', met: !!sup && sup.gameSense >= 80, good: 2, bad: -1 },
    { key: 'C', name: '守自家野区', desc: '打野稳定性 ≥ 75', met: !!jug && jug.consistency >= 75, good: 1, bad: -2 }
  ];
}

/** 节点：塔皮交换（12–15 分钟） */
export function nodePlatesOptions({ starters, powerDiff, economyDiff }) {
  const adc = starters.find((p) => p.role === 'ADC');
  const top = starters.find((p) => p.role === 'TOP');

  return [
    { key: 'A', name: '下路推塔', desc: '射手操作 ≥ 82，或经济领先 > 2k', met: (adc && adc.mechanics >= 82) || economyDiff > 2, good: 4, bad: -3 },
    { key: 'B', name: '上路换塔', desc: '对抗路操作 ≥ 80，或战力差 > +2', met: (top && top.mechanics >= 80) || powerDiff > 2, good: 2, bad: -2 },
    { key: 'C', name: '回防守塔', desc: '全队意识平均 ≥ 78', met: starters.reduce((s, p) => s + p.gameSense, 0) / (starters.length || 1) >= 78, good: 1, bad: -1 }
  ];
}

/** 节点：换线运营（15–18 分钟） */
export function nodeRotationOptions({ starters, lineup, players, economyDiff }) {
  const splitMet = lineupHeroes(lineup, players).some(
    (x) => ['fighter', 'assassin'].includes(x.hero.category) && x.player && x.player.mechanics >= 80
  );
  const fightMet = starters.filter((p) => p.gameSense >= 78).length >= 3;

  return [
    { key: 'A', name: '41 分推', desc: '有战士/刺客且操作 ≥ 80', met: splitMet, good: 3, bad: -3 },
    { key: 'B', name: '抱团压中', desc: '至少 3 人意识 ≥ 78', met: fightMet, good: 3, bad: -3 },
    { key: 'C', name: '收缩拖后期', desc: '经济落后 ≤ 2k', met: economyDiff <= 2, good: 2, bad: -2 }
  ];
}

/** 节点：偷家决策（35 分钟以后） */
export function nodeBackdoorOptions({ starters, lineup, players, powerDiff }) {
  const splitMet = lineupHeroes(lineup, players).some(
    (x) => ['fighter', 'assassin'].includes(x.hero.category) && x.player && x.player.mechanics >= 85
  );
  const fightMet = powerDiff > 0;

  return [
    { key: 'A', name: '派一人偷家', desc: '有战士/刺客且操作 ≥ 85', met: splitMet, good: 6, bad: -6 },
    { key: 'B', name: '正面开团', desc: '当前战力领先', met: fightMet, good: 3, bad: -5 },
    { key: 'C', name: '回防守家', desc: '全队稳定性平均 ≥ 75', met: starters.reduce((s, p) => s + p.consistency, 0) / (starters.length || 1) >= 75, good: 1, bad: -3 }
  ];
}

/** 决策节点池：10 个节点，每场随机抽 3 个 */
export const TACTIC_NODES = [
  { id: 'firstblood', title: '一血团 · 03–05 分钟', time: 3, build: nodeFirstBloodOptions },
  { id: 'invade', title: '野区入侵 · 06–08 分钟', time: 6, build: nodeInvadeOptions },
  { id: 'dragon', title: '第一条小龙 · 08–10 分钟', time: 8, build: node1Options },
  { id: 'herald', title: '峡谷先锋 · 10–12 分钟', time: 11, build: nodeHeraldOptions },
  { id: 'plates', title: '塔皮交换 · 12–15 分钟', time: 12, build: nodePlatesOptions },
  { id: 'rotation', title: '换线运营 · 15–18 分钟', time: 15, build: nodeRotationOptions },
  { id: 'mid', title: '中期节奏 · 20–25 分钟', time: 20, build: node2Options },
  { id: 'baron', title: '大龙决策 · 25–30 分钟', time: 25, build: nodeBaronOptions },
  { id: 'final', title: '决胜团 · 30 分钟以后', time: 30, build: nodeFinalOptions },
  { id: 'backdoor', title: '偷家决策 · 35 分钟以后', time: 35, build: nodeBackdoorOptions }
];

/** 随机抽取本场比赛的决策节点（按时间排序） */
export function rollTacticNodes(rng, count = 3) {
  const pool = rng.shuffle(TACTIC_NODES.slice());
  return pool.slice(0, count).sort((a, b) => a.time - b.time);
}

/** 巅峰对决盲选：随机抽 5 个英雄，玩家可以重随机 */
export function rollPeakHeroes(rng) {
  return Array.from({ length: 5 }, () => rng.pick(HEROES).id);
}

/* ------------------------------------------------------------------ */
/* AI 决策                                                              */
/* ------------------------------------------------------------------ */

function aiChoose(options, rng) {
  const good = options.filter((o) => o.met);
  if (good.length && rng.chance(0.6)) return rng.pick(good).key;
  const rest = options.filter((o) => !o.met);
  return rest.length && rng.chance(0.7) ? rng.pick(rest).key : rng.pick(options).key;
}

/* ------------------------------------------------------------------ */
/* 战报模板                                                             */
/* ------------------------------------------------------------------ */

const TEMPLATES = {
  n1A: {
    win: [
      '我方强行接小龙团，打出一波 0 换 3，顺势收下第一条小龙。',
      '龙坑埋伏得手，我方抢下小龙并击杀对方两人，节奏起势。',
      '对方开龙出现失误，我方接团收割，经济开始领先。'
    ],
    lose: [
      '我方强行接团被打出 1 换 3，小龙拱手让人。',
      '小龙被对方打野抢下，我方撤退时再折一人。',
      '团战开得犹豫，阵型被切开，我方被逐个击破。'
    ]
  },
  n1B: {
    win: [
      '我方放掉第一条小龙，换掉上路两层镀层，经济差缩小到 0.8k。',
      '对方拿龙，我方推掉下路一塔，双方经济基本持平。',
      '我方用小龙换到先锋，转身吃下中路镀层，亏损被抹平。'
    ],
    lose: [
      '我方选择放龙，但镀层没换到，经济小幅落后。',
      '对方拿龙后顺势入侵野区，我方的置换慢了一拍。',
      '放龙决策执行不坚决，队员站位分散，什么也没换到。'
    ]
  },
  n1C: {
    win: [
      '双方在小龙区拉扯近两分钟，最终各自撤退，没有爆发人头。',
      '我方反复试探对方视野，逼出两个闪现后安然撤退。',
      '小龙被拉扯到极限，我方卡住位置，对方放弃开龙。'
    ],
    lose: [
      '拉扯中出现失误，我方辅助被先手抓死，只能放掉小龙。',
      '视野没做好，对方绕后开团，我方仓促应战丢掉小龙。',
      '队员沟通出现分歧，一半想打一半想撤，被对方抓住机会。'
    ]
  },
  n2A: {
    win: [
      '我方五人抱团推中，连破两座外塔后拿下大龙，经济反超。',
      '中路逼团成功，对方被迫接战，我方打出 2 换 5 直接破高地。',
      '抱团推进撕开缺口，对方防线崩溃，我方拿下关键资源。'
    ],
    lose: [
      '我方抱团推中被对方侧翼包抄，团战失利，节奏交出。',
      '推进过深，对方反打打出一波 0 换 4，我方丢掉大龙。',
      '抱团没有打出效果，反而让对手在边线偷掉两座塔。'
    ]
  },
  n2B: {
    win: [
      '我方上单在下路单带牵制三人，队友稳稳拿下大龙。',
      '分带拉扯奏效，我方偷掉对方高地塔，逼出回防。',
      '边线单杀对方核心，我方顺势转线扩大优势。'
    ],
    lose: [
      '分带被抓，我方少打多丢掉中路二塔。',
      '边线牵制没打出效果，正面被对方强开，阵型崩盘。'
    ]
  },
  n2C: {
    win: [
      '我方稳住发育，核心装备成型，正面团战开始占据上风。',
      '拖到后期，我方阵容强度反超，对方进攻屡屡受挫。',
      '避战换发育，经济差被抹平，比赛进入我方节奏。'
    ],
    lose: [
      '我方一味发育，被对方连续拿掉资源，经济差被拉开。',
      '拖后期的代价太大，对方已经推上高地。',
      '发育节奏被打断，核心装备迟迟不出，正面无力接团。'
    ]
  },
  finalWin: [
    '决胜团，我方中单绕后开团，一波 0 换 4 结束比赛。',
    '决胜团，我方 ADC 走位收割，四杀终结比赛。',
    '决胜团，我方打野抢下大龙，顺势一波推平。',
    '决胜团，我方上单先手开团，队友跟上，一波结束。'
  ],
  finalLose: [
    '决胜团，我方阵型被切，核心被秒，比赛失去悬念。',
    '决胜团，我方开团失误，被对方反打一波带走。',
    '决胜团，对方中单绕后，我方后排瞬间融化。',
    '决胜团，我方抢龙失败，被对方一波推平基地。'
  ]
};

function pick(rng, arr) {
  return arr[Math.floor(rng.next() * arr.length)];
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* 单局模拟                                                             */
/* ------------------------------------------------------------------ */

export function simulateGame({ players, teamAId, teamBId, draft, tactic, rng, gameIndex = 0, bo = 1, playerSide = 'blue', duos = [], mmBias = null }) {
  const powerA = computeTeamPower(players, teamAId, duos);
  const powerB = computeTeamPower(players, teamBId, duos);
  const startersA = startersOf(players, teamAId);
  const startersB = startersOf(players, teamBId);
  const lineA = resolveLineup(draft, 'blue', players);
  const lineB = resolveLineup(draft, 'red', players);
  const evalA = evaluateDraft(draft, 'blue', players);
  const evalB = evaluateDraft(draft, 'red', players);

  let adjA = powerA.total * (1 + evalA.pct);
  let adjB = powerB.total * (1 + evalB.pct);
  // 小地图实时战况的胜方给 +3% 战力（实时对局结果反向影响比赛）
  if (mmBias === 'blue') adjA *= 1.03;
  else if (mmBias === 'red') adjB *= 1.03;

  // FMVP 光环：FMVP 选手本局选到自己的 FMVP 英雄时 +3%（tactic.fmvp 来自玩家存档）
  let fmvpBonus = false;
  if (tactic?.fmvp?.playerId && tactic?.fmvp?.heroId) {
    const f = tactic.fmvp;
    const line = playerSide === 'blue' ? lineA : lineB;
    fmvpBonus = line.some((x) => x.isPick && x.playerId === f.playerId && x.heroId === f.heroId);
    if (fmvpBonus) {
      if (playerSide === 'blue') adjA *= 1.03;
      else adjB *= 1.03;
    }
  }

  // 前期经济差
  let economy = (adjA - adjB) * 0.35 + rng.gauss(0, 2.2);

  // ---- 决策节点：本场随机抽取的 3 个 ----
  // ---- 决策节点：本场随机抽取的 3 个 ----
  const nodeDefs = tactic?.nodes?.length ? tactic.nodes : rollTacticNodes(rng, 3);
  const log = [];
  const decisionsBlue = {};
  const decisionsRed = {};
  for (const nodeDef of nodeDefs) {
    const ctxA = { starters: startersA, oppStarters: startersB, lineup: lineA, oppLineup: lineB, players, powerDiff: adjA - adjB, economyDiff: economy };
    const ctxB = { starters: startersB, oppStarters: startersA, lineup: lineB, oppLineup: lineA, players, powerDiff: adjB - adjA, economyDiff: -economy };
    const optA = nodeDef.build(ctxA);
    const optB = nodeDef.build(ctxB);
    const choiceA = tactic?.choices?.[nodeDef.id] || aiChoose(optA, rng);
    const choiceB = aiChoose(optB, rng);
    const dA = applyChoice(optA, choiceA);
    const dB = applyChoice(optB, choiceB);
    adjA += dA;
    adjB += dB;
    economy += (dA - dB) * 0.45;
    decisionsBlue[nodeDef.id] = choiceA;
    decisionsRed[nodeDef.id] = choiceB;
    const t = nodeDef.time * 60 + Math.floor(rng.float(0, 180));
    log.push({ time: fmtTime(t), text: buildNodeText(nodeDef.id, choiceA, dA, optA, rng), good: dA >= 0 });
  }

  // ---- 表现值采样 ----
  const extraA = stabilityExtra(startersA, gameIndex, bo);
  const extraB = stabilityExtra(startersB, gameIndex, bo);
  const sigmaA = MATCH.sigma + stabilityBand(startersA) + extraA;
  const sigmaB = MATCH.sigma + stabilityBand(startersB) + extraB;
  const perfA = rng.gauss(adjA, sigmaA);
  const perfB = rng.gauss(adjB, sigmaB);
  const winner = perfA >= perfB ? 'blue' : 'red';
  const margin = Math.abs(perfA - perfB);

  // 决胜团战报
  const t3 = 28 * 60 + Math.floor(rng.float(0, 420));
  log.push({
    time: fmtTime(t3),
    text: pick(rng, winner === 'blue' ? TEMPLATES.finalWin : TEMPLATES.finalLose),
    good: winner === 'blue'
  });

  const killBase = 8 + Math.round(margin * 0.55);
  const winKills = Math.min(38, killBase + Math.floor(rng.float(2, 9)));
  const loseKills = Math.max(3, winKills - Math.floor(rng.float(4, 13)));
  const score = winner === 'blue'
    ? { blue: winKills, red: loseKills }
    : { blue: loseKills, red: winKills };

  const winStarters = winner === 'blue' ? startersA : startersB;
  const mvp = pickMvp(winStarters, rng);

  return {
    winner,
    winSide: winner,
    score,
    log,
    economy,
    perf: { blue: perfA, red: perfB },
    adjustedPower: { blue: adjA, red: adjB },
    decisions: {
      blue: decisionsBlue,
      red: decisionsRed
    },
    mvp,
    evals: { blue: evalA, red: evalB },
    fmvpBonus
  };
}

function stabilityBand(starters) {
  const avg = teamConsistency(starters);
  if (avg >= 80) return MATCH.sigmaStableHigh - MATCH.sigma;
  if (avg <= 60) return MATCH.sigmaStableLow - MATCH.sigma;
  return 0;
}

function stabilityExtra(starters, gameIndex, bo) {
  if (bo < 5) return 0;
  return teamConsistency(starters) < 60 ? gameIndex * MATCH.bo5SigmaStep : 0;
}

function applyChoice(options, key) {
  const opt = options.find((o) => o.key === key) || options[0];
  return opt.met ? opt.good : opt.bad;
}

function buildNodeText(node, choice, delta, options, rng) {
  const key = `${node}${choice}`;
  const tpl = TEMPLATES[key];
  if (tpl) {
    if (tpl.win && tpl.lose) return pick(rng, delta >= 0 ? tpl.win : tpl.lose);
    return pick(rng, tpl);
  }
  const opt = options.find((o) => o.key === choice);
  const name = opt ? opt.name : '继续运营';
  const good = delta >= 0;
  const generic = good
    ? [`我方${name}执行到位，节奏继续握在自己手里。`, `我方${name}拿到想要的资源，经济小幅领先。`]
    : [`我方${name}执行得不够坚决，节奏被对方拖住。`, `我方${name}被对方反打，资源交换吃了亏。`];
  return pick(rng, generic);
}

function pickMvp(starters, rng) {
  if (!starters.length) return null;
  const scored = starters.map((p) => ({
    p,
    score: currentAbility(p) + rng.float(-6, 6) + (p.role === 'MID' || p.role === 'ADC' ? 2 : 0)
  }));
  scored.sort((a, b) => b.score - a.score);
  const mvp = scored[0].p;
  return { playerId: mvp.id, name: mvp.name, role: mvp.role, roleCn: ROLE_CN[mvp.role] };
}

/* ------------------------------------------------------------------ */
/* 系列赛                                                               */
/* ------------------------------------------------------------------ */

/** 巅峰对决：BO7 打到 3:3 时，双方盲选一局定胜负 */
export function simulatePeakDuel({ players, teamAId, teamBId, rng, duos, peakDuel }) {
  const startersA = startersOf(players, teamAId);
  const startersB = startersOf(players, teamBId);

  const pickHeroes = (chosen) => {
    if (Array.isArray(chosen) && chosen.length >= 5) return chosen.slice(0, 5);
    return Array.from({ length: 5 }, () => rng.pick(HEROES).id);
  };

  const blueHeroes = pickHeroes(peakDuel?.blue);
  const redHeroes = pickHeroes(peakDuel?.red);

  const bonusOf = (heroIds, starters) => {
    let b = 0;
    for (const id of heroIds) {
      const hero = HERO_BY_ID[id];
      if (!hero) continue;
      const owner = starters.find((p) => p.role === hero.role);
      const isSignature = owner && Array.isArray(owner.champions) && owner.champions.includes(id);
      b += isSignature ? 0.03 : 0.01;
    }
    return Math.min(0.12, b);
  };

  const powerA = computeTeamPower(players, teamAId, duos).total * (1 + bonusOf(blueHeroes, startersA));
  const powerB = computeTeamPower(players, teamBId, duos).total * (1 + bonusOf(redHeroes, startersB));

  const sigma = MATCH.sigma + 1.5;
  const perfA = rng.gauss(powerA, sigma);
  const perfB = rng.gauss(powerB, sigma);
  const winner = perfA >= perfB ? 'blue' : 'red';

  return {
    game: {
      winner,
      peak: true,
      log: [
        { time: '巅峰对决', text: '双方盲选阵容，一局定胜负。', good: true },
        {
          time: '巅峰对决',
          text: winner === 'blue' ? '我方在巅峰对决中笑到最后，全场沸腾。' : '我方在巅峰对决中惜败，就差一口气。',
          good: winner === 'blue'
        }
      ]
    },
    blueHeroes,
    redHeroes,
    winner
  };
}

export function simulateSeries({ players, teamAId, teamBId, draft, tactic, rng, bo = 3, playerSide = 'blue', duos = [], peakDuel = null, mmBias = null }) {
  const need = Math.ceil(bo / 2);
  let winsA = 0;
  let winsB = 0;
  const games = [];
  let peak = null;

  for (let i = 0; i < bo && winsA < need && winsB < need; i++) {
    if (bo >= 7 && i === 6 && winsA === 3 && winsB === 3) {
      const duel = simulatePeakDuel({ players, teamAId, teamBId, rng, duos, peakDuel });
      games.push(duel.game);
      if (duel.game.winner === 'blue') winsA += 1;
      else winsB += 1;
      peak = { triggered: true, blueHeroes: duel.blueHeroes, redHeroes: duel.redHeroes, winner: duel.winner };
      break;
    }

    const game = simulateGame({
      players,
      teamAId,
      teamBId,
      draft,
      tactic,
      rng,
      gameIndex: i,
      bo,
      playerSide,
      mmBias,
      duos
    });
    games.push(game);
    if (game.winner === 'blue') winsA += 1;
    else winsB += 1;
  }

  return {
    games,
    winner: winsA > winsB ? 'blue' : 'red',
    score: { blue: winsA, red: winsB },
    blueTeamId: teamAId,
    redTeamId: teamBId,
    peakDuel: peak
  };
}

/** 供 UI 预览：本场随机到的决策节点，以及每个选项是否满足条件 */
export function decisionPreview({ players, teamId, oppTeamId, draft, nodes }) {
  const starters = startersOf(players, teamId);
  const oppStarters = startersOf(players, oppTeamId);
  const line = resolveLineup(draft, 'blue', players);
  const oppLine = resolveLineup(draft, 'red', players);
  const defs = nodes && nodes.length ? nodes : TACTIC_NODES.slice(0, 2);
  return {
    nodes: defs.map((def) => ({
      id: def.id,
      title: def.title,
      options: def.build({
        starters,
        oppStarters,
        lineup: line,
        oppLineup: oppLine,
        players,
        powerDiff: 0,
        economyDiff: 0
      })
    }))
  };
}
