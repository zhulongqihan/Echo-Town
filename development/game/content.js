(function () {
  "use strict";

  const makeAction = (config) => ({
    id: config.id,
    label: config.label,
    detail: config.detail,
    cost: config.cost,
    preview: config.preview,
    requires: config.requires || [],
    effect: config.effect || {},
    goalPoints: config.goalPoints || {},
    result: config.result,
    future: config.future,
    tags: config.tags || [],
    test: config.test || null,
  });

  const CONTENT = {
    version: "3.0.0",
    maxRounds: 23,
    maxLegacyChoices: 3,
    stages: [
      { id: "childhood", label: "童年", range: "6—11岁", hint: "你还没有决定要成为什么人，但每天都在学会一件小事。" },
      { id: "adolescence", label: "少年", range: "12—17岁", hint: "成绩、朋友、兴趣和家人的期待开始拉扯你。" },
      { id: "youth", label: "初入社会", range: "18—29岁", hint: "第一次离开熟悉的地方，选择会开始变成履历。" },
      { id: "middle", label: "成家立业", range: "30—49岁", hint: "钱、关系、责任与理想同时找上门来。" },
      { id: "later", label: "后半生", range: "50—75岁", hint: "你开始决定哪些东西值得留下，哪些东西可以放手。" },
    ],
    skills: {
      study: { label: "学识", levels: ["没学会", "入门", "熟练", "专长", "精通"] },
      craft: { label: "手艺", levels: ["没学会", "入门", "熟练", "专长", "精通"] },
      expression: { label: "表达", levels: ["不敢说", "会开口", "说得清", "能感染", "一呼百应"] },
      empathy: { label: "体谅", levels: ["只顾自己", "会倾听", "懂分寸", "能照料", "让人安心"] },
      courage: { label: "胆识", levels: ["容易退缩", "敢试一次", "扛得住事", "敢担责任", "能带人走"] },
    },
    resources: {
      money: { label: "钱", unit: "元", max: 100 },
      energy: { label: "精力", unit: "点", max: 10 },
      health: { label: "身体", unit: "点", max: 10 },
      happiness: { label: "心气", unit: "点", max: 10 },
      pressure: { label: "压力", unit: "点", max: 10 },
    },
    relationships: {
      family: { label: "家人" },
      mentor: { label: "师长" },
      friend: { label: "朋友" },
      partner: { label: "伴侣" },
      child: { label: "晚辈" },
      neighbor: { label: "邻里" },
    },
    world: {
      shop: { label: "修理铺", values: ["还没开门", "有人留灯", "有固定客人", "成了作坊", "有人接班", "成了镇上的招牌"] },
      bridge: { label: "河桥", values: ["桥板缺了一角", "有人开始补桥", "两岸重新来往", "暴雨也能通行", "孩子们知道怎么过河", "桥成了镇子的名字"] },
      school: { label: "学校", values: ["只剩一间空教室", "有人愿意教", "孩子们有课上", "有了图书角", "镇上留得住学生", "学校成了灯塔"] },
      market: { label: "集市", values: ["摊位零零散散", "周末有人摆摊", "小店开始营业", "外地人会来", "大家有稳定生计", "集市重新热闹"] },
      archive: { label: "镇志", values: ["名字散在纸边", "有人读过一页", "来处被写回来", "每页都有见证人", "孩子能查到自己的来处", "小镇不再忘记自己"] },
    },
    profiles: [
      {
        id: "town-child",
        label: "小镇长大的孩子",
        detail: "家人都认识你，邻居也会喊你的名字。你拥有一张很早就铺开的关系网。",
        start: { money: 5, energy: 8, health: 8, happiness: 6, pressure: 2 },
        skills: { study: 1, craft: 0, expression: 0, empathy: 2, courage: 1 },
        relationships: { family: 4, mentor: 0, friend: 1, partner: 0, child: 0, neighbor: 2 },
        flags: ["town-born"],
      },
      {
        id: "workshop-heir",
        label: "修理铺学徒",
        detail: "你从小在工具声里长大，手很稳，但还没决定要不要接下这间铺子。",
        start: { money: 4, energy: 8, health: 8, happiness: 5, pressure: 3 },
        skills: { study: 0, craft: 2, expression: 0, empathy: 1, courage: 1 },
        relationships: { family: 2, mentor: 3, friend: 0, partner: 0, child: 0, neighbor: 1 },
        flags: ["shop-rookie"],
      },
      {
        id: "newcomer",
        label: "刚搬来的外来者",
        detail: "你带着一只旧箱子和一点积蓄来到回声镇，没有人知道你会不会留下。",
        start: { money: 8, energy: 8, health: 8, happiness: 4, pressure: 3 },
        skills: { study: 1, craft: 0, expression: 1, empathy: 1, courage: 2 },
        relationships: { family: 1, mentor: 0, friend: 0, partner: 0, child: 0, neighbor: 0 },
        flags: ["newcomer"],
      },
      {
        id: "scholar",
        label: "成绩很好的学生",
        detail: "你习惯把问题写在纸上解决，却还不习惯承认自己也需要别人。",
        start: { money: 3, energy: 7, health: 7, happiness: 5, pressure: 4 },
        skills: { study: 3, craft: 0, expression: 1, empathy: 0, courage: 1 },
        relationships: { family: 2, mentor: 1, friend: 0, partner: 0, child: 0, neighbor: 0 },
        flags: ["high-score"],
      },
      {
        id: "storyteller",
        label: "喜欢讲故事的人",
        detail: "你总能把一件小事说得让人愿意听下去，但好故事也需要一个愿意留下的人。",
        start: { money: 3, energy: 8, health: 8, happiness: 7, pressure: 2 },
        skills: { study: 1, craft: 0, expression: 3, empathy: 2, courage: 0 },
        relationships: { family: 2, mentor: 0, friend: 2, partner: 0, child: 0, neighbor: 1 },
        flags: ["storyteller"],
      },
    ],
    talents: [
      { id: "good-memory", label: "过目不忘", detail: "你总能记住书页、门牌和别人随口说过的话。", effect: { skills: { study: 2 }, flags: ["talent-memory"] } },
      { id: "nimble-hands", label: "手很巧", detail: "拆开的东西在你手里总有机会重新运转。", effect: { skills: { craft: 2 }, flags: ["talent-hands"] } },
      { id: "silver-tongue", label: "会把话说到心里", detail: "你不一定最有道理，但常常知道该怎么让人听见。", effect: { skills: { expression: 2 }, flags: ["talent-speech"] } },
      { id: "warm-heart", label: "很会察觉别人", detail: "你能在对方开口前看出他今天是不是过得不太好。", effect: { skills: { empathy: 2 }, flags: ["talent-empathy"] } },
      { id: "thick-skin", label: "抗打击", detail: "被拒绝之后，你通常还能吃完饭，再想下一种办法。", effect: { skills: { courage: 2 }, resources: { pressure: -1 }, flags: ["talent-courage"] } },
      { id: "night-owl", label: "夜里最清醒", detail: "别人睡着之后，你反而容易进入状态，但身体会记住这笔账。", effect: { skills: { study: 1, expression: 1 }, resources: { pressure: 1 }, flags: ["talent-night"] } },
      { id: "lucky-coin", label: "总能碰上巧合", detail: "你口袋里的旧硬币没有魔法，但关键时刻总会被你摸到。", effect: { resources: { money: 2 }, flags: ["talent-luck"] } },
      { id: "slow-and-steady", label: "不急着证明自己", detail: "你不一定最快，但很少因为一时冲动把路走窄。", effect: { resources: { energy: 1, pressure: -1 }, flags: ["talent-steady"] } },
    ],
    goals: [
      { id: "learn", label: "把一门本事练到能谋生", detail: "让某项技能达到精通，并让它在真实生活中派上用场。", target: 8, measure: "成长进度", preferred: ["study", "craft"] },
      { id: "home", label: "让家人过得更好", detail: "在不耗尽自己的前提下，成为家里可靠的那个人。", target: 8, measure: "照料进度", preferred: ["empathy", "money"] },
      { id: "connection", label: "找到真正的同伴", detail: "让至少一段关系经得起时间、分歧和一次道别。", target: 8, measure: "关系进度", preferred: ["friend", "partner"] },
      { id: "town", label: "让回声镇重新热闹", detail: "留下不只属于自己的改变，让更多人愿意留在这里。", target: 8, measure: "小镇进度", preferred: ["neighbor", "market"] },
      { id: "record", label: "给这一生留下证据", detail: "让一段经历有名字、有日期，也有人愿意替你记得。", target: 8, measure: "记录进度", preferred: ["expression", "archive"] },
      { id: "free", label: "不按别人写好的剧本活", detail: "在责任之外保留心气，走到晚年仍能说出自己想要什么。", target: 8, measure: "自由进度", preferred: ["courage", "happiness"] },
    ],
    rounds: [
      {
        id: "childhood-yard", age: 6, stage: "childhood", title: "院子里有一只拆不开的收音机。", copy: "大人们在厨房说话，你蹲在门槛边研究那只没有声音的收音机。它不是你必须修好的东西，却是第一个愿意等你慢慢弄懂的问题。",
        actions: [
          makeAction({ id: "yard-play", label: "先去和邻居孩子玩", detail: "今天不急着弄懂它，先看看谁愿意和你一起蹲在地上。", cost: "消耗 1 精力", preview: "+2 心气；朋友+1；小镇目标+1", effect: { resources: { energy: -1, happiness: 2 }, relationships: { friend: 1 }, flags: ["yard-friend"] }, goalPoints: { connection: 1, town: 1 }, result: "你们把收音机当成藏宝箱，最后找到了里面一颗掉下来的螺丝。", future: "以后遇到难题时，你不会只能一个人蹲在门槛边。", tags: ["关系", "心气"] }),
          makeAction({ id: "fix-radio", label: "把收音机拆开研究", detail: "先认识里面每一根线，弄坏了也没关系。", cost: "消耗 2 精力", preview: "+1 手艺；师长+1；学会“拆解”", effect: { resources: { energy: -2 }, skills: { craft: 1 }, relationships: { mentor: 1 }, flags: ["radio"], secrets: ["night-radio"] }, goalPoints: { learn: 1 }, result: "你没有修好收音机，却记住了哪根线不该碰。祁叔第一次夸你有耐心。", future: "之后遇到坏东西，你会拥有一条可以自己验证的路。", tags: ["手艺", "师长"] }),
          makeAction({ id: "read-comic", label: "躲在树下看旧画报", detail: "你想知道镇子外面的人都在过什么样的日子。", cost: "放弃一次练习", preview: "+1 表达，+1 心气；记录目标+1", effect: { resources: { happiness: 1 }, skills: { expression: 1 }, flags: ["old-magazine"], secrets: ["paper-fold"] }, goalPoints: { record: 1, free: 1 }, result: "你把画报里最好看的那一页折了角，回家后讲给妹妹听。", future: "你会发现，表达不是炫耀，而是把看见的东西交给别人。", tags: ["表达", "自由"] }),
        ],
      },
      {
        id: "childhood-school", age: 8, stage: "childhood", title: "新学校只剩三个座位。", copy: "老师让你自己选位置：靠窗、第一排，或者最后一排。每个位置都能看见不同的东西，也会错过不同的东西。",
        actions: [
          makeAction({ id: "front-seat", label: "坐到第一排", detail: "把听不懂的地方当场问出来。", cost: "压力 +1", preview: "+2 学识；学习目标+1", effect: { resources: { pressure: 1, energy: -1 }, skills: { study: 2 }, flags: ["front-seat"] }, goalPoints: { learn: 1, record: 1 }, result: "你问了一个全班都没听懂的问题，老师在黑板上多写了半页。", future: "成绩会给你一些门票，但也会带来更多期待。", tags: ["学识", "压力"] }),
          makeAction({ id: "window-seat", label: "坐到靠窗的位置", detail: "一半听课，一半观察河对岸的桥。", cost: "消耗 1 精力", preview: "+1 心气，+1 胆识；小镇目标+1", effect: { resources: { energy: -1, happiness: 1 }, skills: { courage: 1 }, flags: ["window-seat"] }, goalPoints: { town: 1, free: 1 }, result: "窗外的河水每天都不一样，你开始想象自己有一天会走到哪里。", future: "对离开和留下的好奇，会在长大后再次找上你。", tags: ["心气", "胆识"] }),
          makeAction({ id: "share-notes", label: "把笔记借给同桌", detail: "你们不一定成为最好的朋友，但可以先互相帮一次。", cost: "消耗 1 精力", preview: "+1 体谅；朋友+2；同伴目标+1", effect: { resources: { energy: -1 }, skills: { empathy: 1 }, relationships: { friend: 2 }, flags: ["share-notes"] }, goalPoints: { connection: 1, home: 1 }, result: "同桌把你的字认全了，第二天替你在老师来之前擦掉了桌上的涂鸦。", future: "关系不是一句承诺，而是下一次还愿不愿意替对方留个位置。", tags: ["体谅", "关系"] }),
        ],
      },
      {
        id: "childhood-sick", age: 10, stage: "childhood", title: "你第一次病到连饭都吃不下。", copy: "家里没有人责怪你，但每个人都有自己的事。你要学会照顾身体，也要学会开口告诉别人你需要什么。",
        actions: [
          makeAction({ id: "rest-at-home", label: "老实休息", detail: "今天不证明自己，先把身体养回来。", cost: "放弃一次行动", preview: "+3 身体，+1 心气；家庭+1", effect: { resources: { health: 3, happiness: 1 }, relationships: { family: 1 }, flags: ["rested"] }, goalPoints: { home: 1, free: 1 }, result: "你睡了很久，醒来时窗外有人把药放在了桌边。", future: "你记住了：保存自己，也是一种对家人的负责。", tags: ["身体", "家人"] }),
          makeAction({ id: "hide-fever", label: "瞒着大人去上课", detail: "你不想因为一次发烧落下进度。", cost: "身体 −2，压力 +2", preview: "+1 学识；但身体和压力会恶化", effect: { resources: { health: -2, pressure: 2, energy: -1 }, skills: { study: 1 }, flags: ["hid-fever"] }, goalPoints: { learn: 1 }, result: "你记住了黑板上的字，却在放学路上差点坐到路边睡着。", future: "有些选择会让你短期更快，但人生会在别处收取费用。", tags: ["学识", "代价"] }),
          makeAction({ id: "ask-for-help", label: "告诉老师和家人你很难受", detail: "承认自己需要帮助，比硬撑更难。", cost: "消耗 1 精力", preview: "+2 体谅；家庭+2；照料目标+1", effect: { resources: { energy: -1 }, skills: { empathy: 2 }, relationships: { family: 2 }, flags: ["asked-help"] }, goalPoints: { home: 1, connection: 1 }, result: "老师替你留了作业，家人也第一次认真问你最近是不是太累。", future: "会求助的人，长大后更有机会成为别人可以依靠的人。", tags: ["体谅", "家人"] }),
        ],
      },
      {
        id: "childhood-festival", age: 11, stage: "childhood", title: "镇上的灯会缺一个讲故事的人。", copy: "祁叔说，灯会最怕只有灯没有人。你可以上台，也可以去修灯，或者把机会让给那个一直不敢举手的孩子。",
        actions: [
          makeAction({ id: "tell-story", label: "上台讲收音机的故事", detail: "不追求讲得完美，只把你知道的说清楚。", cost: "需要表达 1；压力 +1", preview: "+2 表达，+2 心气；记录目标+1", requires: [{ type: "skill", key: "expression", min: 1, label: "需要表达 1" }], effect: { resources: { pressure: 1, happiness: 2 }, skills: { expression: 2 }, flags: ["festival-story"] }, goalPoints: { record: 1, free: 1 }, result: "你讲到一半忘了词，台下有人替你接了下去，大家反而笑得更自然。", future: "你会知道，一次不完美的登台也足以改变别人对你的印象。", tags: ["表达", "心气"] }),
          makeAction({ id: "repair-lantern", label: "去后院修灯", detail: "让台上有光，比自己站在光里更踏实。", cost: "消耗 2 精力", preview: "+1 手艺，+1 小镇；手艺目标+1", effect: { resources: { energy: -2 }, skills: { craft: 1 }, relationships: { neighbor: 1 }, flags: ["festival-lantern"] }, goalPoints: { learn: 1, town: 1 }, result: "最后一排灯亮起来时，没有人知道你蹲在后院沾了一手油。", future: "有些成就感来自掌声，有些来自别人顺利走完一条路。", tags: ["手艺", "小镇"] }),
          makeAction({ id: "invite-shy-child", label: "把话筒递给那个孩子", detail: "你替他挡住第一句，剩下的让他自己说。", cost: "消耗 1 精力", preview: "+2 体谅，朋友+1；同伴目标+1", effect: { resources: { energy: -1, happiness: 1 }, skills: { empathy: 2 }, relationships: { friend: 1 }, flags: ["gave-stage"] }, goalPoints: { connection: 1, home: 1 }, result: "他只说了三句话，却在下台时一直抓着你的袖口。", future: "你可能不会记得他说了什么，但他会记得有人把机会递给过他。", tags: ["体谅", "关系"] }),
        ],
      },
      {
        id: "adolescence-exam", age: 13, stage: "adolescence", title: "第一次重要考试之后，所有人都在问分数。", copy: "分数很清楚，人却不清楚。你可以把它当成门票、当成束缚，也可以先去问问那个考得不好的朋友今晚想不想一起回家。",
        actions: [
          makeAction({ id: "study-plan", label: "制定下一阶段学习计划", detail: "把目标拆成每天能完成的两小时。", cost: "压力 +2，消耗 2 精力", preview: "+2 学识；学习目标+2", effect: { resources: { pressure: 2, energy: -2 }, skills: { study: 2 }, flags: ["study-plan"] }, goalPoints: { learn: 2, record: 1 }, result: "你把计划贴在桌边，第一天就少完成了一项，但没有把纸撕掉。", future: "真正的成长不是一次爆发，而是失败后还会回到计划上。", tags: ["学识", "养成"] }),
          makeAction({ id: "comfort-friend", label: "陪考差的朋友走一段", detail: "今天先不讲道理，听他把最难受的地方说完。", cost: "消耗 1 精力", preview: "+2 体谅，朋友+2；同伴目标+2", effect: { resources: { energy: -1, happiness: 1 }, skills: { empathy: 2 }, relationships: { friend: 2 }, flags: ["comforted-friend"] }, goalPoints: { connection: 2, home: 1 }, result: "他把准考证揉成一团又展开，说下次还想和你坐同一排。", future: "一段关系会因为你没有急着解决它而变得更牢。", tags: ["关系", "体谅"] }),
          makeAction({ id: "learn-bicycle", label: "去修理铺学修自行车", detail: "把课本之外的另一种正确答案握在手里。", cost: "需要手艺 1；消耗 2 精力", preview: "+2 手艺；师长+1；手艺目标+2", requires: [{ type: "skill", key: "craft", min: 1, label: "需要手艺 1" }], effect: { resources: { energy: -2 }, skills: { craft: 2 }, relationships: { mentor: 1 }, flags: ["bike-repair"] }, goalPoints: { learn: 2, town: 1 }, result: "你把链条装反了一次，祁叔没有笑，只让你重新来。", future: "会做具体的事，会让你在另一条人生路上拥有选择权。", tags: ["手艺", "师长"] }),
        ],
      },
      {
        id: "adolescence-club", age: 15, stage: "adolescence", title: "学校新开了三个社团。", copy: "文学社需要一个敢读稿的人，修理社缺一个愿意收拾残局的人，志愿队每周都去河边。你只能先选一个。",
        actions: [
          makeAction({ id: "join-literature", label: "加入文学社", detail: "把你写在本子里的东西读给别人听。", cost: "消耗 2 精力", preview: "+2 表达；朋友+1；记录目标+2", effect: { resources: { energy: -2, happiness: 1 }, skills: { expression: 2 }, relationships: { friend: 1 }, flags: ["literature-club"] }, goalPoints: { record: 2, connection: 1 }, result: "你的第一篇文章被改了七处，但最后一句保留了原样。", future: "你会遇到一群愿意讨论细节的人，也会学会接受修改。", tags: ["表达", "关系"] }),
          makeAction({ id: "join-repair", label: "加入修理社", detail: "从给工具编号、清理工作台开始。", cost: "消耗 2 精力", preview: "+2 手艺；师长+1；手艺目标+2", effect: { resources: { energy: -2 }, skills: { craft: 2 }, relationships: { mentor: 1 }, flags: ["repair-club"] }, goalPoints: { learn: 2, town: 1 }, result: "大家都在抢着修难题时，你先把被踩坏的地垫补好了。", future: "可靠会慢慢变成口碑，口碑会在很久以后替你开门。", tags: ["手艺", "养成"] }),
          makeAction({ id: "join-river-team", label: "加入河边志愿队", detail: "每周去清理桥下的垃圾和淤泥。", cost: "消耗 2 精力", preview: "+2 胆识，邻里+2；小镇目标+2", effect: { resources: { energy: -2, happiness: 1 }, skills: { courage: 2 }, relationships: { neighbor: 2 }, flags: ["river-team"] }, goalPoints: { town: 2, connection: 1 }, result: "你认识了几个平时不会说话的人，桥下也终于能看见水。", future: "小镇的变化不一定从大工程开始，很多时候先从有人愿意来开始。", tags: ["小镇", "胆识"] }),
        ],
      },
      {
        id: "adolescence-summer", age: 17, stage: "adolescence", title: "暑假有一封录取通知，也有一份留镇的工作。", copy: "去外面读书需要钱，留下来能马上帮家里。没有一个选项能把所有人都照顾好，你要先决定自己愿意承担哪一种遗憾。",
        actions: [
          makeAction({ id: "leave-for-school", label: "去外地读书", detail: "带上最轻的行李，把未知当成一次长期练习。", cost: "需要 5 钱；压力 +1", preview: "+2 学识，+2 胆识；自由目标+2", requires: [{ type: "resource", key: "money", min: 5, label: "需要积蓄 5" }], effect: { resources: { money: -5, pressure: 1 }, skills: { study: 2, courage: 2 }, relationships: { family: -1 }, flags: ["left-town"] }, goalPoints: { learn: 2, free: 2 }, test: { skill: "courage", difficulty: 5, label: "胆识检定", success: { resources: { happiness: 1 } }, failure: { resources: { pressure: 1 } }, successText: "你在陌生城市找到了一条自己的路。", failureText: "你在陌生城市绕了几天，还是没有把录取通知退回去。" }, result: "车开动以后，你才发现家人没有说出口的那句“别走太远”。", future: "外地见闻会带来机会，也会让你重新理解留下意味着什么。", tags: ["学识", "离开"] }),
          makeAction({ id: "stay-for-family", label: "留在镇上工作", detail: "先让家里喘一口气，自己的计划以后再说。", cost: "心气 −1；家庭+2", preview: "+3 钱，+2 体谅；家人目标+2", effect: { resources: { money: 3, happiness: -1 }, skills: { empathy: 2 }, relationships: { family: 2 }, flags: ["stayed-town"] }, goalPoints: { home: 2, town: 1 }, result: "你拿到第一笔工资，家里没有庆祝，只是晚饭多炒了一道菜。", future: "留下会让你更快成为家里的支柱，但也可能把自己的愿望推迟。", tags: ["家人", "责任"] }),
          makeAction({ id: "ask-scholarship", label: "去争取一份助学金", detail: "把自己的窘迫写成一份诚实的申请。", cost: "需要学识 2；压力 +1", preview: "+1 学识，+1 胆识；获得“奖学金”旗标", requires: [{ type: "skill", key: "study", min: 2, label: "需要学识 2" }], effect: { resources: { pressure: 1, money: 4 }, skills: { courage: 1, study: 1 }, flags: ["scholarship"] }, goalPoints: { learn: 2, free: 1 }, result: "你没有把每一段困难都写进去，只写了自己接下来想学什么。", future: "机会不是从天上掉下来，很多时候是你终于允许自己开口申请。", tags: ["学识", "胆识"] }),
        ],
      },
      {
        id: "youth-departure", age: 19, stage: "youth", title: "你第一次独自租下一个房间。", copy: "房间很小，钱很少，窗外的城市不会因为你今天搬来就停下来。你需要决定先把日子过稳，还是先把自己放进更大的世界。",
        actions: [
          makeAction({ id: "share-room", label: "和陌生人合租", detail: "省下一点房租，也接受生活边界变得模糊。", cost: "需要 3 钱", preview: "−2 钱；朋友+2；心气+1", requires: [{ type: "resource", key: "money", min: 3, label: "需要积蓄 3" }], effect: { resources: { money: -2, happiness: 1 }, relationships: { friend: 2 }, flags: ["shared-room"] }, goalPoints: { connection: 1, free: 1 }, result: "室友把最后一块西瓜留给你，你们还不知道彼此的全名。", future: "新的关系会在柴米油盐里慢慢显形。", tags: ["关系", "生活"] }),
          makeAction({ id: "night-shift", label: "接一份夜班", detail: "先把钱赚到手，白天再想理想。", cost: "身体 −1，压力 +2", preview: "+8 钱；家人目标+1，但会透支身体", effect: { resources: { money: 8, health: -1, pressure: 2, energy: -2 }, flags: ["night-shift"] }, goalPoints: { home: 1, free: -1 }, result: "凌晨的城市很安静，你第一次知道钱是怎样一点点变多的。", future: "收入让你有了选择，可身体会在未来提醒你这笔账。", tags: ["钱", "代价"] }),
          makeAction({ id: "city-library", label: "去图书馆找资料", detail: "不急着赚钱，先确认自己真正想学什么。", cost: "消耗 2 精力", preview: "+2 学识，+1 心气；学习目标+2", effect: { resources: { energy: -2, happiness: 1 }, skills: { study: 2 }, flags: ["city-library"] }, goalPoints: { learn: 2, record: 1 }, result: "你在旧报纸里找到一条和回声镇很像的新闻，顺手记下了日期。", future: "有些线索不是为了马上解决，而是为了在多年后认出它。", tags: ["学识", "彩蛋线索"] }),
        ],
      },
      {
        id: "youth-mentor", age: 21, stage: "youth", title: "一位老师说：你可以试着带一个新人。", copy: "你自己还没完全站稳，却已经有人把问题递到你手里。成为别人的前辈，会让你更清楚自己究竟懂了多少。",
        actions: [
          makeAction({ id: "mentor-newcomer", label: "带新人做一遍", detail: "把步骤讲慢一点，也给对方犯错的空间。", cost: "消耗 2 精力", preview: "+2 体谅，师长+1；家人目标+2", effect: { resources: { energy: -2 }, skills: { empathy: 2 }, relationships: { mentor: 1, child: 1 }, flags: ["mentor"] }, goalPoints: { home: 2, connection: 1 }, result: "新人把表格填错了，你没有替他改，而是让他自己找到那一格。", future: "你开始拥有一种不会写在证书上的能力：让别人变得更稳。", tags: ["体谅", "传承"] }),
          makeAction({ id: "fix-bicycle", label: "把旧自行车修到能骑", detail: "把少年时代学会的手艺变成一件真正有用的东西。", cost: "需要手艺 2；消耗 2 精力", preview: "+2 手艺，+2 钱；手艺目标+2", requires: [{ type: "skill", key: "craft", min: 2, label: "需要手艺 2" }], effect: { resources: { energy: -2, money: 2 }, skills: { craft: 2 }, goalPoints: { learn: 2, town: 1 }, flags: ["paid-repair"] }, result: "车主试骑了一圈，回来时说这辆车比他记忆里还顺。", future: "你可以把兴趣变成收入，也可以把它留作不被工作吞掉的另一条路。", tags: ["手艺", "收入"] }),
          makeAction({ id: "publish-story", label: "把小镇故事投给杂志", detail: "不写宏大历史，只写桥边卖豆花的人和那场雨。", cost: "需要表达 2；压力 +1", preview: "+2 表达，+2 心气；记录目标+2", requires: [{ type: "skill", key: "expression", min: 2, label: "需要表达 2" }], effect: { resources: { pressure: 1, happiness: 2 }, skills: { expression: 2 }, flags: ["published-story"] }, goalPoints: { record: 2, free: 1 }, result: "编辑只回了一句“请继续写”，你把这句话保存了很多年。", future: "被看见会带来新的邀请，也会让你开始想自己要代表谁说话。", tags: ["表达", "成就"] }),
        ],
      },
      {
        id: "youth-love", age: 24, stage: "youth", title: "一个人开始频繁出现在你的日常里。", copy: "你们一起吃很便宜的饭，一起错过末班车，也一起发现生活没有电影里那么容易。关系要不要更进一步，不会有人替你决定。",
        actions: [
          makeAction({ id: "confess-love", label: "认真说出喜欢", detail: "不承诺永远，只说明你愿意从今天开始试试。", cost: "需要表达 2；压力 +1", preview: "+2 伴侣关系，+2 心气；同伴目标+2", requires: [{ type: "skill", key: "expression", min: 2, label: "需要表达 2" }], effect: { resources: { pressure: 1, happiness: 2 }, relationships: { partner: 2 }, flags: ["love-started"] }, goalPoints: { connection: 2, free: 1 }, result: "对方没有马上回答，只问你明天还要不要一起吃早饭。", future: "真正的关系不是一个结局，而是很多次还愿意回来。", tags: ["关系", "心气"] }),
          makeAction({ id: "keep-friendship", label: "先把这段关系留在朋友位置", detail: "珍惜靠近，不急着把它命名。", cost: "消耗 1 精力", preview: "+2 朋友，+1 心气；同伴目标+2", effect: { resources: { energy: -1, happiness: 1 }, relationships: { friend: 2 }, flags: ["kept-friendship"] }, goalPoints: { connection: 2, free: 1 }, result: "你们没有错过彼此，只是选择用更慢的速度走。", future: "有些同伴不需要成为伴侣，也能陪你穿过很长的一段路。", tags: ["关系", "自由"] }),
          makeAction({ id: "avoid-relationship", label: "把时间全部留给工作", detail: "你害怕关系需要的东西，工作暂时只需要结果。", cost: "压力 +2，心气 −1", preview: "+3 钱；但关系和心气会下降", effect: { resources: { money: 3, pressure: 2, happiness: -1 }, flags: ["avoided-love"] }, goalPoints: { home: 1, free: -1 }, result: "你按时交付了项目，却在回家的路上发现没有人可以分享这个好消息。", future: "逃开一段关系很容易，重新学会靠近会更慢。", tags: ["钱", "代价"] }),
        ],
      },
      {
        id: "youth-career", age: 28, stage: "youth", title: "第一份真正的工作给了你一个选择。", copy: "公司愿意让你升职，修理铺愿意让你回来，社区也在找一个能把事情说清楚的人。职业会占据人生很大一块，但不是全部。",
        actions: [
          makeAction({ id: "take-promotion", label: "接受升职", detail: "钱和履历都更好看，时间会更少。", cost: "压力 +2，消耗 2 精力", preview: "+12 钱，+1 表达；记录目标+1", effect: { resources: { money: 12, pressure: 2, energy: -2 }, skills: { expression: 1 }, flags: ["promotion"] }, goalPoints: { home: 1, record: 1 }, result: "你的名字被写在新工牌上，午饭却还是一个人吃。", future: "你会拥有更大的话语权，也会被更多人期待永远保持能干。", tags: ["职业", "钱"] }),
          makeAction({ id: "return-workshop", label: "回到修理铺", detail: "把手艺当成主业，接受收入慢一点。", cost: "需要手艺 3；需要 2 钱", preview: "+2 手艺，修理铺+2；手艺目标+2", requires: [{ type: "skill", key: "craft", min: 3, label: "需要手艺 3" }, { type: "resource", key: "money", min: 2, label: "需要积蓄 2" }], effect: { resources: { money: -2, happiness: 1 }, skills: { craft: 2 }, relationships: { mentor: 1 }, town: { shop: 2 }, flags: ["workshop-return"] }, goalPoints: { learn: 2, town: 2 }, result: "祁叔把钥匙放在柜台上，没有问你是不是想好了。", future: "一间小铺子会把你的每个选择都变成街坊看得见的结果。", tags: ["手艺", "小镇"] }),
          makeAction({ id: "community-speech", label: "帮社区做一次说明会", detail: "把一堆没人看懂的通知，讲成大家知道该做什么的方案。", cost: "需要表达 3；需要体谅 2", preview: "+2 表达，邻里+2；小镇目标+2", requires: [{ type: "skill", key: "expression", min: 3, label: "需要表达 3" }, { type: "skill", key: "empathy", min: 2, label: "需要体谅 2" }], effect: { resources: { happiness: 1 }, skills: { expression: 2 }, relationships: { neighbor: 2 }, flags: ["community-speech"] }, goalPoints: { town: 2, connection: 1 }, result: "会后有人终于敢举手问：如果家里停水，应该找谁？", future: "清楚的表达会把沉默的人带进决定里。", tags: ["表达", "小镇"] }),
        ],
      },
      {
        id: "middle-family", age: 32, stage: "middle", title: "家里突然需要一笔钱。", copy: "长辈的检查、孩子的学费、铺子的房租同时摆在桌上。你可以先扛住眼前，也可以把责任分给愿意一起承担的人。",
        actions: [
          makeAction({ id: "pay-medical-bill", label: "先把检查费付了", detail: "钱会变少，但至少今晚没人需要再猜。", cost: "需要 12 钱", preview: "−12 钱；家庭+3；家人目标+2", requires: [{ type: "resource", key: "money", min: 12, label: "需要积蓄 12" }], effect: { resources: { money: -12, happiness: -1 }, relationships: { family: 3 }, flags: ["paid-medical"] }, goalPoints: { home: 2, connection: 1 }, result: "缴费单被压在玻璃杯下，长辈问的第一句话还是你吃没吃饭。", future: "你保住了家里的安心，但要重新安排接下来几年的钱。", tags: ["家人", "钱"] }),
          makeAction({ id: "ask-family-share", label: "和家人把账摊开", detail: "不独自扮演英雄，把每个人能做的事写下来。", cost: "需要体谅 3；压力 −1", preview: "+2 体谅，家庭+2；家人目标+2", requires: [{ type: "skill", key: "empathy", min: 3, label: "需要体谅 3" }], effect: { resources: { pressure: -1 }, skills: { empathy: 2 }, relationships: { family: 2 }, flags: ["shared-burden"] }, goalPoints: { home: 2, connection: 1 }, result: "有人承认自己其实也害怕，有人拿出了存了很久的钱。", future: "家庭不是你一个人的项目，愿意共同面对本身就是一种收入。", tags: ["体谅", "家人"] }),
          makeAction({ id: "take-risk-loan", label: "借一笔高息钱周转", detail: "先解决今天，再相信未来的自己能还上。这是一条人人都能走、但不会轻松的路。", cost: "压力 +3；留下债务旗标", preview: "+20 钱；自由目标+1，但会留下债务旗标", effect: { resources: { money: 20, pressure: 3 }, skills: { courage: 1 }, flags: ["debt"] }, goalPoints: { home: 1, free: 1 }, result: "钱来得很快，快到你还没想好最坏情况。", future: "你买到了时间，也把一部分未来抵押给了今天。", tags: ["胆识", "高风险"] }),
        ],
      },
      {
        id: "middle-store", age: 36, stage: "middle", title: "旧修理铺要不要正式开张？", copy: "祁叔的手已经不如以前稳，门口的牌子也该换了。你可以把它变成自己的事业，也可以给家人留出更轻松的生活。",
        actions: [
          makeAction({ id: "open-workshop", label: "把铺子登记成作坊", detail: "花钱换一个可以传下去的名字。", cost: "需要 10 钱、手艺 4", preview: "−10 钱；修理铺+2；手艺目标+2", requires: [{ type: "resource", key: "money", min: 10, label: "需要积蓄 10" }, { type: "skill", key: "craft", min: 4, label: "需要手艺 4" }], effect: { resources: { money: -10 }, town: { shop: 2, market: 1 }, skills: { craft: 1 }, flags: ["workshop"], secrets: ["coin-under-floor"] }, goalPoints: { learn: 2, town: 2 }, test: { skill: "craft", difficulty: 6, label: "手艺检定", success: { resources: { money: 5 } }, failure: { resources: { pressure: 1 } }, successText: "第一批大订单顺利交付，作坊开始有盈余。", failureText: "第一批订单有返工，至少你知道问题出在哪里。" }, result: "新牌子挂上去那天，第一位客人是来修一只三十年前的钟。", future: "作坊会带来收入、学徒和新的责任，不能只靠怀旧经营。", tags: ["手艺", "成就"] }),
          makeAction({ id: "change-career", label: "换一份更稳定的工作", detail: "不追求热爱，先让家里每个月知道钱从哪里来。", cost: "心气 −1", preview: "+18 钱；家庭+1；家人目标+2", effect: { resources: { money: 18, happiness: -1, pressure: 1 }, relationships: { family: 1 }, flags: ["stable-career"] }, goalPoints: { home: 2, free: -1 }, result: "新办公室没有人认识你的过去，但工资到账的那天家里松了一口气。", future: "稳定会给你重新选择的时间，只是别忘了为自己保留一点位置。", tags: ["家人", "稳定"] }),
          makeAction({ id: "take-sabbatical", label: "请假半年去旅行", detail: "用存下的钱换一次不为任何人交付的时间。", cost: "需要 20 钱；压力 −3", preview: "−20 钱；+3 心气，+1 胆识；自由目标+2", requires: [{ type: "resource", key: "money", min: 20, label: "需要积蓄 20" }], effect: { resources: { money: -20, happiness: 3, pressure: -3 }, skills: { courage: 1 }, flags: ["sabbatical"] }, goalPoints: { free: 2, record: 1 }, result: "你在一座没人认识你的城里学会了慢慢吃完一碗面。", future: "回来以后问题还在，但你不再把解决问题当成活着的唯一证明。", tags: ["自由", "心气"] }),
        ],
      },
      {
        id: "middle-partner", age: 40, stage: "middle", title: "你和最亲近的人第一次认真争吵。", copy: "问题不是谁更有道理，而是两个人都觉得自己承担了更多。沉默、道歉和重新分工，会把关系带向不同的地方。",
        actions: [
          makeAction({ id: "talk-through", label: "坐下来把委屈说完", detail: "不先准备反驳，先准确复述对方的感受。", cost: "需要体谅 4；消耗 2 精力", preview: "+2 体谅，伴侣+2；同伴目标+2", requires: [{ type: "skill", key: "empathy", min: 4, label: "需要体谅 4" }], effect: { resources: { energy: -2 }, skills: { empathy: 2 }, relationships: { partner: 2, family: 1 }, flags: ["talked-through"] }, goalPoints: { connection: 2, home: 1 }, result: "你们没有立刻和好，但终于知道争吵下面其实是两个人都很累。", future: "关系不会因为一次谈话变得完美，只会因为愿意谈而多一次机会。", tags: ["关系", "体谅"] }),
          makeAction({ id: "buy-peace", label: "买礼物当作道歉", detail: "先把气氛缓下来，难说的话以后再说。", cost: "需要 8 钱", preview: "−8 钱；心气+1；伴侣+1", requires: [{ type: "resource", key: "money", min: 8, label: "需要积蓄 8" }], effect: { resources: { money: -8, happiness: 1 }, relationships: { partner: 1 }, flags: ["gift-apology"] }, goalPoints: { connection: 1 }, result: "礼物被收下了，真正的问题也还在餐桌另一头。", future: "有时礼物能争取时间，但时间最终还是要用来谈话。", tags: ["关系", "钱"] }),
          makeAction({ id: "leave-argument", label: "先离开现场冷静", detail: "不让最重的话在最累的时候说出口。", cost: "心气 −1；压力 −1", preview: "+1 胆识；压力下降，但关系暂时停滞", effect: { resources: { happiness: -1, pressure: -1 }, skills: { courage: 1 }, flags: ["cooling-off"] }, goalPoints: { free: 1 }, result: "你走到桥边，等水声盖过自己的声音。", future: "退一步不是解决问题，但能让明天还有解决问题的可能。", tags: ["胆识", "关系"] }),
        ],
      },
      {
        id: "middle-child", age: 44, stage: "middle", title: "晚辈问你：我为什么不能选一条不一样的路？", copy: "你曾经为家人做过很多决定，也曾后悔自己没有被允许决定。现在轮到你回答，保护和控制之间究竟差在哪里。",
        actions: [
          makeAction({ id: "support-choice", label: "陪他把选择算清楚", detail: "把风险讲明白，但最后让他自己按下确认。", cost: "需要体谅 4；消耗 2 精力", preview: "+2 体谅，晚辈+2；家人目标+2", requires: [{ type: "skill", key: "empathy", min: 4, label: "需要体谅 4" }], effect: { resources: { energy: -2 }, skills: { empathy: 2 }, relationships: { child: 2 }, flags: ["supported-choice"] }, goalPoints: { home: 2, connection: 1 }, result: "他最后选了一条你不熟悉的路，但你知道他看过地图。", future: "留下的不是你的答案，而是他以后自己做决定的底气。", tags: ["家人", "传承"] }),
          makeAction({ id: "pay-course", label: "替他报一门课", detail: "用钱买一个更安全的起点。", cost: "需要 15 钱", preview: "−15 钱；晚辈+1；学识目标+1", requires: [{ type: "resource", key: "money", min: 15, label: "需要积蓄 15" }], effect: { resources: { money: -15 }, relationships: { child: 1 }, flags: ["paid-course"] }, goalPoints: { home: 1, learn: 1 }, result: "报名成功了，他却说想先试一周再决定要不要继续。", future: "资源能打开一扇门，但走不走进去仍然要由他完成。", tags: ["家人", "钱"] }),
          makeAction({ id: "tell-regret", label: "把自己的遗憾讲给他听", detail: "不把故事讲成教训，只让他知道你也走错过路。说得不漂亮也没关系，先把话说出来。", cost: "消耗 1 精力", preview: "+2 表达，晚辈+1；记录目标+2", effect: { resources: { energy: -1, happiness: 1 }, skills: { expression: 2 }, relationships: { child: 1 }, flags: ["told-regret"] }, goalPoints: { record: 2, connection: 1 }, result: "他听完没有安慰你，只说那我会自己试试看。", future: "有些经验只有被允许不同，才真正成为下一代的礼物。", tags: ["表达", "传承"] }),
        ],
      },
      {
        id: "middle-flood", age: 47, stage: "middle", title: "一场大雨把河水推到了桥面。", copy: "镇上的人都在搬东西。你可以保护自己的家、修桥、或者把大家组织起来先找到最危险的那几户。",
        actions: [
          makeAction({ id: "repair-bridge-adult", label: "带人先修桥", detail: "桥不能只靠一个人扛，先把工作拆给愿意来的人。", cost: "需要胆识 4、手艺 3；身体 −2", preview: "+2 河桥，+2 邻里；小镇目标+2", requires: [{ type: "skill", key: "courage", min: 4, label: "需要胆识 4" }, { type: "skill", key: "craft", min: 3, label: "需要手艺 3" }], effect: { resources: { health: -2, energy: -2 }, skills: { courage: 1 }, relationships: { neighbor: 2 }, town: { bridge: 2, archive: 1 }, flags: ["bridge-master"] }, goalPoints: { town: 2, home: 1 }, result: "桥没有在今晚完全恢复，但撤离的人都能从你钉下的木板上经过。", future: "别人会记住你如何在混乱里分配工具，而不只是你钉了几颗钉子。", tags: ["小镇", "胆识"] }),
          makeAction({ id: "protect-home", label: "先把家里封好", detail: "保护家人和仅有的存款，明天再去看桥。", cost: "需要 6 钱；消耗 2 精力", preview: "−6 钱；家庭+2；家人目标+2", requires: [{ type: "resource", key: "money", min: 6, label: "需要积蓄 6" }], effect: { resources: { money: -6, energy: -2 }, relationships: { family: 2 }, flags: ["protected-home"] }, goalPoints: { home: 2 }, result: "雨水从门缝里进来，但孩子们睡觉的房间保持干燥。", future: "你保住了自己的根，也要面对没有救到所有人的愧疚。", tags: ["家人", "代价"] }),
          makeAction({ id: "organize-evacuation", label: "挨家挨户敲门", detail: "让大家先离开最低处，再讨论谁负责修什么。你不需要等到准备完美才开始保护别人。", cost: "消耗 2 精力", preview: "+1 体谅，邻里+3；小镇目标+2", effect: { resources: { energy: -2 }, skills: { empathy: 1 }, relationships: { neighbor: 3 }, town: { bridge: 1, market: 1 }, flags: ["evacuation"] }, goalPoints: { town: 2, connection: 1 }, result: "最后一扇门被敲开时，整条街已经知道该把谁带到高处。", future: "以后遇到麻烦，镇子不必每次都等一个英雄出现。", tags: ["体谅", "小镇"] }),
        ],
      },
      {
        id: "middle-ledger", age: 49, stage: "middle", title: "你在旧档案里发现一个被改过的日期。", copy: "那笔修桥款和一场旧事故有关。你可以公开、查证、或者把它收起来——真相未必立刻让谁变得更幸福。",
        actions: [
          makeAction({ id: "publish-ledger", label: "把账页交给镇志", detail: "让证据先离开你的抽屉，接受别人核对。", cost: "需要表达 3；压力 +1", preview: "+2 表达，镇志+2；记录目标+2", requires: [{ type: "skill", key: "expression", min: 3, label: "需要表达 3" }], effect: { resources: { pressure: 1 }, skills: { expression: 2 }, town: { archive: 2 }, flags: ["public-ledger"] }, goalPoints: { record: 2, town: 1 }, result: "有人说你翻旧账，也有人把自己记得的另一半日期写在旁边。", future: "下一世可以从一份公开记录开始，而不是从传闻开始。", tags: ["记录", "小镇"] }),
          makeAction({ id: "trace-watergate", label: "沿着水闸编号查下去", detail: "把散开的名字和地点一一对上。", cost: "需要学识 4；消耗 2 精力", preview: "+2 学识，+1 洞察；记录目标+2", requires: [{ type: "skill", key: "study", min: 4, label: "需要学识 4" }], effect: { resources: { energy: -2 }, skills: { study: 2 }, flags: ["watergate-trace"] }, goalPoints: { record: 2, learn: 1 }, result: "你在一份旧地图上找到同一个编号，日期比事故早了三年。", future: "真正的调查需要耐心，也需要有人愿意把你暂时查不到的部分继续接下去。", tags: ["学识", "记录"] }),
          makeAction({ id: "keep-wet-pages", label: "把湿账页收进工具箱", detail: "先保护证据，不让它和你一起被抹掉。哪怕还不会修复纸张，也可以先替它留一个干燥的位置。", cost: "消耗 1 精力", preview: "+1 手艺；获得“湿账页”遗产候选", effect: { resources: { energy: -1 }, skills: { craft: 1 }, town: { archive: 1 }, flags: ["wet-ledger"] }, goalPoints: { record: 1 }, result: "你把纸页夹进防潮袋，墨迹没有继续散开。", future: "它暂时不会改变小镇，但会成为下一世的调查起点。", tags: ["记录", "遗产"] }),
        ],
      },
      {
        id: "later-restart", age: 52, stage: "later", title: "五十岁以后，你仍然可以学一件新东西。", copy: "有人说现在开始太晚，有人说你已经证明过自己。你可以重新当学生，也可以成为别人的老师。",
        actions: [
          makeAction({ id: "return-school", label: "重新报名学习", detail: "接受自己在教室里比别人慢一点。", cost: "需要 10 钱；压力 −1", preview: "−10 钱；+2 学识，+2 心气；学习目标+2", requires: [{ type: "resource", key: "money", min: 10, label: "需要积蓄 10" }], effect: { resources: { money: -10, pressure: -1, happiness: 2 }, skills: { study: 2 }, flags: ["late-study"] }, goalPoints: { learn: 2, free: 1 }, result: "你第一次举手时声音不大，老师还是准确叫出了你的名字。", future: "学习不只为年轻人准备，它会给后半生带来新的叙述方式。", tags: ["学识", "自由"] }),
          makeAction({ id: "teach-youth", label: "在学校带年轻人做项目", detail: "把你走过的弯路变成他们可以少走的一段。", cost: "需要手艺 4 或表达 4；消耗 2 精力", preview: "+2 体谅，晚辈+2；传承目标+2", requires: [{ type: "any", requirements: [{ type: "skill", key: "craft", min: 4 }, { type: "skill", key: "expression", min: 4 }], label: "需要手艺 4或表达 4" }], effect: { resources: { energy: -2, happiness: 1 }, skills: { empathy: 2 }, relationships: { child: 2 }, town: { school: 1 }, flags: ["taught-youth"] }, goalPoints: { home: 2, town: 1, learn: 1 }, result: "学生们没有照着你的方法做，却做出了比你预想更好的东西。", future: "真正的传承不是复制，而是允许下一代改得更好。", tags: ["传承", "小镇"] }),
          makeAction({ id: "street-performance", label: "在桥边办一场小演出", detail: "把广场还给人，不必先等一个正式舞台。就算表达还不成熟，也可以先邀请第一个人停下来。", cost: "消耗 2 精力；接受一次表达检定", preview: "+3 心气，邻里+2；自由目标+2", effect: { resources: { energy: -2, happiness: 3 }, relationships: { neighbor: 2 }, flags: ["street-show"] }, goalPoints: { free: 2, town: 1, connection: 1 }, test: { skill: "expression", difficulty: 6, label: "表达检定", success: { resources: { happiness: 1 } }, failure: { resources: { pressure: 1 } }, successText: "最后一首歌唱完时，桥边没有一个人先离开。", failureText: "有人提前离开，但留下的人把最后一首歌唱完了。" }, result: "有人带来小板凳，有人带来水果，最后连卖报纸的人都停下来听了一首歌。", future: "小镇重新热闹，不一定因为赚了更多钱，也可能因为人重新愿意聚在一起。", tags: ["心气", "小镇"] }),
        ],
      },
      {
        id: "later-memory", age: 56, stage: "later", title: "旧朋友寄来一张没有署名的明信片。", copy: "上面只有一句：你还记得那座桥吗？你可以回信、去找人，或者把这件事当成一段已经结束的青春。",
        actions: [
          makeAction({ id: "write-letter", label: "认真写一封回信", detail: "把这些年没有说出口的感谢写得具体一点。", cost: "需要表达 4；朋友+2", preview: "+2 表达，朋友+3；同伴目标+2", requires: [{ type: "skill", key: "expression", min: 4, label: "需要表达 4" }], effect: { resources: { happiness: 1 }, skills: { expression: 2 }, relationships: { friend: 3 }, flags: ["letter"] }, goalPoints: { connection: 2, record: 1 }, result: "你写了很久，最后没有写“有空再聚”，而是写了一个具体的日期。", future: "关系的回声需要新的行动才能回来。", tags: ["关系", "记录"] }),
          makeAction({ id: "visit-old-friend", label: "带着明信片去找他", detail: "不等对方先解释，先把自己带到那条街。", cost: "需要 15 钱；需要胆识 3", preview: "−15 钱；+2 心气，朋友+3；自由目标+2", requires: [{ type: "resource", key: "money", min: 15, label: "需要积蓄 15" }, { type: "skill", key: "courage", min: 3, label: "需要胆识 3" }], effect: { resources: { money: -15, happiness: 2 }, skills: { courage: 1 }, relationships: { friend: 3 }, flags: ["visited-friend"] }, goalPoints: { connection: 2, free: 2 }, result: "你们在一间很吵的小店见面，谁都没有先问这些年过得好不好。", future: "真正的重逢不是把时间补回来，而是承认时间确实经过了。", tags: ["关系", "自由"] }),
          makeAction({ id: "archive-postcard", label: "把明信片夹进镇志", detail: "保留它，不急着替这段关系下结论。", cost: "消耗 1 精力", preview: "+1 镇志，+1 记录；发现彩蛋线索", effect: { resources: { energy: -1 }, town: { archive: 1 }, flags: ["postcard"], secrets: ["river-number"] }, goalPoints: { record: 2, town: 1 }, result: "你在明信片背面发现一个熟悉的水闸编号，和旧账上的墨迹一样淡。", future: "有些关系和真相会在很晚的时候重新接上。", tags: ["记录", "彩蛋线索"] }),
        ],
      },
      {
        id: "later-town", age: 60, stage: "later", title: "镇上要决定旧学校是否继续保留。", copy: "学生变少了，楼也旧了，但关掉学校意味着孩子们必须离开。你可以投票、筹钱，也可以把镇志里记录过的每个人请回来。",
        actions: [
          makeAction({ id: "save-school", label: "发起保留学校的方案", detail: "把成本、人数和可能的用途都写给大家看。", cost: "需要表达 5、学识 3", preview: "+2 学校，+2 邻里；小镇目标+2", requires: [{ type: "skill", key: "expression", min: 5, label: "需要表达 5" }, { type: "skill", key: "study", min: 3, label: "需要学识 3" }], effect: { skills: { expression: 1 }, relationships: { neighbor: 2 }, town: { school: 2 }, flags: ["saved-school"] }, goalPoints: { town: 2, record: 1 }, result: "方案没有让所有人满意，但大家至少在同一张纸上看见了问题。", future: "公共生活的成就感，常常来自让决定变得可参与。", tags: ["小镇", "表达"] }),
          makeAction({ id: "fund-school", label: "拿出积蓄设奖学金", detail: "让愿意留下学习的人先多一个学期。", cost: "需要 25 钱", preview: "−25 钱；学校+2，晚辈+2；家人目标+2", requires: [{ type: "resource", key: "money", min: 25, label: "需要积蓄 25" }], effect: { resources: { money: -25, happiness: 1 }, relationships: { child: 2 }, town: { school: 2 }, flags: ["school-fund"] }, goalPoints: { town: 2, home: 2 }, result: "第一位拿到奖学金的孩子说，她想学会修桥。", future: "钱会花完，但一个孩子留下来的理由可能会继续生长。", tags: ["小镇", "传承"] }),
          makeAction({ id: "invite-town-alumni", label: "把旧同学都叫回来", detail: "让每个人说说自己离开以后，最想带什么回来。你不必先成为最会照料别人的人，先发出邀请就够了。", cost: "消耗 2 精力", preview: "+1 体谅，邻里+3；集市和学校各+1", effect: { resources: { energy: -2, happiness: 2 }, skills: { empathy: 1 }, relationships: { neighbor: 3, friend: 1 }, town: { market: 1, school: 1 }, flags: ["alumni-return"] }, goalPoints: { town: 2, connection: 1 }, result: "有人带回来一台投影仪，有人带回来一份愿意教一门课的时间。", future: "小镇真正缺的有时不是钱，而是离开的人还愿不愿意回来一次。", tags: ["小镇", "关系"] }),
        ],
      },
      {
        id: "later-handoff", age: 65, stage: "later", title: "你开始认真想：这些东西该交给谁？", copy: "工具、账本、钥匙、联系人和你花了几十年才学会的方法，不能全部跟着你留在抽屉里。",
        actions: [
          makeAction({ id: "train-successor", label: "把作坊交给学徒", detail: "让他先试着做决定，你只在必要时补一句。", cost: "需要作坊基础、手艺 5；晚辈+2", preview: "+2 手艺，+2 晚辈；修理铺+2；学习目标+2", requires: [{ type: "world", key: "shop", min: 3, label: "需要作坊基础 3" }, { type: "skill", key: "craft", min: 5, label: "需要手艺 5" }], effect: { skills: { craft: 2 }, relationships: { child: 2 }, town: { shop: 2 }, flags: ["successor"] }, goalPoints: { learn: 2, town: 2 }, result: "他把第一笔大订单做错了，你没有接过扳手，只问他准备怎么补救。", future: "传承会让你第一次看见，自己的方法如何在别人手里变形。", tags: ["传承", "手艺"] }),
          makeAction({ id: "record-life", label: "把人生写成一册镇志", detail: "不写成功学，只写那些改变方向的普通日子。", cost: "需要表达 5、学识 4；消耗 2 精力", preview: "+3 镇志；记录目标+3；可能发现彩蛋", requires: [{ type: "skill", key: "expression", min: 5, label: "需要表达 5" }, { type: "skill", key: "study", min: 4, label: "需要学识 4" }], effect: { resources: { energy: -2, happiness: 2 }, town: { archive: 3 }, flags: ["life-record"], secrets: ["empty-seat"] }, goalPoints: { record: 3, town: 1 }, result: "你写下了很多没有上新闻的事：一次借伞、一次争吵、一次没有放弃。", future: "下一代不一定照着你的答案生活，但能知道你曾经怎样做选择。", tags: ["记录", "成就"] }),
          makeAction({ id: "give-away-tools", label: "把工具分给需要的人", detail: "不指定唯一继承人，让更多人先用起来。即使你还没学会照料所有人，也可以先分享一件具体的东西。", cost: "心气 +2；让工具开始流动", preview: "+2 体谅，邻里+2；小镇目标+2", effect: { resources: { happiness: 2 }, skills: { empathy: 2 }, relationships: { neighbor: 2, child: 1 }, flags: ["gave-tools"] }, goalPoints: { town: 2, home: 1, free: 1 }, result: "工具一件件离开柜台，你第一次觉得结束不是失去，而是分发。", future: "留下的基础越多，下一世的起点越不只属于一个人。", tags: ["体谅", "传承"] }),
        ],
      },
      {
        id: "later-farewell", age: 70, stage: "later", title: "祁叔留下的钟在午夜多走了一格。", copy: "你已经很久没有听见它这样响。有人说是旧零件，有人说是风，你可以把它当作故障，也可以把它当作回声镇给你的暗号。",
        actions: [
          makeAction({ id: "open-clock", label: "拆开钟看个究竟", detail: "把最熟悉的东西再当成第一次遇见。", cost: "需要手艺 6；消耗 1 精力", preview: "+2 手艺；发现彩蛋“第十三声”", requires: [{ type: "skill", key: "craft", min: 6, label: "需要手艺 6" }], effect: { resources: { energy: -1, happiness: 1 }, skills: { craft: 2 }, flags: ["clock-opened"], secrets: ["thirteenth-chime"] }, goalPoints: { learn: 2, record: 1 }, result: "齿轮里藏着一张很小的纸条：别只修坏掉的东西，也修还来得及的关系。", future: "下一世如果带着这枚发条，某个熟悉的声音会提前响起。", tags: ["手艺", "彩蛋"] }),
          makeAction({ id: "sit-by-bridge", label: "去桥边坐一会儿", detail: "不解决任何问题，看看这些年桥上经过了谁。", cost: "消耗 1 精力；心气 +2", preview: "+2 心气，+1 河桥；自由目标+2", effect: { resources: { energy: -1, happiness: 2 }, town: { bridge: 1 }, flags: ["bridge-memory"] }, goalPoints: { free: 2, town: 1 }, result: "晚辈从桥上跑过去，回头喊了你一声，像很多年前一样。", future: "有些成就不是又完成一件事，而是终于能看见已经完成的事。", tags: ["心气", "小镇"] }),
          makeAction({ id: "call-family", label: "给家人打电话", detail: "不等到有大事，先问一句最近睡得好不好。", cost: "需要体谅 3；家庭+2", preview: "+2 体谅，家庭+2；家人目标+2", requires: [{ type: "skill", key: "empathy", min: 3, label: "需要体谅 3" }], effect: { resources: { happiness: 1 }, skills: { empathy: 2 }, relationships: { family: 2 }, flags: ["late-call"] }, goalPoints: { home: 2, connection: 1 }, result: "电话那头先是一阵沉默，然后有人说起今天菜市场的价格。", future: "关系不必总在大事里证明，它可以由许多普通电话托住。", tags: ["家人", "关系"] }),
        ],
      },
      {
        id: "later-final", age: 75, stage: "later", title: "最后一页还空着，笔在你手里。", copy: "这一生没有把所有事情做完。你可以写下一个名字、一座桥，或者一句准备交给下一世的话。",
        actions: [
          makeAction({ id: "write-final-page", label: "写下这一路的人名", detail: "让感谢不再只停留在心里。字不必漂亮，先把你记得的人写下来。", cost: "消耗 1 精力", preview: "+3 镇志，朋友/家人各+1；记录目标+3", effect: { resources: { energy: -1, happiness: 2 }, relationships: { family: 1, friend: 1 }, town: { archive: 3 }, flags: ["final-page"] }, goalPoints: { record: 3, connection: 1 }, result: "你写了很多名字，最后发现自己最想写的是那些没来得及道谢的人。", future: "下一世会从一份有人情温度的记录开始。", tags: ["记录", "关系"] }),
          makeAction({ id: "leave-open-door", label: "给下一世留一扇门", detail: "把钥匙、地址和第一笔周转钱放在最容易找到的地方。", cost: "需要修理铺 3；需要 8 钱", preview: "−8 钱；修理铺+2；获得“铺子钥匙”遗产候选", requires: [{ type: "world", key: "shop", min: 3, label: "需要修理铺基础 3" }, { type: "resource", key: "money", min: 8, label: "需要积蓄 8" }], effect: { resources: { money: -8 }, town: { shop: 2 }, flags: ["shop-key"], secrets: ["open-door-secret"] }, goalPoints: { town: 2, learn: 1 }, result: "门没有锁死，钥匙和一张写着地址的纸放在柜台里。", future: "下一世可以从一间真正存在的铺子开始，而不是从一张愿望单开始。", tags: ["传承", "小镇"] }),
          makeAction({ id: "listen-thirteenth", label: "等钟走完第十三声", detail: "不记录、不解释，只听完它想说的部分。", cost: "需要发现过钟的秘密；心气 +3", preview: "+3 心气；发现彩蛋“回声不是故障”", requires: [{ type: "secret", key: "thirteenth-chime", label: "需要先发现第十三声" }], effect: { resources: { happiness: 3, pressure: -2 }, flags: ["echo-heard"], secrets: ["echo-not-glitch"] }, goalPoints: { free: 3, record: 1 }, result: "第十三声之后，钟又恢复正常。你却听见门外有人把工具箱放回了原位。", future: "有些彩蛋不会改变数值，只会让下一世知道这座镇子在听。", tags: ["彩蛋", "心气"] }),
        ],
      },
    ],
    legacies: [
      { id: "steady-habit", label: "不把自己耗尽的习惯", detail: "下一世精力上限和起始精力各+1，压力−1。", nextUse: "让下一世的第一次选择不必用透支换来。", requires: [], effect: { resources: { energy: 1, pressure: -1 }, maxResources: { energy: 1 }, flags: ["legacy-steady"] } },
      { id: "small-tool", label: "一件趁手工具", detail: "下一世手艺+2，开局多一件可验证的工作。", nextUse: "让下一世更早出现手艺路线。", requires: [], effect: { skills: { craft: 2 }, flags: ["legacy-tool"] } },
      { id: "study-notebook", label: "写满批注的笔记", detail: "下一世学识+2，并解锁一个额外学习行动。", nextUse: "让下一世的学习不只靠考试。", requires: [], effect: { skills: { study: 2 }, flags: ["legacy-notebook"] } },
      { id: "radio-recording", label: "一段旧收音机录音", detail: "下一世表达+1、心气+2；偶尔会听见不该出现的声音。", nextUse: "让下一世更早发现回声镇的彩蛋线。", requires: [{ type: "flag", key: "radio" }], effect: { skills: { expression: 1 }, resources: { happiness: 2 }, flags: ["legacy-radio"] } },
      { id: "family-recipe", label: "家里传下来的菜谱", detail: "下一世体谅+2、家人关系+1。", nextUse: "让下一世在最早的家庭事件里多一个温柔选项。", requires: [{ type: "relationship", key: "family", min: 5 }], effect: { skills: { empathy: 2 }, relationships: { family: 1 }, flags: ["legacy-recipe"] } },
      { id: "friend-letter", label: "没有寄出的信", detail: "下一世朋友关系+2，开局会出现一个熟悉的地址。", nextUse: "让下一世更容易建立第一段真正的同伴关系。", requires: [{ type: "flag", key: "letter" }], effect: { relationships: { friend: 2 }, flags: ["legacy-letter"] } },
      { id: "bridge-map", label: "河桥旧地图", detail: "下一世胆识+1，小镇河桥基础+1。", nextUse: "让下一世在第一次镇上危机时拥有提前准备。", requires: [{ type: "world", key: "bridge", min: 3 }], effect: { skills: { courage: 1 }, town: { bridge: 1 }, flags: ["legacy-map"] } },
      { id: "shop-key", label: "修理铺的钥匙", detail: "下一世钱+8、手艺+1，修理铺从有人留灯开始。", nextUse: "让下一世可以直接选择经营路线。", requires: [{ type: "flag", key: "shop-key" }], effect: { resources: { money: 8 }, skills: { craft: 1 }, town: { shop: 1 }, flags: ["legacy-shop-key"] } },
      { id: "wet-ledger", label: "夹在工具箱里的湿账页", detail: "下一世学识+1，旧账调查行动会提前出现。", nextUse: "让下一世从一条可核对的线索开始。", requires: [{ type: "flag", key: "wet-ledger" }], effect: { skills: { study: 1 }, town: { archive: 1 }, flags: ["legacy-ledger"] } },
      { id: "school-badge", label: "学校的旧徽章", detail: "下一世学识+1、晚辈关系+1，小镇学校基础+1。", nextUse: "让下一世的学校线有一个真实的入口。", requires: [{ type: "world", key: "school", min: 2 }], effect: { skills: { study: 1 }, relationships: { child: 1 }, town: { school: 1 }, flags: ["legacy-school"] } },
      { id: "clock-spring", label: "第十三声的发条", detail: "下一世手艺+1、心气+1，隐藏事件会在中年出现。", nextUse: "让下一世更早知道故障背后可能有回声。", requires: [{ type: "secret", key: "thirteenth-chime" }], effect: { skills: { craft: 1 }, resources: { happiness: 1 }, flags: ["legacy-spring"] } },
      { id: "town-register", label: "回声镇名册", detail: "下一世表达+1，小镇镇志基础+2。", nextUse: "让下一世的公共事件更容易聚集人。", requires: [{ type: "flag", key: "life-record" }], effect: { skills: { expression: 1 }, town: { archive: 2 }, flags: ["legacy-register"] } },
      { id: "travel-postcard", label: "外地寄回的明信片", detail: "下一世胆识+2、心气+1，并解锁一条离镇路线。", nextUse: "让下一世可以从“去看看”而不是“逃出去”开始。", requires: [{ type: "flag", key: "postcard" }], effect: { skills: { courage: 2 }, resources: { happiness: 1 }, flags: ["legacy-postcard"] } },
      { id: "apprentice-notes", label: "学徒的第一本笔记", detail: "下一世体谅+1、晚辈关系+2，传承目标起步更快。", nextUse: "让下一世能更早把一件事交给别人。", requires: [{ type: "relationship", key: "child", min: 3 }], effect: { skills: { empathy: 1 }, relationships: { child: 2 }, flags: ["legacy-apprentice"] } },
      { id: "unfinished-letter", label: "写到一半的信", detail: "下一世朋友+1、表达+1；某位旧友可能重新出现。", nextUse: "让下一世在关系线里多一次主动回头的机会。", requires: [{ type: "flag", key: "letter" }], effect: { skills: { expression: 1 }, relationships: { friend: 1 }, flags: ["legacy-unfinished-letter"] } },
      { id: "open-door", label: "一扇没有锁上的门", detail: "下一世钱+3、心气+1，小镇修理铺和市场各+1。", nextUse: "让下一世开局就知道这里有人等你。", requires: [{ type: "flag", key: "shop-key" }], effect: { resources: { money: 3, happiness: 1 }, town: { shop: 1, market: 1 }, flags: ["legacy-open-door"] } },
    ],
    achievements: [
      { id: "first-page", label: "写下第一页", detail: "完成第一世。", icon: "✦", requires: [{ type: "world", key: "completedLives", min: 1 }] },
      { id: "three-lives", label: "三世为人", detail: "完成三世人生。", icon: "三", requires: [{ type: "world", key: "completedLives", min: 3 }] },
      { id: "master-of-one", label: "一技之长", detail: "任意一项技能达到 8。", icon: "工", requires: [{ type: "anyStat", group: "skills", min: 8 }] },
      { id: "well-rounded", label: "没有白学的东西", detail: "三项技能达到 5。", icon: "全", requires: [{ type: "statCount", group: "skills", min: 5, count: 3 }] },
      { id: "town-builder", label: "镇子记得你", detail: "任意三项小镇基础达到 3。", icon: "镇", requires: [{ type: "statCount", group: "town", min: 3, count: 3 }] },
      { id: "legacy-collector", label: "把故事带下去", detail: "收集 8 种不同遗产。", icon: "藏", requires: [{ type: "count", group: "collectedLegacyIds", min: 8 }] },
      { id: "good-neighbor", label: "整条街都认识你", detail: "某一世邻里关系达到 8。", icon: "邻", requires: [{ type: "lifeStat", group: "relationships", key: "neighbor", min: 8 }] },
      { id: "second-chance", label: "还来得及", detail: "在压力达到 8 后仍将心气恢复到 7。", icon: "回", requires: [{ type: "flag", key: "second-chance" }] },
      { id: "thirteenth-chime", label: "第十三声", detail: "发现钟里藏着的纸条。", icon: "钟", requires: [{ type: "secret", key: "thirteenth-chime" }] },
      { id: "echo-heard", label: "回声不是故障", detail: "听完最后一声没有解释的钟响。", icon: "声", requires: [{ type: "secret", key: "echo-not-glitch" }] },
      { id: "old-friend", label: "地址仍然有效", detail: "重新走到旧朋友面前。", icon: "信", requires: [{ type: "flag", key: "visited-friend" }] },
      { id: "leave-a-light", label: "给后来的人留灯", detail: "让下一世从一扇真实的门开始。", icon: "灯", requires: [{ type: "flag", key: "shop-key" }] },
    ],
    secrets: [
      { id: "thirteenth-chime", label: "第十三声", detail: "祁叔的钟里藏着一张只写给下一代的纸条。" },
      { id: "echo-not-glitch", label: "回声不是故障", detail: "有些声音没有数值，却会被小镇记住。" },
      { id: "river-number", label: "水闸编号", detail: "明信片和旧账指向同一个从未被写完的地点。" },
      { id: "empty-seat", label: "永远空着的座位", detail: "学校最后一排的座位总会为某个晚到的人留着。" },
      { id: "coin-under-floor", label: "地板下的硬币", detail: "那枚旧硬币从未让你发财，只让你多了一次选择。" },
      { id: "night-radio", label: "凌晨的广播", detail: "录音里偶尔会出现一段不属于任何电台的报时。" },
      { id: "paper-fold", label: "画报的折角", detail: "第一世折过的那一页，下一世仍会出现在镇志里。" },
      { id: "open-door-secret", label: "没有锁上的门", detail: "门后不是奖励，是有人相信你还会回来。" },
    ],
  };

  window.EchoTownContent = CONTENT;
})();
