// KPL 时间线：2025 年 9 月夏季赛尾段开局，之后每年春季赛 + 夏季赛 + 年度总决赛。
// 内部用绝对周推进，W1 = 2025-09-01 那一周。

import { KPL_TEAM_IDS } from '../data/kpl-teams.js';
import { K甲_TEAM_IDS } from '../data/k甲-teams.js';

export const START = { year: 2025, month: 9, day: 1 };
const START_DATE = new Date(2025, 8, 1);

export function weekDate(week) {
  const d = new Date(START_DATE);
  d.setDate(d.getDate() + (week - 1) * 7);
  return d;
}

export function formatDate(d) {
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function weekLabel(week) {
  const d = weekDate(week);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 · 第 ${week} 周`;
}

export function yearOfWeek(week) {
  return weekDate(week).getFullYear();
}

/* ------------------------------------------------------------------ */
/* 赛事定义                                                             */
/* ------------------------------------------------------------------ */

const KPL = KPL_TEAM_IDS;

function splitPrize() {
  return { champion: 500, runnerUp: 250, top4: 120, top6: 40 };
}

function finalsPrize() {
  return { champion: 800, runnerUp: 400, top4: 200, top8: 100 };
}

export const EVENTS_2025 = [
  {
    id: 'summer-2025',
    name: '2025 KPL 夏季赛',
    short: '夏季赛',
    type: 'lpl',
    format: 'rr+playoff',
    startWeek: 1,
    endWeek: 11,
    size: 18,
    teams: KPL,
    playoffSize: 8,
    prize: splitPrize(),
    season: 2025
  },
  {
    id: 'finals-2025',
    name: '2025 KPL 年度总决赛',
    short: '年度总决赛',
    type: 'intl',
    format: 'ko',
    startWeek: 12,
    endWeek: 13,
    size: 8,
    teams: [],
    qualifier: 'summer-2025-top8',
    prize: finalsPrize(),
    season: 2025
  },
  {
    id: 'challenger-2025',
    name: '2025 挑战者杯',
    short: '挑战者杯',
    type: 'lpl',
    format: 'ko',
    startWeek: 14,
    endWeek: 15,
    size: 8,
    teams: KPL.slice(0, 8),
    prize: { champion: 300, runnerUp: 150, top4: 80 },
    season: 2025
  }
];

/** 2026 起：春季赛（第 20 周起）、夏季赛（第 36 周起）、年度总决赛（紧随夏季赛） */
function makeYearEvents(year, springWeek, summerWeek) {
  const events = [
    {
      id: `spring-${year}`,
      name: `${year} KPL 春季赛`,
      short: '春季赛',
      type: 'lpl',
      format: 'rr+playoff',
      startWeek: springWeek,
      endWeek: springWeek + 10,
      size: 18,
      teams: KPL,
      playoffSize: 8,
      prize: splitPrize(),
      season: year
    },
    {
      id: `summer-${year}`,
      name: `${year} KPL 夏季赛`,
      short: '夏季赛',
      type: 'lpl',
      format: 'rr+playoff',
      startWeek: summerWeek,
      endWeek: summerWeek + 10,
      size: 18,
      teams: KPL,
      playoffSize: 8,
      prize: splitPrize(),
      season: year
    },
    {
      id: `kjia-spring-${year}`,
      name: `${year} K甲春季赛`,
      short: 'K甲春季赛',
      type: 'regional',
      format: 'rr+playoff',
      startWeek: springWeek,
      endWeek: springWeek + 10,
      size: 12,
      teams: K甲_TEAM_IDS,
      playoffSize: 6,
      prize: { champion: 80, runnerUp: 40, top4: 20 },
      season: year
    },
    {
      id: `kjia-summer-${year}`,
      name: `${year} K甲夏季赛`,
      short: 'K甲夏季赛',
      type: 'regional',
      format: 'rr+playoff',
      startWeek: summerWeek,
      endWeek: summerWeek + 10,
      size: 12,
      teams: K甲_TEAM_IDS,
      playoffSize: 6,
      prize: { champion: 80, runnerUp: 40, top4: 20 },
      season: year
    },
    {
      id: `finals-${year}`,
      name: `${year} KPL 年度总决赛`,
      short: '年度总决赛',
      type: 'intl',
      format: 'ko',
      startWeek: summerWeek + 11,
      endWeek: summerWeek + 12,
      size: 8,
      teams: [],
      qualifier: `year-points-${year}`,
      prize: finalsPrize(),
      season: year
    },
    {
      id: `challenger-${year}`,
      name: `${year} 挑战者杯`,
      short: '挑战者杯',
      type: 'lpl',
      format: 'ko',
      startWeek: summerWeek + 13,
      endWeek: summerWeek + 14,
      size: 16,
      teams: [],
      qualifier: `challenger-${year}`,
      prize: { champion: 300, runnerUp: 150, top4: 80 },
      season: year
    }
  ];

  // 亚运会只在举办年份加入（2026 爱知·名古屋）
  if (year === 2026) {
    events.push({
      id: 'asiad-2026',
      name: '2026 爱知·名古屋亚运会',
      short: '亚运会',
      type: 'intl',
      format: 'ko',
      startWeek: summerWeek + 16,
      endWeek: summerWeek + 16,
      size: 8,
      teams: [],
      qualifier: `summer-${year}-top4`,
      prize: { champion: 600, runnerUp: 300, top4: 150 },
      season: year
    });
  }

  return events;
}

const YEAR_EVENTS = [];
for (let i = 0; i < 15; i++) {
  const year = 2026 + i;
  YEAR_EVENTS.push(...makeYearEvents(year, 20 + i * 52, 36 + i * 52));
}

export const CALENDAR = [...EVENTS_2025, ...YEAR_EVENTS];

export const COMPETITION_BY_ID = Object.fromEntries(CALENDAR.map((c) => [c.id, c]));

/** 动态补一年的赛事：日历静态部分用完后继续往后一年年生成，赛季可以无限推进（2025 → 2026 → …） */
export function ensureYearEvents(year) {
  if (CALENDAR.some((c) => c.season === year)) return;
  const idx = year - 2026;
  const events = makeYearEvents(year, 20 + idx * 52, 36 + idx * 52);
  CALENDAR.push(...events);
  for (const e of events) COMPETITION_BY_ID[e.id] = e;
  CALENDAR.sort((a, b) => a.startWeek - b.startWeek);
}

export function competitionForWeek(week) {
  return CALENDAR.find((c) => week >= c.startWeek && week <= c.endWeek);
}

export function eventsOfSeason(season) {
  return CALENDAR.filter((c) => c.season === season);
}

export function eventDateLabel(spec) {
  const a = weekDate(spec.startWeek);
  const b = weekDate(spec.endWeek);
  return a.getTime() === b.getTime() ? formatDate(a) : `${formatDate(a)} – ${formatDate(b)}`;
}
