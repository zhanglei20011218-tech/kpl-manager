import { squadOf } from '../data/teams.js';
import { currentAbility, formatMoney } from './player.js';
import { createRng } from './rng.js';

export const EVENT_DEFS = [
  {
    id: 'locker-room',
    title: '更衣室不满',
    icon: '😤',
    desc: '连续失利之后，训练室的气氛变得凝重。几名队员私下抱怨战术安排，有人把耳机摔在了桌上。',
    condition: (state) => {
      const r = state.recentResults || [];
      if (r.length < 2) return false;
      if (!(r[r.length - 1] === 'L' && r[r.length - 2] === 'L')) return false;
      const squad = squadOf(state.players, state.playerTeamId);
      return squad.some((p) => p.satisfaction < 40);
    },
    options: [
      {
        key: 'team-building',
        label: '组织一次团建（20 万）',
        desc: '吃饭、唱 K、把话说开。',
        effect: (state) => {
          state.cash -= 20 * 10000;
          const squad = squadOf(state.players, state.playerTeamId);
          for (const p of squad) p.satisfaction = Math.min(100, p.satisfaction + 10);
          return '一顿火锅之后，训练室重新有了笑声。全队满意度 +10。';
        }
      },
      {
        key: 'ignore',
        label: '先赢下来再说',
        desc: '不处理情绪，把压力留在赛场上。',
        effect: (state) => {
          const squad = squadOf(state.players, state.playerTeamId);
          for (const p of squad) {
            p.satisfaction = Math.max(0, p.satisfaction - 5);
            p.temp = { ...(p.temp || {}), consistency: (p.temp?.consistency || 0) - 3, matches: 1 };
          }
          return '没人再提这件事，但空气更冷了。全队满意度 -5，下一场稳定性 -3。';
        }
      }
    ]
  },
  {
    id: 'genius-lost',
    title: '天才的迷茫',
    icon: '🌫️',
    desc: '那个被寄予厚望的年轻人已经连续几场打得束手束脚。数据不难看，但他自己知道，他不敢操作了。',
    condition: (state) => {
      const squad = squadOf(state.players, state.playerTeamId);
      return squad.some((p) => p.age <= 19 && p.potential >= 85 && (p.form || 0) <= -4);
    },
    options: [
      {
        key: 'start-him',
        label: '下一场继续给首发',
        desc: '用比赛喂信心，代价是稳定性。',
        effect: (state) => {
          const squad = squadOf(state.players, state.playerTeamId);
          const kid = squad.find((p) => p.age <= 19 && p.potential >= 85);
          if (!kid) return '没有找到合适的年轻人。';
          kid.temp = { ...(kid.temp || {}), mechanics: 5, consistency: -5, matches: 1 };
          return `${kid.name} 眼里重新有了光。下一场操作 +5，稳定性 -5。`;
        }
      },
      {
        key: 'bench-him',
        label: '下放替补调整',
        desc: '保护他，但本赛季成长会变慢。',
        effect: (state) => {
          const squad = squadOf(state.players, state.playerTeamId);
          const kid = squad.find((p) => p.age <= 19 && p.potential >= 85);
          if (!kid) return '没有找到合适的年轻人。';
          kid.growthPenalty = 0.2;
          return `${kid.name} 被安排去调整心态。本赛季成长 -20%。`;
        }
      }
    ]
  },
  {
    id: 'veteran-heart',
    title: '老将的坚持',
    icon: '🛡️',
    desc: '训练结束后，训练室里只剩他一个人。他说自己还能打，但也承认，也许是时候考虑以后了。',
    condition: (state) => {
      const squad = squadOf(state.players, state.playerTeamId);
      return squad.some((p) => p.age >= 29 && p.loyalty >= 80 && currentAbility(p) >= 75);
    },
    options: [
      {
        key: 'renew',
        label: '续约一年',
        desc: '尊重他的坚持，薪资要求降低 10%。',
        effect: (state) => {
          const squad = squadOf(state.players, state.playerTeamId);
          const vet = squad.find((p) => p.age >= 29 && p.loyalty >= 80 && currentAbility(p) >= 75);
          if (!vet) return '没有找到合适的老将。';
          vet.contractYears += 1;
          vet.salary = Math.round(vet.salary * 0.9);
          vet.loyalty = Math.min(100, vet.loyalty + 5);
          return `${vet.name} 续约一年，薪资降低 10%。更衣室很受触动。`;
        }
      },
      {
        key: 'let-go',
        label: '尊重他的选择',
        desc: '放他离开，收获一笔转会费。',
        effect: (state) => {
          const squad = squadOf(state.players, state.playerTeamId);
          const vet = squad.find((p) => p.age >= 29 && p.loyalty >= 80 && currentAbility(p) >= 75);
          if (!vet) return '没有找到合适的老将。';
          const fee = Math.round(vet.value * 0.4);
          vet.teamId = null;
          state.cash += fee;
          for (const p of squadOf(state.players, state.playerTeamId)) {
            p.satisfaction = Math.min(100, p.satisfaction + 5);
          }
          return `${vet.name} 离开了。俱乐部收到 ${formatMoney(fee)}，全队满意度 +5。`;
        }
      }
    ]
  }
];

/** 检查是否有可触发事件（每次只弹一个） */
export function checkEvent(state) {
  if (state.pendingEvent) return state.pendingEvent;
  const seen = state.seenEvents || {};
  for (const def of EVENT_DEFS) {
    const seasonKey = `${state.seasonNo}:${def.id}`;
    if (seen[seasonKey]) continue;
    if (def.condition(state)) {
      state.pendingEvent = { id: def.id, ...serializeDef(def) };
      return state.pendingEvent;
    }
  }
  return null;
}

function serializeDef(def) {
  return {
    title: def.title,
    icon: def.icon,
    desc: def.desc,
    options: def.options.map((o) => ({ key: o.key, label: o.label, desc: o.desc }))
  };
}

export function resolveEvent(state, choiceKey) {
  const pending = state.pendingEvent;
  if (!pending) return { ok: false };
  const def = EVENT_DEFS.find((d) => d.id === pending.id);
  if (!def) return { ok: false };
  const opt = def.options.find((o) => o.key === choiceKey);
  if (!opt) return { ok: false };

  const text = opt.effect(state);
  const seasonKey = `${state.seasonNo}:${def.id}`;
  state.seenEvents = state.seenEvents || {};
  state.seenEvents[seasonKey] = true;
  state.pendingEvent = null;
  state.log.push({ type: 'event', text: `${def.title}：${text}` });
  return { ok: true, text };
}

/** 新赛季重置一次性状态 */
export function resetSeasonFlags(state) {
  state.seenEvents = state.seenEvents || {};
  state.pendingEvent = null;
  state.recentResults = [];
  for (const p of state.players) {
    p.temp = null;
    p.growthPenalty = 0;
  }
}
