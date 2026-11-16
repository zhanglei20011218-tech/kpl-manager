// 实时比赛引擎：1 tick = 1 秒（对应约 9 秒游戏时间），一局 120 tick = 2 分钟
// 关键时刻暂停等玩家决策；水晶告破/经济崩盘则提前结束
import { HERO_BY_ID } from '../data/heroes.js';
import { MATCH_TICKS, KEY_EVENTS, EVENT_OPTIONS, curveAt } from '../data/battlefield.js';
import { computeTeamPower } from './power.js';
import { evaluateDraft, resolveLineup } from './match-draft.js';
import { startersOf } from '../data/teams.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createLiveMatch({ draft, players, teamAId, teamBId, meta, fmvp, synergy = 60, rng }) {
  const powerA = computeTeamPower(players, teamAId, []);
  const powerB = computeTeamPower(players, teamBId, []);
  const evalA = evaluateDraft(draft, 'blue', players);
  const evalB = evaluateDraft(draft, 'red', players);
  const lineA = resolveLineup(draft, 'blue', players);
  const lineB = resolveLineup(draft, 'red', players);
  const startersA = startersOf(players, teamAId);
  const startersB = startersOf(players, teamBId);

  // 强势期乘数：取该队 5 个英雄当前 tick 的平均曲线值
  const curveOf = (line, tick) => {
    const phases = line.map((x) => (HERO_BY_ID[x.heroId] || {}).phase || 'balanced');
    if (!phases.length) return 1;
    return phases.reduce((s, p) => s + curveAt(p, tick), 0) / phases.length;
  };

  // FMVP 光环：本队有 FMVP 且拿到其 FMVP 英雄
  const fmvpBonus = (line) =>
    fmvp && line.some((x) => x.isPick && x.playerId === fmvp.playerId && x.heroId === fmvp.heroId) ? 0.08 : 0;

  const baseA = powerA.total * (1 + evalA.pct);
  const baseB = powerB.total * (1 + evalB.pct);
  const synergyBonus = clamp((synergy - 40) / 60, 0, 1) * 0.09;

  const st = {
    tick: 0,
    done: false,
    winnerSide: null,
    blue: { kills: 0, towers: 0, dragons: 0, econ: 0 },
    red: { kills: 0, towers: 0, dragons: 0, econ: 0 },
    log: [],
    pendingEvent: null,
    decisions: [],
    endedEarly: false,
    baseA,
    baseB,
    synergyBonus,
    fmvpA: fmvpBonus(lineA),
    fmvpB: fmvpBonus(lineB),
    startersA,
    startersB,
    lineA,
    lineB,
    evalA,
    evalB
  };

  const econDiff = () => st.blue.econ - st.red.econ;

  // 当前有效战力（含强势期 + 经济追赶 + 默契/FMVP）
  function effPower(side) {
    const tick = st.tick;
    const base = side === 'blue' ? baseA : baseB;
    const line = side === 'blue' ? lineA : lineB;
    const fm = side === 'blue' ? st.fmvpA : st.fmvpB;
    const diff = econDiff();
    const behind = side === 'blue' ? -diff : diff; // 正数 = 落后多少
    // 经济追赶：落后越多，战斗战力补得越多（文档 5.3）
    const catchUp = behind > 100 ? 0.15 : behind > 60 ? 0.1 : behind > 30 ? 0.05 : 0;
    return base * curveOf(line, tick) * (1 + fm) * (1 + st.synergyBonus * 0.5) * (1 + catchUp);
  }

  function log(text) {
    st.log.push(text);
  }

  function gameClock() {
    const sec = st.tick * 9;
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }

  /** 推进一秒；返回当前等待决策的事件（若有） */
  function tick() {
    if (st.done || st.pendingEvent) return st.pendingEvent;
    st.tick += 1;

    // 经济：战力差驱动，带随机波动
    const pa = effPower('blue');
    const pb = effPower('red');
    const gap = (pa - pb) * 0.55 + (rng.next() - 0.5) * 3;
    st.blue.econ += 0.6 + Math.max(0, gap) * 0.12;
    st.red.econ += 0.6 + Math.max(0, -gap) * 0.12;

    // 小规模交战：每 3 tick 一次
    if (st.tick % 3 === 0) {
      const winA = rng.chance(pa / (pa + pb));
      const victim = winA ? 'red' : 'blue';
      st[winA ? 'blue' : 'red'].kills += 1;
      st[winA ? 'blue' : 'red'].econ += 1.5;
      if (st.tick % 12 === 0) log(`[${gameClock()}] ${winA ? '我方' : '对手'}打出一次击杀交换，经济差 ${Math.round(econDiff())} 百`);
      if (st[victim].towers > 0 && rng.chance(0.05)) st[victim].towers -= 1;
    }

    // 推塔：经济优势方缓慢推进
    if (st.tick % 8 === 0) {
      const diff = econDiff();
      if (diff > 18) st.blue.towers = Math.min(9, st.blue.towers + 1);
      else if (diff < -18) st.red.towers = Math.min(9, st.red.towers + 1);
    }

    // 关键时刻：暂停等决策
    const ev = KEY_EVENTS.find((e) => e.tick === st.tick);
    if (ev) {
      st.pendingEvent = { ...ev, options: EVENT_OPTIONS[ev.kind] || EVENT_OPTIONS.dragon };
      log(`[${gameClock()}] ${ev.label} —— 等待你的决策`);
      return st.pendingEvent;
    }

    // 提前结束：一路高地全破 + 经济碾压
    const diff = econDiff();
    if (st.blue.towers >= 8) return endMatch('blue', '对手高地和兵线全面失守');
    if (st.red.towers >= 8) return endMatch('red', '我方高地和兵线全面失守');
    if (st.tick >= MATCH_TICKS) {
      const scoreA = st.blue.towers * 3 + st.blue.dragons * 4 + st.blue.kills * 0.5;
      const scoreB = st.red.towers * 3 + st.red.dragons * 4 + st.red.kills * 0.5;
      return endMatch(scoreA >= scoreB ? 'blue' : 'red', '时间耗尽，按场面优势判定');
    }
    return null;
  }

  /** 玩家在关键时刻做选择 */
  function decide(optionKey) {
    const ev = st.pendingEvent;
    if (!ev) return null;
    const option = ev.options.find((o) => o.key === optionKey) || ev.options[0];
    const pa = effPower('blue');
    const pb = effPower('red');
    // 风险越高，胜率波动越大：以基础胜率为中心放大/缩小
    const baseP = pa / (pa + pb);
    const swing = (option.risk - 0.3) * (rng.next() - 0.5) * 1.6;
    const winA = rng.chance(clamp(baseP + swing, 0.08, 0.92));

    if (ev.kind === 'dragon') {
      const winner = winA ? 'blue' : 'red';
      st[winner].dragons += 1;
      st[winner].econ += 5;
      if (!winA && option.key === 'trade') {
        st.blue.econ += 3;
        log(`[${gameClock()}] 放弃${ev.label}，换掉两路外塔，经济差收窄`);
      } else if (winA) {
        log(`[${gameClock()}] ${ev.label}：我方${option.label}得手，拿下资源`);
      } else {
        log(`[${gameClock()}] ${ev.label}：对手${option.label === 'fight' ? '抢下资源' : '稳住了局面'}`);
      }
    } else {
      // 高地/推进类
      if (option.key === 'push') {
        if (winA) {
          st.blue.towers += 2;
          log(`[${gameClock()}] 强推成功，连破两塔，兵线压进对手半区`);
        } else {
          st.red.towers += 1;
          log(`[${gameClock()}] 强推受阻，对手反推一座外塔`);
        }
      } else if (option.key === 'split') {
        st.blue.econ += winA ? 4 : 1.5;
        if (winA) st.blue.towers += 1;
        log(`[${gameClock()}] 分带牵制${winA ? '成功，对手被迫分兵' : '被识破，收益有限'}`);
      } else {
        st.red.econ = Math.max(0, st.red.econ - 2);
        st.blue.econ += 1;
        log(`[${gameClock()}] 回防稳线，清掉兵线，把比赛往后拖`);
      }
    }

    st.decisions.push({ tick: st.tick, event: ev.id, option: option.key, win: winA });
    st.pendingEvent = null;
    return { win: winA, option };
  }

  function endMatch(side, reason) {
    st.winnerSide = side;
    st.done = true;
    st.pendingEvent = null;
    log(`比赛结束：${side === 'blue' ? '我方' : '对手'}获胜（${reason}）`);
    return null;
  }

  function finish() {
    if (!st.done) endMatch(econDiff() >= 0 ? 'blue' : 'red', '提前结束');
    return {
      winnerSide: st.winnerSide,
      score: { blue: st.blue.kills, red: st.red.kills },
      towers: { blue: st.blue.towers, red: st.red.towers },
      dragons: { blue: st.blue.dragons, red: st.red.dragons },
      econ: { blue: Math.round(st.blue.econ), red: Math.round(st.red.econ) },
      log: st.log,
      decisions: st.decisions,
      ticks: st.tick,
      endedEarly: st.endedEarly,
      lineupA: st.lineA,
      lineupB: st.lineB
    };
  }

  return { state: st, tick, decide, finish };
}
