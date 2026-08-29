(function () {
  "use strict";

  window.EchoTownContent = {
    version: "2.0.0",
    maxRounds: 8,
    phases: {
      start: { label: "起步", hint: "先让自己站稳，认识这一世最紧的限制。" },
      build: { label: "经营", hint: "每一次投入都会让下一步更容易或更困难。" },
      turn: { label: "转折", hint: "前面留下的基础，现在会变成机会或代价。" }
    },
    town: {
      shop: { label: "修理铺", values: ["门还没开", "只剩一盏灯", "有人愿意接手", "成了镇上的落脚处"] },
      bridge: { label: "河桥", values: ["桥板缺了一角", "有人开始补桥", "两岸重新来往", "孩子们知道怎么过河"] },
      trust: { label: "邻里", values: ["各自关门", "有人愿意帮忙", "暴雨前会互相敲门", "整条街一起做决定"] },
      archive: { label: "旧账", values: ["名字散在纸边", "有人读过一页", "来处被写了回来", "每一页都有见证人"] }
    },
    profiles: [
      {
        id: "apprentice",
        label: "修理铺学徒",
        detail: "你已经会拧紧几颗螺丝，但还没有一件真正属于自己的工具。",
        start: { money: 2, energy: 5, health: 3, craft: 1, care: 0, nerve: 1, insight: 0, master: 1, neighbor: 0, apprentice: 0 },
        flags: ["shop-rookie"]
      },
      {
        id: "outsider",
        label: "刚搬来的外来者",
        detail: "你手里有一点积蓄，却没有人知道你能不能留下。",
        start: { money: 3, energy: 5, health: 3, craft: 0, care: 1, nerve: 1, insight: 1, master: 0, neighbor: 0, apprentice: 0 },
        flags: ["newcomer"]
      },
      {
        id: "inheritor",
        label: "旧铺继承人",
        detail: "铺子是你的了，欠下的账和别人不肯说的话也是。",
        start: { money: 1, energy: 4, health: 3, craft: 1, care: 1, nerve: 0, insight: 1, master: 0, neighbor: 1, apprentice: 0 },
        flags: ["shop-owner"]
      }
    ],
    goals: [
      { id: "shop", label: "让修理铺撑到下一代", detail: "让铺子活下来，并留下一个能继续做事的基础。", target: 4, measure: "修理铺基础" },
      { id: "train", label: "让一个人学会接住这间铺子", detail: "把手艺、信任和一件具体的责任交给别人。", target: 3, measure: "传承进度" },
      { id: "truth", label: "把旧账里的一件事查清", detail: "不必揭开所有秘密，但要让一件事有来处、有证据。", target: 3, measure: "查证进度" }
    ],
    rounds: [
      {
        id: "arrival", phase: "start", title: "修理铺今天只来了一个人。", copy: "祁叔把一只停走的钟放在柜台上。你有时间做一件事，但没有时间把所有事都做完。",
        actions: [
          { id: "take-order", label: "先把这只钟修好", detail: "今天先让铺子有一点进账。", cost: "消耗 1 精力", preview: "+2 钱；目标“撑住铺子”+1", effect: { resources: { money: 2, energy: -1 }, goalPoints: { shop: 1 } }, result: "钟走起来了，祁叔把两枚硬币推到你面前。", future: "你有了周转钱，下一回合可以承担一笔材料开销。" },
          { id: "learn-craft", label: "跟祁叔学一遍", detail: "先学会判断坏在哪里，而不是急着换零件。", cost: "消耗 1 精力", preview: "+1 手艺；目标“传给别人”+1", effect: { resources: { energy: -1 }, traits: { craft: 1 }, relationships: { master: 1 }, flags: ["learned"] }, goalPoints: { train: 1 }, result: "你学会了听齿轮的声音。祁叔第一次把工具真正交到你手里。", future: "后面出现需要手艺的行动，也会更容易把经验交给别人。" },
          { id: "open-ledger", label: "翻开柜台下的旧账", detail: "先弄清楚这间铺子为什么总是差一口气。", cost: "消耗 1 精力", preview: "+1 洞察；目标“查清旧账”+1", effect: { resources: { energy: -1 }, traits: { insight: 1 }, flags: ["ledger"] }, goalPoints: { truth: 1 }, result: "旧账里反复出现同一个日期，墨水已经被水泡开。", future: "后面可以选择公开、保留或利用这份线索。" }
        ]
      },
      {
        id: "customer", phase: "start", title: "门口来了一个急着赶路的人。", copy: "他愿意多付钱，只要你今天把箱子里的东西修好。可你的手已经开始发酸。",
        actions: [
          { id: "rush-job", label: "接下这份急活", detail: "多赚一点钱，但今天会很累。", cost: "消耗 2 精力", preview: "+2 钱；目标“撑住铺子”+1", effect: { resources: { money: 2, energy: -2 }, goalPoints: { shop: 1 } }, result: "你赶在天黑前交了货，急着赶路的人没有问你的名字。", future: "钱能救急，但精力会影响后面的选择。" },
          { id: "rest", label: "关门半天，先休息", detail: "今天不赚钱，保留处理麻烦的力气。", cost: "放弃本回合收入", preview: "+2 精力；不会推进目标", effect: { resources: { energy: 2 } }, result: "你睡过了午后的钟声，醒来时手没有那么抖了。", future: "你保住了处理转折事件的余地。" },
          { id: "ask-neighbor", label: "请隔壁帮你看一会儿", detail: "钱要少分一点，但从今天开始有人认识你。", cost: "−1 钱，消耗 1 精力", preview: "+1 邻里；目标“传给别人”+1", effect: { resources: { money: -1, energy: -1 }, relationships: { neighbor: 1 }, flags: ["neighbor-help"] }, goalPoints: { train: 1 }, result: "隔壁的人替你守了半天门，也记住了你不把活全揽在自己身上。", future: "后面出现需要邻里帮忙的行动。" }
        ]
      },
      {
        id: "materials", phase: "build", title: "雨季前，桥边的木料涨价了。", copy: "修理铺需要一批木料，河桥也需要。你可以现在花钱买，也可以先欠下一笔人情。",
        actions: [
          { id: "buy-material", label: "用积蓄买下木料", detail: "不欠人情，但钱会立刻变少。", cost: "需要 2 钱", preview: "获得木料；修理铺基础+1；目标“撑住铺子”+1", requires: [{ type: "resource", key: "money", min: 2, label: "需要积蓄 2" }], effect: { resources: { money: -2 }, town: { shop: 1 }, flags: ["materials"] }, goalPoints: { shop: 1 }, result: "木料堆进后院，铺子终于有东西可以修，而不是只剩一张账单。", future: "下一次暴雨时，你可以把木料用在桥上。" },
          { id: "borrow-material", label: "向邻里借一批木料", detail: "先把材料拿到手，之后要还一个人情。", cost: "需要邻里关系 1", preview: "获得木料；邻里关系+1；目标“撑住铺子”+1", requires: [{ type: "relationship", key: "neighbor", min: 1, label: "需要邻里关系 1" }], effect: { relationships: { neighbor: 1 }, flags: ["materials", "debt"] }, goalPoints: { shop: 1 }, result: "木料送来了，邻居只说了一句：下次别等到涨水才开口。", future: "你保住了钱，但下一次必须回应这份人情。" },
          { id: "river-salvage", label: "去河边捡还能用的木料", detail: "不要钱，但河水不会替你小心。", cost: "−1 身体，−1 精力", preview: "获得木料；+1 胆量；河桥基础+1", effect: { resources: { health: -1, energy: -1 }, traits: { nerve: 1 }, town: { bridge: 1 }, flags: ["materials"] }, result: "你从浅水里拖回几块木板，手臂上多了一道擦伤。", future: "桥边有人第一次看见你愿意冒险做事。" }
        ]
      },
      {
        id: "apprentice", phase: "build", title: "一个比你小几岁的孩子来问：能不能学？", copy: "他没有钱，也不懂规矩，只会把拆下来的零件按大小排好。你可以把他当帮工，也可以把他当未来的人。",
        actions: [
          { id: "teach-apprentice", label: "教他从最简单的活开始", detail: "今天少做一单，把方法交出去。", cost: "−1 钱，−1 精力", preview: "+1 手艺，+1 学徒；目标“传给别人”+1", effect: { resources: { money: -1, energy: -1 }, traits: { craft: 1 }, relationships: { apprentice: 1 }, flags: ["apprentice"] }, goalPoints: { train: 1 }, result: "他把第一颗螺丝拧歪了，但没有把工具摔掉。", future: "只要继续教，他可能在最后一回合接住这间铺子。" },
          { id: "take-extra-jobs", label: "让他先打杂，自己接更多活", detail: "先把钱赚回来，手艺以后再说。", cost: "消耗 2 精力", preview: "+3 钱；目标“撑住铺子”+1", effect: { resources: { money: 3, energy: -2 }, goalPoints: { shop: 1 } }, result: "钱柜变沉了，孩子学会的是递工具和关门。", future: "钱能撑住铺子，但没人能自动替你接班。" },
          { id: "read-ledger", label: "把旧账读给他听", detail: "告诉他这间铺子过去欠下过什么。", cost: "需要先发现旧账；消耗 1 精力", preview: "+1 洞察，旧账被看见；目标“查清旧账”+1", requires: [{ type: "flag", key: "ledger", label: "需要先翻过旧账" }], effect: { resources: { energy: -1 }, traits: { insight: 1 }, town: { archive: 1 }, flags: ["clue"] }, goalPoints: { truth: 1 }, result: "孩子听不懂那几个名字，但记住了你没有把纸烧掉。", future: "公开旧账时，会有一个愿意作证的人。" }
        ]
      },
      {
        id: "rain", phase: "turn", title: "暴雨提前来了。", copy: "桥边的水已经漫过第一块石阶。修理铺、河桥和邻居，今晚只能先保住一件事。",
        actions: [
          { id: "repair-bridge", label: "拿木料去补桥", detail: "让别人能过河，但你会把自己暴露在水里。", cost: "需要木料和手艺；−1 身体，−2 精力", preview: "+河桥；+邻里；目标“撑住铺子”+1", requires: [{ type: "flag", key: "materials", label: "需要先准备木料" }, { type: "trait", key: "craft", min: 1, label: "需要手艺 1" }], effect: { resources: { health: -1, energy: -2 }, town: { bridge: 1, trust: 1 }, flags: ["bridge-repair"] }, goalPoints: { shop: 1 }, result: "桥没有完全修好，但第一批人踩着你钉下的木板过了河。", future: "小镇开始把你看成一个会解决问题的人。" },
          { id: "protect-shop", label: "先把修理铺封好", detail: "保住工具和材料，明天才有东西继续做。", cost: "需要 2 钱；−1 精力", preview: "修理铺基础+1；目标“撑住铺子”+1", requires: [{ type: "resource", key: "money", min: 2, label: "需要积蓄 2" }], effect: { resources: { money: -2, energy: -1 }, town: { shop: 1 }, flags: ["shop-safe"] }, goalPoints: { shop: 1 }, result: "雨水从门缝里进来，但最重要的工具都在干处。", future: "你保住了继续经营的底子，却没有解决桥的问题。" },
          { id: "organize-neighbors", label: "挨家挨户敲门", detail: "让大家一起搬东西、一起决定先救谁。", cost: "需要邻里关系 1；−1 精力", preview: "+2 邻里；目标“传给别人”+1", requires: [{ type: "relationship", key: "neighbor", min: 1, label: "需要邻里关系 1" }], effect: { resources: { energy: -1 }, relationships: { neighbor: 1 }, town: { trust: 2 }, flags: ["storm-network"] }, goalPoints: { train: 1 }, result: "最后一扇门被敲开时，整条街已经知道该把谁带到高处。", future: "以后遇到麻烦，不必每次都靠你一个人。" }
        ]
      },
      {
        id: "accounts", phase: "build", title: "雨停后，旧账翻到了最容易被撕掉的一页。", copy: "纸上有一个日期、一个水闸编号，还有一笔没有人承认的修桥钱。你现在可以让它见光，也可以先把它保护起来。",
        actions: [
          { id: "publish-accounts", label: "把账页贴到镇公所", detail: "证据一旦公开，就不再只由你保管。", cost: "需要线索；消耗 1 精力", preview: "+1 洞察，旧账+1；目标“查清旧账”+1", requires: [{ type: "flagAny", keys: ["clue", "ledger", "legacy-ledger"], label: "需要手里的旧账线索" }], effect: { resources: { energy: -1 }, traits: { insight: 1 }, town: { archive: 1 }, flags: ["public-account"] }, goalPoints: { truth: 1 }, result: "有人骂你多事，也有人把自己记得的另一半日期写在旁边。", future: "下一世可以从一份已经公开的记录开始，而不是从传闻开始。" },
          { id: "hide-pages", label: "把最危险的几页收起来", detail: "先保住证据，不让它和你一起被抹掉。", cost: "需要洞察 1；消耗 1 精力", preview: "+1 洞察；获得“湿账页”遗产候选", requires: [{ type: "trait", key: "insight", min: 1, label: "需要洞察 1" }], effect: { resources: { energy: -1 }, traits: { insight: 1 }, flags: ["hidden-account"] }, goalPoints: { truth: 1 }, result: "你把湿账页夹进工具箱最里面，谁也不知道你手上多了一件危险的东西。", future: "它不会立刻改变小镇，但会成为下一世的调查起点。" },
          { id: "sell-old-papers", label: "把旧纸卖给收废品的人", detail: "先换一笔钱，别让今天的生活输给昨天的真相。", cost: "不需要条件", preview: "+3 钱；目标“撑住铺子”+1；旧账−1", effect: { resources: { money: 3 }, town: { archive: -1 }, flags: ["papers-sold"] }, goalPoints: { shop: 1 }, result: "废纸按斤算钱，卖出去时比你想象得轻。", future: "你度过了眼前的难关，但这条线索不会再完整回来。" }
        ]
      },
      {
        id: "opportunity", phase: "turn", title: "铺子终于有了一个可以交出去的机会。", copy: "有人建议你把修理铺登记成正式作坊，也有人劝你离开镇子。留下和离开都不是错误，但它们会留下不同的下一步。",
        actions: [
          { id: "register-workshop", label: "把铺子登记成作坊", detail: "花钱换一个能继续传下去的名字。", cost: "需要修理铺基础 1；−2 钱", preview: "+1 手艺；修理铺基础+1；目标“撑住铺子”+1", requires: [{ type: "town", key: "shop", min: 1, label: "需要修理铺基础 1" }, { type: "resource", key: "money", min: 2, label: "需要积蓄 2" }], effect: { resources: { money: -2 }, traits: { craft: 1 }, town: { shop: 1 }, flags: ["workshop"] }, goalPoints: { shop: 1 }, result: "新牌子挂起来时，铺子第一次有了不只属于某一个人的名字。", future: "下一世可以从一个现成的作坊起步。" },
          { id: "let-apprentice-run", label: "让学徒试着管一天", detail: "你退到柜台后面，只在他真的需要时开口。", cost: "需要学徒关系 1；消耗 1 精力", preview: "+1 学徒；目标“传给别人”+1", requires: [{ type: "relationship", key: "apprentice", min: 1, label: "需要学徒关系 1" }], effect: { resources: { energy: -1 }, relationships: { apprentice: 1 }, flags: ["handoff"] }, goalPoints: { train: 1 }, result: "他把账算错了一次，但知道该先向客人道歉，再重新做。", future: "最后一回合可能出现真正的交接机会。" },
          { id: "leave-town", label: "收拾工具，去外地看看", detail: "离开不是放弃，只是把这一生的答案换一个地方继续问。", cost: "放弃本世经营机会", preview: "+1 胆量；下一世获得“外地见闻”起点", effect: { traits: { nerve: 1 }, flags: ["left-town"] }, result: "你把门锁好，没有保证一定会回来。", future: "下一世可以从外来的见闻和一笔不大的积蓄开始。" }
        ]
      },
      {
        id: "handoff", phase: "turn", title: "最后一回合，工具箱该交给谁？", copy: "你这一世不会把所有事情都做完。现在要决定的是：把成果留在自己手里，还是让下一双手承担它。",
        actions: [
          { id: "repair-last-order", label: "接下最后一单活", detail: "让今天结束得体面一点，也让铺子多一笔周转。", cost: "消耗 1 精力", preview: "+2 钱；目标“撑住铺子”+1", effect: { resources: { money: 2, energy: -1 }, goalPoints: { shop: 1 } }, result: "最后一单是一只旧钟。它走得不准，但至少没有停。", future: "你留下的是一间还可以继续开门的铺子。" },
          { id: "hand-over-tools", label: "把工具箱交给学徒", detail: "让他接手一件具体的东西，而不是只听你讲道理。", cost: "需要学徒关系 2 或作坊基础", preview: "+2 传承；获得“工具箱”遗产候选", requires: [{ type: "any", requirements: [{ type: "relationship", key: "apprentice", min: 2 }, { type: "flag", key: "workshop" }], label: "需要学徒关系 2或已有作坊" }], effect: { relationships: { apprentice: 1 }, town: { shop: 1, trust: 1 }, flags: ["handed-tools"] }, goalPoints: { train: 2 }, result: "他接过工具箱，先问的不是能修什么，而是坏了该向谁说明。", future: "下一世可以直接从一件会被使用的工具开始。" },
          { id: "finish-last-page", label: "把最后一页写完整", detail: "给日期、名字和水闸编号一个能被别人核对的结尾。", cost: "需要洞察 2或旧账线索；消耗 1 精力", preview: "+1 旧账；目标“查清旧账”+1；获得“完整记录”候选", requires: [{ type: "any", requirements: [{ type: "trait", key: "insight", min: 2 }, { type: "flagAny", keys: ["clue", "ledger"], label: "需要洞察 2或旧账线索" }], label: "需要洞察 2或旧账线索" }], effect: { resources: { energy: -1 }, traits: { insight: 1 }, town: { archive: 1 }, flags: ["complete-record"] }, goalPoints: { truth: 1 }, result: "你没有写下结论，只写下了别人可以重新查证的来处。", future: "下一世可以从一份完整记录开始追问。" }
        ]
      }
    ],
    legacies: [
      { id: "work-habit", label: "做事的习惯", detail: "下一世精力+1，并更容易处理第一个麻烦。", nextUse: "让下一世开局多一次稳住自己的余地。", requires: [], effect: { resources: { energy: 1 }, flags: ["legacy-habit"] } },
      { id: "small-tool", label: "一件趁手工具", detail: "下一世手艺+1，起步时可以少走一点弯路。", nextUse: "让下一世从一个具体的能力开始。", requires: [], effect: { traits: { craft: 1 }, flags: ["legacy-small-tool"] } },
      { id: "old-address", label: "一个可以敲开的住址", detail: "下一世邻里关系+1，遇到难处时有人回应。", nextUse: "让下一世第一个请求不必从陌生人开始。", requires: [], effect: { relationships: { neighbor: 1 }, flags: ["legacy-address"] } },
      { id: "toolbox", label: "祁叔的工具箱", detail: "下一世手艺+1，第一回合修理行动会更有余地。", nextUse: "让下一世一开始就能靠手艺赚钱。", requires: [{ type: "any", requirements: [{ type: "flag", key: "handed-tools" }, { type: "trait", key: "craft", min: 2 }], label: "需要交接工具或手艺 2" }], effect: { traits: { craft: 1 }, flags: ["legacy-toolbox"] } },
      { id: "apprentice-notebook", label: "学徒的第一本笔记", detail: "下一世传承关系+1，遇到学徒时更容易接住机会。", nextUse: "让下一世更早遇到愿意学的人。", requires: [{ type: "relationship", key: "apprentice", min: 1 }], effect: { relationships: { apprentice: 1 }, flags: ["legacy-notebook"] } },
      { id: "customer-list", label: "老客户名单", detail: "下一世开局钱+1，但你会从一件旧承诺开始。", nextUse: "让下一世第一阶段更容易周转。", requires: [{ type: "resource", key: "money", min: 4 }], effect: { resources: { money: 1 }, flags: ["legacy-customers"] } },
      { id: "wet-ledger", label: "湿账页", detail: "下一世洞察+1，并保留一条查账线索。", nextUse: "让下一世不用从传闻开始调查。", requires: [{ type: "flag", key: "hidden-account" }], effect: { traits: { insight: 1 }, flags: ["legacy-ledger"] } },
      { id: "town-key", label: "旧作坊钥匙", detail: "下一世修理铺基础+1，并直接拥有一个可进入的地点。", nextUse: "让下一世从现成的作坊开始，而不是从门外开始。", requires: [{ type: "town", key: "shop", min: 2 }], effect: { town: { shop: 1 }, flags: ["legacy-key"] } },
      { id: "complete-record", label: "完整记录", detail: "下一世旧账基础+1，并能从公开事实继续追问。", nextUse: "让下一世的调查行动少走一步弯路。", requires: [{ type: "flag", key: "complete-record" }], effect: { town: { archive: 1 }, traits: { insight: 1 }, flags: ["legacy-record"] } },
      { id: "outside-view", label: "外地见闻", detail: "下一世胆量+1，开局拥有一笔小积蓄。", nextUse: "让下一世更容易选择离开或带回新办法。", requires: [{ type: "flag", key: "left-town" }], effect: { resources: { money: 1 }, traits: { nerve: 1 }, flags: ["legacy-outside"] } },
      { id: "warm-letter", label: "一封没有寄出的信", detail: "下一世邻里关系+1，遇到困难时有人愿意回应。", nextUse: "让下一世不用独自面对第一个麻烦。", requires: [{ type: "relationship", key: "neighbor", min: 1 }], effect: { relationships: { neighbor: 1 }, flags: ["legacy-letter"] } }
    ]
  };
})();
