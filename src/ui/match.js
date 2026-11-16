import { HERO_BY_ID, HEROES, ROLES, CATEGORY_CN } from '../data/heroes.js';
import { evaluateDraft, opponentHeroTags, currentTurn, resolveLineup, DRAFT_SEQUENCE } from '../core/match-draft.js';
import { decisionPreview } from '../core/match.js';
import { computeTeamPower } from '../core/power.js';
import { teamName, playerTeam, prepareMatch } from '../core/game.js';
import { startersOf } from '../data/teams.js';
import { esc, roleCn, pct } from './format.js';
import { renderCompetitionCalendar } from './schedule.js';
import { renderLive, drawLiveMap, hudHtml } from './live.js';
import { casterLine } from '../data/casters.js';

const FILTERS = ['ALL', ...ROLES];

export function renderMatch(state, ui, prepared) {
  const m = ui.match;
  if (!m) return renderPreview(state, ui, prepared);
  if (m.step === 'draft') return renderDraft(state, ui);
  if (m.step === 'tactic') return renderTactic(state, ui);
  if (m.step === 'live') return renderLive(state, ui);
  if (m.step === 'game-result') return renderGameResult(state, ui);
  if (m.step === 'result') return renderResult(state, ui);
  return renderPreview(state, ui, prepared);
}

/* ------------------------------------------------------------------ */
/* 赛前                                                                 */
/* ------------------------------------------------------------------ */

