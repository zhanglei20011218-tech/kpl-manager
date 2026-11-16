import { squadOf, TEAM_BY_ID } from '../data/teams.js';
import { playerTeam } from '../core/game.js';
import { salaryCapStatus } from '../core/economy.js';
import { marketSalaryOptions, squadWarning, poachQuote } from '../core/transfer.js';
import { overall, consistencyBand, potentialShort, potentialLabel } from '../core/player.js';
import { GROWTH_TAGS, SCOUT } from '../data/constants.js';
import { esc, moneyShort, roleCn, roleTag, money } from './format.js';

export function renderTransfer(state, ui) {
  const team = playerTeam(state);
  const cap = salaryCapStatus(state.players, team);
  const tab = ui.transferTab || 'market';

  return `<div class="topbar">
    <div class="grow"><h1>转会市场</h1><div class="sub">${state.phase === 'offseason' ? '转会窗开放' : '赛季中 · 仅可查看'}</div></div>
    <span class="chip ${cap.over ? 'red' : cap.ratio > 0.85 ? 'gold' : 'accent'}">${(cap.ratio * 100).toFixed(0)}% 帽</span>
  </div>

  <div class="filter-row" style="margin-bottom:12px">
    <button class="filter-chip ${tab === 'market' ? 'on' : ''}" data-action="transfer-tab" data-key="market">可签选手 ${state.market.length}</button>
    <button class="filter-chip ${tab === 'scout' ? 'on' : ''}" data-action="transfer-tab" data-key="scout">青训 ${state.scoutRemaining}/${2}</button>
    <button class="filter-chip ${tab === 'squad' ? 'on' : ''}" data-action="transfer-tab" data-key="squad">我的阵容</button>
    <button class="filter-chip ${tab === 'poach' ? 'on' : ''}" data-action="transfer-tab" data-key="poach">挖角</button>
  </div>

  ${tab === 'market' ? renderMarket(state, cap) : ''}
  ${tab === 'scout' ? renderScout(state, ui) : ''}
  ${tab === 'squad' ? renderMySquad(state) : ''}
  ${tab === 'poach' ? renderPoachTab(state, ui) : ''}
</div>`;
}

function renderMarket(state, cap) {
  if (state.phase !== 'offseason') {
    return `<div class="card flat"><p class="small dim">转会窗在赛季结束后开放。当前可以查看市场，但无法签约。</p></div>
      ${state.market.map((p) => marketCard(state, p, cap, false)).join('')}`;
  }
  if (!state.market.length) {
    return `<div class="empty"><div class="big">📭</div>市场暂时没有合适的选手，签下或出售后会刷新</div>`;
  }
  return `<div class="stack">
    <div class="card tight flat">
      <div class="row"><span class="small">可用资金</span><span class="mono" style="font-weight:800">${moneyShort(state.cash)}</span></div>
      <div class="row" style="margin-top:4px"><span class="small">薪资空间</span><span class="mono" style="font-weight:800">${moneyShort(Math.max(0, cap.cap - cap.total))}</span></div>
    </div>
    ${state.market.map((p) => marketCard(state, p, cap, true)).join('')}
  </div>`;
}

function marketCard(state, p, cap, enabled) {
  const options = p.expectedSalary ? marketSalaryOptions(p) : null;
  const affordable = p.askingValue <= state.cash;
  const capOk = cap.total + (options?.mid || 0) <= cap.cap;
  return `<div class="card tight" data-action="player-detail" data-id="${p.id}" style="cursor:pointer">
    <div class="row-start">
      <span class="avatar">${esc(p.name[0])}</span>
      <div class="grow">
        <div class="row" style="gap:6px">
          <span style="font-weight:700">${esc(p.name)}</span>
          ${roleTag(p.role)}
          <span class="chip" style="font-size:10px">${p.age} 岁</span>
          <span class="chip ${p.nationality === 'KR' ? 'purple' : ''}" style="font-size:10px">${p.nationality === 'KR' ? '韩援' : '本土'}</span>
        </div>
        <div class="tiny muted" style="margin-top:3px">
          OVR ${overall(p)} · 潜力 ${potentialShort(p.potential)} · 稳定 ${consistencyBand(p)} · ${GROWTH_TAGS[p.growthTag]?.cn}
        </div>
        <div class="tiny" style="margin-top:3px;color:var(--accent-2)">
          要价 ${money(p.askingValue)} · 期望薪资 ${money(p.expectedSalary)}/年
        </div>
      </div>
      <div class="center">
        <div class="ovr">${overall(p)}</div>
        <button class="btn btn-xs ${enabled && affordable && capOk ? 'btn-primary' : ''}" style="margin-top:4px"
          data-action="open-sign" data-id="${p.id}" ${!enabled ? 'disabled' : ''}>
          ${!enabled ? '未开窗' : !affordable ? '资金不足' : !capOk ? '超帽' : '签约'}
        </button>
      </div>
    </div>
  </div>`;
}

