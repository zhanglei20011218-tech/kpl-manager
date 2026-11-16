import { TEAMS } from '../data/teams.js';
import { esc } from './format.js';

export function renderIntro(ui, opts = {}) {
  const mode = ui.introMode || 'existing';
  const selected = ui.introTeam || 'ig';
  const inherit = ui.introInherit || selected;

  return `<div class="intro">
    <div class="brand">
      <div class="logo">🏆</div>
      <h1>逐 梦</h1>
      <p>KPL 战队经理 · 2025 年 9 月</p>
    </div>

    ${opts.canResume ? `<button class="btn btn-primary btn-block" data-action="resume-game" style="padding:14px">
      继续上次游戏 · ${esc(opts.resumeLabel || '')}
    </button>` : ''}

    <div class="card accent">
      <div class="row" style="margin-bottom:6px">
        <span class="chip accent">真实战队 · 真实选手</span>
        <span class="tiny muted">从 2025 夏季赛前接手</span>
      </div>
      <p class="small dim" style="line-height:1.6">
        2025 年 9 月，KPL 夏季赛与年底年度总决赛就在眼前。
        你可以接手一支现有战队，也可以收购席位、创建自己的俱乐部。
      </p>
    </div>

    <div class="filter-row">
      <button class="filter-chip ${mode === 'existing' ? 'on' : ''}" data-action="intro-mode" data-key="existing">执教现有战队</button>
      <button class="filter-chip ${mode === 'custom' ? 'on' : ''}" data-action="intro-mode" data-key="custom">创建新战队</button>
    </div>

    ${mode === 'existing' ? renderExisting(ui, selected) : renderCustom(ui, inherit)}

    <label class="stack-sm">
      <span class="section-label">经理名字</span>
      <input
        id="coach-name"
        class="card tight"
        style="border-radius:12px;outline:none;border:1px solid var(--line)"
        maxlength="12"
        value="${esc(ui.introName || '')}"
        placeholder="例如：老陈" />
    </label>

    <button class="btn btn-primary btn-block" data-action="new-game" style="padding:15px">
      ${mode === 'custom' ? '成立俱乐部并开始 →' : '开始执教 →'}
    </button>
    <p class="tiny muted center" style="margin-top:-8px">
      ${mode === 'custom' ? '新战队将收购所选俱乐部的 KPL 席位，并继承其阵容' : '存档自动保存在本机，可离线游玩'}
    </p>
  </div>`;
}

function renderExisting(ui, selected) {
  return `<div>
    <div class="section-label">选择你的战队</div>
    <div class="team-choice" style="margin-top:8px">
      ${TEAMS.map((t) => {
        const tier = t.tier[1] >= 90 ? '夺冠热门' : t.tier[1] >= 84 ? '季后赛强队' : t.tier[1] >= 78 ? '中游球队' : '重建中';
        return `<button class="team-card ${selected === t.id ? 'on' : ''}" data-action="pick-team" data-id="${t.id}">
          <span class="tn">${esc(t.cn)} <span class="tiny muted">${t.short}</span></span>
          <span class="ts">${tier} · 教练 ${esc(t.coach)}</span>
          <span class="ts">2025 KPL 夏季赛 · 18 队</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function renderCustom(ui, inherit) {
  const base = TEAMS.find((t) => t.id === inherit) || TEAMS[0];
  return `<div class="stack">
    <div class="card">
      <div class="section-label" style="margin-bottom:8px">俱乐部信息</div>
      <label class="stack-sm" style="margin-bottom:10px">
        <span class="tiny muted">战队名称</span>
        <input id="team-name" class="card tight" style="border-radius:10px;outline:none;border:1px solid var(--line)"
          maxlength="16" value="${esc(ui.introTeamName || '')}" placeholder="例如：星辰电子竞技俱乐部" />
      </label>
      <div class="row" style="gap:10px;margin-bottom:10px">
        <label class="stack-sm grow">
          <span class="tiny muted">缩写</span>
          <input id="team-short" class="card tight" style="border-radius:10px;outline:none;border:1px solid var(--line);width:100%"
            maxlength="4" value="${esc(ui.introTeamShort || '')}" placeholder="XC" />
        </label>
        <label class="stack-sm">
          <span class="tiny muted">主色</span>
          <input id="team-color" type="color" value="${esc(ui.introColor || '#2ee6c8')}"
            style="width:56px;height:40px;border:none;background:none;border-radius:10px" />
        </label>
      </div>
    </div>

    <div class="card">
      <div class="section-label" style="margin-bottom:8px">收购哪个 KPL 席位</div>
      <p class="tiny muted" style="margin-bottom:8px">新战队会继承该俱乐部的 KPL 席位、赛程与现有阵容，之后可以自由转会。</p>
      <div class="team-choice">
        ${TEAMS.map((t) => `<button class="team-card ${inherit === t.id ? 'on' : ''}" data-action="pick-inherit" data-id="${t.id}">
          <span class="tn">${esc(t.cn)}</span>
          <span class="ts">${t.short} · 教练 ${esc(t.coach)}</span>
        </button>`).join('')}
      </div>
      <p class="tiny muted" style="margin-top:8px">当前选择：${esc(base.cn)}（${base.short}）</p>
    </div>
  </div>`;
}
