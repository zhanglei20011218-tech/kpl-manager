// KPL 官方解说与战报点评。战报里的“解说席”一句话会随机引用其中一位。

export const CASTERS = [
  '瓶子',
  '李九',
  '天云',
  '小鹿',
  '英凯',
  '辰鬼',
  '白乐',
  '灵儿',
  '居居',
  '老帅',
  '阿泰',
  '梦泪',
  '月光',
  'Gemini'
];

const LINES = {
  win: [
    '{caster}：这波团开得太果断了，完全打出了这套阵容该有的样子。',
    '{caster}：节奏一旦起来就压不住了，对面连还手的机会都没有。',
    '{caster}：这就是顶级战队的执行力，说打就打，一点不拖泥带水。',
    '{caster}：资源全吃，视野全压，这局已经很难翻了。',
    '{caster}：选手的个人能力在这个时间点体现得淋漓尽致。',
    '{caster}：说实话，这个 BP 一出来我就觉得难打了，三路全是被压制。',
    '{caster}：他们的团战站位太干净了，前排顶住、后排输出，几乎没有任何失误。',
    '{caster}：你很难想象这是一支常规赛还在磨合的队伍，进步速度太吓人。'
  ],
  lose: [
    '{caster}：这一波开得有点勉强，阵型被对面切开了。',
    '{caster}：节奏断了，接下来要先把视野和兵线处理干净。',
    '{caster}：这波团输得太伤，资源和节奏一起交出去了。',
    '{caster}：还是太着急了，完全可以再等一件装备。',
    '{caster}：对面的反手打得很漂亮，这一波要认。',
    '{caster}：经济差已经拉到 5k 了，接下来只能等对面主动犯错。',
    '{caster}：他们太想赢了，反而把自己的节奏打乱了。'
  ],
  draft: [
    '{caster}：这套 BP 的思路很清楚，就是围绕中野打前期节奏。',
    '{caster}：三 Ban 全部给到对面中路，意图已经写在脸上了。',
    '{caster}：这个 pick 有点出乎意料，但仔细想想是能打的。',
    '{caster}：阵容强度是够的，就看选手能不能把优势兑现。'
  ],
  season: [
    '{caster}：一个赛季打下来，这支队伍的成长是肉眼可见的。',
    '{caster}：恭喜他们，这个成绩配得上整个赛季的付出。',
    '{caster}：接下来就是更大的舞台了，希望他们能走得更远。'
  ]
};

export function casterQuote(scene, rng = { next: Math.random }) {
  const pool = LINES[scene] || LINES.win;
  const raw = pool[Math.floor(rng.next() * pool.length)];
  const text = raw.replace(/^\{caster\}：/, '');
  const name = CASTERS[Math.floor(rng.next() * CASTERS.length)];
  return { name, text };
}

export function casterLine(scene, rng = { next: Math.random }) {
  const { name, text } = casterQuote(scene, rng);
  return `${name}：${text}`;
}

export function casterFor(rng = { next: Math.random }) {
  return CASTERS[Math.floor(rng.next() * CASTERS.length)];
}
