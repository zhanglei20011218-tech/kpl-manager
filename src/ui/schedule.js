import { CALENDAR, COMPETITION_BY_ID, eventDateLabel, weekDate } from '../core/calendar.js';
import { competitionStandings, swissStandings } from '../core/competition.js';
import { currentCompetition, teamName, teamShort, playerPlacement, yearPointsOf } from '../core/game.js';
import { getLeaderboards, getTeamBoard, kdaOf } from '../core/stats.js';
import { esc, rankBadge, roleCn } from './format.js';

const ROUND_NAMES = ['第一轮', '第二轮', '第三轮', '第四轮', '第五轮', '第六轮', '第七轮', '第八轮', '第九轮', '第十轮',
  '第十一轮', '第十二轮', '第十三轮', '第十四轮', '第十五轮'];

const TABS = [
  { key: 'matches', label: '赛程' },
  { key: 'teams', label: '战队榜' },
  { key: 'points', label: '年度积分' },
  { key: 'kills', label: '击杀榜' },
  { key: 'assists', label: '助攻榜' },
  { key: 'kda', label: 'KDA 榜' }
];

const GROUPS = [
  { key: 'lpl', label: 'KPL' },
  { key: 'kjia', label: 'K甲' },
  { key: 'intl', label: '年度总决赛' }
];

function groupOf(c) {
  if (!c) return 'lpl';
  if (c.type === 'lpl') return 'lpl';
  if (c.type === 'regional') return 'kjia';
  if (c.type === 'intl') return 'intl';
  return 'lpl';
}

function inGroup(c, group) {
  if (group === 'lpl') return c.type === 'lpl';
  if (group === 'kjia') return c.type === 'regional';
  if (group === 'intl') return c.type === 'intl';
  return false;
}

export function renderSchedule(state, ui) {
  const tab = ui.scheduleTab || 'matches';
  const currentSpec = COMPETITION_BY_ID[ui.scheduleCompId || state.activeCompetitionId] || CALENDAR[0];
  const group = ui.scheduleGroup || groupOf(currentSpec);
  let compId = currentSpec.id;
  if (!inGroup(COMPETITION_BY_ID[compId], group)) {
    compId = CALENDAR.find((c) => inGroup(c, group))?.id || compId;
  }
  const spec = COMPETITION_BY_ID[compId];
  const comp = state.competitions[compId];
  const list = CALENDAR.filter((c) => inGroup(c, group));

  return `<div class="topbar">
    <div class="grow"><h1>赛事</h1><div class="sub">${state.year} 赛季 · 各赛区赛程与数据榜</div></div>
    <span class="chip">${CALENDAR.length} 项</span>
  </div>

  <div class="card tight" style="margin-bottom:10px">
    <div class="row" style="margin-bottom:8px">
      <span class="tiny muted" style="letter-spacing:.08em">赛事</span>
      <span class="chip accent" style="font-size:10px">${spec ? esc(spec.name) : '—'}</span>
    </div>
    <div class="filter-row" style="margin-bottom:6px">
      ${GROUPS.map((g) => `<button class="filter-chip ${group === g.key ? 'on' : ''}" data-action="schedule-group" data-key="${g.key}">
        ${g.label}
      </button>`).join('')}
    </div>
    <div class="filter-row">
      ${list.map((c) => {
        const done = state.competitions[c.id]?.champion;
        return `<button class="filter-chip ${c.id === compId ? 'on' : ''}" data-action="schedule-comp" data-id="${c.id}">
          ${String(c.season).slice(2)} ${esc(c.short)}${done ? ' ✓' : ''}
        </button>`;
      }).join('')}
    </div>
  </div>

  <div class="segmented" style="margin-bottom:12px">
    ${TABS.map((t) => `<button class="seg ${tab === t.key ? 'on' : ''}" data-action="schedule-tab" data-key="${t.key}">
      ${t.label}
    </button>`).join('')}
  </div>

  ${tab === 'matches' ? renderMatches(state, spec, comp) : renderStats(state, spec, comp, tab)}
</div>`;
}