function renderScout(state, ui) {
  const canScout = state.phase === 'offseason' && state.scoutRemaining > 0;
  return `<div class="stack">
    <div class="card">
      <div class="card-title"><span class="k">青训营</span><span class="v">每赛季 ${SCOUT.perSeason} 次</span></div>
      <p class="small dim" style="line-height:1.6;margin-bottom:10px">
        派出球探，带回 1–2 名 17–19 岁的新人。能力 55–70，潜力 75–95，高潜力概率约 20%。
        球探报告只给模糊区间，真正的潜力要在训练和比赛里慢慢显现。
      </p>
      <div class="row" style="margin-bottom:10px">
        <span class="small">剩余机会</span>
        <span class="mono" style="font-weight:800">${state.scoutRemaining}</span>
      </div>
      <button class="btn ${canScout ? 'btn-primary' : ''} btn-block" data-action="scout" ${canScout ? '' : 'disabled'}>
        ${canScout ? '派出球探（免费）' : state.scoutRemaining <= 0 ? '本赛季机会已用完' : '转会窗开放后才能使用'}
      </button>
    </div>

    ${state.prospects?.length ? `<div class="section-label">待签约新人</div>
      ${state.prospects.map((p) => `<div class="card tight">
        <div class="row-start">
          <span class="avatar">${esc(p.name[0])}</span>
          <div class="grow">
            <div class="row" style="gap:6px">
              <span style="font-weight:700">${esc(p.name)}</span>
              ${roleTag(p.role)}
              <span class="chip" style="font-size:10px">${p.age} 岁</span>
            </div>
            <div class="tiny muted" style="margin-top:3px">
              球探报告：${esc(potentialLabel(p.potential))} · 当前 OVR ${overall(p)}
            </div>
            <div class="tiny" style="margin-top:2px;color:var(--accent)">薪资仅 ${money(p.salary)}/年（身价 5%）</div>
          </div>
          <button class="btn btn-xs btn-primary" data-action="sign-prospect" data-id="${p.id}">签下</button>
        </div>
      </div>`).join('')}` : ''}
  </div>`;
}

