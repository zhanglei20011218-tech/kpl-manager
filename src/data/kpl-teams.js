// KPL 18 支战队与 2025 赛季名单。
// 数据来源：百度百科《2025年王者荣耀职业联赛春季赛》「选手大名单」章节（2025-01-26 公布）。
// 位置按公开资料与选手惯用分路整理，个别替补可能跨位置。
// 数组格式：[ID, 位置, 基础能力, 年龄, 国籍, 招牌英雄（可选）]

export const KPL_TEAMS = [
  {
    id: 'ag',
    name: '成都 AG 超玩会',
    short: 'AG',
    cn: 'AG 超玩会',
    region: 'KPL',
    color: '#e4393c',
    coach: 'zwy',
    style: 'teamfight',
    roster: [
      ['轩染', 'TOP', 89, 23, 'CN', ['guanyu', 'lianpo']],
      ['钟意', 'JUG', 93, 23, 'CN', ['hanxin', 'jing']],
      ['长生', 'MID', 91, 22, 'CN', ['diaochan', 'shangguan']],
      ['一诺', 'ADC', 94, 24, 'CN', ['sunshangxiang', 'gongshuli']],
      ['大帅', 'SUP', 92, 22, 'CN', ['zhangfei', 'daqiao']],
      ['Cat', 'SUP', 86, 26, 'CN', ['guiguzi', 'sunbin']]
    ]
  },
  {
    id: 'wolves',
    name: '重庆狼队',
    short: 'Wolves',
    cn: '狼队',
    region: 'KPL',
    color: '#7b2ff7',
    coach: 'Lovecd',
    style: 'aggressive',
    roster: [
      ['归期', 'TOP', 89, 22, 'CN', ['lvbu', 'kai']],
      ['小胖', 'JUG', 90, 23, 'CN', ['hanxin', 'yunying']],
      ['无玄', 'MID', 87, 22, 'CN', ['zhugeliang', 'yangyuhuan']],
      ['紫幻', 'ADC', 88, 22, 'CN', ['houyi', 'yuqi']],
      ['一笙', 'SUP', 87, 23, 'CN', ['zhangfei', 'lubandashi']],
      ['明崽', 'ADC', 82, 21, 'CN', ['direnjie', 'huangzhong']]
    ]
  },
  {
    id: 'estar',
    name: '武汉 eStarPro',
    short: 'eStar',
    cn: 'eStarPro',
    region: 'KPL',
    color: '#1e90ff',
    coach: 'SK',
    style: 'macro',
    roster: [
      ['坦然', 'TOP', 90, 22, 'CN', ['machao', 'huamulan']],
      ['花海', 'JUG', 93, 24, 'CN', ['jing', 'lan']],
      ['清融', 'MID', 92, 23, 'CN', ['diaochan', 'buzhihuowu']],
      ['易峥', 'ADC', 88, 23, 'CN', ['gongshuli', 'make']],
      ['紫渊', 'SUP', 86, 22, 'CN', ['daqiao', 'guiguzi']],
      ['星宇', 'ADC', 84, 23, 'CN', ['sunshangxiang', 'yuqi']]
    ]
  },
  {
    id: 'drg',
    name: '佛山 DRG',
    short: 'DRG',
    cn: 'DRG',
    region: 'KPL',
    color: '#2ecc71',
    coach: '择',
    style: 'early',
    roster: [
      ['恩', 'TOP', 87, 22, 'CN', ['guanyu', 'machao']],
      ['皖皖', 'JUG', 87, 22, 'CN', ['yunying', 'yao']],
      ['花缘', 'MID', 88, 22, 'CN', ['diaochan', 'wangzhaojun']],
      ['梦岚', 'ADC', 89, 21, 'CN', ['sunshangxiang', 'make']],
      ['四宝', 'SUP', 86, 23, 'CN', ['zhangfei', 'niumo']],
      ['早点', 'ADC', 82, 20, 'CN', ['yuqi', 'direnjie']]
    ]
  },
  {
    id: 'hero',
    name: '南京 Hero 久竞',
    short: 'Hero',
    cn: 'Hero 久竞',
    region: 'KPL',
    color: '#ff6b00',
    coach: '花楼',
    style: 'draft',
    roster: [
      ['景晚', 'TOP', 86, 22, 'CN', ['baiqi', 'lianpo']],
      ['傲寒', 'JUG', 87, 22, 'CN', ['nake', 'libai']],
      ['铃铛', 'MID', 87, 23, 'CN', ['yangyuhuan', 'xishi']],
      ['星痕', 'ADC', 86, 22, 'CN', ['yuqi', 'huangzhong']],
      ['阿豆', 'SUP', 86, 24, 'CN', ['caiwenji', 'sunbin']],
      ['小义', 'JUG', 83, 21, 'CN', ['jing', 'lan']]
    ]
  },
  {
    id: 'wb',
    name: '北京 WB',
    short: 'WB',
    cn: '微博',
    region: 'KPL',
    color: '#ffb400',
    coach: '林',
    style: 'late',
    roster: [
      ['星尘', 'TOP', 87, 22, 'CN', ['huamulan', 'lvbu']],
      ['暖阳', 'JUG', 90, 24, 'CN', ['hanxin', 'luna']],
      ['乔兮', 'MID', 86, 22, 'CN', ['shangguan', 'diaochan']],
      ['枭龙', 'ADC', 87, 21, 'CN', ['gongshuli', 'houyi']],
      ['小麦', 'SUP', 85, 23, 'CN', ['guiguzi', 'daqiao']],
      ['梓墨', 'TOP', 84, 23, 'CN', ['guanyu', 'xiahoudun']]
    ]
  },
  {
    id: 'ttg',
    name: '广州 TTG',
    short: 'TTG',
    cn: 'TTG',
    region: 'KPL',
    color: '#00c2a8',
    coach: '久哲',
    style: 'balanced',
    roster: [
      ['萝卜', 'TOP', 86, 22, 'CN', ['guanyu', 'xiahoudun']],
      ['小白熊', 'JUG', 86, 22, 'CN', ['lan', 'jing']],
      ['清清', 'MID', 88, 23, 'CN', ['daji', 'wangzhaojun']],
      ['佳心', 'ADC', 86, 21, 'CN', ['make', 'sunshangxiang']],
      ['帆帆', 'SUP', 87, 24, 'CN', ['niumo', 'caiwenji']],
      ['向鱼', 'MID', 84, 23, 'CN', ['yangyuhuan', 'xishi']]
    ]
  },
  {
    id: 'jdg',
    name: '北京 JDG',
    short: 'JDG',
    cn: 'JDG',
    region: 'KPL',
    color: '#c8102e',
    coach: '时皓',
    style: 'macro',
    roster: [
      ['誓约', 'TOP', 87, 22, 'CN', ['guanyu', 'lianpo']],
      ['无畏', 'JUG', 89, 23, 'CN', ['hanxin', 'jing']],
      ['上限', 'MID', 86, 21, 'CN', ['diaochan', 'shangguan']],
      ['小玖', 'ADC', 87, 22, 'CN', ['gongshuli', 'make']],
      ['挽墨', 'SUP', 85, 22, 'CN', ['zhangfei', 'daqiao']],
      ['零栩', 'MID', 82, 20, 'CN', ['xishi', 'zhugeliang']]
    ]
  },
  {
    id: 'ksg',
    name: '苏州 KSG',
    short: 'KSG',
    cn: 'KSG',
    region: 'KPL',
    color: '#00a8e8',
    coach: '点点',
    style: 'teamfight',
    roster: [
      ['轻语', 'TOP', 86, 22, 'CN', ['lvbu', 'guanyu']],
      ['流浪', 'JUG', 86, 22, 'CN', ['nake', 'hanxin']],
      ['今屿', 'MID', 85, 22, 'CN', ['diaochan', 'xishi']],
      ['妖刀', 'ADC', 88, 23, 'CN', ['sunshangxiang', 'houyi']],
      ['啊泽', 'SUP', 85, 25, 'CN', ['niumo', 'caiwenji']],
      ['子阳', 'ADC', 83, 22, 'CN', ['yuqi', 'make']]
    ]
  },
  {
    id: 'edgm',
    name: '上海 EDG.M',
    short: 'EDG.M',
    cn: 'EDG.M',
    region: 'KPL',
    color: '#002776',
    coach: '爱思',
    style: 'late',
    roster: [
      ['凌云', 'TOP', 85, 22, 'CN', ['xiahoudun', 'lvbu']],
      ['云黎', 'JUG', 85, 21, 'CN', ['lan', 'yao']],
      ['花卷', 'MID', 86, 22, 'CN', ['shangguan', 'buzhihuowu']],
      ['初晨', 'ADC', 86, 23, 'CN', ['direnjie', 'huangzhong']],
      ['壶神', 'SUP', 84, 22, 'CN', ['guiguzi', 'taiyizhenren']],
      ['一曲', 'MID', 83, 21, 'CN', ['daji', 'yangyuhuan']]
    ]
  },
  {
    id: 'dyg',
    name: '深圳 DYG',
    short: 'DYG',
    cn: 'DYG',
    region: 'KPL',
    color: '#4a90e2',
    coach: 'Helios',
    style: 'balanced',
    roster: [
      ['栋栋', 'TOP', 84, 22, 'CN', ['baiqi', 'xiahoudun']],
      ['流星', 'JUG', 85, 22, 'CN', ['libai', 'jing']],
      ['夏凌', 'MID', 84, 21, 'CN', ['xishi', 'zhugeliang']],
      ['钎城', 'ADC', 85, 22, 'CN', ['direnjie', 'yuqi']],
      ['小轩', 'SUP', 83, 22, 'CN', ['sunbin', 'caiwenji']],
      ['小星', 'MID', 81, 20, 'CN', ['daji', 'wangzhaojun']]
    ]
  },
  {
    id: 'lgd',
    name: '杭州 LGD.NBW',
    short: 'LGD',
    cn: 'LGD',
    region: 'KPL',
    color: '#d0021b',
    coach: '大大',
    style: 'macro',
    roster: [
      ['沉夜', 'TOP', 84, 22, 'CN', ['baiqi', 'xiahoudun']],
      ['小落', 'JUG', 84, 21, 'CN', ['jing', 'libai']],
      ['九尾', 'MID', 87, 24, 'CN', ['yangyuhuan', 'wangzhaojun']],
      ['小久', 'ADC', 84, 21, 'CN', ['make', 'gongshuli']],
      ['花花', 'SUP', 83, 22, 'CN', ['daqiao', 'sunbin']],
      ['小涵', 'MID', 80, 20, 'CN', ['xishi', 'daji']]
    ]
  },
  {
    id: 'rw',
    name: '济南 RW 侠',
    short: 'RW',
    cn: 'RW 侠',
    region: 'KPL',
    color: '#f39c12',
    coach: '行天',
    style: 'aggressive',
    roster: [
      ['Fly', 'TOP', 90, 26, 'CN', ['lvbu', 'huamulan']],
      ['小A', 'JUG', 85, 22, 'CN', ['luna', 'nake']],
      ['无双', 'MID', 84, 22, 'CN', ['buzhihuowu', 'shangguan']],
      ['小晗', 'ADC', 85, 21, 'CN', ['huangzhong', 'houyi']],
      ['见月', 'SUP', 84, 23, 'CN', ['taiyizhenren', 'zhangfei']],
      ['秋源', 'ADC', 81, 20, 'CN', ['yuqi', 'direnjie']]
    ]
  },
  {
    id: 'tes',
    name: '长沙 TES.A',
    short: 'TES.A',
    cn: 'TES.A',
    region: 'KPL',
    color: '#e74c3c',
    coach: '张角',
    style: 'balanced',
    roster: [
      ['无幻', 'TOP', 84, 22, 'CN', ['lianpo', 'baiqi']],
      ['小优', 'JUG', 84, 22, 'CN', ['yunying', 'libai']],
      ['小爱', 'MID', 83, 21, 'CN', ['zhugeliang', 'daji']],
      ['蓝桉', 'ADC', 84, 21, 'CN', ['yuqi', 'make']],
      ['瓜瓜', 'SUP', 82, 22, 'CN', ['sunbin', 'zhangfei']],
      ['久酷', 'MID', 82, 23, 'CN', ['xishi', 'wangzhaojun']]
    ]
  },
  {
    id: 'rngm',
    name: '上海 RNG.M',
    short: 'RNG.M',
    cn: 'RNG.M',
    region: 'KPL',
    color: '#8e44ad',
    coach: '洪洗象',
    style: 'early',
    roster: [
      ['小伟', 'TOP', 83, 22, 'CN', ['machao', 'guanyu']],
      ['离洛', 'JUG', 83, 21, 'CN', ['hanxin', 'lan']],
      ['樱花', 'MID', 82, 20, 'CN', ['daji', 'diaochan']],
      ['极光', 'ADC', 84, 22, 'CN', ['make', 'sunshangxiang']],
      ['季节', 'SUP', 82, 22, 'CN', ['daqiao', 'caiwenji']],
      ['小七', 'MID', 79, 19, 'CN', ['xishi', 'zhugeliang']]
    ]
  },
  {
    id: 'qingjiu',
    name: '情久',
    short: '情久',
    cn: '情久',
    region: 'KPL',
    color: '#16a085',
    coach: 'Vv',
    style: 'teamfight',
    roster: [
      ['玖痕', 'TOP', 82, 21, 'CN', ['baiqi', 'xiahoudun']],
      ['陌冷', 'JUG', 82, 21, 'CN', ['libai', 'nake']],
      ['风行', 'MID', 82, 20, 'CN', ['wangzhaojun', 'yangyuhuan']],
      ['落空', 'ADC', 82, 20, 'CN', ['houyi', 'yuqi']],
      ['安七', 'SUP', 81, 21, 'CN', ['zhangfei', 'sunbin']],
      ['恒心', 'MID', 78, 19, 'CN', ['xishi', 'daji']]
    ]
  },
  {
    id: 'klg',
    name: '深圳 KLG',
    short: 'KLG',
    cn: 'KLG',
    region: 'KPL',
    color: '#9b59b6',
    coach: '雪见',
    style: 'draft',
    roster: [
      ['云顶', 'TOP', 80, 21, 'CN', ['lianpo', 'machao']],
      ['夕愈', 'JUG', 80, 21, 'CN', ['yao', 'yunying']],
      ['舒尹', 'MID', 79, 20, 'CN', ['xishi', 'zhugeliang']],
      ['莫科', 'ADC', 80, 20, 'CN', ['direnjie', 'make']],
      ['挽梦', 'SUP', 79, 21, 'CN', ['taiyizhenren', 'guiguzi']],
      ['雨天', 'ADC', 77, 19, 'CN', ['houyi', 'yuqi']]
    ]
  },
  {
    id: 'we',
    name: '西安 WE',
    short: 'WE',
    cn: 'WE',
    region: 'KPL',
    color: '#e67e22',
    coach: 'ccq',
    style: 'balanced',
    roster: [
      ['百兽', 'TOP', 84, 23, 'CN', ['guanyu', 'lvbu']],
      ['幕色', 'JUG', 83, 22, 'CN', ['jing', 'lan']],
      ['自渡', 'MID', 82, 21, 'CN', ['diaochan', 'xishi']],
      ['开心', 'ADC', 83, 21, 'CN', ['sunshangxiang', 'make']],
      ['佩恩', 'SUP', 82, 22, 'CN', ['zhangfei', 'niumo']],
      ['鹏鹏', 'ADC', 84, 23, 'CN', ['gongshuli', 'houyi']]
    ]
  }
];

export const KPL_TEAM_IDS = KPL_TEAMS.map((t) => t.id);
