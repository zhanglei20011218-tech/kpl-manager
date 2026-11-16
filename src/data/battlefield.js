// 战场数据：地图布局（0–1 归一化坐标）、英雄强势期曲线、关键时刻
// 一局 120 tick = 2 分钟现实时间，对应 18 分钟游戏时间（1 tick ≈ 9 秒）

export const MATCH_TICKS = 120;
export const GAME_SECONDS_PER_TICK = 9;

// 蓝方（左下）→ 红方（右上），与官方地图布局一致
export const MAP = {
  base: { blue: [0.1, 0.9], red: [0.9, 0.1] },
  dragon: [0.66, 0.72], // 暴君（下半区）
  tyrant: [0.34, 0.28], // 主宰（上半区）
  river: [[0.02, 0.08], [0.9, 0.98]],
  lanes: {
    TOP: { label: '对抗路', path: [[0.14, 0.74], [0.08, 0.3], [0.28, 0.06], [0.66, 0.05]] },
    MID: { label: '中路', path: [[0.16, 0.84], [0.5, 0.5], [0.84, 0.16]] },
    ADC: { label: '发育路', path: [[0.26, 0.92], [0.72, 0.94], [0.94, 0.62], [0.92, 0.26]] },
    JUG: { label: '打野', path: [[0.2, 0.8], [0.42, 0.62], [0.58, 0.38], [0.8, 0.2]] },
    SUP: { label: '游走', path: [[0.18, 0.86], [0.5, 0.5], [0.82, 0.18]] }
  }
};

// 每条路的塔：路径进度（0 = 自家水晶侧，1 = 对方水晶侧）
export const TOWER_T = [0.34, 0.56, 0.78];

// 强势期曲线（5 段对应 0–20% / 20–40% / 40–60% / 60–80% / 80–100% 比赛进度）
export const POWER_CURVE = {
  early: [1.2, 1.05, 0.88, 0.78, 0.7],
  mid: [0.95, 1.12, 1.1, 0.95, 0.9],
  late: [0.85, 0.92, 1.05, 1.15, 1.18],
  balanced: [1.0, 1.02, 1.0, 0.99, 1.0]
};

export function curveAt(phase, tick) {
  const curve = POWER_CURVE[phase] || POWER_CURVE.balanced;
  const seg = Math.min(curve.length - 1, Math.floor((tick / MATCH_TICKS) * curve.length));
  return curve[seg];
}

// 关键时刻：每个都会暂停等玩家决策；一方水晶告破则提前结束
export const KEY_EVENTS = [
  { tick: 13, id: 'first-dragon', label: '第一条暴君', kind: 'dragon' },
  { tick: 27, id: 'shield-down', label: '防御塔护盾消失', kind: 'tower' },
  { tick: 53, id: 'tyrant', label: '主宰刷新', kind: 'dragon' },
  { tick: 67, id: 'shadow-dragon', label: '暗影暴君团', kind: 'dragon' },
  { tick: 100, id: 'high-ground', label: '高地攻坚', kind: 'tower' },
  { tick: 117, id: 'storm-dragon', label: '风暴龙王团', kind: 'dragon' }
];

// 决策选项：risk 越高，收益与风险同时放大
export const EVENT_OPTIONS = {
  dragon: [
    { key: 'fight', label: '强开团', desc: '抢占视野直接开团，赢面大但失误也会被抓', risk: 0.55 },
    { key: 'trade', label: '放龙换线', desc: '放弃资源换推进与兵线，稳但不赚', risk: 0.35 },
    { key: 'poke', label: '拉扯试探', desc: '保持阵型消耗，低风险小收益', risk: 0.28 }
  ],
  tower: [
    { key: 'push', label: '强推高地', desc: '集中火力破塔，成功即破口', risk: 0.5 },
    { key: 'split', label: '分带牵扯', desc: '两路同时施压，逼对手分兵', risk: 0.36 },
    { key: 'back', label: '回防稳线', desc: '清线稳住节奏，把团战往后拖', risk: 0.2 }
  ]
};
