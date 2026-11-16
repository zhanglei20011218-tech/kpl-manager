import { squadOf } from '../data/teams.js';
import { salaryCapStatus } from '../core/economy.js';
import { playerTeam } from '../core/game.js';
import { overall, consistencyBand, potentialShort } from '../core/player.js';
import { GROWTH_TAGS, ROLE_WEIGHTS } from '../data/constants.js';
import { esc, money, playerRow, roleTag, moneyShort, statLine } from './format.js';
import { HERO_BY_ID } from '../data/heroes.js';

const ROLE_ORDER = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];

export function renderSquad(state) {
  const team = playerTeam(state);
  const squad = squadOf(state.players, state.playerTeamId);
  const starters = ROLE_ORDER.map((role) => squad.find((p) => p.isStarter && p.role === role)).filter(Boolean);
  const subs = squad.filter((p) => !p.isStarter);
  const cap = salaryCapStatus(state.players, team);
  const totalPower = starters.reduce((s, p) => s + overall(p), 0);

  return `<div class="topbar">
    <div class="grow">
      <h1>阵容</h1>
      <div class="sub">${esc(team.name)} · ${squad.length} 人 · 首发平均 OVR ${starters.length ? Math.round(totalPower / starters.length) : 0}</div>
    </div>
    <span class="chip ${cap.over ? 'red' : cap.ratio > 0.85 ? 'gold' : 'accent'}">${moneyShort(cap.total)} / ${moneyShort(cap.cap)}</span>
  </div>

  <div class="stack">
    <div class="section-label">首发五人</div>
    ${starters.map((p) => playerRow(p, {
      extra: `<span class="chip ${p.trainingFocus ? 'blue' : ''}" style="font-size:10px">${
        p.trainingFocus ? esc(trainingName(p.trainingFocus)) : '未设训练'
      }</span>`
    })).join('')}

    <div class="section-label" style="margin-top:6px">替补席</div>
    ${subs.length
      ? subs.map((p) => playerRow(p)).join('')
      : `<div class="empty"><div class="big">🪑</div>替补席空着，去转会市场看看</div>`}

    <div class="card">
      <div class="card-title"><span class="k">薪资结构</span><span class="v">单人上限 ${money(cap.singleMax)}</span></div>
      <div class="kv"><span class="k">当前总薪资</span><span class="v">${money(cap.total)}</span></div>
      <div class="kv"><span class="k">薪资帽</span><span class="v">${money(cap.cap)}</span></div>
      <div class="kv"><span class="k">占用比例</span><span class="v" style="color:${cap.over ? 'var(--red)' : 'var(--accent)'}">${(cap.ratio * 100).toFixed(0)}%</span></div>
      ${cap.over ? `<p class="small" style="color:var(--red);margin-top:8px">超出薪资帽，无法签下新选手。</p>` : ''}
    </div>

    <div class="card flat">
      <div class="card-title"><span class="k">训练方向</span><span class="v">赛季中自动执行</span></div>
      <p class="tiny muted">点开任意选手，在详情里切换训练方向。满意度低于 30 时训练效果减半。</p>
    </div>
  </div>`;
}

export function trainingName(key) {
  const map = {
    mechanics: '个人技术',
    gameSense: '战术复盘',
    championPool: '英雄池拓展',
    consistency: '心态管理',
    team: '团队配合'
  };
  return map[key] || key;
}

