// 实时小地图：10 个英雄自行移动、交战、阵亡复活。
// 玩家用「进攻 / 防守 / 平衡」影响己方推进倾向，HUD 实时显示经济、人头、塔、龙。

import { HERO_BY_ID } from '../data/heroes.js';

const BASE = { blue: { x: 86, y: 86 }, red: { x: 14, y: 14 } };
const TOWERS = {
  blue: [[72, 72], [64, 60], [56, 50]],
  red: [[28, 28], [36, 40], [44, 50]]
};
const DRAGON = { x: 50, y: 62 };
const TICK_MS = 90;
const IMG = new Map();

function loadImg(id) {
  if (IMG.has(id)) return IMG.get(id);
  const url = (HERO_BY_ID[id] && HERO_BY_ID[id].img) || `./assets/heroes/${id}.jpg`;
  const img = new Image();
  img.src = url;
  IMG.set(id, img);
  return img;
}

function pickTarget(u, mode) {
  const enemyBase = u.side === 'blue' ? BASE.red : BASE.blue;
  const ownBase = BASE[u.side];
  // 进攻倾向：越激进越往敌方基地压；防守往回撤
  const aggr = [0.35, 0.5, 0.68][['defend', 'balanced', 'attack'].indexOf(mode)] ?? 0.5;
  const r = Math.random();
  if (r < aggr) return { x: enemyBase.x + (Math.random() - 0.5) * 22, y: enemyBase.y + (Math.random() - 0.5) * 22 };
  if (r < aggr + 0.22) return { x: DRAGON.x + (Math.random() - 0.5) * 14, y: DRAGON.y + (Math.random() - 0.5) * 14 };
  return { x: ownBase.x + (Math.random() - 0.5) * 40, y: ownBase.y + (Math.random() - 0.5) * 40 };
}

