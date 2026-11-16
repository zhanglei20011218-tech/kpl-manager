import {
  currentCompetition,
  currentCompetitionSpec,
  prepareMatch,
  playerMatchesThisWeek,
  canEndWeek,
  playerTeam,
  teamName,
  teamShort
} from '../core/game.js';
import { competitionStandings, competitionRank, matchesForWeek } from '../core/competition.js';
import { CALENDAR, weekLabel, eventDateLabel } from '../core/calendar.js';
import { computeTeamPower, bondLabel } from '../core/power.js';
import { salaryCapStatus } from '../core/economy.js';
import { recentNews, NEWS_TYPES } from '../core/news.js';
import { esc, money, rankBadge, verdictTag } from './format.js';

export function renderHome(state) {
  const team = playerTeam(state);
  const comp = currentCompetition(state);
  const spec = currentCompetitionSpec(state);
  const cap = salaryCapStatus(state.players, team);
  const power = computeTeamPower(state.players, state.playerTeamId, state.duos);
  const prep = prepareMatch(state);
  const pending = playerMatchesThisWeek(state);
  const gate = canEndWeek(state);

  const phaseLabel = {
    preseason: '季前准备',
    season: comp ? comp.name : '休赛期',
    offseason: '转会期'
  }[state.phase];

  return `<div class="topbar">
    <div class="grow">
      <h1>${esc(team.name)}</h1>
      <div class="sub">${state.year} 赛季 · ${esc(phaseLabel)} · ${weekLabel(state.week)}</div>
    </div>
    <span class="chip accent">${esc(team.short)}</span>
  </div>

  <div class="resbar">
    <div class="res">
      <div class="k">资金</div>
      <div class="v">${(state.cash / 10000).toFixed(0)}<small> 万</small></div>
    </div>
    <div class="res">
      <div class="k">薪资 / 帽</div>
      <div class="v" style="color:${cap.over ? 'var(--red)' : cap.ratio > 0.85 ? 'var(--gold)' : 'var(--text)'}">
        ${(cap.total / 10000).toFixed(0)}<small> / ${(cap.cap / 10000).toFixed(0)} 万</small>
      </div>
    </div>
    <div class="res">
      <div class="k">战队战力</div>
      <div class="v">${power.total.toFixed(1)}<small> 羁绊${bondLabel(power.bond)}</small></div>
    </div>
  </div>

  ${state.phase === 'preseason' ? renderPreseason(state) : ''}
  ${state.phase === 'season' ? renderSeason(state, comp, spec, prep, pending, gate) : ''}
  ${state.phase === 'offseason' ? renderOffseason(state) : ''}

  ${renderNews(state)}

  ${renderCalendarStrip(state)}

  ${comp && comp.standings ? renderStandings(state, comp) : ''}

  <div class="card">
    <div class="card-title"><span class="k">最近战报</span><span class="v">${state.recentResults.slice(-6).join(' ') || '—'}</span></div>
    ${state.playerResults.length ? `<div class="stack-sm">
      ${state.playerResults.slice(-4).reverse().map((r) => `<div class="row" style="font-size:12.5px">
        <span class="row-start" style="gap:7px">${verdictTag(r.won)}<span>${esc(teamName(state, r.opponentId))}</span></span>
        <span class="mono muted">${r.score.blue} - ${r.score.red}</span>
      </div>`).join('')}
    </div>` : `<div class="empty"><div class="big">🗒️</div>还没有比赛记录</div>`}
  </div>`;
}

function renderPreseason(state) {
  const isStart = state.year === 2025;
  return `<div class="card accent">
    <div class="card-title"><span class="k">${state.year} 赛季</span><span class="v">${isStart ? '9 月 · 夏季赛前' : '春季赛开赛'}</span></div>
    <p class="small dim" style="margin-bottom:10px">
      ${isStart
        ? '2025 年 9 月接手：先打 KPL 夏季赛，再冲击年底年度总决赛。'
        : '每年春季赛与夏季赛，年底年度总决赛。先安排好训练和设施，再开始。'}
    </p>
    <button class="btn btn-primary btn-block" data-action="start-year" style="padding:14px">开始赛季 →</button>
  </div>`;
}

function renderSeason(state, comp, spec, prep, pending, gate) {
  if (!comp) {
    return `<div class="card"><p class="small dim">休赛期，点下方按钮推进到下一个赛事。</p>
      <button class="btn btn-block btn-primary" style="margin-top:10px" data-action="end-week">推进到下一赛事</button></div>`;
  }

  const stageLabel = comp.stage === 'playoff' ? '淘汰赛' : comp.groups ? '小组赛' : '常规赛';
  const playerIn = comp.playerIn !== false;

  if (!playerIn) {
    return `<div class="card">
      <div class="card-title"><span class="k">${esc(comp.name)}</span><span class="chip">未参赛</span></div>
      <p class="small dim" style="margin-bottom:10px">你没有拿到这项赛事的参赛资格，赛事会自动进行。可以到「赛事」页查看结果。</p>
      <button class="btn btn-primary btn-block" data-action="end-week">结束本周</button>
    </div>`;
  }

  const match = prep.ok ? prep.match : pending[0] || null;
  const opponent = match ? (match.home === state.playerTeamId ? match.away : match.home) : null;
  const bo = comp.stage === 'playoff' ? 'BO7' : 'BO5';

  return `<div class="card ${pending.length ? 'accent' : ''}">
    <div class="card-title">
      <span class="k">${esc(comp.name)} · ${stageLabel}</span>
      <span class="v">${weekLabel(state.week)}</span>
    </div>
    ${opponent ? `<div class="row" style="margin-bottom:10px">
      <div class="row-start">
        <span class="avatar lg" style="background:linear-gradient(145deg,${esc(playerTeam(state).color)}44,rgba(46,230,200,.15))">${esc(teamName(state, opponent)[0])}</span>
        <div>
          <div style="font-size:15px;font-weight:750">vs ${esc(teamName(state, opponent))}</div>
          <div class="tiny muted">对手战力 ${computeTeamPower(state.players, opponent, state.duos).total.toFixed(1)} · 本周还剩 ${pending.length} 场</div>
        </div>
      </div>
      <span class="chip ${comp.stage === 'playoff' ? 'gold' : 'blue'}">${bo}</span>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" data-action="prepare-match">准备比赛 →</button>
      <button class="btn" data-action="quick-sim">快速模拟</button>
    </div>` : `<p class="small dim" style="margin-bottom:10px">本周的比赛已经全部结束。</p>
    <button class="btn ${gate.ok ? 'btn-primary' : ''} btn-block" data-action="end-week" ${gate.ok ? '' : 'disabled'}>结束本周 →</button>`}
  </div>`;
}