function renderPreview(state, ui, prepared) {
  const info = prepared || prepareMatch(state);
  if (!info || !info.ok) {
    return `<div class="topbar">
      <div class="grow"><h1>比赛</h1><div class="sub">${esc(info?.reason || '当前没有可进行的比赛')}</div></div>
    </div>
    ${renderCompetitionCalendar(state, ui)}
    <div class="card flat">
      <p class="tiny muted">${esc(info?.reason || '高亮日期是你参加的比赛，点击任意日期查看当天赛程。')}</p>
    </div>`;
  }
  const oppId = info.opponentId || (info.match.home === state.playerTeamId ? info.match.away : info.match.home);
  const my = computeTeamPower(state.players, state.playerTeamId, state.duos);
  const opp = computeTeamPower(state.players, oppId, state.duos);
  const bo = info.comp?.stage === 'playoff' ? 'BO7 · 淘汰赛' : 'BO5';
  return `<div class="topbar">
    <div class="grow"><h1>赛前准备</h1><div class="sub">${esc(info.comp?.name || '')} · ${bo}</div></div>
    <button class="btn btn-xs" data-action="leave-match">返回</button>
  </div>
  <div class="stack">
    <div class="hero-banner">
      <div class="row">
        <div class="center grow">
          <div class="tiny muted">${esc(playerTeam(state).short)}</div>
          <div style="font-size:20px;font-weight:800">${my.total.toFixed(1)}</div>
          <div class="tiny muted">羁绊 +${(my.bond * 100).toFixed(1)}%</div>
        </div>
        <div class="center" style="padding:0 12px">
          <div style="font-size:13px;color:var(--muted)">VS</div>
        </div>
        <div class="center grow">
          <div class="tiny muted">${esc(teamName(state, oppId).slice(0, 3))}</div>
          <div style="font-size:20px;font-weight:800">${opp.total.toFixed(1)}</div>
          <div class="tiny muted">羁绊 +${(opp.bond * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title"><span class="k">赛制说明</span><span class="v">BP 3 Ban + 3 Pick</span></div>
      <ul class="small dim" style="margin:0;padding-left:18px;line-height:1.75">
        <li>版本强势英雄 +3%，招牌 +2%，克制 / 联动各 +1%（最多 2 层）</li>
        <li>BP 总修正上限 ±10%</li>
        <li>招牌被全部 Ban 掉的选手会让队伍 -2%</li>
        <li>两局之间不做调整，决策影响整个系列赛</li>
      </ul>
    </div>
    <button class="btn btn-primary btn-block" data-action="start-draft" style="padding:15px">进入 BP →</button>
    ${renderCompetitionCalendar(state, ui)}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* BP                                                                   */
/* ------------------------------------------------------------------ */

const CATEGORY_COLOR = {
  fighter: '#f87171',
  tank: '#94a3b8',
  assassin: '#c084fc',
  mage: '#60a5fa',
  marksman: '#fbbf24',
  support: '#34d399'
};

function heroColor(h) {
  return CATEGORY_COLOR[h?.category] || '#94a3b8';
}

function renderDraft(state, ui) {
  const m = ui.match;
  const d = m.draft;
  const filter = m.heroFilter || 'ALL';
  const mySide = d.playerSide;
  const oppSide = mySide === 'blue' ? 'red' : 'blue';
  const turn = currentTurn(d);
  const myEval = evaluateDraft(d, mySide, state.players);
  const team = playerTeam(state);
  const oppId = mySide === 'blue' ? d.redTeamId : d.blueTeamId;
  const analysisLevel = team.facilities.analysis;

  const globalUsed = new Set(d.globalUsed || []);
  // 每个分路只能选一个英雄：仅在 Pick 阶段排除本边已选分路（Ban 阶段可以 ban 任何分路）
  const myRoles =
    turn && turn.type === 'ban'
      ? new Set()
      : new Set((d.picks[mySide] || []).map((id) => (HERO_BY_ID[id] || {}).role));
  const pool = HEROES.filter((h) => !globalUsed.has(h.id) && !myRoles.has(h.role) && (filter === 'ALL' || h.role === filter));
  const banned = new Set([...d.bans.blue, ...d.bans.red]);
  const picked = new Set([...d.picks.blue, ...d.picks.red]);
  const myChampions = new Set(
    startersOf(state.players, state.playerTeamId).flatMap((p) => p.champions || [])
  );

  const myTurn = !!turn && turn.side === mySide;
  const turnLabel = !turn
    ? 'BP 结束 · 点击两位选手可交换英雄位置'
    : myTurn
      ? `轮到你 ${turn.type === 'ban' ? 'Ban' : 'Pick'}`
      : `对手 ${turn.type === 'ban' ? 'Ban' : 'Pick'} 中`;

  const oppTags = opponentHeroTags(d, mySide, analysisLevel);
  const pickCount = d.picks[mySide].length + d.picks[oppSide].length;
  const pickTotal = DRAFT_SEQUENCE.filter((s) => s.type === 'pick').length;

  const gameNo = m.series ? m.series.gameIndex + 1 : 1;
  const boNum = m.series ? m.series.bo : 5;
  return `<div class="topbar">
    <div class="grow"><h1>BP</h1><div class="sub">${esc(team.name)} vs ${esc(teamName(state, oppId))} · BO${boNum} 第 ${gameNo} 局 · 第 ${Math.min(pickCount, pickTotal)}/${pickTotal} 手</div></div>
    <span class="chip ${myTurn ? 'accent' : ''}">${d.step}/${DRAFT_SEQUENCE.length}</span>
  </div>

  <div class="bp-sticky">
    ${bpBoard(state, d, turn, mySide, m)}

    <div class="bp-turn ${myTurn ? 'mine' : 'theirs'}">
      <span class="bp-turn-dot"></span>
      <span class="bp-turn-text">${esc(turnLabel)}</span>
      <span class="bp-turn-hint">${!turn ? '换完位后点下方按钮' : myTurn ? (turn.type === 'ban' ? '点击英雄禁用' : '点击英雄选择') : '等待对手…'}</span>
      ${myTurn ? `<span class="bp-timer"><span class="bp-timer-text">30</span><small>s</small></span>` : ''}
    </div>
  </div>

  <div class="filter-row" style="margin-bottom:10px">
    ${FILTERS.map((f) => `<button class="filter-chip ${filter === f ? 'on' : ''}" data-action="hero-filter" data-key="${f}">
      ${f === 'ALL' ? '全部' : roleCn(f)}
    </button>`).join('')}
  </div>

  <div class="hero-grid">
    ${pool.map((h) => {
      const isBanned = banned.has(h.id);
      const isPicked = picked.has(h.id);
      const strong = (d.meta.strongByRole[h.role] || []).includes(h.id);
      const star = myChampions.has(h.id);
      const isFmvp = state.fmvp?.heroId === h.id;
      return `<button class="hero-card ${isBanned ? 'is-banned' : ''} ${isPicked ? 'is-picked' : ''} ${strong ? 'strong' : ''} ${star ? 'star' : ''} ${isFmvp ? 'fmvp-hero' : ''}"
        data-action="draft-pick" data-id="${h.id}" ${isBanned || isPicked ? 'disabled' : ''}>
        <span class="himg"><img src="./assets/heroes/${h.id}.jpg" alt="${esc(h.name)}" decoding="async"></span>
        <span class="hbody">
          <span class="hn">${esc(h.name)}</span>
          <span class="hr">${roleCn(h.role)}</span>
        </span>
        <span class="tags">
          ${strong ? '<i class="s" title="版本强势"></i>' : ''}
          ${star ? '<i class="b" title="招牌"></i>' : ''}
          ${isBanned ? '<i class="x" title="已 Ban"></i>' : ''}
        </span>
      </button>`;
    }).join('')}
  </div>

  <div class="card tight" style="margin-bottom:12px">
    <div class="row">
      <span class="small">我方 BP 修正</span>
      <span class="mono" style="font-weight:800;color:${myEval.pct >= 0 ? 'var(--accent)' : 'var(--red)'}">
        ${myEval.pct >= 0 ? '+' : ''}${(myEval.pct * 100).toFixed(1)}%
      </span>
    </div>
    ${myEval.tags.length ? `<div class="wrap" style="margin-top:7px">
      ${myEval.tags.map((t) => `<span class="chip ${t.value >= 0 ? 'accent' : 'red'}">${esc(t.label)} ${t.value >= 0 ? '+' : ''}${(t.value * 100).toFixed(0)}%</span>`).join('')}
    </div>` : '<p class="tiny muted" style="margin-top:6px">还没有触发任何标签</p>'}
    ${oppTags.length ? `<div class="wrap" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)">
      <span class="tiny muted" style="width:100%">对手阵容（分析室 Lv.${analysisLevel}）</span>
      ${oppTags.map((t) => `<span class="chip">${esc(t.hero.name)}${t.tags.length ? ' · ' + esc(t.tags.join('/')) : ''}</span>`).join('')}
    </div>` : ''}
  </div>

  <div class="wrap" style="margin-top:12px">
    <span class="chip"><i class="dot" style="background:var(--gold)"></i> 版本强势 +3%</span>
    <span class="chip"><i class="dot" style="background:var(--red)"></i> 我方招牌 +2%</span>
    <span class="chip"><i class="dot" style="background:var(--accent-2)"></i> 克制 +1%</span>
    <span class="chip"><i class="dot" style="background:var(--purple)"></i> 联动 +1%</span>
  </div>

  <button class="btn btn-block" style="margin-top:14px" data-action="auto-draft">托管 BP（自动选择）</button>
  ${turn ? '' : `<button class="btn btn-primary btn-block" style="margin-top:10px" data-action="go-tactic">确认阵容，进入第 ${m.series ? m.series.gameIndex + 1 : 1} 局比赛 →</button>`}`;
}

/** BP 板：左右 Ban 区 + 中间赛事名 + 10 个 Pick 槽 */
// 「关门 → 换位 → 开门」特效：黑屏期间完成英雄落位，开门后看到的就是站好位置的阵容
function playBpCurtain() {
  const el = document.getElementById('bp-curtain');
  if (!el) return;
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('play'));
  window.setTimeout(() => el.classList.remove('play'), 1250);
  window.setTimeout(() => el.classList.add('hidden'), 1750);
}

function bpBoard(state, d, turn, mySide, m) {
  const comp = m?.comp;
  const eventName = comp?.name || 'KPL';
  const stage = stageLabelOf(comp);

  const done = d.step >= DRAFT_SEQUENCE.length;
  const pickSteps = DRAFT_SEQUENCE.map((s, i) => ({ ...s, step: i })).filter((s) => s.type === 'pick');
  // 填充方向：蓝方从左往右，红方从右往左
  const FILL = { blue: [0, 1, 2, 3, 4], red: [4, 3, 2, 1, 0] };

  // 全部选完：先播「关门」特效，黑屏期间把 picks 重排成按分路站位的顺序，开门后看到的就是站好位的阵容
  if (done && !d.laneLocked) {
    if (!d.lanePending) {
      d.lanePending = true;
      playBpCurtain();
      window.setTimeout(() => {
        for (const side of ['blue', 'red']) {
          const teamId = side === 'blue' ? d.blueTeamId : d.redTeamId;
          const lineup = startersOf(state.players, teamId)
            .slice()
            .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
          const np = new Array(5).fill(null);
          const left = (d.picks[side] || []).slice();
          // 按英雄分路找到对应分路选手的槽位
          for (const heroId of left) {
            const role = (HERO_BY_ID[heroId] || {}).role;
            const idx = lineup.findIndex((p, i) => np[i] === null && p.role === role);
            if (idx >= 0) np[idx] = heroId;
          }
          // 兜底：没匹配上分路的英雄填到空槽
          const rest = left.filter((h) => !np.includes(h));
          for (let i = 0; i < 5 && rest.length; i++) {
            if (np[i] === null) np[i] = rest.shift();
          }
          d.picks[side] = np;
        }
        d.laneLocked = true;
        // 通知 main.js 重绘（ui 层不能直接调 render，会形成循环依赖）
        window.dispatchEvent(new Event('bp-lane-locked'));
      }, 520);
    }
  }

  const slotHtml = (side, idx) => {
    const teamId = side === 'blue' ? d.blueTeamId : d.redTeamId;
    const lineup = startersOf(state.players, teamId)
      .slice()
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
    const player = lineup[idx];
    if (!player) return '<div class="bps"></div>';
    let heroId = null;
    let no = '';
    if (done) {
      heroId = d.picks[side][idx] || null;
      if (heroId) no = String(idx + 1);
    } else {
      const n = FILL[side].indexOf(idx);
      heroId = n >= 0 && n < d.picks[side].length ? d.picks[side][n] : null;
      if (heroId) no = String(n + 1);
    }
    const active = turn && turn.type === 'pick' && turn.side === side && !heroId;
    return `<div class="bps ${side} ${heroId ? 'filled' : ''} ${active ? 'active' : ''}">
      ${no ? `<span class="bps-order">${no}</span>` : ''}
      <div class="bps-art"${heroId ? ` style="background-image:url('./assets/heroes/${heroId}.jpg')"` : ''}>${
        heroId
          ? `<img src="./assets/heroes/full/${heroId}.jpg" onerror="this.remove()" alt="" decoding="async">`
          : ''
      }</div>
      <div class="bps-hero">${heroId ? esc(HERO_BY_ID[heroId]?.name || '') : ''}</div>
      <div class="bps-player">${esc(player.name)}</div>
    </div>`;
  };

  const blueSlots = [0, 1, 2, 3, 4].map((i) => slotHtml('blue', i)).join('');
  const redSlots = [0, 1, 2, 3, 4].map((i) => slotHtml('red', i)).join('');

  const banRow = (side) => {
    const total = DRAFT_SEQUENCE.filter((s) => s.type === 'ban' && s.side === side).length;
    return Array.from({ length: total }, (_, i) => {
      const heroId = d.bans[side][i];
      const active = turn && turn.type === 'ban' && turn.side === side && !heroId;
      return `<div class="bpb ${active ? 'active' : ''}">${heroId ? `<img src="./assets/heroes/${heroId}.jpg" alt="">` : ''}</div>`;
    }).join('');
  };

  return `<div class="bp-board">
    <div class="bp-head">
      <div class="bp-ban-row">${banRow('blue')}</div>
      <div class="bp-event"><b>${esc(eventName)}</b><span>${esc(stage)}</span></div>
      <div class="bp-ban-row">${banRow('red')}</div>
    </div>
    <div class="bp-teams">
      <div class="bp-side blue">
        <span class="bp-side-label">我方 · 蓝</span>
        <div class="bp-side-slots">${blueSlots}</div>
      </div>
      <div class="bp-vs">VS</div>
      <div class="bp-side red">
        <span class="bp-side-label">对手 · 红</span>
        <div class="bp-side-slots">${redSlots}</div>
      </div>
    </div>
  </div>`;
}

/** 英雄对应的选手：按分路匹配，同分路多人时按选取顺序分配 */
function playerForPick(state, teamId, heroId, picks, order) {
  const lineup = startersOf(state.players, teamId);
  const used = new Set();
  for (let i = 0; i < order; i++) {
    const h = HERO_BY_ID[picks[i]];
    const p = lineup.find((x) => x.role === h?.role && !used.has(x.id));
    if (p) used.add(p.id);
  }
  const hero = HERO_BY_ID[heroId];
  return (
    lineup.find((x) => x.role === hero?.role && !used.has(x.id)) ||
    lineup.find((x) => !used.has(x.id)) ||
    null
  );
}

function stageLabelOf(comp) {
  if (!comp) return '';
  if (comp.stage === 'playoff') {
    const rounds = comp.playoff?.rounds || [];
    const cur = rounds[comp.playoff?.roundIndex ?? 0];
    return cur?.name || '淘汰赛';
  }
  if (comp.stage === 'group') return '小组赛';
  return '常规赛';
}

function bpTeamPanel(side, teamId, state, turn, mySide, d) {
  const team = state.teams.find((t) => t.id === teamId);
  const picks = d.picks[side];
  const bans = d.bans[side];
  const active = turn?.side === side;
  const mine = side === mySide;

  const starters = startersOf(state.players, teamId);
  const usedPlayers = new Set();
  const rows = picks.map((id) => {
    const h = HERO_BY_ID[id];
    let owner = starters.find((p) => p.role === h.role && !usedPlayers.has(p.id));
    if (!owner) owner = starters.find((p) => !usedPlayers.has(p.id));
    if (owner) usedPlayers.add(owner.id);
    return { h, owner };
  });

  return `<div class="bp-team ${side} ${active ? 'active' : ''} ${mine ? 'mine' : ''}">
    <div class="bp-team-head">
      <span class="bp-team-dot"></span>
      <span class="bp-team-name">${esc(team?.short || teamId)}</span>
      ${mine ? '<span class="bp-you">你</span>' : ''}
    </div>
    <div class="bp-picks">
      ${[0, 1, 2].map((i) => {
        const id = picks[i];
        if (!id) return `<span class="bp-pick empty">PICK</span>`;
        const { h, owner } = rows[i];
        const fresh = i === picks.length - 1;
        return `<span class="bp-pick filled ${fresh ? 'fresh' : ''}">
          <span class="bp-pick-hero">${esc(h.name)}</span>
          ${owner ? `<span class="bp-pick-player">${esc(owner.name)}</span>` : ''}
        </span>`;
      }).join('')}
    </div>
    <div class="bp-bans">
      ${[0, 1, 2].map((i) => {
        const id = bans[i];
        if (!id) return `<span class="bp-ban empty"></span>`;
        const h = HERO_BY_ID[id];
        return `<span class="bp-ban filled" title="${esc(h.name)}">${esc(h.name.slice(0, 1))}</span>`;
      }).join('')}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 战术                                                                 */
/* ------------------------------------------------------------------ */

function lineupCompare(state, d, mySide, oppSide, myEval, oppEval) {
  const myLine = resolveLineup(d, mySide, state.players);
  const oppLine = resolveLineup(d, oppSide, state.players);
  const myTeamId = mySide === 'blue' ? d.blueTeamId : d.redTeamId;
  const oppTeamId = oppSide === 'blue' ? d.blueTeamId : d.redTeamId;
  const myTeam = state.teams.find((t) => t.id === myTeamId);
  const oppTeam = state.teams.find((t) => t.id === oppTeamId);

  const col = (line, team, evalResult, tone) => `<div class="lineup-col ${tone}">
    <div class="lineup-team">
      <span>${esc(team?.short || '')}</span>
      <span class="lineup-pct">${evalResult.pct >= 0 ? '+' : ''}${(evalResult.pct * 100).toFixed(1)}%</span>
    </div>
    ${line.map((slot) => {
      const h = HERO_BY_ID[slot.heroId];
      if (!h) return '';
      const p = state.players.find((x) => x.id === slot.playerId);
      return `<div class="lineup-row">
        <span class="lineup-role">${roleCn(h.role)}</span>
        <span class="lineup-hero">${esc(h.name)}</span>
        <span class="lineup-player">${esc(p?.name || '')}</span>
      </div>`;
    }).join('')}
  </div>`;

  return `<div class="card">
    <div class="card-title"><span class="k">双方阵容</span><span class="v">BP 结束</span></div>
    <div class="lineup-compare">
      ${col(myLine, myTeam, myEval, 'blue')}
      ${col(oppLine, oppTeam, oppEval, 'red')}
    </div>
  </div>`;
}

/** 单局战报：本局结果 + 系列赛比分 + 全局 BP 状态 */
function renderGameResult(state, ui) {
  const m = ui.match;
  const s = m.series;
  const g = m.lastGame?.game;
  const playerWon = !!m.lastGame?.won;
  const score = `${g?.score?.blue ?? 0} - ${g?.score?.red ?? 0}`;
  const team = playerTeam(state);
  const oppName = teamName(state, m.opponentId);
  return `<div class="topbar">
    <div class="grow"><h1>第 ${m.series.gameIndex} 局结束</h1><div class="sub">${esc(team.name)} vs ${esc(oppName)} · BO${s.bo}</div></div>
    <span class="chip ${playerWon ? 'accent' : 'red'}">${s.winsA} - ${s.winsB}</span>
  </div>

  <div class="stack">
    <div class="card ${playerWon ? 'gold' : ''}">
      <div class="card-title"><span class="k">${playerWon ? '✅ 本局胜利' : '❌ 本局失利'}</span><span class="v">${score}</span></div>
      <div class="kv"><span class="k">本局 MVP</span><span class="v">${esc(g?.mvp?.name || '—')}</span></div>
      ${g?.fmvpBonus ? `<div class="kv"><span class="k">⭐ FMVP 光环</span><span class="v" style="color:var(--gold)">+3% 战力 · ${esc((HERO_BY_ID[state.fmvp?.heroId] || {}).name || '')}</span></div>` : ''}
    </div>

    <div class="card">
      <div class="card-title"><span class="k">本局战绩</span><span class="v">10 名选手 · K/D/A</span></div>
      ${['blue', 'red'].map((side) => `
        <div class="section-label" style="margin:8px 0 2px;color:${side === 'blue' ? '#7fb0ff' : '#ff9b9b'}">${side === 'blue' ? esc(team.name) : esc(oppName)}</div>
        ${(g?.board?.[side] || []).map((b) => `
          <div class="kv" style="padding:3px 0">
            <span class="k" style="display:flex;align-items:center;gap:6px;min-width:0">
              <img src="./assets/heroes/${b.heroId}.jpg" alt="" style="width:22px;height:22px;border-radius:5px;object-fit:cover;flex:none" onerror="this.style.display='none'">
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.name)}</span>
            </span>
            <span class="v" style="font-variant-numeric:tabular-nums">${b.kills}/${b.deaths}/${b.assists}</span>
          </div>`).join('')}
      `).join('')}
    </div>

    <div class="card">
      <div class="card-title"><span class="k">系列赛比分</span><span class="v">BO${s.bo} · 先胜 ${s.need} 局</span></div>
      <div class="row"><span class="small">${esc(team.name)}</span><span class="mono" style="font-weight:800">${s.winsA}</span></div>
      <div class="row" style="margin-top:4px"><span class="small">${esc(oppName)}</span><span class="mono" style="font-weight:800">${s.winsB}</span></div>
      <p class="tiny muted" style="margin-top:8px">全局 BP：双方已用 ${s.used.length} 个英雄，后续局不能再选。</p>
    </div>

    ${s.done
      ? '<button class="btn btn-primary btn-block" data-action="next-game" style="padding:15px">查看系列赛总结 →</button>'
      : `<button class="btn btn-primary btn-block" data-action="next-game" style="padding:15px">进入第 ${s.gameIndex + 1} 局 BP →</button>`}
  </div>`;
}

function renderTactic(state, ui) {
  const m = ui.match;
  const d = m.draft;
  const mySide = d.playerSide;
  const oppSide = mySide === 'blue' ? 'red' : 'blue';
  const myEval = evaluateDraft(d, mySide, state.players);
  const oppEval = evaluateDraft(d, oppSide, state.players);
  const oppId = mySide === 'blue' ? d.redTeamId : d.blueTeamId;
  const preview = decisionPreview({
    players: state.players,
    teamId: state.playerTeamId,
    oppTeamId: oppId,
    draft: d,
    nodes: m.nodes
  });
  const t = m.tactic || { choices: {} };
  const nodes = preview.nodes || [];
  const missing = nodes.filter((n) => !t.choices[n.id]).length;

  return `<div class="topbar">
    <div class="grow"><h1>赛中决策</h1><div class="sub">${esc(playerTeam(state).name)} vs ${esc(teamName(state, oppId))}</div></div>
    <span class="chip accent">BP ${myEval.pct >= 0 ? '+' : ''}${(myEval.pct * 100).toFixed(1)}%</span>
  </div>

  <div class="stack">
    ${lineupCompare(state, d, mySide, oppSide, myEval, oppEval)}

    ${nodes.map((n) => decisionBlock(n.title, n.id, n.options, t.choices[n.id])).join('')}
    ${m.comp?.stage === 'playoff' ? renderPeakDuel(state, m) : ''}

    <div class="card tight flat">
      <div class="row"><span class="small">我方修正战力</span>
        <span class="mono" style="font-weight:800">${(computeTeamPower(state.players, state.playerTeamId, state.duos).total * (1 + myEval.pct)).toFixed(1)}</span>
      </div>
      <div class="row" style="margin-top:4px"><span class="small">对手修正战力</span>
        <span class="mono" style="font-weight:800">${(computeTeamPower(state.players, oppId, state.duos).total * (1 + oppEval.pct)).toFixed(1)}</span>
      </div>
    </div>

    <button class="btn btn-primary btn-block" data-action="play-match" ${missing ? 'disabled' : ''} style="padding:15px">
      ${missing ? `还有 ${missing} 个决策没选` : `开始第 ${m.series ? m.series.gameIndex + 1 : 1} 局比赛 →`}
    </button>
    <button class="btn btn-ghost btn-block" data-action="back-to-draft">返回 BP</button>
  </div>`;
}

function liveMapBlock(state, d, ui) {
  const mode = ui.mmMode || 'balanced';
  const modes = [
    ['attack', '进攻', '压塔、抢龙，风险更高'],
    ['balanced', '平衡', '按阵容强度推进'],
    ['defend', '防守', '缩塔发育，等后期']
  ];
  return `<div class="card minimap-card">
    <div class="card-title"><span class="k">实时战况</span><span class="v">10 名英雄自动对局</span></div>
    <canvas class="minimap" width="340" height="340"></canvas>
    <div class="mm-stats"></div>
    <div class="mm-modes">
      ${modes.map(([k, label, desc]) => `<button class="mm-mode ${mode === k ? 'on' : ''}" data-action="mm-mode" data-mode="${k}" title="${desc}">${label}</button>`).join('')}
    </div>
  </div>`;
}

function decisionBlock(title, nodeKey, options, chosen) {
  return `<div class="card">
    <div class="card-title"><span class="k">${esc(title)}</span><span class="v">${chosen ? '已选择' : '待决策'}</span></div>
    <div class="stack-sm">
      ${options.map((o) => `<button class="decision ${chosen === o.key ? 'on' : ''}" data-action="choose-tactic" data-node="${nodeKey}" data-key="${o.key}">
        <div class="dh">
          <span class="key">${o.key}</span>
          <span style="font-weight:650">${esc(o.name)}</span>
          <span class="chip ${o.met ? 'green' : 'red'}" style="margin-left:auto;font-size:10px">${o.met ? '条件满足' : '条件不足'}</span>
        </div>
        <div class="dd">${esc(o.desc)}</div>
        <div class="dstate" style="color:${o.met ? 'var(--green)' : 'var(--red)'}">
          ${o.met ? `预计 +${o.good}` : `预计 ${o.bad}`}
        </div>
      </button>`).join('')}
    </div>
  </div>`;
}

function renderPeakDuel(state, m) {
  const chosen = m.peakDuel || [];
  return `<div class="card peak">
    <div class="card-title"><span class="k">⚡ 巅峰对决</span><span class="v">${chosen.length}/5</span></div>
    <p class="tiny muted" style="line-height:1.6">
      BO7 打到 3:3 时进入盲选，一局定胜负。双方看不到对方阵容，这就是你的第五局。
    </p>
    <div class="peak-slots">
      ${[0, 1, 2, 3, 4].map((i) => {
        const h = HERO_BY_ID[chosen[i]];
        return `<span class="peak-slot ${h ? 'filled' : ''}">${h ? esc(h.name) : '?'}</span>`;
      }).join('')}
    </div>
    <button class="btn btn-xs" data-action="peak-reroll">重随机</button>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 结果                                                                 */
/* ------------------------------------------------------------------ */

function renderResult(state, ui) {
  const r = ui.match.result;
  if (!r) return '';
  const myWon = r.playerWon;
  const oppId = r.opponentId;
  const series = r.series;

  return `<div class="topbar">
    <div class="grow"><h1>${myWon ? '胜利' : '失利'}</h1><div class="sub">${esc(playerTeam(state).name)} vs ${esc(teamName(state, oppId))}</div></div>
    <span class="chip ${myWon ? 'green' : 'red'}">${series.score.blue} - ${series.score.red}</span>
  </div>

  <div class="stack">
    <div class="hero-banner center">
      <div class="tiny muted">${esc(teamName(state, oppId))}</div>
      <div style="font-size:38px;font-weight:800;letter-spacing:2px;color:${myWon ? 'var(--accent)' : 'var(--red)'}">
        ${series.score.blue} : ${series.score.red}
      </div>
      <div class="small dim">${myWon ? '拿下这一场' : '差了一口气'}</div>
    </div>

    ${series.games.map((g, i) => renderGameCard(state, g, i, oppId)).join('')}

    ${series.peakDuel?.triggered ? `<div class="card peak">
      <div class="card-title"><span class="k">⚡ 巅峰对决</span><span class="v">${series.peakDuel.winner === 'blue' ? '我方胜' : '对方胜'}</span></div>
      <p class="tiny muted" style="margin-bottom:8px">3:3 进入盲选，一局定胜负。</p>
      <div class="peak-slots">
        ${series.peakDuel.blueHeroes.map((id) => `<span class="peak-slot filled">${esc(HERO_BY_ID[id]?.name || id)}</span>`).join('')}
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-title"><span class="k">比赛总结</span></div>
      <div class="kv"><span class="k">BP 修正</span><span class="v">${pct(blueBpPct(series))}</span></div>
      <div class="kv"><span class="k">场均经济差</span><span class="v">${(series.games.reduce((s, g) => s + g.economy, 0) / series.games.length).toFixed(1)}k</span></div>
      <div class="kv"><span class="k">系列赛 MVP</span><span class="v">${esc(bestMvp(series))}</span></div>
    </div>

    <button class="btn btn-primary btn-block" data-action="finish-match" style="padding:14px">继续 →</button>
  </div>`;
}

function blueBpPct(series) {
  const g = series.games[0];
  return g ? g.evals.blue.pct : 0;
}

function bestMvp(series) {
  const counts = {};
  for (const g of series.games) {
    if (g.winner === 'blue' && g.mvp) {
      counts[g.mvp.name] = (counts[g.mvp.name] || 0) + 1;
    }
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? `${best[0]}（${best[1]} 次）` : '-';
}

function renderGameCard(state, g, index, oppId) {
  const win = g.winner === 'blue';
  return `<div class="card ${win ? 'accent' : ''}">
    <div class="card-title">
      <span class="k">第 ${index + 1} 局 ${win ? '· 胜' : '· 负'}</span>
      <span class="v mono">${g.score.blue} - ${g.score.red}</span>
    </div>
    <div class="log">
      ${g.log.map((e) => `<div class="ev ${e.good ? 'good' : 'bad'}"><time>${e.time}</time><p>${esc(e.text)}</p></div>`).join('')}
      <div class="final">最终比分：${g.score.blue} - ${g.score.red}</div>
    </div>
    ${g.mvp ? `<div class="row" style="margin-top:9px">
      <span class="tiny muted">本局 MVP</span>
      <span class="small"><span class="mvp-star">★</span> ${esc(g.mvp.name)}（${roleCn(g.mvp.role)}）</span>
    </div>` : ''}
    <div class="caster-line">🎙️ ${esc(casterLine(win ? 'win' : 'lose'))}</div>
  </div>`;
}