export function renderPlayerSheet(state, playerId) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return '';
  const isMine = p.teamId === state.playerTeamId;
  const inMarket = !isMine && (state.market || []).some((m) => m.id === p.id);
  const canSign = inMarket && state.phase !== 'season';
  const w = ROLE_WEIGHTS[p.role];
  const growth = GROWTH_TAGS[p.growthTag];
  const avgRating = p.season?.games ? p.season.ratingSum / p.season.games : 0;
  const fmvps = (state.fmvpList || []).filter((f) => f.playerId === p.id);

  return `<div class="sheet">
    <div class="grab"></div>
    <div class="row" style="align-items:flex-start;margin-bottom:12px">
      <div class="row-start">
        <span class="avatar lg">${esc(p.name[0])}</span>
        <div>
          <h2 style="margin:0">${esc(p.name)} ${roleTag(p.role)}</h2>
          <div class="tiny muted">${p.age} 岁 · ${growth?.cn || ''} · ${p.nationality === 'KR' ? '韩援' : '本土'} · 合同 ${p.contractYears} 年</div>
        </div>
      </div>
      <div class="center">
        <div style="font-size:26px;font-weight:800;color:var(--accent)">${overall(p)}</div>
        <div class="tiny muted">OVR</div>
      </div>
    </div>

    <div class="stack-sm" style="margin-bottom:12px">
      ${statLine('操作', p.mechanics)}
      ${statLine('意识', p.gameSense)}
      ${statLine('英雄池', p.championPool)}
      ${statLine('稳定性', p.consistency)}
      ${statLine('潜力', p.potential)}
    </div>

    <div class="card tight" style="margin-bottom:12px">
      <div class="kv"><span class="k">稳定性区间</span><span class="v">${consistencyBand(p)}</span></div>
      <div class="kv"><span class="k">潜力评估</span><span class="v">${potentialShort(p.potential)}（${p.growthTag === 'genius' ? '成长 +3/赛季' : p.growthTag === 'normal' ? '成长 +2/赛季' : '成长 +1/赛季'}）</span></div>
      <div class="kv"><span class="k">巅峰期</span><span class="v">${p.peakAge}–${p.peakAge + p.peakDuration} 岁</span></div>
      <div class="kv"><span class="k">忠诚 / 满意度</span><span class="v">${p.loyalty} / ${p.satisfaction}</span></div>
      ${isMine ? `<div class="kv"><span class="k">薪资 / 身价</span><span class="v">${money(p.salary)} / ${money(p.value)}</span></div>` : `<div class="kv"><span class="k">身价</span><span class="v">${money(p.value)}</span></div>`}
      ${p.season?.games ? `<div class="kv"><span class="k">本赛季</span><span class="v">${p.season.games} 场 · 平均评分 ${avgRating.toFixed(1)} · MVP ${p.season.mvps}</span></div>` : ''}
    </div>

    ${fmvps.length ? `<div class="card gold" style="margin-bottom:12px">
      <div class="card-title"><span class="k">🏅 FMVP</span><span class="v">${fmvps.length} 次</span></div>
      ${fmvps.map((f) => `<div class="kv"><span class="k">${f.season} ${esc(f.compName)}</span><span class="v">${esc(f.heroName)}</span></div>`).join('')}
    </div>` : ''}

    <div class="section-label">招牌英雄</div>
    <div class="wrap" style="margin:6px 0 14px">
      ${(p.champions || []).map((c) => `<span class="chip gold">${esc(heroNameSafe(c))}</span>`).join('') || '<span class="tiny muted">暂无</span>'}
    </div>

    ${isMine ? `<div class="section-label">训练方向</div>
    <div class="stack-sm" style="margin:6px 0 14px">
      ${Object.entries(trainingOptions()).map(([key, def]) => `<button class="decision ${p.trainingFocus === key ? 'on' : ''}" data-action="set-training" data-id="${p.id}" data-key="${key}">
        <div class="dh"><span class="key">${def.icon}</span><span style="font-weight:650">${def.name}</span></div>
        <div class="dd">${def.desc}</div>
      </button>`).join('')}
    </div>

    <div class="btn-row">
      ${p.isStarter
        ? `<button class="btn btn-danger" data-action="set-bench" data-id="${p.id}">下放替补</button>`
        : `<button class="btn btn-primary" data-action="set-starter" data-id="${p.id}">设为首发</button>`}
      <button class="btn" data-action="renew" data-id="${p.id}">续约 2 年</button>
    </div>
    <button class="btn btn-block btn-ghost" style="margin-top:8px" data-action="close-sheet">关闭</button>` : canSign ? `<button class="btn btn-primary btn-block" data-action="open-sign" data-id="${p.id}">签约</button>
    <button class="btn btn-block btn-ghost" style="margin-top:8px" data-action="close-sheet">关闭</button>` : `<button class="btn btn-block" data-action="close-sheet">关闭</button>`}
  </div>`;
}

function heroNameSafe(id) {
  return HERO_BY_ID[id]?.name || id;
}

function trainingOptions() {
  return {
    mechanics: { name: '个人技术', icon: '⚔️', desc: '操作 +1~2（受潜力限制）' },
    gameSense: { name: '战术复盘', icon: '🧠', desc: '意识 +1~2' },
    championPool: { name: '英雄池拓展', icon: '📚', desc: '英雄池 +1~2，有概率掌握新英雄' },
    consistency: { name: '心态管理', icon: '🧘', desc: '稳定性 +1~2' },
    team: { name: '团队配合', icon: '🤝', desc: '满意度 +3，羁绊小幅提升' }
  };
}