function renderMySquad(state) {
  const squad = squadOf(state.players, state.playerTeamId);
  const warn = squadWarning(state);
  return `<div class="stack">
    ${!warn.ok ? `<div class="card" style="border-color:rgba(255,107,122,.4)">
      <p class="small" style="color:var(--red)">首发不完整：缺少 ${warn.missing.map(roleCn).join('、') || '选手'}</p>
    </div>` : ''}
    ${squad.map((p) => `<div class="card tight">
      <div class="row-start">
        <span class="avatar">${esc(p.name[0])}</span>
        <div class="grow">
          <div class="row" style="gap:6px">
            <span style="font-weight:700">${esc(p.name)}</span>
            ${roleTag(p.role)}
            ${p.isStarter ? '<span class="chip accent" style="font-size:10px">首发</span>' : '<span class="chip" style="font-size:10px">替补</span>'}
          </div>
          <div class="tiny muted" style="margin-top:3px">
            OVR ${overall(p)} · ${p.age} 岁 · 合同 ${p.contractYears} 年 · 薪资 ${money(p.salary)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="btn btn-xs" data-action="player-detail" data-id="${p.id}">详情</button>
          ${!p.isStarter ? `<button class="btn btn-xs btn-danger" data-action="release" data-id="${p.id}">出售</button>` : ''}
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 签约弹层                                                             */
/* ------------------------------------------------------------------ */

export function renderSignSheet(state, playerId) {
  const p = state.market.find((x) => x.id === playerId);
  if (!p) return '';
  const opts = marketSalaryOptions(p);
  const cap = salaryCapStatus(state.players, playerTeam(state));
  const rows = [
    { key: 'low', label: '压价 −15%', salary: opts.low, note: '有概率被直接拒绝' },
    { key: 'mid', label: '标准报价', salary: opts.mid, note: '最稳妥' },
    { key: 'high', label: '加价 +15%', salary: opts.high, note: '提升满意度' }
  ];
  return `<div class="sheet">
    <div class="grab"></div>
    <h2>签约 ${esc(p.name)}</h2>
    <div class="sheet-sub">${roleCn(p.role)} · ${p.age} 岁 · OVR ${overall(p)} · 潜力 ${potentialShort(p.potential)}</div>

    <div class="card tight" style="margin-bottom:12px">
      <div class="kv"><span class="k">转会费</span><span class="v">${money(p.askingValue)}</span></div>
      <div class="kv"><span class="k">当前资金</span><span class="v">${money(state.cash)}</span></div>
      <div class="kv"><span class="k">薪资空间</span><span class="v">${money(Math.max(0, cap.cap - cap.total))}</span></div>
    </div>

    <div class="stack-sm">
      ${rows.map((r) => {
        const overCap = cap.total + r.salary > cap.cap;
        return `<button class="decision" data-action="sign-player" data-id="${p.id}" data-tier="${r.key}" ${overCap ? 'disabled' : ''}>
          <div class="dh"><span style="font-weight:700">${r.label}</span>
            <span class="chip ${overCap ? 'red' : 'accent'}" style="margin-left:auto">${money(r.salary)}/年</span></div>
          <div class="dd">${esc(r.note)}${overCap ? ' · 会超出薪资帽' : ''}</div>
        </button>`;
      }).join('')}
    </div>

    <button class="btn btn-block" style="margin-top:12px" data-action="close-sheet">取消</button>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 挖角页签                                                             */
/* ------------------------------------------------------------------ */

function renderPoachTab(state, ui) {
  const region = ui.poachRegion || 'ALL';
  const regions = ['ALL'];
  const pool = state.players.filter((p) => p.teamId && p.teamId !== state.playerTeamId);
  const filtered = region === 'ALL' ? pool : pool.filter((p) => TEAM_BY_ID[p.teamId]?.region === region);
  const list = filtered.slice().sort((a, b) => overall(b) - overall(a)).slice(0, 40);

  return `<div class="stack">
    <div class="filter-row">
      ${regions.map((r) => `<button class="filter-chip ${region === r ? 'on' : ''}" data-action="poach-region" data-key="${r}">
        ${r === 'ALL' ? '全部' : r}
      </button>`).join('')}
    </div>
    <div class="card tight flat">
      <p class="tiny muted">挖角需要支付违约金，成功率取决于选手意愿：薪资涨幅、两队实力差、忠诚度与满意度。成功率上限 85%。</p>
    </div>
    ${list.map((p) => {
      const team = TEAM_BY_ID[p.teamId];
      return `<button class="card tight" style="width:100%;text-align:left" data-action="open-poach" data-id="${p.id}">
        <div class="row-start">
          <span class="avatar">${esc(p.name[0])}</span>
          <span class="grow">
            <span class="row" style="gap:6px">
              <span style="font-weight:700">${esc(p.name)}</span>
              ${roleTag(p.role)}
              <span class="chip" style="font-size:10px">${esc(team?.short || '')}</span>
              <span class="chip purple" style="font-size:10px">${esc(team?.region || '')}</span>
            </span>
            <span class="tiny muted" style="display:block;margin-top:3px">
              OVR ${overall(p)} · 身价 ${money(p.value)} · 薪资 ${money(p.salary)}
            </span>
          </span>
          <span class="btn btn-xs btn-primary">挖角</span>
        </div>
      </button>`;
    }).join('')}
    ${!list.length ? `<div class="empty">该赛区没有可挖角的选手</div>` : ''}
  </div>`;
}

export function renderPoachSheet(state, playerId) {
  const quote = poachQuote(state, playerId);
  if (!quote) return '';
  const p = quote.player;
  const cap = salaryCapStatus(state.players, playerTeam(state));
  const okCap = cap.total + quote.salary <= cap.cap;
  const okCash = state.cash >= quote.fee;
  const can = okCap && okCash;
  const tone = quote.chance >= 55 ? 'var(--green)' : quote.chance >= 30 ? 'var(--gold)' : 'var(--red)';

  return `<div class="sheet">
    <div class="grab"></div>
    <h2>挖角 ${esc(p.name)}</h2>
    <div class="sheet-sub">${esc(quote.oldTeam?.name || '')} · ${esc(quote.region)} · ${roleCn(p.role)} · ${p.age} 岁</div>

    <div class="card tight" style="margin-bottom:12px">
      <div class="kv"><span class="k">违约金</span><span class="v">${money(quote.fee)}</span></div>
      <div class="kv"><span class="k">新薪资</span><span class="v">${money(quote.salary)}/年</span></div>
      <div class="kv"><span class="k">选手意愿</span><span class="v" style="color:${tone}">${quote.chance}%</span></div>
      <div class="kv"><span class="k">忠诚度 / 满意度</span><span class="v">${p.loyalty} / ${p.satisfaction}</span></div>
    </div>

    <div class="card tight" style="margin-bottom:12px">
      <div class="kv"><span class="k">你的资金</span><span class="v" style="color:${okCash ? 'var(--green)' : 'var(--red)'}">${money(state.cash)}</span></div>
      <div class="kv"><span class="k">薪资空间</span><span class="v" style="color:${okCap ? 'var(--green)' : 'var(--red)'}">${money(Math.max(0, cap.cap - cap.total))}</span></div>
    </div>

    <p class="tiny muted" style="margin-bottom:10px">意愿越低成功率越低；失败后选手忠诚度会上升。成功率上限 85%。</p>

    <button class="btn ${can ? 'btn-primary' : ''} btn-block" data-action="do-poach" data-id="${p.id}" ${can ? '' : 'disabled'}>
      ${!okCash ? '资金不足' : !okCap ? '超出薪资帽' : `强行挖角（${quote.chance}%）`}
    </button>
    <button class="btn btn-block" style="margin-top:8px" data-action="close-sheet">取消</button>
  </div>`;
}
