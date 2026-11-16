import { FACILITIES, MAX_FACILITY_LEVEL, ECONOMY } from '../data/constants.js';
import { facilityUpgradeCost, facilityUpkeep, salaryTotal, salaryCapStatus } from '../core/economy.js';
import { playerTeam } from '../core/game.js';
import { esc, money, moneyShort } from './format.js';

export function renderMore(state) {
  const team = playerTeam(state);
  const upkeep = facilityUpkeep(team);
  const salaries = salaryTotal(state.players, state.playerTeamId);
  const cap = salaryCapStatus(state.players, team);

  return `<div class="topbar">
    <div class="grow"><h1>俱乐部</h1><div class="sub">${esc(team.name)} · 设施与财务</div></div>
    <span class="chip">S${state.year}</span>
  </div>

  <div class="stack">
    ${renderHonors(state)}
    ${renderAwards(state)}

    <div class="card">
      <div class="card-title"><span class="k">设施</span><span class="v">维护 ${money(upkeep)}/赛季</span></div>
      <div class="stack-sm">
        ${Object.entries(FACILITIES).map(([key, def]) => {
          const lv = team.facilities[key];
          const maxed = lv >= MAX_FACILITY_LEVEL;
          const cost = facilityUpgradeCost(team, key);
          return `<div class="card tight flat">
            <div class="row">
              <div class="row-start" style="gap:9px">
                <span style="font-size:20px">${def.icon}</span>
                <div>
                  <div style="font-weight:700;font-size:13px">${def.name} <span class="chip" style="font-size:10px">Lv.${lv}</span></div>
                  <div class="tiny muted" style="margin-top:2px">${esc(def.desc)}</div>
                </div>
              </div>
              <button class="btn btn-xs ${maxed ? '' : 'btn-primary'}" data-action="upgrade-facility" data-key="${key}" ${maxed ? 'disabled' : ''}>
                ${maxed ? '满级' : `升级 ${moneyShort(cost)}`}
              </button>
            </div>
            <div class="bar ${lv >= 4 ? 'hi' : 'mid'}" style="margin-top:8px"><i style="width:${(lv / MAX_FACILITY_LEVEL) * 100}%"></i></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="k">财务概览</span><span class="v">每赛季结算</span></div>
      <div class="kv"><span class="k">当前资金</span><span class="v">${money(state.cash)}</span></div>
      <div class="kv"><span class="k">选手薪资</span><span class="v">${money(salaries)}</span></div>
      <div class="kv"><span class="k">薪资帽</span><span class="v">${money(cap.cap)}（占用 ${(cap.ratio * 100).toFixed(0)}%）</span></div>
      <div class="kv"><span class="k">基础运营</span><span class="v">${money(ECONOMY.operatingCost)}</span></div>
      <div class="kv"><span class="k">设施维护</span><span class="v">${money(upkeep)}</span></div>
      <div class="kv"><span class="k">联赛分成</span><span class="v">${money(ECONOMY.leagueShare)}</span></div>
      <div class="kv"><span class="k">冠军奖金</span><span class="v">${money(ECONOMY.prizeChampion)}</span></div>
      <p class="tiny muted" style="margin-top:8px">
        安全线：薪资 ≤ 总收入 50%。超过 65% 进入赤字风险，超过 80% 无法进行转会。
      </p>
    </div>

    ${state.lastSettlement ? `<div class="card">
      <div class="card-title"><span class="k">上一次赛季结算</span><span class="v" style="color:${state.lastSettlement.net >= 0 ? 'var(--green)' : 'var(--red)'}">
        ${state.lastSettlement.net >= 0 ? '+' : ''}${money(state.lastSettlement.net)}
      </span></div>
      ${state.lastSettlement.items.map((i) => `<div class="kv">
        <span class="k">${esc(i.label)}</span>
        <span class="v" style="color:${i.kind === 'income' ? 'var(--green)' : 'var(--red)'}">
          ${i.amount >= 0 ? '+' : ''}${money(i.amount)}
        </span>
      </div>`).join('')}
    </div>` : ''}

    <div class="card">
      <div class="card-title"><span class="k">存档</span><span class="v">自动保存</span></div>
      <p class="tiny muted" style="margin-bottom:10px">存档保存在本机浏览器。换设备或清理缓存前，请先导出备份文本。</p>
      <div class="stack-sm">
        <button class="btn btn-block" data-action="exit-to-menu">退出到主菜单（保留存档）</button>
        <button class="btn btn-block" data-action="export-save">导出存档文本</button>
        <button class="btn btn-block" data-action="check-update">检查更新</button>
        <button class="btn btn-block" data-action="import-save">导入存档文本</button>
        <button class="btn btn-danger btn-block" data-action="delete-save">删除存档并重开</button>
      </div>
    </div>

    <div class="card flat">
      <div class="card-title"><span class="k">关于</span><span class="v">v1.0</span></div>
      <p class="tiny muted" style="line-height:1.7">
        单机 PWA · 无账号 · 无联网。数值参数集中在 <code>src/data/constants.js</code>，
        比赛标准差、BP 加成、薪资帽等都可以直接改。<br/>
        添加到主屏幕后可以全屏离线游玩。
      </p>
    </div>
  </div>`;
}

function renderHonors(state) {
  const honors = state.honors || [];
  const league = honors.filter((h) => h.type === 'lpl').length;
  const intl = honors.filter((h) => h.type === 'intl').length;

  return `<div class="card gold">
    <div class="card-title"><span class="k">荣誉墙</span><span class="v">${honors.length} 座奖杯</span></div>
    ${honors.length ? `
      <div class="honor-stats">
        <span><b>${honors.length}</b> 总冠军</span>
        <span><b>${league}</b> 联赛</span>
        <span><b>${intl}</b> 国际赛</span>
      </div>
      <div class="honor-grid">
        ${honors.slice().reverse().map((h) => `<div class="honor-item ${h.type}">
          <span class="honor-trophy">🏆</span>
          <span class="honor-name">${esc(h.short)}</span>
          <span class="honor-year">${h.season}</span>
        </div>`).join('')}
      </div>`
      : '<p class="tiny muted">还没有冠军。拿下第一座奖杯后，这里会记录每一座。</p>'}
  </div>`;
}

function renderAwards(state) {
  const a = state.awards;
  if (!a) return '';
  const roleCn = { TOP: '对抗路', JUG: '打野', MID: '中路', ADC: '发育路', SUP: '游走' };
  return `<div class="card gold" style="margin-bottom:12px">
    <div class="card-title"><span class="k">🏆 ${a.year} 年度颁奖</span><span class="v">巅峰之夜</span></div>
    <div class="kv"><span class="k">年度最佳选手</span><span class="v">${esc(a.mvp?.name || '—')}</span></div>
    <div class="kv"><span class="k">年度最佳新锐</span><span class="v">${esc(a.rookie?.name || '—')}</span></div>
    <div class="kv"><span class="k">年度最佳教练</span><span class="v">${esc(a.coach || '—')}</span></div>
    <div class="kv"><span class="k">最受欢迎俱乐部</span><span class="v">${esc(state.teams.find((t) => t.id === a.popularTeam)?.short || '—')}</span></div>
    <div class="section-label" style="margin:10px 0 6px">年度最佳阵容</div>
    ${['TOP', 'JUG', 'MID', 'ADC', 'SUP'].map((role) => `<div class="kv"><span class="k">${roleCn[role]}</span><span class="v">${esc(a.lineup[role]?.name || '—')}</span></div>`).join('')}
  </div>`;
}
