// 新闻系统：把转会、比赛、冠军、退役等事件写成一条条短新闻，显示在主页。

import { casterQuote } from '../data/casters.js';

export const NEWS_TYPES = {
  transfer: { label: '转会', icon: '🔁', tone: 'blue' },
  match: { label: '赛事', icon: '⚔️', tone: 'accent' },
  title: { label: '冠军', icon: '🏆', tone: 'gold' },
  player: { label: '选手', icon: '👤', tone: 'purple' },
  league: { label: '联赛', icon: '📢', tone: '' }
};

export function addNews(state, { type = 'league', title, body = '', season = state.year, week = state.week, caster = null }) {
  if (!title) return null;
  state.news = state.news || [];
  if (state.news.some((n) => n.title === title && n.season === season && n.week === week)) return null;

  state.newsSeq = (state.newsSeq || 0) + 1;
  const item = {
    id: `n-${state.newsSeq}`,
    type,
    title,
    body,
    season,
    week,
    seq: state.newsSeq,
    caster
  };
  state.news.unshift(item);
  if (state.news.length > 60) state.news.length = 60;
  return item;
}

export function recentNews(state, count = 6) {
  return (state.news || []).slice(0, count);
}

export function newsById(state, id) {
  return (state.news || []).find((n) => n.id === id) || null;
}

/** 比赛新闻：双方全名、轮次、比分、MVP、解说短评 */
export function addMatchNews(state, { comp, match, playerTeamId, playerWon, playerScore, oppScore, mvpName }) {
  const myTeam = state.teams.find((t) => t.id === playerTeamId);
  const oppId = match.home === playerTeamId ? match.away : match.home;
  const oppTeam = state.teams.find((t) => t.id === oppId);

  const round = comp.playoff
    ? comp.playoff.rounds.find((r) => r.matches.includes(match))?.name || '淘汰赛'
    : '常规赛';

  const title = `${myTeam?.name || ''} ${playerWon ? '击败' : '不敌'} ${oppTeam?.name || ''}（${playerScore}-${oppScore}）`;

  const lines = [
    `${comp.name} · ${round}`,
    `${myTeam?.name || ''} ${playerScore} - ${oppScore} ${oppTeam?.name || ''}。`
  ];
  if (mvpName) lines.push(`本场 MVP：${mvpName}。`);

  return addNews(state, {
    type: 'match',
    title,
    body: lines.join('\n\n'),
    caster: casterQuote(playerWon ? 'win' : 'lose')
  });
}

/** 冠军新闻：赛事、冠军、决赛比分、解说短评 */
export function addTitleNews(state, { comp, championName, finalScore }) {
  const lines = [`${comp.name} 落幕，${championName} 捧起冠军奖杯。`];
  if (finalScore) lines.push(`决赛比分：${finalScore}。`);
  return addNews(state, {
    type: 'title',
    title: `${comp.name} 冠军：${championName}`,
    body: lines.join('\n\n'),
    caster: casterQuote('season')
  });
}

/** 开局时写入几条背景新闻，让新闻栏一上来就不是空的 */
export function seedOpeningNews(state) {
  const year = state.year;
  const items = [
    {
      type: 'league',
      title: `${year} KPL 夏季赛本周开赛`,
      body: '十八支战队进入常规赛，赛季末前八名晋级季后赛。'
    },
    {
      type: 'league',
      title: '年度总决赛 11 月开赛',
      body: '夏季赛前八名将争夺年度总决赛冠军，决出年度最后一座奖杯。'
    },
    {
      type: 'transfer',
      title: '转会期临近，多支战队开始接触自由人',
      body: '赛季结束后将开放转会窗，各队经理已经开始评估阵容短板。'
    }
  ];
  for (const item of items) addNews(state, { ...item, week: 1 });
}
