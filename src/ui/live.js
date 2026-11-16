// 观战页：Canvas 重绘地图 + HUD + 决策卡 + 战况日志
import { MAP, TOWER_T, GAME_SECONDS_PER_TICK } from '../data/battlefield.js';
import { HERO_BY_ID } from '../data/heroes.js';
import { esc } from './format.js';

export function fmtClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

export function hudHtml(st) {
  const diff = Math.round(st.blue.econ - st.red.econ);
  return `
    <span class="lh"><b>${fmtClock(st.tick * GAME_SECONDS_PER_TICK)}</b></span>
    <span class="lh ${diff >= 0 ? 'up' : 'down'}">经济 ${diff >= 0 ? '+' : ''}${diff}</span>
    <span class="lh">人头 ${st.blue.kills}:${st.red.kills}</span>
    <span class="lh">塔 ${st.blue.towers}:${st.red.towers}</span>
    <span class="lh">龙 ${st.blue.dragons}:${st.red.dragons}</span>`;
}

export function renderLive(state, ui) {
  const live = ui.match?.live;
  if (!live) return '<div class="card"><p class="muted">观战数据丢失，请返回比赛页重进。</p></div>';
  const st = live.state;
  return `
  <h1>观战</h1>
  <div class="live-hud" id="live-hud">${hudHtml(st)}</div>
  <div class="live-map-wrap">
    <canvas class="live-map" id="live-map" width="640" height="400"></canvas>
    ${st.pendingEvent ? renderDecision(st.pendingEvent) : ''}
    ${st.done ? `<div class="live-end">${st.winnerSide === 'blue' ? '我方' : '对手'}获胜</div>` : ''}
  </div>
  <div class="live-feed" id="live-feed">${st.log.slice(-4).map((t) => `<div class="lf">${esc(t)}</div>`).join('')}</div>
  <div class="row" style="gap:8px;margin-top:12px">
    ${st.done
      ? '<button class="btn" data-action="live-result">查看战报</button>'
      : '<button class="btn ghost" data-action="live-skip">跳到结果</button>'}
  </div>`;
}

function renderDecision(ev) {
  return `<div class="live-decision">
    <div class="ld-title">${esc(ev.label)} —— 做出决策</div>
    <div class="ld-opts">
      ${ev.options
        .map(
          (o) => `<button class="ld-opt risk-${o.risk > 0.45 ? 'high' : o.risk > 0.32 ? 'mid' : 'low'}" data-action="live-decide" data-key="${o.key}">
          <b>${esc(o.label)}</b><span>${esc(o.desc)}</span>
        </button>`
        )
        .join('')}
    </div>
  </div>`;
}

function lanePoint(laneKey, t) {
  const pts = (MAP.lanes[laneKey] || MAP.lanes.MID).path;
  const seg = Math.max(0, Math.min(1, t)) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(seg));
  const f = seg - i;
  const [x1, y1] = pts[i];
  const [x2, y2] = pts[i + 1];
  return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f];
}

const LANE_OF_ROLE = { TOP: 'TOP', JUG: 'JUG', MID: 'MID', ADC: 'ADC', SUP: 'SUP' };

// 英雄头像缓存：地图上用圆形小头像代替纯色点
const heroImgs = new Map();

