(function (global) {
  "use strict";

  if (global.EchoTownStrategy) return;
  const CONTENT = global.EchoTownContent;
  if (!CONTENT) throw new Error("strategy.js requires content.js");

  const VERSION = 1;
  const ROUTES = [
    { id: "craft", label: "手艺谋生", detail: "从修好一件东西，到靠手艺生活，再把方法交出去。" },
    { id: "study", label: "学业职业", detail: "让学习成为方法、工作和能够留下的专业成果。" },
    { id: "community", label: "关系共建", detail: "学习求助、共同分担，再把可以合作的日常留给小镇。" },
  ];
  const STAGES = CONTENT.stages.map(function (stage) { return stage.id; });
  const RELATION_KEYS = Object.keys(CONTENT.relationships);
  const GOAL_STATUSES = ["achieved", "missed", "legacy-settled"];
  const CHAIN_ENDINGS = {
    "chain-craft-workshop": {
      chainId: "craft-orders", routeId: "craft",
      success: { id: "craft-orders-delivered", label: "维修单成了交付约定", copy: "少年时写下的维修步骤经过试修，第一批订单按约交付；修理铺和集市获得新的基础。" },
      failure: { id: "craft-orders-rework", label: "返工也写进维修单", copy: "试修记录没有解决所有问题，第一批订单仍需返工；这次投入已经发生，压力增加，作坊成果尚未达成。" },
    },
    "chain-study-report": {
      chainId: "study-method", routeId: "study",
      success: { id: "study-report-verified", label: "笔记经得起核对", copy: "少年时的学习方法经过试讲，终于用于核对旧账；两页可以复查的证据进入镇志。" },
      failure: { id: "study-report-unresolved", label: "把未证实的部分留下", copy: "这次核对还缺少关键证据。你记录了疑点，但没有把推测写成调查成果；压力增加。" },
    },
    "chain-community-flood": {
      chainId: "community-roster", routeId: "community",
      success: { id: "community-roster-worked", label: "名单变成了互相照应", copy: "河流队的约定经过家庭分工，终于在洪水中派上用场；邻里、河桥与集市得到实际帮助。" },
      failure: { id: "community-roster-gaps", label: "分工里还有空缺", copy: "旧名单没有覆盖所有变化，协作一度脱节。你记住了需要补上的位置；这次未形成公共成果，压力增加。" },
    },
  };

  function consequenceDefinition(life, sourceId, success, round, variantId) {
    const chain = CHAIN_ENDINGS[sourceId];
    const original = success ? chain.success : chain.failure;
    const recorded = (life.actions || []).find(function (entry) { return entry.actionId === sourceId && entry.round === round + 1; });
    const id = variantId || recorded?.journeyVariant;
    const variant = global.EchoTownJourney?.getVariantDefinitions().find(function (entry) { return entry.id === id && entry.actionId === sourceId; });
    return variant ? Object.assign({}, original, { label: variant.label + (success ? " · 已完成" : " · 尚未完成"), copy: success ? variant.test.successText : variant.test.failureText }) : original;
  }

  function eventAction(config) {
    return Object.assign({ requires: [], effect: {}, goalPoints: {}, tags: [], test: null }, config);
  }

  function appendAction(roundId, action) {
    const round = CONTENT.rounds.find(function (item) { return item.id === roundId; });
    if (!round) throw new Error("Unknown strategy round: " + roundId);
    if (!round.actions.some(function (item) { return item.id === action.id; })) round.actions.push(eventAction(action));
  }

  function evidenceRequirement(id, success) {
    return { type: "evidence", ids: [id], kind: "event", success: success === null ? null : true, min: 1, label: success === null ? "需要完成前一段经历（成功或失败均可）" : "需要完成前一段经历" };
  }

  function skillRequirement(key, min) {
    return { type: "skill", key: key, min: min, label: "需要" + CONTENT.skills[key].label + " " + min };
  }

  function addContent() {
    CONTENT.rounds.forEach(function (round) {
      appendAction(round.id, {
        id: "steady-" + round.id, label: "先把眼前的日子稳住",
        detail: "暂不承担这件事，不消耗资源，也不提供新的成长或成果证据。",
        cost: "无资源支出 · 无前置条件", preview: "保留当前资源，继续下一段人生",
        result: "你给自己留了余地。这一回没有新增承诺，也没有新增成果。",
        future: "你仍可以在以后的节点重新选择方向。", tags: ["保守安排"],
        strategy: { conservative: true },
      });
    });

    appendAction("adolescence-exam", {
      id: "chain-craft-promise", label: "和祁叔写下维修步骤", detail: "先把检查顺序写清楚，以后遇到同样的故障再回来核对。",
      cost: "精力 −1", preview: "手艺 +1，师长 +1；21 岁可继续试修", effect: { resources: { energy: -1 }, skills: { craft: 1 }, relationships: { mentor: 1 } },
      result: "祁叔在纸边补了一句：修好了也要说清为什么。", future: "21 岁时，你可以拿这份记录试修一辆旧车。",
      tags: ["手艺", "维修约定"], strategy: { routeId: "craft", chainId: "craft-orders", step: 1 },
    });
    appendAction("youth-mentor", {
      id: "chain-craft-trial", label: "照着旧维修单试修", detail: "用真实故障检验少年时的步骤，无论结果如何都保留记录。",
      requires: [evidenceRequirement("chain-craft-promise")], cost: "精力 −2 · 手艺检定 5", preview: "成功：钱 +4、手艺 +1；失败：压力 +1；36 岁可继续接单",
      effect: { resources: { energy: -2 } }, test: { skill: "craft", difficulty: 5, label: "试修检定", success: { resources: { money: 4 }, skills: { craft: 1 } }, failure: { resources: { pressure: 1 } }, successText: "旧车通过了试骑，车主付了维修费。", failureText: "旧车仍有异响，你把未解决的故障写了下来。" },
      result: "维修单从一张纸变成了一次真实尝试。", future: "36 岁时可以带着这次成功或失败的记录接第一批订单。",
      tags: ["手艺", "试修"], strategy: { routeId: "craft", chainId: "craft-orders", step: 2 },
    });
    appendAction("middle-store", {
      id: "chain-craft-workshop", label: "按试修记录接第一批订单", detail: "把费用和交付要求写在同一张单上，再检验自己的方法。",
      requires: [evidenceRequirement("chain-craft-trial", null), skillRequirement("craft", 4)], cost: "钱 −10 · 精力 −1 · 手艺检定 7", preview: "成功：钱 +6、手艺 +1、修理铺 +2、集市 +1；失败：压力 +2",
      effect: { resources: { money: -10, energy: -1 } }, test: { skill: "craft", difficulty: 7, label: "订单交付检定", success: { resources: { money: 6 }, skills: { craft: 1 }, town: { shop: 2, market: 1 } }, failure: { resources: { pressure: 2 } }, successText: "第一批订单按约交付，维修单成了店里的共同方法。", failureText: "订单需要返工，投入已发生，你没有把未完成的订单记成成果。" },
      result: "最初那张维修单一直留在柜台边。", future: "这次订单的实际结果会留在人生回顾里。",
      tags: ["手艺", "经营"], strategy: { routeId: "craft", chainId: "craft-orders", step: 3 },
    });

    appendAction("adolescence-exam", {
      id: "chain-study-plan", label: "把错题整理成学习方法", detail: "不只记住答案，还写下什么时候应该换一种解法。",
      cost: "精力 −1 · 压力 +1", preview: "学识 +1；21 岁可用这份笔记试讲", effect: { resources: { energy: -1, pressure: 1 }, skills: { study: 1 } },
      result: "林老师请你保留那些没有马上解开的题。", future: "21 岁时，你可以把这套方法讲给真实的学习者。",
      tags: ["学习", "方法"], strategy: { routeId: "study", chainId: "study-method", step: 1 },
    });
    appendAction("youth-mentor", {
      id: "chain-study-trial", label: "用少年笔记给学生试讲", detail: "能自己做对，也要接受别人还听不懂的可能。",
      requires: [evidenceRequirement("chain-study-plan")], cost: "精力 −2 · 学识检定 5", preview: "成功：钱 +4、学识 +1、晚辈 +1；失败：压力 +1；49 岁可继续核验旧账",
      effect: { resources: { energy: -2 } }, test: { skill: "study", difficulty: 5, label: "试讲检定", success: { resources: { money: 4 }, skills: { study: 1 }, relationships: { child: 1 } }, failure: { resources: { pressure: 1 } }, successText: "学生自己解开了下一题，家长付了这次辅导费。", failureText: "学生仍没有听懂，你记下了需要重讲的部分。" },
      result: "笔记里多了一种与你不同的理解方式。", future: "49 岁时，这次试讲记录可以成为核对旧账的方法起点。",
      tags: ["学习", "试讲"], strategy: { routeId: "study", chainId: "study-method", step: 2 },
    });
    appendAction("middle-ledger", {
      id: "chain-study-report", label: "用多年笔记核对旧账", detail: "沿用经历过试讲的方法，把结论和证据逐项对齐。",
      requires: [evidenceRequirement("chain-study-trial", null)], cost: "精力 −2 · 学识检定 7", preview: "成功：学识 +1、镇志 +2；失败：压力 +1",
      effect: { resources: { energy: -2 } }, test: { skill: "study", difficulty: 7, label: "证据核验检定", success: { skills: { study: 1 }, town: { archive: 2 } }, failure: { resources: { pressure: 1 } }, successText: "证据与编号逐项吻合，你把可以复查的结论交给镇志。", failureText: "关键编号仍对不上，你保留疑点，没有发布未经证实的结论。" },
      result: "少年时的笔记终于碰到了一个需要认真回答的成年问题。", future: "核验成功或证据不足都会作为真实经历留在回顾里。",
      tags: ["学识", "专业成果"], strategy: { routeId: "study", chainId: "study-method", step: 3 },
    });

    appendAction("adolescence-club", {
      id: "chain-community-promise", label: "和河流队写一张轮值表", detail: "先问清谁能在什么时候帮忙，再把承诺写下来。",
      cost: "精力 −1", preview: "体谅 +1、邻里 +1；32 岁可继续学习家庭分工", effect: { resources: { energy: -1 }, skills: { empathy: 1 }, relationships: { neighbor: 1 } },
      result: "第一次轮值没有英雄，只有彼此记住时间的人。", future: "32 岁时，你可以把这次协作方法用在家人的照料里。",
      tags: ["关系", "共同承担"], strategy: { routeId: "community", chainId: "community-roster", step: 1 },
    });
    appendAction("middle-family", {
      id: "chain-community-roster", label: "参照轮值表商量家庭分工", detail: "不用一个人的保证代替所有人的时间。",
      requires: [evidenceRequirement("chain-community-promise")], cost: "精力 −1 · 体谅检定 5", preview: "成功：家人 +2、压力 −1；失败：压力 +1；47 岁可继续组织协作",
      effect: { resources: { energy: -1 } }, test: { skill: "empathy", difficulty: 5, label: "共同分工检定", success: { resources: { pressure: -1 }, relationships: { family: 2 } }, failure: { resources: { pressure: 1 } }, successText: "家人认领了各自能承担的时间，事情终于不用一个人硬扛。", failureText: "几个人的时间仍对不上，这次分工没有谈成。" },
      result: "你把能做到和暂时做不到的部分都留在表里。", future: "47 岁时，这次分工的经验可以用来组织洪水中的协作。",
      tags: ["家人", "分工"], strategy: { routeId: "community", chainId: "community-roster", step: 2 },
    });
    appendAction("middle-flood", {
      id: "chain-community-flood", label: "按共同名单组织疏散", detail: "把少年轮值和家庭分工的经验用在真正紧急的一晚。",
      requires: [evidenceRequirement("chain-community-roster", null)], cost: "精力 −2 · 体谅检定 7", preview: "成功：邻里 +3、河桥 +1、集市 +1；失败：压力 +2",
      effect: { resources: { energy: -2 } }, test: { skill: "empathy", difficulty: 7, label: "协作疏散检定", success: { relationships: { neighbor: 3 }, town: { bridge: 1, market: 1 } }, failure: { resources: { pressure: 2 } }, successText: "需要帮助的人都有了接应，合作没有停在一张名单上。", failureText: "旧名单遗漏了新的住户，协作一度脱节，还需要重新组织。" },
      result: "你终于知道，一张名单必须跟着人的生活一起更新。", future: "协作是否奏效会作为这条约定的实际结果留在回顾里。",
      tags: ["关系", "公共成果"], strategy: { routeId: "community", chainId: "community-roster", step: 3 },
    });

    appendAction("childhood-school", {
      id: "legacy-tool-practice", label: "照旧工具的刻痕练一次拆装", detail: "上一世留下的工具多了一条可以直接照做的路径。",
      requires: [{ type: "legacy", id: "small-tool", label: "需要继承一件趁手工具" }], cost: "精力 −1", preview: "手艺 +1、师长 +1；留下实际动手证据", effect: { resources: { energy: -1 }, skills: { craft: 1 }, relationships: { mentor: 1 } },
      result: "你按刻痕把零件放回原位，第一次知道前人为什么要留下这些记号。", future: "这次动手可以作为童年手艺成果的经历证据。", tags: ["遗产", "手艺"], strategy: { routeId: "craft", legacyId: "small-tool" },
    });
    appendAction("adolescence-exam", {
      id: "legacy-notebook-method", label: "沿着旧批注整理自己的方法", detail: "保留前人的疑问，再用自己的例子把它讲清楚。",
      requires: [{ type: "legacy", id: "study-notebook", label: "需要继承写满批注的笔记" }], cost: "精力 −1", preview: "学识 +1；可作为 21 岁试讲的替代入口", effect: { resources: { energy: -1 }, skills: { study: 1 } },
      result: "你没有照抄旧答案，而是在批注旁写下了自己的检验办法。", future: "这份方法同样能打开 21 岁的试讲机会。", tags: ["遗产", "学习"], strategy: { routeId: "study", legacyId: "study-notebook" },
    });
    const studyTrial = CONTENT.rounds.find(function (round) { return round.id === "youth-mentor"; }).actions.find(function (action) { return action.id === "chain-study-trial"; });
    studyTrial.requires = [{ type: "evidence", ids: ["chain-study-plan", "legacy-notebook-method"], kind: "event", min: 1, label: "需要少年时整理过学习方法，或使用过继承的笔记" }];
    appendAction("middle-family", {
      id: "legacy-letter-share", label: "照旧信里的约定安排共同照料", detail: "从信里留下的一句叮嘱开始，把家人的分工落下来。",
      requires: [{ type: "legacy", id: "friend-letter", label: "需要继承没有寄出的信" }], cost: "精力 −1", preview: "体谅 +1、家人 +2、压力 −1；不要求既有体谅技能", effect: { resources: { energy: -1, pressure: -1 }, skills: { empathy: 1 }, relationships: { family: 2 } },
      result: "每个人认领了能做的一步，信里的约定第一次成为可以共享的照料方法。", future: "这次实际分工可以与后来的关系沟通共同构成阶段成果。", tags: ["遗产", "分工"], strategy: { routeId: "community", legacyId: "friend-letter" },
    });

    const relationshipPairs = [];
    RELATION_KEYS.forEach(function (key, index) { RELATION_KEYS.slice(index + 1).forEach(function (other) {
      relationshipPairs.push({ type: "all", requirements: [{ type: "relationship", key: key, min: 5 }, { type: "relationship", key: other, min: 5 }] });
    }); });
    [
      { routeId: "craft", label: "留一份可以照做的维修册", detail: "把方法、检查步骤与需要避开的错误交出去。", requires: [skillRequirement("craft", 6)], result: "你把维修册留在工具旁，后来的人可以从第一步开始核对。" },
      { routeId: "study", label: "把自己的方法整理成教材", detail: "给结论写上依据，也给仍不知道的事留出位置。", requires: [skillRequirement("study", 6)], result: "你的教材写出了能验证的步骤，没有把不确定的部分藏起来。" },
      { routeId: "community", label: "交出一份共同照料的联系表", detail: "写清谁愿意帮助谁，让熟悉的人能够继续彼此联络。", requires: [{ type: "any", requirements: relationshipPairs, label: "需要至少两类关系达到 5" }], result: "名单里的关系已经存在，后来的人知道可以从谁开始商量。" },
    ].forEach(function (handoff) {
      appendAction("later-final", { id: "handoff-" + handoff.routeId, label: handoff.label, detail: handoff.detail, requires: handoff.requires, cost: "无资源支出", preview: "留下本路线的实际交接证据；不额外增加数值", result: handoff.result, future: "这份交接会进入本世成果与结局评价。", tags: ["交接"], strategy: { routeId: handoff.routeId, handoff: true } });
    });

    const legacyCopy = {
      "small-tool": { detail: "下一世手艺 +2，携带趁手工具；8 岁可以沿工具刻痕练习拆装。", nextUse: "8 岁学校事件增加一项手艺实践选择。" },
      "study-notebook": { detail: "下一世学识 +2，携带笔记本；13 岁可以整理旧批注，打开 21 岁试讲的替代入口。", nextUse: "13 岁学习事件增加一项方法整理选择。" },
      "friend-letter": { detail: "下一世朋友关系 +2，并携带旧手机；32 岁可以照信里的约定安排共同照料。", nextUse: "32 岁家庭事件增加不要求既有体谅技能的照料选择。" },
    };
    CONTENT.legacies.forEach(function (legacy) { if (legacyCopy[legacy.id]) Object.assign(legacy, legacyCopy[legacy.id]); });
  }

  addContent();

  function stat(group, key, min, label) { return { type: "stat", group: group, key: key, min: min, label: label }; }
  function proof(ids, label, options) { return Object.assign({ type: "proof", ids: ids, kind: "event", min: 1, success: true, label: label }, options || {}); }
  function any(label, conditions) { return { type: "any", conditions: conditions, label: label }; }
  function all(label, conditions) { return { type: "all", conditions: conditions, label: label }; }
  function job(id, count, label) { return proof([id], label, { kind: "job", min: count, distinctRounds: true }); }
  function goal(routeId, stageId, label, detail, conditions) { return { id: routeId + ":" + stageId, routeId: routeId, stageId: stageId, label: label, detail: detail, conditions: conditions }; }
  const FAMILY_PROOF = ["share-notes", "ask-for-help", "invite-shy-child", "comfort-friend", "stay-for-family", "mentor-newcomer", "keep-friendship", "confess-love", "ask-family-share", "legacy-letter-share", "talk-through", "support-choice", "organize-evacuation", "chain-community-flood", "invite-town-alumni", "call-family", "handoff-community"];
  const GOALS = [
    goal("craft", "childhood", "动手解决一个问题", "实际修过东西，而不只拥有先天手艺。", [stat("skills", "craft", 2, "手艺达到 2"), proof(["fix-radio", "repair-lantern", "legacy-tool-practice"], "完成一次实际拆装或修理")]),
    goal("study", "childhood", "形成自己的学习方法", "关键学习选择或持续练习形成自己的方法。", [stat("skills", "study", 3, "学识达到 3"), any("坐到第一排，或在两个节点主动学习", [proof(["front-seat"], "坐到第一排"), proof(["routine-study"], "两个不同节点学习", { kind: "life", min: 2, distinctRounds: true })])]),
    goal("community", "childhood", "学会求助与回应", "一次具体回应，比预先拥有好关系更重要。", [stat("skills", "empathy", 2, "体谅达到 2"), proof(["share-notes", "ask-for-help", "invite-shy-child"], "借笔记、主动求助或邀请害羞的孩子")]),
    goal("craft", "adolescence", "挣到第一笔手艺工资", "把练习用在别人真正需要的地方。", [stat("skills", "craft", 4, "手艺达到 4"), job("shop-shift", 1, "少年阶段完成一次修理铺工作")]),
    goal("study", "adolescence", "取得下一程资格", "升学或有偿辅导，都需要真正完成一次尝试。", [stat("skills", "study", 4, "学识达到 4"), any("申请奖学金、成功升学，或完成辅导工作", [proof(["ask-scholarship", "leave-for-school"], "完成升学准备或升学检定"), job("tutor-shift", 1, "完成一次辅导工作")])]),
    goal("community", "adolescence", "共同承担一件事", "维持关系，也为一个具体约定付出行动。", [stat("skills", "empathy", 3, "体谅达到 3"), { type: "relation-count", min: 4, count: 1, label: "至少一类关系达到 4" }, proof(["comfort-friend", "join-river-team", "stay-for-family", "chain-community-promise"], "实际安慰、照料或参加协作")]),
    goal("craft", "youth", "靠本事维持生活", "做过工作，并为下一笔日常支出留出准备。", [stat("skills", "craft", 5, "手艺达到 5"), job("shop-shift", 2, "初入社会阶段完成两次修理铺工作"), { type: "reserve", label: "现金足够下一节点的生活费" }]),
    goal("study", "youth", "把知识用于工作", "知识经过真实工作，而不只停在技能数字上。", [stat("skills", "study", 5, "学识达到 5"), any("完成两次辅导，或一次辅导后获得晋升", [job("tutor-shift", 2, "两次辅导工作"), all("辅导后晋升", [job("tutor-shift", 1, "一次辅导工作"), proof(["take-promotion"], "接受晋升")])])]),
    goal("community", "youth", "建立可靠协作", "能力与两次实际关系投入一起构成合作。", [stat("skills", "empathy", 4, "体谅达到 4"), stat("skills", "expression", 3, "表达达到 3"), proof(["mentor-newcomer", "community-speech"], "带过新人或完成公开说明"), proof(["routine-social", "routine-care"], "在两个不同节点维护关系", { kind: "life", min: 2, distinctRounds: true })]),
    goal("craft", "middle", "经营开始稳定", "成功开办作坊或交付开张订单后，还要继续工作；小单返修不等于开张。", [stat("skills", "craft", 7, "手艺达到 7"), { type: "ordered-proof", firstIds: ["open-workshop", "chain-craft-workshop"], excludeJourneyVariants: ["journey-craft-repair-v1"], nextIds: ["shop-shift", "project-craft-shift"], nextKind: "job", label: "成功开张后，在较晚节点再做一次修理工作（小单返修不计开张）" }, { type: "reserve", label: "现金足够下一节点的生活费" }]),
    goal("study", "middle", "完成一项专业成果", "用学习核验旧事，或在稳定职业中持续传授。", [stat("skills", "study", 7, "学识达到 7"), any("完成旧账核验，或稳定职业后两次辅导", [proof(["trace-watergate", "chain-study-report"], "完成可验证的调查"), { type: "ordered-proof", firstIds: ["change-career"], nextIds: ["tutor-shift"], nextKind: "job", min: 2, label: "稳定职业后的两个节点完成辅导" }])]),
    goal("community", "middle", "把责任共同分出去", "协作要在实际压力中落地。", [stat("skills", "empathy", 6, "体谅达到 6"), any("组织疏散，或完成家庭分担与关系沟通", [proof(["organize-evacuation", "chain-community-flood"], "完成公共协作"), all("家庭分担并认真沟通", [proof(["ask-family-share", "legacy-letter-share", "chain-community-roster"], "完成家庭分担"), proof(["talk-through"], "完成关系沟通")])])]),
    goal("craft", "later", "把方法交给后来人", "既可以带出接班人，也可以留下一份可照做的维修册。", [stat("skills", "craft", 6, "手艺达到 6"), any("完成接班、赠予工具且有晚辈接应，或 75 岁交接维修册", [proof(["train-successor", "handoff-craft"], "完成手艺交接"), all("赠予工具且有晚辈接应", [proof(["give-away-tools"], "赠予工具"), stat("relationships", "child", 3, "晚辈关系达到 3")])])]),
    goal("study", "later", "留下可传授的成果", "把积累整理到别人能够继续使用的地方。", [stat("skills", "study", 6, "学识达到 6"), proof(["save-school", "record-life", "handoff-study"], "保住学校、记录人生或 75 岁交接教材")]),
    goal("community", "later", "让关系继续运转", "关系已有基础，也做过一次真正的重新联络或交接。", [{ type: "relation-count", min: 5, count: 2, label: "至少两类关系达到 5" }, proof(["invite-town-alumni", "call-family", "handoff-community"], "邀请校友、联系家人或 75 岁交接联系表")]),
  ];

  CONTENT.strategy = { version: VERSION, routes: ROUTES, goals: GOALS, trainingCaps: { childhood: 4, adolescence: 6, youth: 8, middle: 10, later: 10 }, naturalRecovery: 3, chains: [
    { id: "craft-orders", routeId: "craft", label: "维修单的三次检验", ages: [13, 21, 36], actionIds: ["chain-craft-promise", "chain-craft-trial", "chain-craft-workshop"] },
    { id: "study-method", routeId: "study", label: "从错题到可核验的旧账", ages: [13, 21, 49], actionIds: ["chain-study-plan", "chain-study-trial", "chain-study-report"] },
    { id: "community-roster", routeId: "community", label: "一张轮值表的三次分工", ages: [15, 32, 47], actionIds: ["chain-community-promise", "chain-community-roster", "chain-community-flood"] },
  ] };

  function boundedRound(value) { const n = Number(value); return Number.isInteger(n) && n >= 0 && n < CONTENT.rounds.length ? n : 0; }
  function stageOfRound(round) { return CONTENT.rounds[boundedRound(round)].stage; }
  function currentStage(life) { return stageOfRound(life.round); }
  function validRoute(id) { return ROUTES.some(function (route) { return route.id === id; }); }
  function defaultRoute(life) {
    if (life.goalId === "home" || life.goalId === "connection" || life.goalId === "town") return "community";
    if (Number(life.skills && life.skills.craft || 0) > Number(life.skills && life.skills.study || 0)) return "craft";
    return "study";
  }
  function canonicalKind(kind, id) {
    if (["job", "work"].includes(kind)) return "job";
    if (["life", "life-action", "LIFE_ACTION"].includes(kind)) return CONTENT.jobs.concat(global.EchoTownProjects?.getJobDefinitions?.() || []).some(function (job) { return job.id === id; }) ? "job" : "life";
    if (["event", "EVENT_ACTION", "event-action"].includes(kind)) return "event";
    if (["opportunity", "OPPORTUNITY"].includes(kind)) return "opportunity";
    return "";
  }
  function sourceFor(id, kind, round) {
    if (kind === "event") return CONTENT.rounds[round].actions.find(function (action) { return action.id === id; });
    const list = kind === "job" ? CONTENT.jobs.concat(global.EchoTownProjects?.getJobDefinitions?.() || []) : kind === "life" ? CONTENT.lifeActions.concat(global.EchoTownProjects?.getLifeActionDefinitions?.() || []) : kind === "opportunity" ? CONTENT.opportunities : [];
    return list.find(function (action) { return action.id === id; });
  }
  function normalizeEvidence(entries) {
    const seen = new Set();
    return (Array.isArray(entries) ? entries : []).filter(function (entry) {
      if (!entry || !Number.isInteger(entry.round) || entry.round < 0 || entry.round >= CONTENT.rounds.length) return false;
      const kind = canonicalKind(entry.kind, entry.id);
      const source = sourceFor(entry.id, kind, entry.round);
      const key = entry.round + ":" + kind + ":" + entry.id;
      if (!source || seen.has(key)) return false;
      if (source.test && typeof entry.success !== "boolean") return false;
      seen.add(key);
      return true;
    }).slice(0, 256).map(function (entry) {
      const kind = canonicalKind(entry.kind, entry.id);
      return { id: entry.id, kind: kind, round: entry.round, success: entry.success !== false };
    });
  }

  function initLife(life, options) {
    if (!life || typeof life !== "object") return null;
    const old = life.strategy && typeof life.strategy === "object" ? life.strategy : {};
    const strategy = {
      version: VERSION, routeId: validRoute(old.routeId) ? old.routeId : defaultRoute(life), goals: {},
      evidence: normalizeEvidence(old.evidence), consequences: [],
      migratedThroughStage: STAGES.includes(old.migratedThroughStage) ? old.migratedThroughStage : null,
    };
    GOALS.forEach(function (definition) {
      const saved = old.goals && old.goals[definition.id];
      if (saved && GOAL_STATUSES.includes(saved.status)) strategy.goals[definition.id] = {
        status: saved.status, round: boundedRound(saved.round), checks: Array.isArray(saved.checks) ? saved.checks.slice(0, definition.conditions.length).map(Boolean) : [],
      };
    });
    const migration = life.migration || {};
    if ((options && options.migrated) || migration.deferGoals) {
      const cutoff = STAGES.includes(migration.stageId) ? migration.stageId : stageOfRound(Number.isInteger(migration.round) ? migration.round : life.round);
      strategy.migratedThroughStage = strategy.migratedThroughStage || cutoff;
    }
    if (strategy.migratedThroughStage) {
      const through = STAGES.indexOf(strategy.migratedThroughStage);
      GOALS.forEach(function (definition) {
        const activeHere = migration.goalAccessVersion === 1 && definition.stageId === migration.stageId && (migration.activeGoalIds || []).includes(definition.id);
        if (STAGES.indexOf(definition.stageId) <= through && !activeHere && !strategy.goals[definition.id]) strategy.goals[definition.id] = {
          status: "legacy-settled", round: boundedRound(Number.isInteger(migration.round) ? migration.round : life.round), checks: [],
        };
      });
    }
    strategy.evidence.forEach(function (entry) {
      const chain = entry.kind === "event" && CHAIN_ENDINGS[entry.id];
      if (chain) strategy.consequences.push({ id: (entry.success ? chain.success : chain.failure).id, round: entry.round, success: entry.success });
    });
    life.strategy = strategy;
    return strategy;
  }

  function record(life, event) {
    if (!life || !event || typeof event.id !== "string") return { recorded: false, consequences: [] };
    if (!life.strategy || life.strategy.version !== VERSION) initLife(life);
    const round = Number.isInteger(event.round) ? event.round : boundedRound(life.round);
    if (round !== boundedRound(life.round) || round < 0 || round >= CONTENT.rounds.length) return { recorded: false, consequences: [] };
    const kind = canonicalKind(event.kind, event.id);
    const source = sourceFor(event.id, kind, round);
    if (!source || (source.test && typeof event.success !== "boolean")) return { recorded: false, consequences: [] };
    const exists = life.strategy.evidence.some(function (entry) { return entry.id === event.id && entry.kind === kind && entry.round === round; });
    if (exists) return { recorded: false, consequences: [] };
    const evidence = { id: event.id, kind: kind, round: round, success: event.success !== false };
    life.strategy.evidence.push(evidence);
    const chain = kind === "event" && CHAIN_ENDINGS[event.id];
    const consequences = [];
    if (chain) {
      const consequence = Object.assign({}, consequenceDefinition(life, event.id, evidence.success, round, event.journeyVariant), { chainId: chain.chainId, routeId: chain.routeId, sourceActionId: event.id, round: round, age: CONTENT.rounds[round].age, success: evidence.success });
      if (!life.strategy.consequences.some(function (item) { return item.id === chain.success.id || item.id === chain.failure.id; })) {
        life.strategy.consequences.push({ id: consequence.id, round: round, success: evidence.success });
        consequences.push(consequence);
      }
    }
    return { recorded: true, evidence: evidence, consequences: consequences };
  }

  function matches(life, condition, stageId) {
    return ((life.strategy && life.strategy.evidence) || []).filter(function (entry) {
      if (condition.ids && !condition.ids.includes(entry.id)) return false;
      if (condition.kind && entry.kind !== condition.kind) return false;
      if (condition.success !== null && entry.success !== (condition.success === false ? false : true)) return false;
      if (stageId && stageOfRound(entry.round) !== stageId) return false;
      if (condition.excludeJourneyVariants?.length && (life.actions || []).some(function (action) { return action.actionId === entry.id && action.round === entry.round + 1 && condition.excludeJourneyVariants.includes(action.journeyVariant); })) return false;
      return true;
    });
  }
  function evaluate(life, condition, stageId) {
    let current = 0;
    let target = Number(condition.min || 1);
    if (condition.type === "stat") current = Number(life[condition.group] && life[condition.group][condition.key] || 0);
    else if (condition.type === "proof") {
      const entries = matches(life, condition, stageId);
      current = condition.distinctStages ? new Set(entries.map(function (entry) { return stageOfRound(entry.round); })).size : condition.distinctRounds ? new Set(entries.map(function (entry) { return entry.round; })).size : entries.length;
    } else if (condition.type === "relation-count") {
      current = (condition.keys || RELATION_KEYS).filter(function (key) { return Number(life.relationships && life.relationships[key] || 0) >= condition.min; }).length;
      target = condition.count;
    } else if (condition.type === "town-count") {
      current = Object.values(life.town || {}).filter(function (value) { return Number(value) >= condition.min; }).length;
      target = condition.count;
    } else if (condition.type === "skill-count") {
      current = Object.values(life.skills || {}).filter(function (value) { return Number(value) >= condition.min; }).length;
      target = condition.count || 1;
    } else if (condition.type === "reserve") {
      const next = CONTENT.rounds[Math.min(boundedRound(life.round) + 1, CONTENT.rounds.length - 1)];
      const bill = CONTENT.livingCosts.find(function (item) { return next.age <= item.maxAge; });
      current = Number(life.resources && life.resources.money || 0);
      target = Number(bill && bill.cost || 0);
    } else if (condition.type === "ordered-proof") {
      const first = matches(life, { ids: condition.firstIds, kind: "event", excludeJourneyVariants: condition.excludeJourneyVariants }, stageId);
      const earliest = first.length ? Math.min.apply(null, first.map(function (entry) { return entry.round; })) : Infinity;
      current = new Set(matches(life, { ids: condition.nextIds, kind: condition.nextKind }, stageId).filter(function (entry) { return entry.round > earliest; }).map(function (entry) { return entry.round; })).size;
    } else if (condition.type === "any" || condition.type === "all") {
      const checks = condition.conditions.map(function (item) { return evaluate(life, item, stageId); });
      current = checks.filter(function (item) { return item.met; }).length;
      target = condition.type === "any" ? 1 : checks.length;
    } else if (condition.type === "at-most") {
      current = Number(life[condition.group] && life[condition.group][condition.key] || 0);
      return { label: condition.label, met: current <= condition.max, current: current, target: condition.max };
    } else return { label: condition.label || "未知条件", met: false, current: 0, target: 1 };
    return { label: condition.label, met: current >= target, current: current, target: target };
  }

  function goalView(life, definition) {
    const strategy = life.strategy || {};
    const saved = strategy.goals && strategy.goals[definition.id];
    const status = typeof saved === "string" ? saved : saved && saved.status;
    const legacy = status === "legacy-settled";
    const future = STAGES.indexOf(definition.stageId) > STAGES.indexOf(currentStage(life));
    const conditions = definition.conditions.map(function (condition, index) {
      if (legacy || future) return { label: condition.label, met: false };
      if (saved && Array.isArray(saved.checks) && saved.checks.length) return { label: condition.label, met: Boolean(saved.checks[index]) };
      if (status) return { label: condition.label, met: status === "achieved" };
      if (definition.stageId !== currentStage(life)) return { label: condition.label, met: false };
      return evaluate(life, condition, definition.stageId);
    });
    const progress = conditions.filter(function (condition) { return condition.met; }).length;
    return { id: definition.id, stageId: definition.stageId, stageLabel: CONTENT.stages.find(function (item) { return item.id === definition.stageId; }).label, routeId: definition.routeId, label: definition.label, detail: legacy ? "本阶段沿用旧版经历，不补判新成果；后续尚未开始的阶段会启用新目标。" : definition.detail, conditions: conditions, completed: status === "achieved", status: status || (future ? "future" : progress === conditions.length ? "ready" : "pending"), progress: progress, target: conditions.length };
  }

  function getGoals(life) {
    const stageId = currentStage(life);
    const stage = CONTENT.stages.find(function (item) { return item.id === stageId; });
    const strategy = life.strategy || {};
    return { stageId: stageId, stageLabel: stage.label, routeId: validRoute(strategy.routeId) ? strategy.routeId : defaultRoute(life), goals: GOALS.filter(function (item) { return item.stageId === stageId; }).map(function (definition) { return goalView(life, definition); }) };
  }

  function getAllGoals(life) {
    return GOALS.map(function (definition) { return goalView(life, definition); });
  }

  function getConsequences(life) {
    return ((life.strategy && life.strategy.consequences) || []).map(function (entry) {
      const sourceId = Object.keys(CHAIN_ENDINGS).find(function (id) { const chain = CHAIN_ENDINGS[id]; return chain.success.id === entry.id || chain.failure.id === entry.id; });
      if (!sourceId) return null;
      const chain = CHAIN_ENDINGS[sourceId];
      const success = chain.success.id === entry.id;
      const definition = consequenceDefinition(life, sourceId, success, boundedRound(entry.round));
      return Object.assign({}, definition, { chainId: chain.chainId, routeId: chain.routeId, sourceActionId: sourceId, round: boundedRound(entry.round), age: CONTENT.rounds[boundedRound(entry.round)].age, success });
    }).filter(Boolean);
  }

  function settleStage(life) {
    if (!life || !life.strategy) return [];
    const round = boundedRound(life.round);
    const stageId = currentStage(life);
    if (CONTENT.rounds[round + 1] && CONTENT.rounds[round + 1].stage === stageId) return [];
    if (!life.strategy.evidence.some(function (entry) { return entry.round === round && entry.kind === "event"; })) return [];
    const settled = [];
    getGoals(life).goals.forEach(function (item) {
      if (life.strategy.goals[item.id]) return;
      const result = { status: item.progress === item.target ? "achieved" : "missed", round: round, checks: item.conditions.map(function (condition) { return condition.met; }) };
      life.strategy.goals[item.id] = result;
      settled.push(Object.assign({ id: item.id, routeId: item.routeId, stageId: stageId, label: item.label, completed: result.status === "achieved" }, result));
    });
    return settled;
  }

  function requirementMet(life, requirement) {
    if (!requirement) return true;
    if (requirement.type === "evidence") return evaluate(life, Object.assign({}, requirement, { type: "proof" }), requirement.stageId || null).met;
    if (requirement.type === "strategy-goal") {
      const item = life.strategy && life.strategy.goals && life.strategy.goals[requirement.id];
      return Boolean(item && item.status === "achieved");
    }
    if (requirement.type === "legacy") return (life.inheritedLegacyIds || []).includes(requirement.id);
    if (requirement.type === "route") return Boolean(life.strategy && life.strategy.routeId === requirement.id);
    return false;
  }

  function getWishStatus(life) {
    const wish = CONTENT.goals.find(function (item) { return item.id === life.goalId; }) || CONTENT.goals[0];
    if (life.status === "complete" && life.outcome && !Array.isArray(life.outcome.achievedGoalIds) && life.migration?.legacyGoalProgress) {
      const progress = Number(life.migration.legacyGoalProgress[wish.id] || 0);
      return { goalId: wish.id, label: wish.label, completed: progress >= wish.target, detail: "旧制愿望结算已保留，本世不重新评定。", progress: progress, target: wish.target, conditions: [], legacy: true };
    }
    const commonRelation = proof(FAMILY_PROOF.concat(["routine-care", "routine-social"]), "在三个不同阶段实际维护过关系", { kind: null, min: 3, distinctStages: true });
    const conditionsByWish = {
      learn: [{ type: "skill-count", min: 8, count: 1, label: "一项技能达到 8" }, proof(["shop-shift", "project-craft-shift", "tutor-shift", "market-shift", "town-job", "fix-bicycle", "chain-craft-trial", "chain-study-trial"], "实际用本领完成一次有偿工作", { kind: null })],
      home: [stat("relationships", "family", 6, "家人关系达到 6"), stat("resources", "health", 4, "身体保持至少 4"), { type: "at-most", group: "cashflow", key: "debt", max: 0, label: "当前债务已付清" }, proof(["routine-care", "ask-family-share", "legacy-letter-share", "pay-medical-bill", "chain-community-roster"], "实际参与照料或家庭分担", { kind: null })],
      connection: [{ type: "relation-count", min: 7, count: 1, label: "至少一段关系达到 7" }, commonRelation],
      town: [{ type: "town-count", min: 3, count: 3, label: "至少三项小镇基础达到 3" }, proof(["community-speech", "organize-evacuation", "repair-bridge-adult", "save-school", "invite-town-alumni", "town-job", "chain-community-flood"], "在两个不同节点亲自参与公共事务", { kind: null, min: 2, distinctRounds: true })],
      record: [stat("town", "archive", 3, "镇志达到 3"), proof(["routine-record", "publish-story", "publish-ledger", "trace-watergate", "chain-study-report", "archive-postcard", "record-life", "write-final-page", "handoff-study"], "在两个不同阶段实际留下记录", { kind: null, min: 2, distinctStages: true })],
      free: [stat("resources", "happiness", 7, "心气保持至少 7"), { type: "at-most", group: "resources", key: "pressure", max: 6, label: "压力不高于 6" }, proof(["leave-for-school", "take-sabbatical", "return-school", "visit-old-friend", "move-out"], "完成一次主动改变生活方向的行动", { kind: null })],
    };
    const conditions = conditionsByWish[wish.id].map(function (condition) { return evaluate(life, condition, null); });
    const progress = conditions.filter(function (condition) { return condition.met; }).length;
    const completed = progress === conditions.length;
    const result = { goalId: wish.id, label: wish.label, completed: completed, detail: completed ? "这些条件已由当前状态与实际经历共同满足。" : "以实际经历和生活状态检验愿望；行动次数不再直接换算成人生成就。", progress: progress, target: conditions.length, conditions: conditions };
    if (life.migration && life.migration.legacyGoalProgress) result.legacyProgress = Number(life.migration.legacyGoalProgress[wish.id] || 0);
    return result;
  }

  function getOutcome(life) {
    const strategy = life.strategy || {};
    const routeId = validRoute(strategy.routeId) ? strategy.routeId : defaultRoute(life);
    const route = ROUTES.find(function (item) { return item.id === routeId; });
    const achievedGoalIds = GOALS.filter(function (goal) { return goal.routeId === routeId && strategy.goals && strategy.goals[goal.id] && strategy.goals[goal.id].status === "achieved"; }).map(function (goal) { return goal.id; });
    const wish = getWishStatus(life);
    const health = Number(life.resources && life.resources.health || 0);
    const pressure = Number(life.resources && life.resources.pressure || 0);
    const debt = Number(life.cashflow && life.cashflow.debt || 0);
    const consequences = (strategy.consequences || []).map(function (item) { return { id: item.id, round: item.round, success: item.success }; });
    const titles = { craft: "你把一门手艺做成了可以接下去的日子。", study: "你把学过的东西变成了别人可以核对的方法。", community: "你让一些原本只能独自承担的事有了共同的办法。" };
    let title = achievedGoalIds.length >= 3 ? titles[routeId] : "这条路还没有走完，但你留下了真实做过的部分。";
    let tone = achievedGoalIds.length >= 3 ? route.label : "仍在摸索";
    const notes = ["本世" + route.label + "达成 " + achievedGoalIds.length + " 项阶段成果。", wish.completed ? "你选择的愿望也有了实际证据。" : "愿望仍有未完成的条件。"]; 
    if (strategy.migratedThroughStage) notes.push("旧版阶段经历继续保留，没有被追授为新版成果。");
    if (debt > 0) notes.push("尚有 " + debt + " 元债务，这笔代价没有被成功的故事抹去。");
    if (pressure >= 8) notes.push("高压也留在了这份履历里。");
    if (health <= 0) { title = "你留下了方法，也留下了透支身体的代价。"; tone = "需要余地"; }
    const score = Math.max(1, Math.min(100, 50 + achievedGoalIds.length * 8 + (wish.completed ? 10 : 0) - Math.min(20, debt) - (pressure >= 8 ? 8 : 0) - (health <= 0 ? 30 : 0)));
    return { title: title, copy: notes.join(""), tone: tone, score: score, routeId: routeId, achievedGoalIds: achievedGoalIds, consequences: consequences };
  }

  function getRouteEvents(life) {
    return CONTENT.rounds[boundedRound(life.round)].actions.filter(function (action) { return action.strategy && !action.strategy.conservative; });
  }

  global.EchoTownStrategy = {
    VERSION: VERSION, initLife: initLife, record: record, getGoals: getGoals, settleStage: settleStage,
    getWishStatus: getWishStatus, getOutcome: getOutcome, getRouteEvents: getRouteEvents, requirementMet: requirementMet,
    getAllGoals: getAllGoals, getConsequences: getConsequences,
  };
})(window);
