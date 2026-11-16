// 英雄池：133 名英雄，与王者荣耀官网 2026 年 11 月英雄列表同步。
// 数据来源：pvp.qq.com 英雄资料列表页（含元流之子 5 种形态）。
// role 按主分路归类，category 用于 BP 克制，phase 用于赛中决策的阵容判定。

export const ROLES = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];

export const ROLE_CN = { TOP: '对抗路', JUG: '打野', MID: '中路', ADC: '发育路', SUP: '游走' };

export const CATEGORY_CN = {
  fighter: '战士',
  tank: '坦克',
  assassin: '刺客',
  mage: '法师',
  marksman: '射手',
  support: '辅助'
};

export const PHASE_CN = { early: '前期', mid: '中期', late: '后期', balanced: '均衡' };

/** 克制闭环：战士 > 坦克 > 刺客 > 法师 > 射手 > 战士，另加 坦克 > 刺客、刺客 > 射手、射手 > 坦克 */
export const COUNTERS = {
  fighter: ['tank'],
  tank: ['assassin'],
  assassin: ['mage', 'marksman'],
  mage: ['marksman'],
  marksman: ['fighter', 'tank'],
  support: []
};

/** 预设联动：两名英雄同时在己方阵容时触发“联动”标签（每层 +1%，最多 2 层） */
export const SYNERGIES = [
  ['daqiao', 'gongsunli'],
  ['lubandashi', 'lubanqihao'],
  ['zhangfei', 'houyi'],
  ['guiguzi', 'buzhihuowu'],
  ['sunbin', 'diaochan'],
  ['taiyizhenren', 'sunshangxiang'],
  ['mingshiyin', 'jialuo'],
  ['yao', 'sunwukong']
];