function heroImage(heroId) {
  if (!heroId) return null;
  let img = heroImgs.get(heroId);
  if (!img) {
    img = new Image();
    img.src = `./assets/heroes/${heroId}.jpg`;
    img.onload = () => {
      // 头像就绪后重绘（首次渲染时往往还没加载完）
      if (mapTarget && mapUi) drawLiveMap(mapTarget, mapUi);
    };
    heroImgs.set(heroId, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// 地图原图：加载一次，抹掉红色标注（按像素把高饱和红替换为邻近地图色），缓存处理结果
let mapImg = null;
let mapCanvas = null;
let mapTarget = null; // 最近一次绘制的目标画布
let mapUi = null;

function ensureMap() {
  if (mapImg) return;
  mapImg = new Image();
  mapImg.src = './assets/map/battlefield.jpg';
  mapImg.onload = () => {
    const c = document.createElement('canvas');
    c.width = mapImg.width;
    c.height = mapImg.height;
    const x = c.getContext('2d');
    x.drawImage(mapImg, 0, 0);
    try {
      const d = x.getImageData(0, 0, c.width, c.height);
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i];
        const g = p[i + 1];
        const b = p[i + 2];
        // 红色标注文字：高红、低绿蓝
        if (r > 108 && r - g > 32 && r - b > 32) {
          let j = i - 4;
          let guard = 0;
          while (j > 0 && guard++ < 400 && p[j] > 108 && p[j] - p[j + 1] > 32 && p[j] - p[j + 2] > 32) j -= 4;
          if (j >= 0) {
            p[i] = p[j];
            p[i + 1] = p[j + 1];
            p[i + 2] = p[j + 2];
          }
        }
      }
      x.putImageData(d, 0, 0);
    } catch (e) {
      /* 跨域或像素读取失败时直接用原图 */
    }
    mapCanvas = c;
    // 底图就绪后立即重绘一次（首次渲染时图片往往还没加载完）
    if (mapTarget && mapUi) drawLiveMap(mapTarget, mapUi);
  };
}

export function drawLiveMap(canvas, ui) {
  const live = ui.match?.live;
  if (!canvas || !live) return;
  mapTarget = canvas;
  mapUi = ui;
  const st = live.state;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const px = (v) => v * W;
  const py = (v) => v * H;

  ensureMap();
  if (mapCanvas) {
    // 原图底图（已抹掉红色标注）+ 暗色蒙版，和深色 UI 统一
    ctx.drawImage(mapCanvas, 0, 0, W, H);
    ctx.fillStyle = 'rgba(8, 16, 24, 0.46)';
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0a1a14');
    g.addColorStop(0.5, '#0b1a26');
    g.addColorStop(1, '#0a1420');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 河道
  ctx.strokeStyle = 'rgba(56,189,248,.16)';
  ctx.lineWidth = W * 0.07;
  ctx.beginPath();
  ctx.moveTo(px(MAP.river[0][0]), py(MAP.river[0][1]));
  ctx.lineTo(px(MAP.river[1][0]), py(MAP.river[1][1]));
  ctx.stroke();

  // 三条路
  for (const key of ['TOP', 'MID', 'ADC']) {
    const lane = MAP.lanes[key];
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = W * 0.028;
    ctx.beginPath();
    lane.path.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
    ctx.stroke();
  }

  // 龙坑
  const pit = (p, color, label) => {
    ctx.beginPath();
    ctx.arc(px(p[0]), py(p[1]), W * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = `${W * 0.026}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, px(p[0]), py(p[1]) + W * 0.009);
  };
  pit(MAP.dragon, 'rgba(168,85,247,.3)', '暴君');
  pit(MAP.tyrant, 'rgba(250,204,21,.25)', '主宰');

  // 防御塔（每路 3 座 × 双方）
  for (const lane of ['TOP', 'MID', 'ADC']) {
    TOWER_T.forEach((t) => {
      for (const side of ['blue', 'red']) {
        const [x, y] = lanePoint(lane, side === 'blue' ? t : 1 - t);
        ctx.fillStyle = side === 'blue' ? 'rgba(96,165,250,.85)' : 'rgba(248,113,113,.85)';
        ctx.fillRect(px(x) - W * 0.008, py(y) - H * 0.016, W * 0.016, H * 0.022);
      }
    });
  }

  // 水晶
  const nexus = (p, color) => {
    ctx.beginPath();
    ctx.arc(px(p[0]), py(p[1]), W * 0.035, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  nexus(MAP.base.blue, 'rgba(96,165,250,.9)');
  nexus(MAP.base.red, 'rgba(248,113,113,.9)');

  // 英雄（10 个头像点 + 血条）
  const drawHeroes = (line, side) => {
    const team = side === 'blue' ? st.blue : st.red;
    const t = Math.min(0.85, 0.18 + team.towers * 0.05);
    (line || []).forEach((x) => {
      const role = (HERO_BY_ID[x.heroId] || {}).role || 'MID';
      const lane = LANE_OF_ROLE[role] || 'MID';
      const lt = side === 'blue' ? t : 1 - t;
      const jitter = (Math.abs(hash(x.heroId + side)) % 100) / 100 - 0.5;
      const [x0, y0] = lanePoint(lane, Math.max(0.05, Math.min(0.95, lt + jitter * 0.06)));
      const cx = px(x0);
      const cy = py(y0);
      const r = W * 0.026;
      const img = heroImage(x.heroId);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (img) {
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = side === 'blue' ? 'rgba(96,165,250,.95)' : 'rgba(248,113,113,.95)';
        ctx.fill();
      }
      ctx.restore();
      // 阵营描边
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = side === 'blue' ? 'rgba(96,165,250,.95)' : 'rgba(248,113,113,.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const hp = 0.55 + ((st.tick * 7 + Math.abs(hash(x.heroId)) % 40) % 45) / 100;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(cx - W * 0.02, cy - H * 0.033, W * 0.04, H * 0.007);
      ctx.fillStyle = hp > 0.6 ? '#4ade80' : hp > 0.3 ? '#facc15' : '#f87171';
      ctx.fillRect(cx - W * 0.02, cy - H * 0.033, W * 0.04 * hp, H * 0.007);
    });
  };
  drawHeroes(st.lineA, 'blue');
  drawHeroes(st.lineB, 'red');
}
