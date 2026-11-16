// K甲（王者荣耀甲级职业联赛）12 支队伍与 2026 赛季阵容。
// 前 9 支为 K甲 常驻队伍，后 3 支为挑战者杯特邀：主播队、全国大赛、外卡。
// 选手 ID 以公开资料为参考，部分为补位。

export const K甲_TEAMS = [
  {
    id: 'ka-mtg',
    name: '郑州 MTG',
    short: 'MTG',
    cn: 'MTG',
    region: 'K甲',
    color: '#e63946',
    coach: '老帅',
    style: 'teamfight',
    roster: [
      ['小义', 'TOP', 82, 22, 'CN', ['guanyu', 'lvbu']],
      ['阿豆', 'JUG', 82, 22, 'CN', ['hanxin', 'jing']],
      ['久龙', 'MID', 81, 21, 'CN', ['diaochan', 'xishi']],
      ['小玖', 'ADC', 81, 21, 'CN', ['sunshangxiang', 'gongshuli']],
      ['小离', 'SUP', 80, 22, 'CN', ['zhangfei', 'daqiao']]
    ]
  },
  {
    id: 'ka-jxg',
    name: '无锡 JXG',
    short: 'JXG',
    cn: 'JXG',
    region: 'K甲',
    color: '#457b9d',
    coach: '残剑',
    style: 'macro',
    roster: [
      ['小竹', 'TOP', 81, 21, 'CN', ['lianpo', 'xiahoudun']],
      ['蓝柚', 'JUG', 81, 21, 'CN', ['libai', 'lan']],
      ['小涵', 'MID', 80, 20, 'CN', ['daji', 'zhugeliang']],
      ['小久', 'ADC', 80, 20, 'CN', ['make', 'yuqi']],
      ['小七', 'SUP', 79, 21, 'CN', ['sunbin', 'caiwenji']]
    ]
  },
  {
    id: 'ka-wz',
    name: '东莞 Wz',
    short: 'Wz',
    cn: 'Wz',
    region: 'K甲',
    color: '#2a9d8f',
    coach: '小东北',
    style: 'early',
    roster: [
      ['小阳', 'TOP', 80, 21, 'CN', ['machao', 'guanyu']],
      ['小龙', 'JUG', 80, 21, 'CN', ['nake', 'yao']],
      ['小云', 'MID', 79, 20, 'CN', ['wangzhaojun', 'yangyuhuan']],
      ['小雨', 'ADC', 79, 20, 'CN', ['houyi', 'direnjie']],
      ['小雪', 'SUP', 78, 21, 'CN', ['niumo', 'taiyizhenren']]
    ]
  },
  {
    id: 'ka-uug',
    name: '常山 UUG',
    short: 'UUG',
    cn: 'UUG',
    region: 'K甲',
    color: '#e9c46a',
    coach: '小海',
    style: 'draft',
    roster: [
      ['小川', 'TOP', 79, 21, 'CN', ['baiqi', 'lianpo']],
      ['小山', 'JUG', 79, 21, 'CN', ['yunying', 'jing']],
      ['小江', 'MID', 78, 20, 'CN', ['xishi', 'daji']],
      ['小湖', 'ADC', 78, 20, 'CN', ['gongshuli', 'make']],
      ['小河', 'SUP', 77, 21, 'CN', ['daqiao', 'sunbin']]
    ]
  },
  {
    id: 'ka-vg',
    name: '厦门 VG',
    short: 'VG',
    cn: 'VG',
    region: 'K甲',
    color: '#9b5de5',
    coach: '阿泽',
    style: 'balanced',
    roster: [
      ['小辰', 'TOP', 79, 21, 'CN', ['lvbu', 'kaisa']],
      ['小虎', 'JUG', 79, 21, 'CN', ['luna', 'nakelulu']],
      ['小星', 'MID', 78, 20, 'CN', ['diaochan', 'shangguanwaner']],
      ['小月', 'ADC', 78, 20, 'CN', ['yuqi', 'huangzhong']],
      ['小风', 'SUP', 77, 21, 'CN', ['zhangfei', 'guiguzi']]
    ]
  },
  {
    id: 'ka-rngm',
    name: '上海 RNG.M',
    short: 'RNG.M',
    cn: 'RNG.M',
    region: 'K甲',
    color: '#8e44ad',
    coach: '洪洗象',
    style: 'early',
    roster: [
      ['小伟', 'TOP', 80, 21, 'CN', ['machao', 'guanyu']],
      ['离洛', 'JUG', 80, 21, 'CN', ['hanxin', 'lan']],
      ['樱花', 'MID', 79, 20, 'CN', ['daji', 'diaochan']],
      ['极光', 'ADC', 80, 21, 'CN', ['make', 'sunshangxiang']],
      ['季节', 'SUP', 79, 21, 'CN', ['daqiao', 'caiwenji']]
    ]
  },
  {
    id: 'ka-klg',
    name: '深圳 KLG',
    short: 'KLG',
    cn: 'KLG',
    region: 'K甲',
    color: '#16a085',
    coach: '雪见',
    style: 'draft',
    roster: [
      ['云顶', 'TOP', 79, 21, 'CN', ['lianpo', 'machao']],
      ['夕愈', 'JUG', 79, 21, 'CN', ['yao', 'yunying']],
      ['舒尹', 'MID', 78, 20, 'CN', ['xishi', 'zhugeliang']],
      ['莫科', 'ADC', 78, 20, 'CN', ['direnjie', 'make']],
      ['挽梦', 'SUP', 77, 21, 'CN', ['taiyizhenren', 'guiguzi']]
    ]
  },
  {
    id: 'ka-qingjiu',
    name: '桐乡情久',
    short: '情久',
    cn: '情久',
    region: 'K甲',
    color: '#f4a261',
    coach: 'Vv',
    style: 'teamfight',
    roster: [
      ['玖痕', 'TOP', 79, 21, 'CN', ['baiqi', 'xiahoudun']],
      ['陌冷', 'JUG', 79, 21, 'CN', ['libai', 'nake']],
      ['风行', 'MID', 78, 20, 'CN', ['wangzhaojun', 'yangyuhuan']],
      ['落空', 'ADC', 78, 20, 'CN', ['houyi', 'yuqi']],
      ['安七', 'SUP', 77, 21, 'CN', ['zhangfei', 'sunbin']]
    ]
  },
  {
    id: 'ka-tcg',
    name: '无锡 TCG',
    short: 'TCG',
    cn: 'TCG',
    region: 'K甲',
    color: '#1d3557',
    coach: '时皓',
    style: 'macro',
    roster: [
      ['小满', 'TOP', 80, 20, 'CN', ['guanyu', 'lvbu']],
      ['小北', 'JUG', 80, 21, 'CN', ['jing', 'lan']],
      ['小寒', 'MID', 79, 20, 'CN', ['diaochan', 'xishi']],
      ['小暑', 'ADC', 79, 20, 'CN', ['gongshuli', 'make']],
      ['小春', 'SUP', 78, 21, 'CN', ['zhangfei', 'caiwenji']]
    ]
  },
  {
    id: 'ka-huya',
    name: '虎牙梦之队',
    short: '梦之队',
    cn: '主播队',
    region: 'K甲',
    color: '#ff6b00',
    coach: '呆阿拿',
    style: 'aggressive',
    roster: [
      ['小浪', 'TOP', 76, 22, 'CN', ['machao', 'lvbu']],
      ['阿星', 'JUG', 77, 22, 'CN', ['hanxin', 'libai']],
      ['小七', 'MID', 76, 21, 'CN', ['daji', 'anqila']],
      ['阿离', 'ADC', 77, 21, 'CN', ['gongshuli', 'sunshangxiang']],
      ['小虎牙', 'SUP', 75, 22, 'CN', ['zhangfei', 'guiguzi']]
    ]
  },
  {
    id: 'ka-nacc',
    name: '全国大赛冠军',
    short: '全国大赛',
    cn: '全国大赛',
    region: 'K甲',
    color: '#06d6a0',
    coach: '赛事教练',
    style: 'balanced',
    roster: [
      ['小校', 'TOP', 75, 20, 'CN', ['lianpo', 'baiqi']],
      ['小园', 'JUG', 75, 20, 'CN', ['yao', 'yunying']],
      ['小社', 'MID', 74, 19, 'CN', ['xishi', 'daji']],
      ['小团', 'ADC', 74, 19, 'CN', ['direnjie', 'houyi']],
      ['小赛', 'SUP', 73, 20, 'CN', ['sunbin', 'caiwenji']]
    ]
  },
  {
    id: 'ka-wildcard',
    name: '外卡联队',
    short: '外卡',
    cn: '外卡',
    region: 'K甲',
    color: '#6c757d',
    coach: '外卡教练',
    style: 'early',
    roster: [
      ['小外', 'TOP', 74, 21, 'CN', ['guanyu', 'xiahoudun']],
      ['小卡', 'JUG', 74, 21, 'CN', ['nake', 'libai']],
      ['小联', 'MID', 73, 20, 'CN', ['zhugeliang', 'daji']],
      ['小队', 'ADC', 73, 20, 'CN', ['yuqi', 'make']],
      ['小伍', 'SUP', 72, 21, 'CN', ['niumo', 'taiyizhenren']]
    ]
  }
];

export const K甲_TEAM_IDS = K甲_TEAMS.map((t) => t.id);