export const HEROES = [
  // ---------- 对抗路 ----------
  { id: 'guanyu', name: '关羽', role: 'TOP', category: 'fighter', phase: 'early' },
  { id: 'huamulan', name: '花木兰', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'kai', name: '铠', role: 'TOP', category: 'fighter', phase: 'late' },
  { id: 'lvbu', name: '吕布', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'machao', name: '马超', role: 'TOP', category: 'fighter', phase: 'early' },
  { id: 'lianpo', name: '廉颇', role: 'TOP', category: 'tank', phase: 'early' },
  { id: 'baiqi', name: '白起', role: 'TOP', category: 'tank', phase: 'late' },
  { id: 'xiahoudun', name: '夏侯惇', role: 'TOP', category: 'tank', phase: 'mid' },
  { id: 'xiangyu', name: '项羽', role: 'TOP', category: 'tank', phase: 'mid' },
  { id: 'chengyaojin', name: '程咬金', role: 'TOP', category: 'tank', phase: 'late' },
  { id: 'liubang', name: '刘邦', role: 'TOP', category: 'tank', phase: 'mid' },
  { id: 'sulie', name: '苏烈', role: 'TOP', category: 'tank', phase: 'mid' },
  { id: 'zhubajie', name: '猪八戒', role: 'TOP', category: 'tank', phase: 'late' },
  { id: 'mengqi', name: '梦奇', role: 'TOP', category: 'tank', phase: 'mid' },
  { id: 'mengtian', name: '蒙恬', role: 'TOP', category: 'tank', phase: 'mid' },
  { id: 'laofuzi', name: '老夫子', role: 'TOP', category: 'fighter', phase: 'late' },
  { id: 'damo', name: '达摩', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'caocao', name: '曹操', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'yangjian', name: '杨戬', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'nezha', name: '哪吒', role: 'TOP', category: 'fighter', phase: 'early' },
  { id: 'sunce', name: '孙策', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'kuangtie', name: '狂铁', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'lixin', name: '李信', role: 'TOP', category: 'fighter', phase: 'late' },
  { id: 'yase', name: '亚瑟', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'dianwei', name: '典韦', role: 'TOP', category: 'fighter', phase: 'late' },
  { id: 'zhongwuyan', name: '钟无艳', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'gongbenwuzang', name: '宫本武藏', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'xialuote', name: '夏洛特', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'yalian', name: '亚连', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'jixiaoman', name: '姬小满', role: 'TOP', category: 'fighter', phase: 'early' },
  { id: 'zhaohuaizhen', name: '赵怀真', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'chicha', name: '蚩奼', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'cang', name: '苍', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'ying', name: '影', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'yuanliuzhizi_tank', name: '元流之子·坦克', role: 'TOP', category: 'tank', phase: 'mid' },
  { id: 'sunquan', name: '孙权', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'miyue', name: '芈月', role: 'TOP', category: 'mage', phase: 'late' },
  { id: 'yadianna', name: '雅典娜', role: 'TOP', category: 'fighter', phase: 'mid' },
  { id: 'sikongzhen', name: '司空震', role: 'TOP', category: 'fighter', phase: 'mid' },

  // ---------- 打野 ----------
  { id: 'hanxin', name: '韩信', role: 'JUG', category: 'assassin', phase: 'early' },
  { id: 'libai', name: '李白', role: 'JUG', category: 'assassin', phase: 'mid' },
  { id: 'luna', name: '露娜', role: 'JUG', category: 'assassin', phase: 'late' },
  { id: 'nakelulu', name: '娜可露露', role: 'JUG', category: 'assassin', phase: 'early' },
  { id: 'jing', name: '镜', role: 'JUG', category: 'assassin', phase: 'mid' },
  { id: 'lan', name: '澜', role: 'JUG', category: 'assassin', phase: 'early' },
  { id: 'yunying', name: '云缨', role: 'JUG', category: 'fighter', phase: 'mid' },
  { id: 'dongfangyao', name: '曜', role: 'JUG', category: 'fighter', phase: 'late' },
  { id: 'fei', name: '暃', role: 'JUG', category: 'assassin', phase: 'mid' },
  { id: 'peiqinhu', name: '裴擒虎', role: 'JUG', category: 'assassin', phase: 'early' },
  { id: 'bailixuance', name: '百里玄策', role: 'JUG', category: 'assassin', phase: 'early' },
  { id: 'ake', name: '阿轲', role: 'JUG', category: 'assassin', phase: 'early' },
  { id: 'lanlingwang', name: '兰陵王', role: 'JUG', category: 'assassin', phase: 'early' },
  { id: 'jvyoujing', name: '橘右京', role: 'JUG', category: 'assassin', phase: 'mid' },
  { id: 'sunwukong', name: '孙悟空', role: 'JUG', category: 'assassin', phase: 'late' },
  { id: 'xinmoliuer', name: '心魔六耳', role: 'JUG', category: 'assassin', phase: 'mid' },
  { id: 'yuanliuzhizi_assassin', name: '元流之子·刺客', role: 'JUG', category: 'assassin', phase: 'mid' },
  { id: 'zhaoyun', name: '赵云', role: 'JUG', category: 'fighter', phase: 'mid' },
  { id: 'liubei', name: '刘备', role: 'JUG', category: 'fighter', phase: 'mid' },
  { id: 'aguduo', name: '阿古朵', role: 'JUG', category: 'tank', phase: 'mid' },
  { id: 'dasiming', name: '大司命', role: 'JUG', category: 'fighter', phase: 'mid' },
  { id: 'yunzhongjun', name: '云中君', role: 'JUG', category: 'assassin', phase: 'mid' },

  // ---------- 中路 ----------
  { id: 'diaochan', name: '貂蝉', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'daji', name: '妲己', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'zhugeliang', name: '诸葛亮', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'buzhihuowu', name: '不知火舞', role: 'MID', category: 'assassin', phase: 'early' },
  { id: 'shangguanwaner', name: '上官婉儿', role: 'MID', category: 'mage', phase: 'early' },
  { id: 'wangzhaojun', name: '王昭君', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'yangyuhuan', name: '杨玉环', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'xishi', name: '西施', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'wuzetian', name: '武则天', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'zhenji', name: '甄姬', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'bianque', name: '扁鹊', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'gaojianli', name: '高渐离', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'yingzheng', name: '嬴政', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'mozi', name: '墨子', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'xiaoqiao', name: '小乔', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'zhouyv', name: '周瑜', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'ganjiangmoye', name: '干将莫邪', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'shenmengxi', name: '沈梦溪', role: 'MID', category: 'mage', phase: 'early' },
  { id: 'milaidi', name: '米莱狄', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'zhangliang', name: '张良', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'nvwa', name: '女娲', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'change', name: '嫦娥', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'haiyue', name: '海月', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'hainuo', name: '海诺', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'jinchan', name: '金蝉', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'jiangziya', name: '姜子牙', role: 'MID', category: 'mage', phase: 'late' },
  { id: 'yixing', name: '弈星', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'anqila', name: '安琪拉', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'simayi', name: '司马懿', role: 'MID', category: 'assassin', phase: 'mid' },
  { id: 'yuange', name: '元歌', role: 'MID', category: 'assassin', phase: 'mid' },
  { id: 'wangwei', name: '王维', role: 'MID', category: 'mage', phase: 'mid' },
  { id: 'yuanliuzhizi_magic', name: '元流之子·法师', role: 'MID', category: 'mage', phase: 'mid' },

  // ---------- 发育路 ----------
  { id: 'houyi', name: '后羿', role: 'ADC', category: 'marksman', phase: 'late' },
  { id: 'lubanqihao', name: '鲁班七号', role: 'ADC', category: 'marksman', phase: 'late' },
  { id: 'sunshangxiang', name: '孙尚香', role: 'ADC', category: 'marksman', phase: 'mid' },
  { id: 'makeboluo', name: '马可波罗', role: 'ADC', category: 'marksman', phase: 'mid' },
  { id: 'gongsunli', name: '公孙离', role: 'ADC', category: 'marksman', phase: 'early' },
  { id: 'direnjie', name: '狄仁杰', role: 'ADC', category: 'marksman', phase: 'mid' },
  { id: 'yuji', name: '虞姬', role: 'ADC', category: 'marksman', phase: 'late' },
  { id: 'huangzhong', name: '黄忠', role: 'ADC', category: 'marksman', phase: 'late' },
  { id: 'mengya', name: '蒙犽', role: 'ADC', category: 'marksman', phase: 'mid' },
  { id: 'jialuo', name: '伽罗', role: 'ADC', category: 'marksman', phase: 'late' },
  { id: 'bailishouyue', name: '百里守约', role: 'ADC', category: 'marksman', phase: 'mid' },
  { id: 'liyuanfang', name: '李元芳', role: 'ADC', category: 'marksman', phase: 'early' },
  { id: 'ailin', name: '艾琳', role: 'ADC', category: 'marksman', phase: 'late' },
  { id: 'laixiao', name: '莱西奥', role: 'ADC', category: 'marksman', phase: 'mid' },
  { id: 'geya', name: '戈娅', role: 'ADC', category: 'marksman', phase: 'mid' },
  { id: 'luyana', name: '卢雅那', role: 'ADC', category: 'marksman', phase: 'mid' },
  { id: 'aoyin', name: '敖隐', role: 'ADC', category: 'marksman', phase: 'late' },
  { id: 'yuanliuzhizi_archer', name: '元流之子·射手', role: 'ADC', category: 'marksman', phase: 'mid' },

  // ---------- 游走 ----------
  { id: 'zhangfei', name: '张飞', role: 'SUP', category: 'tank', phase: 'mid' },
  { id: 'niumo', name: '牛魔', role: 'SUP', category: 'tank', phase: 'early' },
  { id: 'guiguzi', name: '鬼谷子', role: 'SUP', category: 'support', phase: 'early' },
  { id: 'daqiao', name: '大乔', role: 'SUP', category: 'support', phase: 'late' },
  { id: 'sunbin', name: '孙膑', role: 'SUP', category: 'support', phase: 'late' },
  { id: 'caiwenji', name: '蔡文姬', role: 'SUP', category: 'support', phase: 'late' },
  { id: 'taiyizhenren', name: '太乙真人', role: 'SUP', category: 'support', phase: 'mid' },
  { id: 'lubandashi', name: '鲁班大师', role: 'SUP', category: 'tank', phase: 'mid' },
  { id: 'donghuangtaiyi', name: '东皇太一', role: 'SUP', category: 'tank', phase: 'mid' },
  { id: 'dunshan', name: '盾山', role: 'SUP', category: 'tank', phase: 'mid' },
  { id: 'zhongkui', name: '钟馗', role: 'SUP', category: 'support', phase: 'mid' },
  { id: 'zhuangzhou', name: '庄周', role: 'SUP', category: 'support', phase: 'late' },
  { id: 'mingshiyin', name: '明世隐', role: 'SUP', category: 'support', phase: 'mid' },
  { id: 'yao', name: '瑶', role: 'SUP', category: 'support', phase: 'late' },
  { id: 'liushan', name: '刘禅', role: 'SUP', category: 'tank', phase: 'mid' },
  { id: 'dayu', name: '大禹', role: 'SUP', category: 'tank', phase: 'mid' },
  { id: 'duoliya', name: '朵莉亚', role: 'SUP', category: 'support', phase: 'late' },
  { id: 'shaosiyuan', name: '少司缘', role: 'SUP', category: 'support', phase: 'mid' },
  { id: 'kongkonger', name: '空空儿', role: 'SUP', category: 'support', phase: 'mid' },
  { id: 'sangqi', name: '桑启', role: 'SUP', category: 'support', phase: 'mid' },
  { id: 'yuanliuzhizi_support', name: '元流之子·辅助', role: 'SUP', category: 'support', phase: 'mid' }
];

export const HERO_BY_ID = Object.fromEntries(
  HEROES.map((h) => [h.id, { ...h, img: `./assets/heroes/${h.id}.jpg` }])
);

// 兼容早期选手数据里的旧 ID 写法
const LEGACY = {
  nake: 'nakelulu',
  shangguan: 'shangguanwaner',
  luban: 'lubanqihao',
  make: 'makeboluo',
  gongshuli: 'gongsunli',
  yuqi: 'yuji'
};
for (const [oldId, newId] of Object.entries(LEGACY)) {
  HERO_BY_ID[oldId] = HERO_BY_ID[newId];
}

export const HEROES_BY_ROLE = Object.fromEntries(
  ROLES.map((role) => [role, HEROES.filter((h) => h.role === role)])
);

export const SYNERGY_SET = new Set(SYNERGIES.map(([a, b]) => [a, b].sort().join('|')));

export function hasSynergy(a, b) {
  return SYNERGY_SET.has([a, b].sort().join('|'));
}

export function counters(a, b) {
  return (COUNTERS[a] || []).includes(b);
}

export const CATEGORY_LIST = ['fighter', 'tank', 'assassin', 'mage', 'marksman', 'support'];
