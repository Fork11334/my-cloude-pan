/* ============================================================
 * 长夜便利店 — 剧情 / 五夜脚本 / 顾客数据
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';

  const RULES = [
    '二十二点前锁好后门。后门只能从里面打开。',
    '门铃响，才有客人。没听见门铃的人，不要接待。',
    '先问口令，再看证件。口令每晚由电台在二十三点前播报。',
    '若客人不眨眼、不呼白气、在玻璃里没有影子，或者说出了你心里想的话——不要收钱，不要转身，去拿枪。',
    '枪在柜台下面，一个夜班只有六发。不要打人。打错了，你就不再是店员。',
    '不要邀请任何人进入柜台，也不要替任何人看管东西。',
    '四点天亮前，不要看后门的猫眼。',
    '如果电台里的苏姐开始叫你“小岳”，关掉电台。'
  ];

  const NOTES = [
    {
      id: 'note1', meta: '老陈的字迹 · 收银台下面 · 第一夜',
      text: '它们不是从外面来的。\n\n它们是从镜子里、从玻璃里、从你没有关严的后门缝里，一点一点学会的。\n\n先学声音，再学脸，最后学会等。\n\n小岳，如果你看到这张纸，说明它们已经学会你了。\n\n别相信玻璃。'
    },
    {
      id: 'note2', meta: '夹在后仓配电箱后面 · 第二夜',
      text: '苏姐不是人。\n\n她是第一个。2012 年的夜班，她也没有等到天亮。\n\n她不是坏，她只是回不去了。\n\n别让她知道你发现了。她会在电台里叫你的名字。\n\n后门外面不是巷子。你听见的风声，是隧道。'
    },
    {
      id: 'note3', meta: '后仓铁皮柜 · 第三夜',
      text: '交接记录（复印件）\n\n2012.11.03　苏晴　　交接完成\n2017.04.19　陈立　　交接完成\n2024.09.14　林小舟　交接完成\n2024.12.01　林岳　　待交接\n\n每一班都有人留下名字。\n每一班都有人没能走掉。\n\n——老陈'
    },
    {
      id: 'note4', meta: '第四夜 · 配电箱内侧',
      text: '我试过报警。\n\n他们来了，做了笔录，喝了咖啡，走的时候在门口和一个人打了招呼。\n\n那个人没有影子。\n\n这里没有“外面”。你打开门，只是让它进来。'
    },
    {
      id: 'note5', meta: '第五夜 · 更衣室镜子背面',
      text: '如果你看到这里，说明店里只剩你一个了。\n\n别开枪打玻璃。子弹会停在里面。\n\n想走的话，后门在仓库最里面。\n\n想留下来的话，把灯关掉，坐到柜台后面，等门铃响。\n\n它会记得你的名字。'
    }
  ];

  const ENDINGS = {
    replace: {
      id: 'replace', kicker: 'ENDING 01 · 换班', title: '下一个夜班',
      text: '你打开了后门。\n\n门外没有巷子，也没有雨。只有一条向下延伸的走廊，灯管一盏一盏亮起来，像在欢迎你。\n\n苏姐站在走廊尽头。她穿着和你一样的工装，胸前的工牌上写着你的名字。\n\n“交接吧。”她说。\n\n你把柜台钥匙交给她。她把手放在你的肩上，很轻，像一封没有寄出的信。\n\n后来，长夜路 24H 便利店又招了一个夜班店员。\n\n面试那天，收音机里有一个很温柔的声音，在教他背夜班守则。\n\n“……如果电台里的苏姐开始叫你小岳，关掉电台。”\n\n他问：“苏姐是谁？”\n\n没有人回答。'
    },
    burn: {
      id: 'burn', kicker: 'ENDING 02 · 长夜尽头', title: '把灯关掉',
      text: '你把仓库里那桶用来擦地的酒精泼在纸箱、货架和收银台下。\n\n打火机是你自己的。三块钱，在柜台下面放了一个月。\n\n火光起来的时候，你听见货架深处传来很多人的声音。有老陈的，有小舟的，还有你自己的。\n\n它们没有惨叫。它们只是很轻地说：\n\n“谢谢。”\n\n你坐在柜台后面，看着天光从玻璃外面一点一点透进来。\n\n第一次，你看见了自己的影子。\n\n消防车到的时候，便利店已经烧成了一个空壳。\n\n人们在废墟里找到两具尸体。一具是男性，另一具无法辨认。\n\n没有人知道，其中一个，在最后一刻终于等到了天亮。'
    },
    shoot: {
      id: 'shoot', kicker: 'ENDING 03 · 天亮以后', title: '最后一发',
      text: '你举起枪，隔着玻璃对准她。\n\n玻璃裂开一道很细的白线。子弹停在玻璃里面，像一颗被按了暂停的星。\n\n苏姐笑了。她把手掌贴在裂缝上。\n\n“还是这么不听话。”\n\n然后她转身走进雨里。路灯一盏一盏地灭下去，像有人从街的另一头开始关灯。\n\n你等到 04:00。\n\n天没有亮。但门铃响了。\n\n你走出柜台，推开门。外面是一条你很熟悉的街，积水里映着便利店的招牌。\n\n你走了很久，才想起来——\n\n这条街，你已经走了十二年了。\n\n你回到店里。柜台后面，站着一个和你一模一样的人，正在系围裙。\n\n他抬头看你，说：\n\n“你终于下班了。”'
    }
  };

  const NIGHTS_META = [
    { id: 1, title: '试用期', sub: '雨夜 · 第一位客人' },
    { id: 2, title: '重复', sub: '没有听见门铃的人' },
    { id: 3, title: '名单', sub: '失踪九十七天' },
    { id: 4, title: '停电', sub: '后门外面不是巷子' },
    { id: 5, title: '最后一班', sub: '04:00 之前' }
  ];

  /* ============================================================
   * 顾客数据
   * ============================================================ */
  const C = {};

  C.n1_zhao = {
    id: 'n1_zhao', name: '赵国强', sex: '男', age: 52, kind: 'human',
    look: {
      height: 1.70, build: 'heavy', coat: '#2b3035', pants: '#1a1c1f',
      hat: 'beanie', hairColor: '#2a231c', scarf: '#3b2a22', glasses: false,
      wet: true, face: 'human'
    },
    portrait: { kind: 'human', flip: true, bg: '#8c9aa0', tint: 'rgba(180,160,120,.16)' },
    id: {
      name: '赵国强', sex: '男', dob: '1972 年 05 月 18 日',
      addr: '长夜路 34 号 2 单元 401', no: '3101 1972 0518 2437',
      valid: '有效期限 2016.03 — 2036.03', stamp: '已核验'
    },
    items: [{ name: '热美式', price: 8 }, { name: '红双喜', price: 24 }],
    dialogue: {
      greet: '……夜班啊。外面雨大，伞都没用。',
      request: '一杯热的，最便宜的。再来包烟，红双喜。',
      remind: '我不着急。你慢慢来。',
      codeOk: '雨停了。……怎么了？我进来的时候雨就小了。',
      codeBad: '',
      scan: '就这些。烟别拿错了，我抽了三十年。',
      pay: '不用找了。当小费。',
      leave: '你一个人值夜，小心点。这条街最近不太平。',
      idOk: '看吧。我这岁数还能是假的？',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.1, text: '他呼出的白气在冷空气里散开。', danger: false },
        { delay: 2.6, text: '他眨眼了。眼睛很红，像很久没睡。', danger: false },
        { delay: 4.4, text: '他一直在看窗外自己的车。', danger: false },
        { delay: 6.4, text: '玻璃里有他的影子，和柜台前的他一样疲惫。', danger: false }
      ],
      id: ['证件是真的。照片比现在年轻一些。'],
      code: ['他的口令是对的。'],
      scan: []
    },
    tags: ['出租车司机', '熟客']
  };

  C.n1_zhou = {
    id: 'n1_zhou', name: '周野', sex: '男', age: 26, kind: 'human',
    look: {
      height: 1.78, build: 'slim', coat: '#1f2a2e', pants: '#202226',
      hat: 'cap', hairColor: '#141210', scarf: null, glasses: false,
      wet: true, face: 'humanB', badge: true
    },
    portrait: { kind: 'humanB', flip: false, bg: '#7f8d91', tint: 'rgba(120,140,150,.18)' },
    id: {
      name: '周野', sex: '男', dob: '1998 年 02 月 11 日',
      addr: '长夜路南段 7 号 3 楼', no: '3101 1998 0211 0815',
      valid: '有效期限 2019.07 — 2039.07', stamp: '已核验'
    },
    items: [{ name: '泡面（红烧牛肉）', price: 6.5 }, { name: '火腿肠', price: 3 }],
    dialogue: {
      greet: '能借个热水吗？外面冷得手都僵了。',
      request: '泡面，火腿肠。今晚最后一单，送完就回去。',
      remind: '我等你。我不赶时间。',
      codeOk: '雨停了。一个跑夜单的都知道。',
      codeBad: '',
      scan: '对，就这两样。',
      pay: '谢谢。你这儿还招人吗？我白天也能来。',
      leave: '对了——上一个夜班的呢？老陈？我上个月还见过他。',
      idOk: '给。喏，没成年都跑不了夜路。',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.2, text: '他呼出的白气很重，肩膀在发抖。', danger: false },
        { delay: 2.8, text: '他手背上有一道旧疤，像被什么咬过。', danger: false },
        { delay: 4.6, text: '他一直在看后仓那扇门。', danger: false },
        { delay: 6.2, text: '玻璃里有他的影子。他在搓手。', danger: false }
      ],
      id: ['证件正常。照片上他比现在胖一点。'],
      code: ['口令正确，没有犹豫。'],
      scan: []
    },
    tags: ['外卖骑手', '新客']
  };

  C.n1_fake1 = {
    id: 'n1_fake1', name: '撑伞的男人', sex: '男', age: 30, kind: 'fake',
    look: {
      height: 1.88, build: 'slim', coat: '#171b1e', pants: '#0e1012',
      hat: 'beanie', hairColor: '#0d0b0a', scarf: null, glasses: false,
      pale: true, wet: true, extraFinger: true, tint: 0xd8d2c8, headScale: 1.02
    },
    portrait: { kind: 'fake', flip: false, bg: '#5a6266', tint: 'rgba(60,70,80,.3)' },
    id: null,
    items: [],
    dialogue: {
      greet: '……外面冷。',
      request: '我不买东西。我能进来吗？柜台里面，暖和一点。',
      remind: '你为什么不说话？',
      codeBad: '口令？……雨还在下。',
      codeOk: '',
      scan: '我没有东西。我只是想进来。',
      pay: '别收钱。让我进去。',
      leave: '你确定？外面……很冷。',
      idBad: '我没有那种东西。',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '他没有眨眼。一次也没有。', danger: true },
        { delay: 2.3, text: '冷空气里，他没有呼出白气。', danger: true },
        { delay: 4.0, text: '玻璃里没有他的影子。', danger: true },
        { delay: 5.6, text: '他的右手有六根手指。', danger: true },
        { delay: 7.0, text: '他的湿头发在滴水，地上却是干的。', danger: true }
      ],
      id: ['他没有证件。'],
      code: ['他的口令是错的。他知道自己错了。'],
      scan: []
    },
    tags: ['没有买东西', '一直站在门口']
  };

  /* ---------------- Night 2 ---------------- */
  C.n2_zhao = {
    id: 'n2_zhao', name: '赵国强', sex: '男', age: 52, kind: 'human',
    look: {
      height: 1.70, build: 'heavy', coat: '#2b3035', pants: '#1a1c1f',
      hat: 'beanie', hairColor: '#2a231c', scarf: '#3b2a22', wet: true, face: 'human'
    },
    portrait: { kind: 'human', flip: true, bg: '#8c9aa0', tint: 'rgba(180,160,120,.16)' },
    id: {
      name: '赵国强', sex: '男', dob: '1972 年 05 月 18 日',
      addr: '长夜路 34 号 2 单元 401', no: '3101 1972 0518 2437',
      valid: '有效期限 2016.03 — 2036.03', stamp: '已核验'
    },
    items: [{ name: '热美式', price: 8 }],
    dialogue: {
      greet: '又是你。昨天那杯咖啡救了我半条命。',
      request: '老样子，热的。今天不买烟了。',
      remind: '你先忙。',
      codeOk: '天快亮了。你们换口令换得真勤。',
      codeBad: '',
      scan: '就一杯。',
      pay: '放这儿吧。',
      leave: '门口那张寻人启事……是你贴的？我昨晚看见有个女的站在那儿，看了很久。',
      idOk: '还查啊？行行行。',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.2, text: '他呼出的白气很重。', danger: false },
        { delay: 3.0, text: '他今晚没刮胡子，手上有油污。', danger: false },
        { delay: 5.0, text: '玻璃里有他的影子，正低头数零钱。', danger: false }
      ],
      id: ['证件正常，熟悉的那个名字。'],
      code: ['口令正确。'],
      scan: []
    },
    tags: ['出租车司机', '熟客']
  };

  C.n2_lin = {
    id: 'n2_lin', name: '林婉', sex: '女', age: 21, kind: 'human',
    look: {
      height: 1.63, build: 'slim', coat: '#3a3038', pants: '#1e1b20',
      hat: null, hairColor: '#17110f', scarf: '#5a3a3a', glasses: true, longHair: true,
      pale: true, wet: true, face: 'humanB', headScale: 0.96, tint: 0xe8dcd2
    },
    portrait: { kind: 'humanB', flip: true, bg: '#8a8c80', tint: 'rgba(200,170,150,.24)' },
    id: {
      name: '林婉', sex: '女', dob: '2003 年 10 月 02 日',
      addr: '长夜路 88 号 学生公寓 B 座', no: '3101 2003 1002 0642',
      valid: '有效期限 2021.09 — 2031.09', stamp: '已核验'
    },
    items: [{ name: '关东煮（三串）', price: 10 }, { name: '原味酸奶', price: 4 }],
    dialogue: {
      greet: '……还有热的吗？',
      request: '关东煮，三串。再来一个酸奶。',
      remind: '我赶时间，末班车快没了。',
      codeOk: '天快亮了。……现在才十一点吧。',
      codeBad: '',
      scan: '嗯，就这些。',
      pay: '扫码可以吗？',
      leave: '谢谢。刚才……有人在窗外叫我的名字。我以为是你。',
      idOk: '给。我成年了，真的。',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '她呼出的白气很轻，眼睛是肿的。', danger: false },
        { delay: 2.6, text: '她的指甲缝里有干掉的水泥灰。', danger: false },
        { delay: 4.6, text: '玻璃里有她的影子，正把围巾往上拉。', danger: false },
        { delay: 6.0, text: '她一直在看门口，像在等谁进来。', danger: false }
      ],
      id: ['证件正常。照片上的她笑得很用力。'],
      code: ['口令正确。'],
      scan: []
    },
    tags: ['学生', '末班车']
  };

  C.n2_repeat = {
    id: 'n2_repeat', name: '雨衣男人', sex: '男', age: 35, kind: 'fake',
    look: {
      height: 1.84, build: 'normal', coat: '#242a24', pants: '#151714',
      hat: 'beanie', hairColor: '#0b0a09', scarf: null, glasses: false,
      pale: true, wet: true, extraFinger: true, tint: 0xd2cec2, face: 'human', headScale: 1.01
    },
    portrait: { kind: 'fake', flip: true, bg: '#606864', tint: 'rgba(60,70,60,.28)' },
    id: {
      name: '赵国强', sex: '男', dob: '1972 年 05 月 18 日',
      addr: '长夜路 34 号 2 单元 401', no: '3101 1972 0518 2437',
      valid: '有效期限 2016.03 — 2036.03', stamp: '已核验'
    },
    items: [],
    dialogue: {
      greet: '……夜班啊。外面雨大。',
      request: '一杯热的，最便宜的。',
      remind: '一杯热的，最便宜的。',
      codeBad: '口令？……口令？',
      codeOk: '',
      scan: '就这些。就这些。',
      pay: '不用找了。当小费。',
      leave: '你一个人值夜，小心点。',
      idBad: '你看吧。我这岁数还能是假的？',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '他重复了你刚才的话，只晚了半秒。', danger: true },
        { delay: 2.4, text: '他没有眨眼。', danger: true },
        { delay: 4.0, text: '他没有呼出白气。', danger: true },
        { delay: 5.6, text: '玻璃里没有他的影子。', danger: true },
        { delay: 7.0, text: '他的雨衣在滴水，地上却没有水痕。', danger: true },
        { delay: 8.6, text: '他的右手有六根手指。', danger: true }
      ],
      id: ['证件上的名字是刚才那位出租车司机的。照片上的人在笑——嘴角太宽了。'],
      code: ['他答不上来。他只是在重复问题。'],
      scan: []
    },
    tags: ['雨衣', '声音很熟']
  };

  C.n2_silent = {
    id: 'n2_silent', name: '长发的女人', sex: '女', age: 29, kind: 'fake',
    look: {
      height: 1.67, build: 'slim', coat: '#1a1d21', pants: '#0e1012',
      hat: null, hairColor: '#0a0807', scarf: null, glasses: false, longHair: true,
      pale: true, wet: true, extraFinger: true, tint: 0xe2ddd4, face: 'humanB', headScale: 0.95
    },
    portrait: { kind: 'fake', flip: true, bg: '#4e5558', tint: 'rgba(90,100,110,.32)' },
    id: null,
    items: [],
    dialogue: {
      greet: '……',
      request: '不用了。我等他。',
      remind: '你忙你的。',
      codeBad: '',
      codeOk: '天快亮了。',
      scan: '……',
      pay: '我不买东西。我等他。',
      leave: '外面雨大。我不走。',
      idBad: '没有。',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '没有听见门铃。她是自己出现在柜台前的。', danger: true },
        { delay: 2.5, text: '她没有眨眼。头发上的水一直滴。', danger: true },
        { delay: 4.2, text: '她没有呼出白气。', danger: true },
        { delay: 5.8, text: '玻璃里没有她的影子。', danger: true },
        { delay: 7.2, text: '她的口令是对的。她知道今晚的口令。', danger: true }
      ],
      id: ['她没有证件。'],
      code: ['她的口令完全正确。也许是在门外面听见的。'],
      scan: []
    },
    tags: ['没有门铃', '一直看着后仓']
  };

  C.n2_ma = {
    id: 'n2_ma', name: '马德胜', sex: '男', age: 56, kind: 'human',
    look: {
      height: 1.74, build: 'heavy', coat: '#3a342c', pants: '#25221c',
      hat: null, hairColor: '#5a5048', scarf: null, glasses: false,
      wet: true, face: 'humanB', tint: 0xd8c8b8
    },
    portrait: { kind: 'humanB', flip: false, bg: '#8a8470', tint: 'rgba(170,150,110,.22)' },
    id: {
      name: '马德胜', sex: '男', dob: '1968 年 12 月 30 日',
      addr: '长夜路北段 12 号平房', no: '3101 1968 1230 1194',
      valid: '有效期限 2013.01 — 2033.01', stamp: '已核验'
    },
    items: [{ name: '啤酒（易拉罐）', price: 6 }, { name: '花生米', price: 4 }],
    dialogue: {
      greet: '呃……还开着啊。好，好。',
      request: '两罐啤酒，一包花生。别问我为什么这么晚。',
      remind: '我……我坐会儿就走。',
      codeOk: '天快亮了。唉，这口令，听着像句吉利话。',
      codeBad: '',
      scan: '对，对。',
      pay: '钱给你。多出来的……算我请你。',
      leave: '老陈以前也在这儿值夜。后来有一天，他走进后仓，就没出来。你别学他。',
      idOk: '给。我又不是什么坏人。',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.2, text: '他呼出的白气带着酒味。', danger: false },
        { delay: 2.8, text: '他的手在抖，但影子很正常。', danger: false },
        { delay: 4.8, text: '玻璃里有他的影子，趴在柜台上打瞌睡。', danger: false }
      ],
      id: ['证件正常，地址是北段的平房。'],
      code: ['口令正确，虽然说得含含糊糊。'],
      scan: []
    },
    tags: ['醉酒', '老陈的朋友']
  };

  /* ---------------- Night 3 ---------------- */
  C.n3_wang = {
    id: 'n3_wang', name: '王锐', sex: '男', age: 38, kind: 'human',
    look: {
      height: 1.80, build: 'normal', coat: '#1c232d', pants: '#14181c',
      hat: null, hairColor: '#171310', scarf: null, glasses: false,
      wet: false, face: 'human', badge: true, tint: 0xd8c6b4
    },
    portrait: { kind: 'human', flip: false, bg: '#7a8590', tint: 'rgba(150,160,180,.2)' },
    id: {
      name: '王锐', sex: '男', dob: '1986 年 07 月 24 日',
      addr: '长夜区公安分局宿舍 2 栋', no: '3101 1986 0724 0017',
      valid: '有效期限 2015.06 — 2045.06', stamp: '已核验'
    },
    items: [{ name: '矿泉水', price: 2 }, { name: '热美式', price: 8 }],
    dialogue: {
      greet: '别紧张。巡夜，顺便买点东西。',
      request: '一瓶水，一杯咖啡。谢了。',
      remind: '我看看就走。',
      codeOk: '别开门。……嗯，这口令不太吉利。',
      codeBad: '',
      scan: '就这些。',
      pay: '开张发票？算了。',
      leave: '最近三个月，这一带报了十一起失踪。全都在凌晨，全都在长夜路。\n上一个夜班店员，叫陈立。你认识吗？',
      idOk: '警号在这儿。放心。',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.2, text: '他呼出的白气很均匀，肩膀上有雨水。', danger: false },
        { delay: 2.8, text: '腰间的对讲机偶尔响一声，是真正的人声。', danger: false },
        { delay: 4.8, text: '玻璃里有他的影子，警帽拿在手上。', danger: false },
        { delay: 6.6, text: '他一直在看门口那张寻人启事。', danger: false }
      ],
      id: ['证件是真的。警号与照片吻合。'],
      code: ['口令正确。'],
      scan: []
    },
    tags: ['巡警', '寻人启事']
  };

  C.n3_sister = {
    id: 'n3_sister', name: '林小舟', sex: '女', age: 24, kind: 'fake',
    look: {
      height: 1.64, build: 'slim', coat: '#2a2f3a', pants: '#1a1c20',
      hat: null, hairColor: '#120d0a', scarf: null, glasses: false, longHair: true,
      pale: true, wet: true, extraFinger: true, tint: 0xf0e8e0, face: 'humanB', headScale: 0.94
    },
    portrait: { kind: 'humanB', flip: true, bg: '#5d6a72', tint: 'rgba(150,170,190,.3)' },
    id: null,
    items: [],
    dialogue: {
      greet: '哥。',
      request: '我不买东西。你把门开一下，我有点冷。',
      remind: '哥，你还在生我的气吗？',
      codeBad: '',
      codeOk: '别开门。……你每天都要问一遍吗？',
      scan: '……',
      pay: '我不要钱。我只想进来。',
      leave: '你又要让我一个人回去吗？',
      idBad: '我不用带那种东西。你认出我了，对吧？',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 0.9, text: '她记得你小时候的事，但顺序不对。', danger: true },
        { delay: 2.4, text: '她的头发在滴水，地上却是干的。', danger: true },
        { delay: 4.0, text: '她没有呼出白气。外面明明这么冷。', danger: true },
        { delay: 5.6, text: '玻璃里没有她的影子。', danger: true },
        { delay: 7.2, text: '她的脸，像是从照片里被小心剪下来，再贴上去的。', danger: true },
        { delay: 8.8, text: '她的右手有六根手指。她一直把手藏在袖子里。', danger: true }
      ],
      id: ['她没有证件。她不需要。'],
      code: ['她的口令完全正确。她甚至知道你会先问这个。'],
      scan: []
    },
    tags: ['林小舟', '失踪九十七天']
  };

  C.n3_chen = {
    id: 'n3_chen', name: '陈小北', sex: '男', age: 23, kind: 'human',
    look: {
      height: 1.75, build: 'slim', coat: '#26333a', pants: '#1c2024',
      hat: 'cap', hairColor: '#1a1512', scarf: null, glasses: false, wet: true,
      face: 'humanB', badge: true, tint: 0xd8c4b0
    },
    portrait: { kind: 'humanB', flip: false, bg: '#7d8a86', tint: 'rgba(130,160,150,.18)' },
    id: {
      name: '陈小北', sex: '男', dob: '2001 年 04 月 09 日',
      addr: '长夜路南段 21 号 4 楼', no: '3101 2001 0409 0533',
      valid: '有效期限 2020.08 — 2030.08', stamp: '已核验'
    },
    items: [{ name: '能量饮料', price: 9 }, { name: '烤肠', price: 4 }],
    dialogue: {
      greet: '哥，还开着呢！太好了。',
      request: '能量饮料，再来根烤肠。今晚单子疯了。',
      remind: '不急不急，你先忙。',
      codeOk: '别开门。哈哈，这口令谁想的，怪吓人的。',
      codeBad: '',
      scan: '对！',
      pay: '扫了啊。哥你脸色不太好。',
      leave: '对了，刚才外面有个人，站在雨里一动不动。长得……还挺像你的。',
      idOk: '给，随便看。',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '他呼出的白气很急，手机一直在响。', danger: false },
        { delay: 2.6, text: '他的鞋底沾着泥，手里攥着车钥匙。', danger: false },
        { delay: 4.4, text: '玻璃里有他的影子，正在看手机。', danger: false }
      ],
      id: ['证件正常，照片有点糊。'],
      code: ['口令正确，还笑了一下。'],
      scan: []
    },
    tags: ['外卖骑手', '见过街对面的人']
  };

  C.n3_double = {
    id: 'n3_double', name: '林岳', sex: '男', age: 27, kind: 'fake',
    look: {
      height: 1.76, build: 'normal', coat: '#3a3f44', pants: '#22262a',
      hat: null, hairColor: '#161311', scarf: null, glasses: false,
      pale: true, wet: true, extraFinger: true, tint: 0xe4ded6, face: 'human', headScale: 1.0
    },
    portrait: { kind: 'human', flip: false, bg: '#5d6466', tint: 'rgba(140,150,150,.26)' },
    id: {
      name: '林岳', sex: '男', dob: '1997 年 08 月 16 日',
      addr: '长夜路 24 号 便利店后仓', no: '3101 1997 0816 2107',
      valid: '有效期限 2020.01 — 2040.01', stamp: '已核验'
    },
    items: [],
    dialogue: {
      greet: '回来啦。',
      request: '我来换班。你可以下班了。',
      remind: '你已经值了很久了。',
      codeBad: '',
      codeOk: '别开门。……我们都背得很熟。',
      scan: '不用扫。',
      pay: '钱不用给。我是来接班的。',
      leave: '别走。外面没有天亮。',
      idBad: '你看清楚。这是我的名字。',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '他穿着和你一样的工装。', danger: true },
        { delay: 2.4, text: '他没有眨眼。', danger: true },
        { delay: 3.9, text: '他学的不是你的声音，是你的停顿。', danger: true },
        { delay: 5.5, text: '玻璃里没有他的影子。', danger: true },
        { delay: 7.0, text: '他的工牌上，名字是反的。', danger: true },
        { delay: 8.6, text: '他知道你今天想请几天假。', danger: true }
      ],
      id: ['证件上的一切都和你一样。连照片上的痣也一样。'],
      code: ['口令正确。他连语气都学会了。'],
      scan: []
    },
    tags: ['和你一模一样', '来接班的']
  };

  /* ---------------- Night 4 ---------------- */
  C.n4_zhao = {
    id: 'n4_zhao', name: '赵国强', sex: '男', age: 52, kind: 'human',
    look: {
      height: 1.70, build: 'heavy', coat: '#2b3035', pants: '#1a1c1f',
      hat: 'beanie', hairColor: '#2a231c', scarf: '#3b2a22', wet: true, face: 'human'
    },
    portrait: { kind: 'human', flip: true, bg: '#8c9aa0', tint: 'rgba(180,160,120,.16)' },
    id: {
      name: '赵国强', sex: '男', dob: '1972 年 05 月 18 日',
      addr: '长夜路 34 号 2 单元 401', no: '3101 1972 0518 2437',
      valid: '有效期限 2016.03 — 2036.03', stamp: '已核验'
    },
    items: [{ name: '热美式', price: 8 }, { name: '手电筒电池', price: 6 }],
    dialogue: {
      greet: '怎么停电了？整条街都黑了。',
      request: '一杯热的。再来两节电池，我车灯快没电了。',
      remind: '你别摸黑找，我不急。',
      codeOk: '长夜。……你那收音机不是这么说的。',
      codeBad: '',
      scan: '就这些。你手电筒借我照照？算了。',
      pay: '拿着。灯亮之前别乱走。',
      leave: '刚才灯灭的时候，我看见门外站着一个人。我按喇叭，他没躲。',
      idOk: '给。',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '他呼出的白气在手电光里散开。', danger: false },
        { delay: 2.4, text: '他眨眼了。手电筒的光在抖。', danger: false },
        { delay: 4.2, text: '玻璃里有他的影子，贴在窗边往外看。', danger: false }
      ],
      id: ['证件正常。'],
      code: ['他的口令是“长夜”，和电台第一次说的一样。'],
      scan: []
    },
    tags: ['出租车司机', '停电']
  };

  C.n4_tall = {
    id: 'n4_tall', name: '场外的人', sex: '男', age: 40, kind: 'fake',
    look: {
      height: 1.96, build: 'slim', coat: '#141719', pants: '#0b0d0e',
      hat: 'none', hairColor: '#0a0908', scarf: null, glasses: false,
      pale: true, wet: true, extraFinger: true, tint: 0xd6d0c6, headScale: 1.04
    },
    portrait: { kind: 'fake', flip: false, bg: '#4c5458', tint: 'rgba(60,70,80,.32)' },
    id: {
      name: '陈立', sex: '男', dob: '1899 年 11 月 30 日',
      addr: '长夜路 24 号（该地址不存在）', no: '0000 0000 0000 0000',
      valid: '有效期限 2012.11 — 2012.11', stamp: '已核验'
    },
    items: [],
    dialogue: {
      greet: '灯灭了。你还在啊。',
      request: '配电箱在哪儿？我帮你看看。',
      remind: '后仓。我知道在后仓。',
      codeBad: '天亮。……第二次说的那个。',
      codeOk: '',
      scan: '不用。',
      pay: '我进去看看。',
      leave: '你把门锁好。外面的人越来越多了。',
      idBad: '这是我的证件。你看，签发机关都在这儿。',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '没有听见门铃。灯灭之后，他就站在那儿了。', danger: true },
        { delay: 2.4, text: '他没有眨眼。黑暗里，他的眼白亮得很不自然。', danger: true },
        { delay: 4.0, text: '他没有呼出白气，尽管店里冷得能看见呼吸。', danger: true },
        { delay: 5.5, text: '手电照过去，他的影子落在地上——是反的。', danger: true },
        { delay: 7.2, text: '他的工牌上写着“陈立”。那是老陈的名字。', danger: true }
      ],
      id: ['出生年份是 1899。有效期只有一天。地址就是这家便利店。'],
      code: ['他说的是电台第二次播报的口令。那个口令不该存在。'],
      scan: []
    },
    tags: ['停电后出现', '问配电箱']
  };

  C.n4_nurse = {
    id: 'n4_nurse', name: '林静', sex: '女', age: 31, kind: 'human',
    look: {
      height: 1.66, build: 'normal', coat: '#2e3338', pants: '#1e2226',
      hat: null, hairColor: '#1a1412', scarf: '#4a4248', glasses: false, longHair: true,
      pale: true, wet: true, face: 'humanB', headScale: 0.96, tint: 0xe6dcd2
    },
    portrait: { kind: 'humanB', flip: true, bg: '#7f8a8a', tint: 'rgba(170,180,170,.2)' },
    id: {
      name: '林静', sex: '女', dob: '1993 年 03 月 17 日',
      addr: '长夜区人民医院宿舍 3 栋', no: '3101 1993 0317 0882',
      valid: '有效期限 2022.04 — 2042.04', stamp: '已核验'
    },
    items: [{ name: '牛奶', price: 5 }, { name: '创可贴', price: 3 }],
    dialogue: {
      greet: '灯怎么全灭了？我在外面敲了半天门。',
      request: '牛奶，还有创可贴。夜班医务室只剩这些了。',
      remind: '你脸色很差。要不要坐下？',
      codeOk: '长夜。……你们的广播像在念悼词。',
      codeBad: '',
      scan: '对，就这些。',
      pay: '谢谢。你一个人守着这儿，不容易。',
      leave: '今晚送来三个没有身份的……算了，不该跟你说这些。',
      idOk: '给你。',
      idBad: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '她呼出的白气很浅，袖口有消毒水味。', danger: false },
        { delay: 2.6, text: '她眨眼了。黑眼圈很重。', danger: false },
        { delay: 4.4, text: '玻璃里有她的影子，正在数创可贴。', danger: false }
      ],
      id: ['证件正常。'],
      code: ['口令是“长夜”，正确。'],
      scan: []
    },
    tags: ['护士', '停电']
  };

  C.n4_chen = {
    id: 'n4_chen', name: '老陈', sex: '男', age: 48, kind: 'fake',
    look: {
      height: 1.73, build: 'normal', coat: '#2f3330', pants: '#1b1d1a',
      hat: 'cap', hairColor: '#4a423a', scarf: null, glasses: false,
      pale: true, wet: true, extraFinger: true, tint: 0xcfc8ba, face: 'human', badge: true
    },
    portrait: { kind: 'fake', flip: true, bg: '#5d635c', tint: 'rgba(80,80,70,.3)' },
    id: {
      name: '陈立', sex: '男', dob: '1976 年 06 月 12 日',
      addr: '长夜路 24 号 便利店后仓', no: '3101 1976 0612 1508',
      valid: '有效期限 2012.10 — 2032.10', stamp: '已核验'
    },
    items: [],
    dialogue: {
      greet: '小岳。我回来接班。',
      request: '你把钥匙给我，就走吧。你已经很累了。',
      remind: '我在这儿等了十二年了。',
      codeBad: '口令？我们那时候不用口令。',
      codeOk: '',
      scan: '不用扫。我不是客人。',
      pay: '我不要钱。',
      leave: '后门外面不是巷子。你听见的风声，是隧道。',
      idBad: '我的证件一直在这儿。你自己看。',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '他穿着老款的工装，胸牌上是“陈立”。', danger: true },
        { delay: 2.4, text: '他没有眨眼。', danger: true },
        { delay: 4.0, text: '他没有呼出白气。', danger: true },
        { delay: 5.5, text: '玻璃里没有他的影子。', danger: true },
        { delay: 7.0, text: '他的右手有六根手指。', danger: true },
        { delay: 8.6, text: '他说话的方式，和墙上那张便签一模一样。', danger: true }
      ],
      id: ['证件是真的。可照片上的人已经死了三年。'],
      code: ['他答不上来。他说那个年代不需要口令。'],
      scan: []
    },
    tags: ['前夜班店员', '来接班']
  };

  C.n4_watcher = {
    id: 'n4_watcher', name: '货架后面的人', sex: '男', age: 30, kind: 'fake',
    look: {
      height: 1.86, build: 'slim', coat: '#101214', pants: '#08090a',
      hat: null, hairColor: '#080706', scarf: null, glasses: false,
      pale: true, wet: false, extraFinger: true, tint: 0xcac4ba, headScale: 1.02
    },
    portrait: { kind: 'fake', flip: false, bg: '#464c50', tint: 'rgba(40,44,48,.4)' },
    id: null,
    items: [],
    dialogue: {
      greet: '……',
      request: '……',
      remind: '……',
      codeBad: '……',
      codeOk: '',
      scan: '……',
      pay: '……',
      leave: '……',
      idBad: '……',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 0.8, text: '监控里，他一直站在货架后面。', danger: true },
        { delay: 2.2, text: '他没有眨眼。', danger: true },
        { delay: 3.8, text: '他没有呼出白气。', danger: true },
        { delay: 5.2, text: '玻璃里没有他的影子。', danger: true }
      ],
      id: ['没有证件。'],
      code: ['他什么也不说。'],
      scan: []
    },
    tags: ['只在监控里出现']
  };

  /* ---------------- Night 5 ---------------- */
  C.n5_zhao = {
    id: 'n5_zhao', name: '赵国强', sex: '男', age: 52, kind: 'fake',
    look: {
      height: 1.70, build: 'heavy', coat: '#2b3035', pants: '#1a1c1f',
      hat: 'beanie', hairColor: '#2a231c', scarf: '#3b2a22', wet: true,
      pale: true, extraFinger: true, tint: 0xd2ccc4, face: 'human'
    },
    portrait: { kind: 'fake', flip: true, bg: '#5a6062', tint: 'rgba(80,80,76,.32)' },
    id: {
      name: '赵国强', sex: '男', dob: '1972 年 05 月 18 日',
      addr: '长夜路 34 号 2 单元 401', no: '3101 1972 0518 2437',
      valid: '有效期限 2016.03 — 2036.03', stamp: '已核验'
    },
    items: [],
    dialogue: {
      greet: '我们来换班。',
      request: '你的班已经够长了。',
      remind: '外面还有两个。',
      codeBad: '',
      codeOk: '雨停了。我们都知道。',
      scan: '不用扫。',
      pay: '不用找了。',
      leave: '你一个人值夜，小心点。',
      idBad: '你看吧。我这岁数还能是假的？',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 0.9, text: '他是赵国强。可他今晚没有开车来。', danger: true },
        { delay: 2.3, text: '他没有眨眼。', danger: true },
        { delay: 3.8, text: '他没有呼出白气。', danger: true },
        { delay: 5.3, text: '玻璃里没有他的影子。', danger: true },
        { delay: 6.9, text: '他重复着赵国强说过的话，一字不差。', danger: true }
      ],
      id: ['证件是真的——那是赵国强的证件。可他本人昨晚已经交班回家了。'],
      code: ['口令完全正确。'],
      scan: []
    },
    tags: ['昨晚的客人', '没有开车来']
  };

  C.n5_ma = {
    id: 'n5_ma', name: '马德胜', sex: '男', age: 56, kind: 'fake',
    look: {
      height: 1.74, build: 'heavy', coat: '#3a342c', pants: '#25221c',
      hat: null, hairColor: '#5a5048', scarf: null, pale: true, wet: true,
      extraFinger: true, tint: 0xd8d0c4, face: 'humanB'
    },
    portrait: { kind: 'fake', flip: false, bg: '#5c5a50', tint: 'rgba(90,80,62,.3)' },
    id: {
      name: '马德胜', sex: '男', dob: '1968 年 12 月 30 日',
      addr: '长夜路北段 12 号平房', no: '3101 1968 1230 1194',
      valid: '有效期限 2013.01 — 2033.01', stamp: '已核验'
    },
    items: [],
    dialogue: {
      greet: '呃……还开着啊。好，好。',
      request: '两罐啤酒，一包花生。别问我为什么这么晚。',
      remind: '我……我坐会儿就走。',
      codeBad: '',
      codeOk: '雨停了。唉，这口令，听着像句吉利话。',
      scan: '对，对。',
      pay: '钱给你。多出来的……算我请你。',
      leave: '老陈以前也在这儿值夜。你别学他。',
      idBad: '给。我又不是什么坏人。',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 0.9, text: '他呼出的白气带着酒味。', danger: true },
        { delay: 2.3, text: '他说话时，影子没有动。', danger: true },
        { delay: 3.8, text: '玻璃里没有他的影子。', danger: true },
        { delay: 5.3, text: '他右手有六根手指。', danger: true }
      ],
      id: ['证件是真的，但住址已经拆迁六年了。'],
      code: ['口令正确。'],
      scan: []
    },
    tags: ['昨晚的客人', '不会醉']
  };

  C.n5_zhou = {
    id: 'n5_zhou', name: '周野', sex: '男', age: 26, kind: 'fake',
    look: {
      height: 1.78, build: 'slim', coat: '#1f2a2e', pants: '#202226',
      hat: 'cap', hairColor: '#141210', scarf: null, pale: true, wet: true,
      extraFinger: true, tint: 0xd4cec6, face: 'humanB', badge: true
    },
    portrait: { kind: 'fake', flip: false, bg: '#596463', tint: 'rgba(70,90,86,.3)' },
    id: {
      name: '周野', sex: '男', dob: '1998 年 02 月 11 日',
      addr: '长夜路南段 7 号 3 楼', no: '3101 1998 0211 0815',
      valid: '有效期限 2019.07 — 2039.07', stamp: '已核验'
    },
    items: [],
    dialogue: {
      greet: '哥，还开着呢。',
      request: '我来还你充电宝。',
      remind: '你忘了吗？我借过你的充电宝。',
      codeBad: '',
      codeOk: '雨停了。哥，你声音怎么在抖。',
      scan: '不用扫了。',
      pay: '不用找了。',
      leave: '你一个人值夜，小心点。',
      idBad: '给。',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 0.9, text: '他手里没有充电宝。', danger: true },
        { delay: 2.3, text: '他没有眨眼。', danger: true },
        { delay: 3.8, text: '他没有呼出白气。', danger: true },
        { delay: 5.3, text: '玻璃里没有他的影子。', danger: true },
        { delay: 6.9, text: '他右手有六根手指。', danger: true }
      ],
      id: ['证件是真的。可他昨晚已经死了。'],
      code: ['口令正确。'],
      scan: []
    },
    tags: ['昨晚的客人', '死人']
  };

  C.n5_su = {
    id: 'n5_su', name: '苏姐', sex: '女', age: 34, kind: 'fake',
    look: {
      height: 1.68, build: 'slim', coat: '#1c2420', pants: '#111513',
      hat: null, hairColor: '#0e0b0a', scarf: '#2a2420', glasses: false, longHair: true,
      pale: true, wet: true, extraFinger: false, tint: 0xded8ce, face: 'humanB', headScale: 0.95
    },
    portrait: { kind: 'humanB', flip: true, bg: '#4c5450', tint: 'rgba(120,130,120,.3)' },
    id: null,
    items: [],
    dialogue: {
      greet: '林岳。你已经上了十二年夜班了。',
      request: '让我进去。我们换班。',
      remind: '外面没有天亮。你只是忘了。',
      codeBad: '',
      codeOk: '口令这种东西，是我教他们说的。',
      scan: '……',
      pay: '我不要钱。我要你的名字。',
      leave: '天快亮了。你确定要一个人等到最后？',
      idBad: '我不需要证件。我认识你很久了。',
      idOk: ''
    },
    clues: {
      observe: [
        { delay: 1.0, text: '她站在玻璃外面，雨水从她身上穿过去。', danger: true },
        { delay: 2.4, text: '她没有影子。', danger: true },
        { delay: 3.8, text: '她的声音是从收音机里传出来的，不是从门外。', danger: true }
      ],
      id: [],
      code: [],
      scan: []
    },
    tags: ['电台里的声音', '第一个夜班店员']
  };

  /* ============================================================
   * 五夜脚本
   * ============================================================ */
  const NIGHTS = [
    /* ---------------- NIGHT 1 ---------------- */
    {
      id: 1, title: '试用期', kicker: '第 一 夜 · 22:00',
      quote: '雨从傍晚开始下，一直没有停。\n交接的人没有来。柜台上留着一串钥匙，和一张湿掉的守则。',
      bullets: ['熟悉柜台：接待第一位客人', '记住今晚的口令', '拖地、补货，撑到天亮'],
      codeWord: '雨停了', codeAt: '22:05', realDuration: 340,
      timeline: [
        { t: '22:02', type: 'radio', text: '林岳，能听见吗？我是苏姐。欢迎上第一个夜班。\n钥匙在收银机旁边。后门我已经锁好了。' },
        { t: '22:05', type: 'radio', text: '今晚的口令是——「雨停了」。\n记住，先问口令，再看证件。别嫌麻烦。' },
        { t: '22:07', type: 'objective', text: '在柜台后等第一位客人。' },
        { t: '22:15', type: 'spawn', c: 'n1_zhao' },
        { t: '22:50', type: 'objective', text: '客人走了。去把地上的水拖干（拖把在货架旁）。' },
        { t: '22:52', type: 'radio', text: '哦，对了。拖把在第二排货架边上。\n地板太滑，客人会摔。' },
        { t: '23:10', type: 'spawn', c: 'n1_zhou' },
        { t: '23:55', type: 'event', name: 'flicker' },
        { t: '23:57', type: 'whisper', text: '……柜台下面……' },
        { t: '00:25', type: 'spawn', c: 'n1_fake1' },
        { t: '01:30', type: 'event', name: 'knock' },
        { t: '01:32', type: 'radio', text: '后门？……别开。听见了吗？别开。\n风大，老门会自己响。' },
        { t: '02:20', type: 'objective', text: '收银台下面好像压着一张纸。低头看看。' },
        { t: '02:24', type: 'note', note: 'note1' },
        { t: '03:30', type: 'radio', text: '快四点了。\n林岳，你今晚……有没有看见什么不该看见的东西？' },
        { t: '03:40', type: 'whisper', text: '你做得很好。它记住你了。' },
        { t: '03:59', type: 'end' }
      ],
      end: {
        kicker: '第一夜 · 04:00', title: '合格',
        story: '天边没有亮，只是雨小了一点。\n\n苏姐在电台里说：第一班，合格。\n\n你锁上门，回头看了一眼柜台。玻璃里映着空荡荡的店，和你自己。\n\n你数了数——影子只有一个。\n\n可你总觉得，柜台下面还蹲着什么。'
      }
    },
    /* ---------------- NIGHT 2 ---------------- */
    {
      id: 2, title: '重复', kicker: '第 二 夜 · 22:00',
      quote: '第二天，寻人启事被雨泡烂了一角。\n有人把它重新贴好了，还多贴了一张。\n\n新贴的那张，是你的照片。',
      bullets: ['今晚的口令是「天快亮了」', '后仓的墙上多了一张便签', '没听见门铃的客人……不要接待'],
      codeWord: '天快亮了', codeAt: '22:05', realDuration: 360,
      timeline: [
        { t: '22:02', type: 'radio', text: '林岳，早。昨晚你走得急，收银台下面没关严。\n今晚的口令是——「天快亮了」。' },
        { t: '22:06', type: 'event', name: 'poster' },
        { t: '22:20', type: 'spawn', c: 'n2_zhao' },
        { t: '23:00', type: 'spawn', c: 'n2_lin' },
        { t: '23:40', type: 'spawn', c: 'n2_repeat' },
        { t: '00:08', type: 'event', name: 'flicker' },
        { t: '00:12', type: 'whisper', text: '不要回头。' },
        { t: '00:15', type: 'spawn', c: 'n2_silent', silent: true },
        { t: '00:17', type: 'radio', text: '……刚才是不是有人在店里？\n我好像听见你在跟谁说话。' },
        { t: '01:30', type: 'spawn', c: 'n2_ma' },
        { t: '02:20', type: 'objective', text: '去后仓看看。墙上多了一张便签。' },
        { t: '02:24', type: 'note', note: 'note2' },
        { t: '03:20', type: 'radio', text: '林岳……你妹妹叫什么名字？' },
        { t: '03:24', type: 'whisper', text: '你从来没告诉过她。' },
        { t: '03:40', type: 'radio', text: '……算了。当我没问。\n天快亮了。' },
        { t: '03:59', type: 'end' }
      ],
      end: {
        kicker: '第二夜 · 04:00', title: '重复',
        story: '你翻看收银台的监控回放。\n\n从 23:40 到 00:20，柜台前一直站着一个穿雨衣的人。\n\n他什么也没买。他一直在学你说话。\n\n你按下暂停。画面里的他，正对着镜头笑。\n\n可你记得很清楚——他当时没有笑。'
      }
    },
    /* ---------------- NIGHT 3 ---------------- */
    {
      id: 3, title: '名单', kicker: '第 三 夜 · 22:00',
      quote: '电台在凌晨播了一份名单。\n十一个人。最后一个名字，你听了九十七天。\n\n九十七天前，林小舟在长夜路下车，再也没有回家。',
      bullets: ['核对巡警的证件与口令', '今晚的口令是「别开门」', '如果她回来……你知道该怎么做'],
      codeWord: '别开门', codeAt: '22:05', realDuration: 380,
      timeline: [
        { t: '22:02', type: 'radio', text: '林岳，你的手在抖。\n今晚的口令是——「别开门」。\n是的，我知道你在等谁。' },
        { t: '22:30', type: 'spawn', c: 'n3_wang' },
        { t: '23:15', type: 'radio', text: '插播一条寻人信息。\n林小舟，女，二十四岁。失踪九十七天。\n最后出现地点：长夜路 24H 便利店。' },
        { t: '23:20', type: 'spawn', c: 'n3_sister' },
        { t: '00:20', type: 'whisper', text: '哥，你为什么不来找我？' },
        { t: '00:40', type: 'event', name: 'recording' },
        { t: '01:20', type: 'spawn', c: 'n3_chen' },
        { t: '02:10', type: 'spawn', c: 'n3_double' },
        { t: '02:50', type: 'whisper', text: '你已经很久没回家了。' },
        { t: '03:20', type: 'objective', text: '去后仓的铁皮柜看看。' },
        { t: '03:24', type: 'note', note: 'note3' },
        { t: '03:50', type: 'radio', text: '……天快亮了。\n小岳，把灯关了吧。' },
        { t: '03:59', type: 'end' }
      ],
      end: {
        kicker: '第三夜 · 04:00', title: '名单',
        story: '收音机自己响了。\n\n里面是你的声音，很平静，像在念一段天气预报：\n\n“我是林岳。我在长夜路 24 号。我没有离开过。”\n\n你关掉收音机。它又自己响了起来。\n\n这一次，声音是从后仓传来的。'
      }
    },
    /* ---------------- NIGHT 4 ---------------- */
    {
      id: 4, title: '停电', kicker: '第 四 夜 · 22:00',
      quote: '你开始习惯在黑暗里数呼吸。\n\n停电以后，店里只剩下冰箱的嗡嗡声，\n和柜台下面那把枪的重量。',
      bullets: ['灯灭了。去后仓找配电箱', '电台今晚说了两个口令', '别让任何人靠近后仓'],
      codeWord: '长夜', code2: '天亮', codeAt: '22:04', realDuration: 400,
      timeline: [
        { t: '22:02', type: 'radio', text: '林岳，今晚的口令是——「长夜」。\n重复一遍。今晚的口令是——' },
        { t: '22:03', type: 'radio', text: '……「天亮」。\n不，不对。我刚才是说漏嘴了。\n你听错了。口令只有一个。' },
        { t: '22:10', type: 'event', name: 'blackout' },
        { t: '22:12', type: 'objective', text: '灯灭了。去后仓检查配电箱。按 F 打开手电。' },
        { t: '22:30', type: 'spawn', c: 'n4_zhao' },
        { t: '23:10', type: 'spawn', c: 'n4_tall', silent: true },
        { t: '23:15', type: 'radio', text: '……店里是不是有人？\n别让他靠近后仓。听见了吗？' },
        { t: '23:50', type: 'spawn', c: 'n4_nurse' },
        { t: '00:30', type: 'spawn', c: 'n4_chen' },
        { t: '01:10', type: 'objective', text: '去后仓把配电箱合上。' },
        { t: '01:40', type: 'event', name: 'watcher' },
        { t: '01:45', type: 'radio', text: '灯亮了。\n监控里……货架后面有人。你看见了吗？' },
        { t: '02:30', type: 'objective', text: '查看配电箱内侧。' },
        { t: '02:34', type: 'note', note: 'note4' },
        { t: '03:10', type: 'event', name: 'backdoor' },
        { t: '03:12', type: 'radio', text: '林岳，把后门打开。\n我把交接的人带来了。你该休息了。' },
        { t: '03:20', type: 'whisper', text: '不要看猫眼。不要看猫眼。不要看猫眼。' },
        { t: '03:59', type: 'end' }
      ],
      end: {
        kicker: '第四夜 · 04:00', title: '接电成功',
        story: '配电箱里的电闸被合上了。\n\n你回到柜台，发现监控的时间停在 03:14。\n\n画面里，后门开着。门外站着一个人，背对着镜头。\n\n你认出了那件外套。\n\n那是你自己的外套。\n\n你现在穿着的这一件，右边口袋里，多了一串不属于你的钥匙。'
      }
    },
    /* ---------------- NIGHT 5 ---------------- */
    {
      id: 5, title: '最后一班', kicker: '第 五 夜 · 22:00',
      quote: '广播昨晚没有响。\n\n柜台上的电话线被剪断了，切口很整齐。\n玻璃外面，街灯一盏一盏地灭。\n\n你在等一个再也不会来的交接人。',
      bullets: ['读完交接记录', '别让它们进来', '04:00 之前，做一个决定'],
      codeWord: '雨停了', codeAt: '22:00', realDuration: 440,
      timeline: [
        { t: '22:02', type: 'objective', text: '后仓铁皮柜里有一份交接记录。去读完它。' },
        { t: '22:04', type: 'note', note: 'note5' },
        { t: '22:10', type: 'event', name: 'streetlights' },
        { t: '23:10', type: 'spawn', c: 'n5_zhao' },
        { t: '23:50', type: 'spawn', c: 'n5_ma' },
        { t: '00:30', type: 'spawn', c: 'n5_zhou' },
        { t: '01:20', type: 'event', name: 'watcher' },
        { t: '01:40', type: 'radio', text: '（静电）……林岳……（静电）\n你把他们都留下了。\n很好。' },
        { t: '02:20', type: 'whisper', text: '柜台下面还有六发子弹。一直都有。' },
        { t: '02:40', type: 'objective', text: '玻璃外面有人。不要开灯。' },
        { t: '03:00', type: 'event', name: 'su' },
        { t: '03:05', type: 'finale' }
      ],
      end: {
        kicker: '第五夜', title: '最后一班',
        story: '你站在柜台后面，听见门铃在雨里响了一声。\n\n没有人进来。'
      }
    }
  ];

  /* Key impostors wear a human face; the wrongness is in the details. */
  ['n2_silent', 'n3_sister', 'n3_double', 'n4_chen', 'n5_zhao', 'n5_ma', 'n5_zhou', 'n5_su'].forEach(function (id) {
    const c = C[id];
    if (!c) return;
    c.humanFace = true;
    if (!c.portrait) c.portrait = {};
    c.portrait.kind = (c.look && c.look.face === 'b') ? 'humanB' : 'human';
  });

  MS.Story = {
    RULES: RULES,
    NOTES: NOTES,
    ENDINGS: ENDINGS,
    NIGHTS_META: NIGHTS_META,
    NIGHTS: NIGHTS,
    CUSTOMERS: C
  };
})(window.MS);