function renderMatches(state, spec, comp) {
  return `${spec ? renderCompetitionHeader(state, spec, comp) : ''}
    ${comp ? `${renderStageAwards(state, comp)}${renderCompetitionBody(state, comp)}` : `<div class="empty"><div class="big">📅</div>该赛事尚未开始</div>`}`;
}

/** 赛段常规赛最佳：常规赛打完时评选，随赛事保存 */
function renderStageAwards(state, comp) {
  const a = comp.regularAwards;
  if (!a) return '';
  const roleCn = { TOP: '对抗路', JUG: '打野', MID: '中路', ADC: '发育路', SUP: '游走' };
  return `<div class="card gold" style="margin-bottom:12px">
    <div class="card-title"><span class="k">🏅 常规赛最佳</span><span class="v">${esc(comp.name)}</span></div>
    <div class="kv"><span class="k">常规赛最佳选手</span><span class="v">${esc(a.mvp?.name || '—')}</span></div>
    ${['TOP', 'JUG', 'MID', 'ADC', 'SUP'].map((role) => `<div class="kv"><span class="k">${roleCn[role]}</span><span class="v">${esc(a.lineup[role]?.name || '—')}</span></div>`).join('')}
  </div>`;
}

function renderStats(state, spec, comp, tab) {
  if (tab === 'teams') return renderTeamBoard(state, comp);
  if (tab === 'points') return renderYearPoints(state);
  return renderPlayerBoard(state, tab, comp);
}