export function createMinimap(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const size = Math.round(rect.width || 340);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const { blue = [], red = [], onEnd } = opts || {};
  const units = [];
  const add = (side, list) =>
    list.forEach((p) => {
      const b = BASE[side];
      units.push({
        side,
        name: p.name,
        role: p.role,
        heroId: p.heroId,
        power: p.power || 82,
        x: b.x + (Math.random() - 0.5) * 10,
        y: b.y + (Math.random() - 0.5) * 10,
        tx: b.x,
        ty: b.y,
        hp: 100,
        maxHp: 100,
        alive: true,
        deadAt: 0,
        kills: 0,
        deaths: 0
      });
      loadImg(p.heroId);
    });
  add('blue', blue);
  add('red', red);

  const st = {
    time: 0,
    mode: 'balanced',
    gold: [800, 800],
    kills: [0, 0],
    towers: [3, 3],
    dragons: [0, 0],
    lastDragon: 0,
    over: false
  };

  let timer = 0;
  let raf = 0;
  let last = 0;

  function p2c(x, y) {
    return [(x / 100) * size, (y / 100) * size];
  }

  function drawMap() {
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#0d1a24');
    g.addColorStop(1, '#0a1620');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // 河道
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.13)';
    ctx.lineWidth = size * 0.055;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.12);
    ctx.lineTo(size * 0.88, size);
    ctx.stroke();

    // 三条路
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = size * 0.03;
    const lanes = [
      [0, 0.02, 0.02, 0],
      [[0, 0.04], [1, 0.96]],
      [[0.02, 1], [1, 0.02]]
    ];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, size);
    ctx.moveTo(0, 0);
    ctx.lineTo(size, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(size, size);
    ctx.stroke();

    // 龙坑
    const [dx, dy] = p2c(DRAGON.x, DRAGON.y);
    ctx.beginPath();
    ctx.arc(dx, dy, size * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `${Math.round(size * 0.032)}px system-ui`;
    ctx.fillStyle = 'rgba(216, 180, 254, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('龙', dx, dy + size * 0.012);

    // 塔
    for (const side of ['blue', 'red']) {
      TOWERS[side].forEach(([tx, ty], i) => {
        if (i >= st.towers[side === 'blue' ? 1 : 0]) return;
        const [cx, cy] = p2c(tx, ty);
        ctx.beginPath();
        ctx.rect(cx - size * 0.018, cy - size * 0.018, size * 0.036, size * 0.036);
        ctx.fillStyle = side === 'blue' ? 'rgba(59, 130, 246, 0.55)' : 'rgba(239, 68, 68, 0.55)';
        ctx.fill();
      });
    }

    // 基地
    for (const side of ['blue', 'red']) {
      const [bx, by] = p2c(BASE[side].x, BASE[side].y);
      ctx.beginPath();
      ctx.arc(bx, by, size * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = side === 'blue' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(239, 68, 68, 0.18)';
      ctx.fill();
    }
  }

  function drawUnit(u) {
    const [cx, cy] = p2c(u.x, u.y);
    const r = size * 0.032;
    if (!u.alive) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120, 120, 120, 0.5)';
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    const img = IMG.get(u.heroId);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = u.side === 'blue' ? '#3b82f6' : '#ef4444';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = u.side === 'blue' ? '#60a5fa' : '#f87171';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 血条
    const w = r * 2.1;
    const h = 2.6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(cx - w / 2, cy - r - h - 2, w, h);
    ctx.fillStyle = u.hp > 45 ? '#4ade80' : u.hp > 20 ? '#fbbf24' : '#ef4444';
    ctx.fillRect(cx - w / 2, cy - r - h - 2, (w * u.hp) / u.maxHp, h);
  }

  function step() {
    if (st.over) return;
    st.time += TICK_MS / 1000;

    // 经济自然增长
    st.gold[0] += 42 + Math.random() * 24;
    st.gold[1] += 42 + Math.random() * 24;

    // 龙：每 25 秒一次
    if (st.time - st.lastDragon > 25) {
      st.lastDragon = st.time;
      const who = Math.random() < 0.5 ? 0 : 1;
      st.dragons[who] += 1;
      st.gold[who] += 900;
    }

    // 推塔
    if (Math.random() < 0.012) {
      const side = Math.random() < 0.5 ? 0 : 1;
      if (st.towers[side] > 0) st.towers[side] -= 1;
    }
    if (st.towers[0] === 0 || st.towers[1] === 0) {
      st.over = true;
      if (onEnd) onEnd({ winner: st.towers[1] === 0 ? 'blue' : 'red', state: st });
      return;
    }
    if (st.time > 180) {
      st.over = true;
      if (onEnd) onEnd({ winner: st.gold[0] >= st.gold[1] ? 'blue' : 'red', state: st });
      return;
    }

    for (const u of units) {
      if (!u.alive) {
        if (st.time - u.deadAt > 6) {
          u.alive = true;
          u.hp = u.maxHp;
          const b = BASE[u.side];
          u.x = b.x + (Math.random() - 0.5) * 8;
          u.y = b.y + (Math.random() - 0.5) * 8;
        }
        continue;
      }

      // 找到最近敌人
      let foe = null;
      let best = 14;
      for (const v of units) {
        if (v.side === u.side || !v.alive) continue;
        const d = Math.hypot(v.x - u.x, v.y - u.y);
        if (d < best) {
          best = d;
          foe = v;
        }
      }

      if (foe && best < 10) {
        // 交战：伤害取决于战力 + 随机
        const dmg = (u.power / 100) * (6 + Math.random() * 10);
        foe.hp -= dmg;
        if (foe.hp <= 0) {
          foe.hp = 0;
          foe.alive = false;
          foe.deadAt = st.time;
          foe.deaths += 1;
          u.kills += 1;
          const side = u.side === 'blue' ? 0 : 1;
          st.kills[side] += 1;
          st.gold[side] += 320;
        }
        // 靠近
        u.x += ((foe.x - u.x) / best) * 0.8;
        u.y += ((foe.y - u.y) / best) * 0.8;
      } else {
        // 走位
        if (Math.hypot(u.tx - u.x, u.ty - u.y) < 3) {
          const mode = u.side === 'blue' ? st.mode : 'balanced';
          const t = pickTarget(u, mode);
          u.tx = t.x;
          u.ty = t.y;
        }
        const dx = u.tx - u.x;
        const dy = u.ty - u.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = 0.55;
        u.x = Math.max(2, Math.min(98, u.x + (dx / d) * sp));
        u.y = Math.max(2, Math.min(98, u.y + (dy / d) * sp));
      }

      // 缓慢回血
      if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 0.4);
    }

    render();
  }

  function render() {
    drawMap();
    for (const u of units) drawUnit(u);
    const hud = canvas.parentElement?.querySelector('.mm-stats');
    if (hud) {
      hud.innerHTML = `
        <span><b>${Math.floor(st.gold[0])}</b> vs <b>${Math.floor(st.gold[1])}</b> 经济</span>
        <span><b>${st.kills[0]}</b> : <b>${st.kills[1]}</b> 人头</span>
        <span><b>${st.towers[0]}</b> vs <b>${st.towers[1]}</b> 塔</span>
        <span><b>${st.dragons[0]}</b> vs <b>${st.dragons[1]}</b> 龙</span>`;
    }
  }

  function loop(ts) {
    if (!last) last = ts;
    if (ts - last >= TICK_MS) {
      last = ts;
      step();
    }
    raf = requestAnimationFrame(loop);
  }

  render();
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      st.over = true;
    },
    setMode(mode) {
      st.mode = mode;
    },
    getState() {
      return st;
    }
  };
}
