import { ROLE_CN, HERO_BY_ID } from '../data/heroes.js';
import { formatMoney, formatMoneyShort, overall, consistencyBand, potentialShort } from '../core/player.js';
import { GROWTH_TAGS } from '../data/constants.js';

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function money(n) {
  return formatMoney(n);
}

export function moneyShort(n) {
  return formatMoneyShort(n);
}

export function roleCn(role) {
  return ROLE_CN[role] || role;
}

export function heroName(id) {
  return HERO_BY_ID[id]?.name || id;
}

export function bar(value, max = 100, cls = '') {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = cls || (value >= 80 ? 'hi' : value >= 62 ? 'mid' : 'low');
  return `<div class="bar ${tone}"><i style="width:${pct}%"></i></div>`;
}

export function statLine(label, value, max = 100) {
  return `<div class="stat-line">
    <span class="lbl">${esc(label)}</span>
    ${bar(value, max)}
    <span class="val">${Math.round(value)}</span>
  </div>`;
}

export function roleTag(role) {
  return `<span class="role-tag role-${role}">${roleCn(role)}</span>`;
}

export function avatar(player, cls = '') {
  const ch = player?.name?.[0] || '?';
  return `<span class="avatar ${cls}">${esc(ch)}</span>`;
}

export function playerRow(p, { selected = false, action = 'player-detail', extra = '' } = {}) {
  const ov = overall(p);
  const growth = GROWTH_TAGS[p.growthTag]?.cn || '';
  return `<button class="player-row ${selected ? 'sel' : ''}" data-action="${action}" data-id="${p.id}">
    ${avatar(p)}
    <span class="grow">
      <span class="pname">${esc(p.name)} ${roleTag(p.role)}</span>
      <span class="pmeta">${p.age} 岁 · ${growth} · 潜力${potentialShort(p.potential)} · 稳定性 ${consistencyBand(p)}</span>
    </span>
    ${extra}
    <span class="ovr">${ov}<small>OVR</small></span>
  </button>`;
}

export function gradeColor(v) {
  if (v >= 85) return 'var(--gold)';
  if (v >= 75) return 'var(--accent)';
  if (v >= 65) return 'var(--accent-2)';
  return 'var(--text-2)';
}

export function verdictTag(won) {
  return won ? '<span class="chip green">胜</span>' : '<span class="chip red">负</span>';
}

export function rankBadge(rank) {
  const cls = rank === 1 ? 'p1' : rank === 2 ? 'p2' : rank === 3 ? 'p3' : '';
  return `<span class="rank-badge ${cls}">${rank}</span>`;
}

export function pct(v, digits = 1) {
  return `${(v * 100).toFixed(digits)}%`;
}

export function signed(n, unit = '') {
  return `${n >= 0 ? '+' : ''}${n}${unit}`;
}