function renderOffseason(state) {
  const s = state.lastSeasonSummary;
  const st = state.lastSettlement;
  return `<div class="card gold">
    <div class="card-title"><span class="k">${state.year} 赛季结算</span><span class="chip gold">${esc(s?.finish || '赛季结束')}</span></div>
    ${st ? `<div class="row" style="margin-bottom:8px">
      <span class="dim small">全年 ${s?.wins || 0} 胜 ${s?.losses || 0} 负 · 冠军 ${s?.titles || 0} 个</span>
      <span class="mono" style="color:${st.net >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:800">
        ${st.net >= 0 ? '+' : ''}${money(st.net)}
      </span>
    </div>` : ''}
    <div class="btn-row" style="margin-top:10px">
      <button class="btn" data-action="goto-transfer">前往转会</button>
      <button class="btn btn-primary" data-action="next-year">开启 ${state.year + 1} 赛季</button>
    </div>
  </div>`;
}

function renderNews(state) {
  const list = recentNews(state, 6);
  if (!list.length) return '';
  return `<div class="card">
    <div class="card-title"><span class="k">📰 新闻</span><span class="v">${state.news.length} 条</span></div>
    <div class="stack-sm">
      ${list.map((n) => {
        const t = NEWS_TYPES[n.type] || NEWS_TYPES.league;
        return `<button class="news-item" data-action="open-news" data-id="${n.id}">
          <span class="news-tag ${t.tone}">${t.icon} ${t.label}</span>
          <span class="news-title">${esc(n.title)}</span>
          <span class="news-time">W${n.week}</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function renderCalendarStrip(state) {
  const now = state.week;
  const list = CALENDAR
    .filter((c) => c.type !== 'regional' && c.endWeek >= now - 1)
    .sort((a, b) => a.startWeek - b.startWeek)
    .slice(0, 4);
  if (!list.length) return '';

  return `<div class="card">
    <div class="card-title"><span class="k">近期赛事</span><span class="v">接下来 ${list.length} 项</span></div>
    <div class="stack-sm">
      ${list.map((c) => {
        const comp = state.competitions[c.id];
        const done = comp && comp.champion;
        const active = state.activeCompetitionId === c.id && state.phase === 'season';
        const champion = comp?.champion;
        const soon = !comp && c.startWeek <= now + 2;
        return `<button class="row" style="width:100%;text-align:left;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)"
          data-action="open-competition" data-id="${c.id}">
          <span class="row-start" style="gap:8px">
            <span class="chip ${active ? 'accent' : done ? 'green' : soon ? 'gold' : ''}" style="font-size:10px">${active ? '进行中' : done ? '已结束' : soon ? '即将开始' : '未开始'}</span>
            <span style="font-size:12.5px;font-weight:${active || soon ? '700' : '500'}">${esc(c.name)}</span>
          </span>
          <span class="tiny muted">${champion ? esc(teamShort(state, champion)) : eventDateLabel(c)}</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function renderStandings(state, comp) {
  if (comp.groups) {
    const groups = competitionStandings(comp);
    return `<div class="card">
      <div class="card-title"><span class="k">小组积分</span><span class="v">${esc(comp.name)}</span></div>
      ${groups.map((g) => `<div class="section-label" style="margin:8px 0 4px">${g.name} 组</div>
        <table class="table"><tbody>
          ${g.standings.map((s, i) => `<tr class="${s.teamId === state.playerTeamId ? 'me' : ''}">
            <td>${rankBadge(i + 1)}</td>
            <td>${esc(teamName(state, s.teamId))}</td>
            <td class="num">${s.wins}</td>
            <td class="num">${s.losses}</td>
          </tr>`).join('')}
        </tbody></table>`).join('')}
    </div>`;
  }

  const sorted = competitionStandings(comp);
  return `<div class="card">
    <div class="card-title"><span class="k">积分榜</span><span class="v">前 8 进季后赛</span></div>
    <table class="table">
      <thead><tr><th></th><th>战队</th><th class="num">胜</th><th class="num">负</th><th class="num">净胜局</th></tr></thead>
      <tbody>
        ${sorted.slice(0, 16).map((s, i) => `<tr class="${s.teamId === state.playerTeamId ? 'me' : ''}">
          <td>${rankBadge(i + 1)}</td>
          <td>${esc(teamName(state, s.teamId))}</td>
          <td class="num">${s.wins}</td>
          <td class="num">${s.losses}</td>
          <td class="num">${s.gameWins - s.gameLosses > 0 ? '+' : ''}${s.gameWins - s.gameLosses}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