function renderYearPoints(state) {
  const rows = yearPointsOf(state, state.year);
  return `<div class="card">
    <div class="card-title"><span class="k">年度积分</span><span class="v">春季赛 + 夏季赛 · 前 8 进年度总决赛</span></div>
    <table class="table">
      <thead><tr><th></th><th>战队</th><th class="num">春季赛</th><th class="num">夏季赛</th><th class="num">总分</th></tr></thead>
      <tbody>
        ${rows.map((r, i) => `<tr class="${r.teamId === state.playerTeamId ? 'me' : ''}">
          <td>${rankBadge(i + 1)}</td>
          <td>${esc(teamShort(state, r.teamId))}</td>
          <td class="num">${r.spring}</td>
          <td class="num">${r.summer}</td>
          <td class="num" style="font-weight:750">${r.total}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 战队榜                                                               */
/* ------------------------------------------------------------------ */

function renderTeamBoard(state, comp) {
  const board = getTeamBoard(state, comp?.id);
  const standingsMap = {};
  if (comp?.standings) {
    for (const s of comp.standings) standingsMap[s.teamId] = s;
  }

  if (!board.length) {
    return `<div class="empty"><div class="big">📊</div>还没有比赛数据，先打几场</div>`;
  }

  return `<div class="card">
    <div class="card-title"><span class="k">战队比分排名</span><span class="v">按 K/D</span></div>
    <table class="table">
      <thead><tr>
        <th></th><th>战队</th><th class="num">胜-负</th><th class="num">击杀</th><th class="num">死亡</th><th class="num">K/D</th>
      </tr></thead>
      <tbody>
        ${board.map((row, i) => {
          const st = standingsMap[row.teamId];
          const rec = st ? `${st.wins}-${st.losses}` : `${row.games} 局`;
          return `<tr class="${row.teamId === state.playerTeamId ? 'me' : ''}">
            <td>${rankBadge(i + 1)}</td>
            <td>${esc(teamShort(state, row.teamId))}</td>
            <td class="num">${rec}</td>
            <td class="num">${row.kills}</td>
            <td class="num">${row.deaths}</td>
            <td class="num" style="color:var(--accent)">${row.kd.toFixed(2)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  ${comp?.standings ? `<div class="card">
    <div class="card-title"><span class="k">当前赛事积分榜</span><span class="v">${esc(comp.name)}</span></div>
    <table class="table">
      <thead><tr><th></th><th>战队</th><th class="num">胜</th><th class="num">负</th><th class="num">净胜局</th></tr></thead>
      <tbody>
        ${competitionStandings(comp).map((s, i) => `<tr class="${s.teamId === state.playerTeamId ? 'me' : ''}">
          <td>${rankBadge(i + 1)}</td>
          <td>${esc(teamName(state, s.teamId))}</td>
          <td class="num">${s.wins}</td>
          <td class="num">${s.losses}</td>
          <td class="num">${s.gameWins - s.gameLosses > 0 ? '+' : ''}${s.gameWins - s.gameLosses}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}`;
}

/* ------------------------------------------------------------------ */
/* 个人榜                                                               */
/* ------------------------------------------------------------------ */

function renderPlayerBoard(state, tab, comp) {
  const { kills, assists, kda } = getLeaderboards(state, comp?.id);
  const list = tab === 'kills' ? kills : tab === 'assists' ? assists : kda;
  const title = tab === 'kills' ? '击杀榜' : tab === 'assists' ? '助攻榜' : 'KDA 榜';
  const metric = tab === 'kills' ? 'K' : tab === 'assists' ? 'A' : 'KDA';

  if (!list.length) {
    return `<div class="empty"><div class="big">📊</div>还没有比赛数据，先打几场</div>`;
  }

  return `<div class="card">
    <div class="card-title"><span class="k">${title}</span><span class="v">本赛季 · 前 20</span></div>
    <div class="stack-sm">
      ${list.map((p, i) => {
        const s = p.season || {};
        const value = tab === 'kills' ? s.kills || 0 : tab === 'assists' ? s.assists || 0 : kdaOf(p).toFixed(2);
        return `<button class="row" style="width:100%;text-align:left;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.04)"
          data-action="player-detail" data-id="${p.id}">
          <span class="row-start" style="gap:8px;min-width:0">
            <span class="rank-badge ${i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : ''}">${i + 1}</span>
            <span class="avatar sm">${esc(p.name[0])}</span>
            <span style="min-width:0">
              <span style="font-size:13px;font-weight:650;display:block">${esc(p.name)}</span>
              <span class="tiny muted">${esc(teamShort(state, p.teamId))} · ${roleCn(p.role)} · ${s.games || 0} 场</span>
            </span>
          </span>
          <span class="center" style="min-width:64px">
            <span class="mono" style="font-weight:800;font-size:15px;color:${i < 3 ? 'var(--gold)' : 'var(--text)'}">${value}</span>
            <span class="tiny muted" style="display:block">${metric}</span>
          </span>
        </button>`;
      }).join('')}
    </div>
    <p class="tiny muted" style="margin-top:10px">点击选手查看详细数据。KDA = (击杀 + 助攻) / 死亡。</p>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 赛程                                                                 */
/* ------------------------------------------------------------------ */

function renderCompetitionHeader(state, spec, comp) {
  const placement = comp ? playerPlacement(state, comp) : null;
  const label = { champion: '冠军', runnerUp: '亚军', top4: '四强', top8: '八强' }[placement];
  const stageLabel = comp?.stage === 'playoff'
    ? '淘汰赛'
    : comp?.swiss
      ? '瑞士轮'
      : comp?.groups
        ? '小组赛'
        : '常规赛';
  return `<div class="card accent" style="margin-bottom:12px">
    <div class="card-title">
      <span class="k">${esc(spec.name)}</span>
      <span class="chip ${comp?.champion ? 'gold' : ''}">${comp?.champion ? '已结束' : comp ? '进行中' : '未开始'}</span>
    </div>
    <div class="row" style="margin-bottom:6px">
      <span class="tiny muted">${eventDateLabel(spec)} · ${spec.type === 'lpl' ? 'KPL' : spec.type === 'regional' ? 'K甲' : '年度总决赛'}</span>
      <span class="chip" style="font-size:10px">${stageLabel}</span>
    </div>
    ${comp?.champion ? `<div class="row">
      <span class="small">冠军</span>
      <span class="chip gold">${esc(teamName(state, comp.champion))}</span>
    </div>` : ''}
    ${label ? `<div class="row" style="margin-top:4px">
      <span class="small">你的成绩</span>
      <span class="chip ${placement === 'champion' ? 'gold' : 'accent'}">${label}</span>
    </div>` : ''}
  </div>`;
}

function renderCompetitionBody(state, comp) {
  if (comp.swiss) {
    return renderSwiss(state, comp);
  }
  if (comp.groups) {
    return `${renderLeagueTable(state, comp)}${comp.groups.map((g) => renderGroup(state, comp, g)).join('')}`;
  }
  // 进入淘汰赛后，晋级图优先展示，排名表放到下面
  if (comp.stage === 'playoff' || comp.format === 'ko') {
    return `${renderPlayoff(state, comp)}${renderLeagueTable(state, comp)}`;
  }
  return `${renderLeagueTable(state, comp)}<div class="stack">${comp.rounds.map((r) => renderRound(state, comp, r)).join('')}</div>`;
}

/** 联赛积分榜：常规赛阶段和季后赛阶段都保留，方便对照最终排名 */
function renderLeagueTable(state, comp) {
  if (comp.groups) {
    const groups = competitionStandings(comp);
    return `<div class="card" style="margin-bottom:12px">
      <div class="card-title"><span class="k">小组积分</span><span class="v">${esc(comp.name)}</span></div>
      ${groups.map((g) => `<div class="section-label" style="margin:8px 0 4px">${g.name} 组</div>
        <table class="table"><tbody>
          ${g.standings.map((s, i) => `<tr class="${s.teamId === state.playerTeamId ? 'me' : ''}">
            <td>${rankBadge(i + 1)}</td>
            <td>${esc(teamShort(state, s.teamId))}</td>
            <td class="num">${s.wins}</td>
            <td class="num">${s.losses}</td>
          </tr>`).join('')}
        </tbody></table>`).join('')}
    </div>`;
  }

  if (comp.standings) {
    const sorted = competitionStandings(comp);
    const cut = comp.playoffSize || 8;
    return `<div class="card" style="margin-bottom:12px">
      <div class="card-title"><span class="k">联赛排名</span><span class="v">前 ${cut} 进季后赛</span></div>
      <table class="table">
        <thead><tr><th></th><th>战队</th><th class="num">胜</th><th class="num">负</th><th class="num">净胜局</th></tr></thead>
        <tbody>
          ${sorted.slice(0, 16).map((s, i) => `<tr class="${s.teamId === state.playerTeamId ? 'me' : ''}">
            <td>${rankBadge(i + 1)}</td>
            <td>${esc(teamShort(state, s.teamId))}</td>
            <td class="num">${s.wins}</td>
            <td class="num">${s.losses}</td>
            <td class="num">${(s.gameWins || 0) - (s.gameLosses || 0)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  // 纯淘汰赛赛事：按晋级图推导最终名次
  const ranking = finalRanking(comp);
  if (!ranking.length) return '';

  return `<div class="card" style="margin-bottom:12px">
    <div class="card-title"><span class="k">最终名次</span><span class="v">${ranking.length} 队</span></div>
    <table class="table">
      <thead><tr><th></th><th>战队</th><th class="num">名次</th></tr></thead>
      <tbody>
        ${ranking.map((r) => `<tr class="${r.teamId === state.playerTeamId ? 'me' : ''}">
          <td>${rankBadge(r.rank)}</td>
          <td>${esc(teamShort(state, r.teamId))}</td>
          <td class="num">${r.rankLabel}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

/** 从淘汰赛结果推导 1..N 名：冠军、亚军、各轮负者并列 */
function finalRanking(comp) {
  const p = comp.playoff;
  if (!p || !p.champion) return [];

  const place = new Map();
  place.set(p.champion, 1);

  const finalRound = p.rounds[p.rounds.length - 1];
  const finalMatch = finalRound?.matches?.[0];
  if (finalMatch?.result) {
    const runner = finalMatch.result.winnerId === finalMatch.home ? finalMatch.away : finalMatch.home;
    if (runner) place.set(runner, 2);
  }

  let nextPlace = 3;
  for (let i = p.rounds.length - 2; i >= 0; i -= 1) {
    const round = p.rounds[i];
    for (const m of round.matches) {
      if (!m.result) continue;
      const loser = m.result.winnerId === m.home ? m.away : m.home;
      if (!place.has(loser)) place.set(loser, nextPlace);
    }
    nextPlace += round.matches.length;
  }

  for (const id of comp.teams) {
    if (!place.has(id)) place.set(id, nextPlace);
  }

  return [...place.entries()]
    .map(([teamId, rank]) => ({ teamId, rank, rankLabel: `第 ${rank} 名` }))
    .sort((a, b) => a.rank - b.rank);
}

function renderSwiss(state, comp) {
  const sw = comp.swiss;
  const sorted = swissStandings(comp);
  return `<div class="card" style="margin-bottom:12px">
    <div class="card-title"><span class="k">瑞士轮</span><span class="v">3 胜晋级 / 3 负淘汰</span></div>
    ${sw.rounds.length
      ? sw.rounds.map((r) => `<div class="stack-sm" style="margin-bottom:10px">
        <div class="tiny muted">${esc(r.name)}</div>
        ${r.matches.map((m) => matchRow(state, m)).join('')}
      </div>`).join('')
      : '<p class="tiny muted">瑞士轮尚未开始</p>'}
    <div class="section-label" style="margin-top:10px">当前战绩</div>
    <table class="table">
      <thead><tr><th>战队</th><th class="num">胜</th><th class="num">负</th></tr></thead>
      <tbody>
        ${sorted.map((s) => `<tr class="${s.teamId === state.playerTeamId ? 'me' : ''}">
          <td>${esc(teamShort(state, s.teamId))}</td>
          <td class="num">${s.w}</td>
          <td class="num">${s.l}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${sw.qualified.length ? `<div class="section-label" style="margin-top:10px">已晋级 8 强</div>
      <div class="wrap" style="margin-top:5px">${sw.qualified.map((id) => `<span class="chip green">${esc(teamShort(state, id))}</span>`).join('')}</div>` : ''}
    ${sw.eliminated.length ? `<div class="section-label" style="margin-top:10px">已淘汰</div>
      <div class="wrap" style="margin-top:5px">${sw.eliminated.map((id) => `<span class="chip red">${esc(teamShort(state, id))}</span>`).join('')}</div>` : ''}
  </div>`;
}

function renderGroup(state, comp, group) {
  return `<div class="card" style="margin-bottom:12px">
    <div class="card-title"><span class="k">${esc(comp.name)} · ${group.name} 组</span><span class="v">${group.teams.length} 队</span></div>
    ${group.rounds.map((r) => `<div class="stack-sm" style="margin-bottom:8px">
      <div class="tiny muted">第 ${r.index + 1} 轮</div>
      ${r.matches.map((m) => matchRow(state, m)).join('')}
    </div>`).join('')}
  </div>`;
}

function renderRound(state, comp, round) {
  const weekStart = comp.startWeek + Math.floor(round.index / (comp.type === 'lpl' ? 2 : 1));
  return `<div class="card">
    <div class="card-title"><span class="k">${ROUND_NAMES[round.index] || `第 ${round.index + 1} 轮`}</span><span class="v">${round.matches.filter((m) => m.result).length}/${round.matches.length} 场</span></div>
    <div class="stack-sm">
      ${round.matches.map((m) => matchRow(state, m)).join('')}
    </div>
  </div>`;
}

function renderPlayoff(state, comp) {
  const p = comp.playoff;
  if (!p) return `<div class="empty">淘汰赛尚未开始</div>`;
  return `<div class="card">
    <div class="card-title"><span class="k">晋级图</span><span class="v">横向滑动查看</span></div>
    <div class="bracket-scroll">
      <div class="bracket">
        ${p.rounds.map((r) => `<div class="bracket-col">
          <div class="bracket-col-title">${esc(r.name)}</div>
          ${r.matches.map((m) => bracketMatch(state, m)).join('')}
        </div>`).join('')}
      </div>
    </div>
  </div>
  ${p.champion ? `<div class="card gold" style="margin-top:10px"><div class="row">
    <span class="small">冠军</span>
    <span class="chip gold">${esc(teamName(state, p.champion))}</span>
  </div></div>` : ''}`;
}

function bracketMatch(state, m) {
  const r = m.result;
  const homeWin = r && r.winnerId === m.home;
  const awayWin = r && r.winnerId === m.away;
  const mine = m.home === state.playerTeamId || m.away === state.playerTeamId;
  return `<div class="bracket-match ${mine ? 'mine' : ''}">
    <div class="bm-row ${homeWin ? 'win' : ''}">
      <span class="bm-team">${esc(teamShort(state, m.home))}</span>
      <span class="bm-score">${r ? r.homeGames : '·'}</span>
    </div>
    <div class="bm-row ${awayWin ? 'win' : ''}">
      <span class="bm-team">${esc(teamShort(state, m.away))}</span>
      <span class="bm-score">${r ? r.awayGames : '·'}</span>
    </div>
  </div>`;
}

function matchRow(state, m) {
  const mine = m.home === state.playerTeamId || m.away === state.playerTeamId;
  const r = m.result;
  const homeWin = r && r.winnerId === m.home;
  const awayWin = r && r.winnerId === m.away;
  return `<div class="row ${mine ? 'me' : ''}" style="padding:4px 6px;border-radius:8px;background:${mine ? 'rgba(46,230,200,.07)' : 'transparent'}">
    <span class="row-start" style="gap:6px;min-width:0">
      <span style="font-size:12.5px;font-weight:${homeWin ? '750' : '500'};color:${homeWin ? 'var(--accent)' : 'var(--text-2)'}">${esc(teamShort(state, m.home))}</span>
      <span class="tiny muted">vs</span>
      <span style="font-size:12.5px;font-weight:${awayWin ? '750' : '500'};color:${awayWin ? 'var(--accent)' : 'var(--text-2)'}">${esc(teamShort(state, m.away))}</span>
    </span>
    <span class="mono tiny" style="color:${r ? 'var(--text)' : 'var(--muted)'}">${r ? `${r.homeGames} - ${r.awayGames}` : '未赛'}</span>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 赛程日历                                                             */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function monthOf(date) {
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function shiftMonth(cursor, delta) {
  const d = new Date(cursor.year, cursor.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 某一天落在哪些赛事的时间范围内 */
export function eventsOnDate(date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = day.getTime();
  return CALENDAR.filter((spec) => {
    const start = weekDate(spec.startWeek);
    const end = weekDate(spec.endWeek);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return t >= start.getTime() && t <= end.getTime();
  });
}

/** 只保留玩家相关的赛事：LPL 与国际赛，排除其他赛区联赛和玩家确定没进的赛事 */
export function playerEventsOnDate(state, date) {
  return eventsOnDate(date).filter((spec) => {
    if (spec.type === 'regional') return false;
    const comp = state.competitions[spec.id];
    if (comp && comp.playerIn === false) return false;
    return true;
  });
}

/** 日期对应的赛季周次 */
export function weekOfDate(date) {
  const start = weekDate(1);
  const days = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.floor(days / 7) + 1;
}

/** 某赛事在指定周的全部比赛（含已结束） */
function weekMatchesAny(comp, week) {
  if (!comp) return [];
  const offset = week - comp.startWeek;
  if (offset < 0) return [];
  if (comp.stage === 'playoff' && comp.playoff) {
    return comp.playoff.rounds.flatMap((r) => r.matches);
  }
  if (comp.swiss) return comp.swiss.rounds.flatMap((r) => r.matches);
  if (comp.type === 'lpl' || comp.type === 'regional') {
    if (!comp.rounds?.length) return [];
    return comp.rounds.slice(offset * 2, offset * 2 + 2).flatMap((r) => r.matches);
  }
  if (comp.groups) return comp.groups.flatMap((g) => g.rounds[offset]?.matches || []);
  if (comp.rounds?.length) return comp.rounds[offset]?.matches || [];
  return [];
}

export function renderCompetitionCalendar(state, ui) {
  const cursor = ui.calendarMonth || monthOf(weekDate(state.week));
  const first = new Date(cursor.year, cursor.month, 1);
  const offset = first.getDay();
  const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(new Date(cursor.year, cursor.month, d));
  while (cells.length % 7) cells.push(null);

  const todayKey = dateKey(weekDate(state.week));

  return `<div class="card tight" style="margin-bottom:10px">
    <div class="cal-head">
      <button class="cal-nav" data-action="calendar-prev">‹</button>
      <div class="cal-title">${cursor.year} 年 ${cursor.month + 1} 月</div>
      <button class="cal-nav" data-action="calendar-next">›</button>
    </div>
    <div class="cal-week">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">
      ${cells.map((date) => {
        if (!date) return '<span class="cal-cell blank"></span>';
        const key = dateKey(date);
        const covering = playerEventsOnDate(state, date);
        const weekStart = weekDate(weekOfDate(date));
        const isWeekStart = date.getTime() === weekStart.getTime();
        const events = isWeekStart ? covering : [];
        const isToday = key === todayKey;
        const mine = covering.some((e) => state.competitions[e.id]?.playerIn);
        return `<button class="cal-cell ${isToday ? 'today' : ''} ${covering.length ? 'has' : ''} ${mine ? 'mine' : ''}"
          data-action="calendar-day" data-date="${key}" ${covering.length ? '' : 'disabled'}>
          <span class="cal-num">${date.getDate()}</span>
          <span class="cal-tags">
            ${events.slice(0, 2).map((e) => `<i class="cal-tag ${e.type}">${esc(e.short)}</i>`).join('')}
            ${events.length > 2 ? `<i class="cal-tag more">+${events.length - 2}</i>` : ''}
          </span>
        </button>`;
      }).join('')}
    </div>
    <div class="cal-legend">
      <span><i class="cal-dot lpl"></i>KPL</span>
      <span><i class="cal-dot intl"></i>国际赛</span>
    </div>
  </div>`;
}

export function renderDaySheet(state, ui) {
  const date = parseDateKey(ui.sheet.date);
  const week = weekOfDate(date);
  const events = playerEventsOnDate(state, date);

  return `<div class="sheet">
    <div class="sheet-head">
      <h2>${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日</h2>
      <button class="btn btn-xs" data-action="close-sheet">关闭</button>
    </div>
    <div class="sheet-body">
      ${events.length ? events.map((spec) => {
        const comp = state.competitions[spec.id];
        const matches = weekMatchesAny(comp, week);
        const done = comp?.champion;
        return `<div class="card tight" style="margin-bottom:8px">
          <div class="card-title">
            <span class="k">${esc(spec.name)}</span>
            <span class="v">${done ? '已结束' : comp ? '进行中' : '未开始'}</span>
          </div>
          <div class="tiny muted">${eventDateLabel(spec)}</div>
          ${matches.length
            ? `<div class="stack-sm" style="margin-top:6px">${matches.slice(0, 8).map((m) => matchRow(state, m)).join('')}</div>`
            : '<p class="tiny muted" style="margin-top:6px">本周没有安排比赛</p>'}
        </div>`;
      }).join('') : '<div class="empty">这天没有比赛</div>'}
    </div>
  </div>`;
}
