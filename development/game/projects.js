(function (global) {
  "use strict";

  const CONTENT = global.EchoTownContent;
  if (!CONTENT) throw new Error("projects.js requires content.js");
  const ID = "craft-customers-youth-v1";
  const JOB_ID = "project-craft-shift";
  const START = CONTENT.rounds.findIndex(round => round.id === "youth-departure");
  const PREPARE = CONTENT.rounds.findIndex(round => round.id === "youth-mentor");
  const RETURN = CONTENT.rounds.findIndex(round => round.id === "youth-love");
  const DEADLINE = CONTENT.rounds.findIndex(round => round.id === "youth-career");
  const STATUS = ["active", "completed", "incomplete", "withdrawn"];
  const STEPS = ["firstWork", "preparation", "returnWork"];
  const ROUNDS = { firstWork: START, preparation: PREPARE, returnWork: RETURN };
  const copy = value => JSON.parse(JSON.stringify(value));
  const recordObject = value => value && typeof value === "object" && !Array.isArray(value);
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const action = (actionId, kind, ap, energySpent) => ({ type: "LIFE_ACTION", actionId, kind, ap, moneySpent: 0, energySpent });
  const purchase = actionId => ({ type: "BUY_ITEM", actionId, kind: "purchase", ap: 1, moneySpent: CONTENT.items.find(item => item.id === actionId).price, energySpent: 0 });
  const REGISTRY = [
    {
      id: ID, routeId: "craft", title: "建立固定客源", skillKey: "craft", finalField: "finalCraft", minimumSkill: 5,
      steps: { firstWork: [action("shop-shift", "job", 2, 2)], preparation: [action("routine-repair", "life", 1, 2), purchase("toolkit")], returnWork: [action("shop-shift", "job", 2, 2)] },
      labels: { firstWork: "19岁完成一次修理铺帮工", preparation: "21岁练习手艺，或购买趁手工具", returnWork: "24岁再完成一次修理铺帮工" },
      details: { firstWork: "沿用修理铺帮工：2行动点、耗2精力、收入7", preparation: "1行动点；练习耗2精力，购工具花12元，只记录一次准备", returnWork: "沿用修理铺帮工：2行动点、耗2精力、收入7" },
      summary: "用两次真实帮工和一次准备，逐步让熟客愿意直接找你维修。普通帮工始终可以继续。",
      alternatives: "不接受项目也可照常帮工。普通帮工收入7、耗2精力、压力+1，并有基础手艺与修理铺成长。",
      completedLabel: "已建立固定客源", activeLabel: "积累客源中", unlockId: JOB_ID, unlockKind: "job",
      completed: "32岁起解锁固定客户维修：2行动点，收入14、耗4精力、压力+2；基础不加手艺与修理铺。安排前记得给本节点的人生事件留出精力。",
    },
    {
      id: "study-practice-youth-v1", routeId: "study", title: "形成专业方法", skillKey: "study", finalField: "finalStudy", minimumSkill: 5,
      steps: { firstWork: [action("tutor-shift", "job", 2, 2)], preparation: [action("routine-study", "life", 1, 2), purchase("study-notebook")], returnWork: [action("tutor-shift", "job", 2, 2)] },
      labels: { firstWork: "19岁完成一次辅导", preparation: "21岁主动学习，或购买空白笔记本", returnWork: "24岁再次完成辅导" },
      details: { firstWork: "沿用辅导：2行动点、耗2精力、收入8", preparation: "1行动点；学习耗2精力，笔记本花10元，只记录一次准备", returnWork: "沿用辅导：2行动点、耗2精力、收入8" },
      summary: "从两次真实辅导中积累问题，再留出时间整理方法，为以后按次提供专业咨询做准备。",
      alternatives: "稳定辅导每次2行动点、收入8、耗2精力，增加学识、学校与晚辈关系。专业咨询按次付薪，能为休息或其他安排留出1行动点。",
      completedLabel: "已形成专业方法", activeLabel: "整理专业方法中", unlockId: "project-study-consult", unlockKind: "job",
      completed: "32岁起解锁专业咨询：1行动点，收入6、耗2精力、压力+1，无基础技能或学校成长。可接一份后休息，也可花2行动点做两份；各自支付成本。",
    },
    {
      id: "community-network-youth-v1", routeId: "community", title: "建立互助网络", skillKey: "empathy", finalField: "finalEmpathy", minimumSkill: 5,
      steps: { firstWork: [action("routine-care", "life", 1, 1)], preparation: [action("routine-record", "life", 1, 1)], returnWork: [action("routine-social", "life", 1, 1)] },
      labels: { firstWork: "19岁亲自照料家人", preparation: "21岁记录联络与分工", returnWork: "24岁主动联络同伴" },
      details: { firstWork: "沿用照料家人：1行动点、耗1精力，增加体谅与家人关系", preparation: "沿用写下今天的账：1行动点、耗1精力，增加表达", returnWork: "沿用约一个人见面：1行动点、耗1精力，增加朋友关系" },
      summary: "先承担一次照料，再整理记录、保持联络，逐步建立有人能接手的互助安排。",
      alternatives: "亲自照料不花钱，耗1精力并增加体谅与家人关系。建立网络后可花钱协调分担，用现金换精力，家人仍有人照料。",
      completedLabel: "互助网络已建立", activeLabel: "联系互助伙伴中", unlockId: "project-community-care", unlockKind: "life",
      completed: "32岁起解锁协作照料：1行动点、花3元、精力+2、压力−1、家人和晚辈各+1；不增加基础体谅，不属于工作。缺钱时仍可亲自照料，关系已满时不会继续增加。",
    },
  ];
  const definition = id => REGISTRY.find(item => item.id === id) || null;
  const choiceFor = (config, key, type, id) => config.steps[key].find(choice => choice.type === type && choice.actionId === id);
  function demand(condition, message) { if (!condition) throw new Error("项目记录无效：" + message); }
  function keysAre(value, allowed) { return Object.keys(value).every(key => allowed.includes(key)); }
  function empty(life) {
    const eligible = life && life.status === "active" && (life.round < START || (life.round === START && life.actionPoints === CONTENT.actionPointsPerRound && life.sideActionsUsed === 0 && !life.lastAction));
    return { version: 1, eligibleFromRound: eligible ? START : null, current: null };
  }
  function evidenceFor(life, step, choice) {
    if (choice.type === "BUY_ITEM") return (life.inventory || []).includes(choice.actionId) && Boolean(life.ledger && life.ledger.entries.some(entry => entry.round === PREPARE && entry.kind === "purchase" && entry.id === choice.actionId && entry.money === -choice.moneySpent));
    return Boolean(life.strategy && life.strategy.evidence.some(entry => entry.round === step.round && entry.kind === choice.kind && entry.id === step.actionId && entry.success === true));
  }
  function deadlineEvent(life) {
    const entry = (life.actions || []).find(item => item.round === DEADLINE + 1 && item.age === CONTENT.rounds[DEADLINE].age);
    if (!entry || !(life.strategy && life.strategy.evidence || []).some(item => item.round === DEADLINE && item.kind === "event" && item.id === entry.actionId)) return false;
    return life.round > DEADLINE || life.status === "complete" || (life.round === DEADLINE && life.lastAction && life.lastAction.actionId === entry.actionId);
  }
  function result(projects, changed, message) { return { ok: true, changed: Boolean(changed), projects: copy(projects), message: message || "" }; }
  function refused(projects, message) { return { ok: false, changed: false, projects: copy(projects), message }; }

  // Present records are strictly validated, never repaired or replayed. Existing
  // craft records retain their exact version, fields and receipt identifiers.
  function normalize(raw, life) {
    if (raw === undefined) return empty(life);
    demand(recordObject(raw) && raw.version === 1 && Object.prototype.hasOwnProperty.call(raw, "current") && keysAre(raw, ["version", "eligibleFromRound", "current"]), "版本或结构");
    demand(raw.eligibleFromRound === START || raw.eligibleFromRound === null, "接入起点");
    if (raw.current === null) return { version: 1, eligibleFromRound: raw.eligibleFromRound, current: null };
    const item = raw.current;
    const config = recordObject(item) && definition(item.id);
    demand(raw.eligibleFromRound === START, "项目不能早于接入起点");
    demand(config && STATUS.includes(item.status) && keysAre(item, ["id", "status", "acceptedRound", "steps", "settledRound", "resultId", config.finalField]), "项目或状态");
    demand(item.acceptedRound === START, "接受节点");
    demand(recordObject(item.steps) && Object.keys(item.steps).every(key => STEPS.includes(key)), "步骤");
    const normalized = { id: item.id, status: item.status, acceptedRound: START, steps: {} };
    const receipts = new Set();
    for (const key of STEPS) {
      const step = item.steps[key];
      if (step === undefined) continue;
      demand(recordObject(step) && step.round === ROUNDS[key] && keysAre(step, ["round", "type", "actionId", "slot", "receiptId", "ap", "moneySpent", "energySpent"]), key + "节点");
      const choice = choiceFor(config, key, step.type, step.actionId);
      demand(choice, key + "行动");
      demand(integer(step.slot, 1, CONTENT.actionPointsPerRound), key + "行动序号");
      if (choice.ap === 2) demand(step.slot === 1, "两点工作必须是该节点第一次行动");
      const receiptId = [item.id, step.round, step.slot, step.type, step.actionId].join(":");
      demand(step.receiptId === receiptId && !receipts.has(receiptId), key + "凭证");
      demand(step.ap === choice.ap, key + "行动点");
      demand(step.moneySpent === choice.moneySpent && step.energySpent === choice.energySpent, key + "实际成本");
      if (life) {
        demand(step.round <= life.round, "未来步骤");
        demand(evidenceFor(life, step, choice), key + "缺少真实行动记录");
        if (step.round === life.round) demand(life.sideActionsUsed >= step.slot, key + "超过实际行动数");
      }
      receipts.add(receiptId);
      normalized.steps[key] = { round: step.round, type: step.type, actionId: step.actionId, slot: step.slot, receiptId, ap: step.ap, moneySpent: step.moneySpent, energySpent: step.energySpent };
    }
    if (life) {
      const currentSteps = Object.values(normalized.steps).filter(step => step.round === life.round);
      if (currentSteps.length) {
        const recordedAP = currentSteps.reduce((total, step) => total + step.ap, 0);
        const otherActions = Math.max(0, life.sideActionsUsed - currentSteps.length);
        demand(integer(life.actionPoints, 0, CONTENT.actionPointsPerRound - recordedAP - otherActions), "已记录步骤的行动点尚未实际扣除");
      }
    }
    if (item.status === "active") {
      demand(item.settledRound === undefined && item.resultId === undefined && item[config.finalField] === undefined, "未结算项目不能有结果");
      if (life) demand(life.round >= START && life.round <= DEADLINE && life.status === "active", "活动项目时段");
    } else {
      demand(item.resultId === item.id + ":" + item.status, "结果ID");
      demand(integer(item.settledRound, START, DEADLINE), "结算节点");
      if (item.status !== "withdrawn") demand(item.settledRound === DEADLINE, "期限结算");
      demand(Object.values(normalized.steps).every(step => step.round <= item.settledRound), "结算后步骤");
      if (life) demand(item.settledRound <= life.round, "未来结算");
      normalized.settledRound = item.settledRound;
      normalized.resultId = item.resultId;
      if (item.status !== "withdrawn") {
        demand(integer(item[config.finalField], 0, Number.MAX_SAFE_INTEGER), "结算时能力");
        const complete = STEPS.every(key => normalized.steps[key]) && item[config.finalField] >= config.minimumSkill;
        demand((item.status === "completed") === complete, "结果与真实步骤不符");
        normalized[config.finalField] = item[config.finalField];
        if (life) demand(deadlineEvent(life), "尚未完成28岁人生事件");
      } else demand(item[config.finalField] === undefined, "退出不计算最终能力");
    }
    return { version: 1, eligibleFromRound: START, current: normalized };
  }

  function canAccept(life, projects) {
    if (!life || life.status !== "active") return "请先开始这一世";
    if (projects.current) return "这一世已经选择或结束过一个青年项目";
    if (projects.eligibleFromRound !== START) return "这一世已越过项目接入时点，下一世可以重新选择";
    if (life.round !== START || life.lastAction) return "在19岁安排生活前，可以选择一个青年项目";
    if (life.actionPoints !== CONTENT.actionPointsPerRound || life.sideActionsUsed !== 0) return "本节点已经安排过生活，项目从下一世重新选择";
    return "";
  }
  function accept(life, projectId) {
    const projects = normalize(life && life.projects, life);
    const config = definition(projectId === undefined ? ID : projectId);
    if (!config) return refused(projects, "没有这个项目");
    const reason = canAccept(life, projects);
    if (reason) return refused(projects, reason);
    projects.current = { id: config.id, status: "active", acceptedRound: START, steps: {} };
    return result(projects, true, "开始" + config.title + "。接受不消耗行动点，也不提供收入或成果。");
  }
  function withdraw(life) {
    const projects = normalize(life && life.projects, life);
    const project = projects.current;
    if (!project || project.status !== "active") return refused(projects, "没有正在进行的项目");
    project.status = "withdrawn";
    project.settledRound = life.round;
    project.resultId = project.id + ":withdrawn";
    return result(projects, true, "已退出" + definition(project.id).title + "。既有工资、成本、物品与成长保留；仍可照常工作、照料或继续人生。");
  }
  function record(life, receipt) {
    const projects = normalize(life && life.projects, life);
    const project = projects.current;
    if (!project || project.status !== "active" || !receipt) return result(projects, false);
    const config = definition(project.id);
    const key = STEPS.find(name => ROUNDS[name] === life.round && choiceFor(config, name, receipt.type, receipt.id));
    if (!key || project.steps[key]) return result(projects, false);
    const choice = choiceFor(config, key, receipt.type, receipt.id);
    const before = receipt.before;
    if (!recordObject(before) || receipt.round !== life.round || life.lastAction || life.status !== "active") return refused(projects, "项目步骤缺少已执行行动凭证");
    const spent = { ap: before.actionPoints - life.actionPoints, money: Math.max(0, before.money - life.resources.money), energy: Math.max(0, before.energy - life.resources.energy) };
    const ownedBefore = Array.isArray(before.inventory) ? before.inventory.includes(receipt.id) : receipt.id === "toolkit" ? before.hadToolkit : undefined;
    const step = { round: life.round, type: receipt.type, actionId: receipt.id, slot: life.sideActionsUsed, receiptId: [project.id, life.round, life.sideActionsUsed, receipt.type, receipt.id].join(":"), ap: spent.ap, moneySpent: spent.money, energySpent: spent.energy };
    const valid = integer(before.actionPoints, choice.ap, CONTENT.actionPointsPerRound) && spent.ap === choice.ap
      && integer(before.sideActionsUsed, 0, 1) && life.sideActionsUsed === before.sideActionsUsed + 1
      && spent.money === choice.moneySpent && spent.energy === choice.energySpent
      && (choice.type !== "BUY_ITEM" || ownedBefore === false) && evidenceFor(life, step, choice);
    if (!valid) return refused(projects, "项目只记录已经付出真实成本的行动");
    project.steps[key] = step;
    return result(projects, true, config.labels[key] + "，已记录。" + (key === "returnWork" ? "28岁完成人生事件后，按真实步骤和能力结算。" : "下一步照自己的生活安排来。"));
  }
  function settle(life) {
    const projects = normalize(life && life.projects, life);
    const project = projects.current;
    if (!project || project.status !== "active") return result(projects, false);
    if (life.round !== DEADLINE || !life.lastAction) return result(projects, false);
    if (!deadlineEvent(life)) return refused(projects, "需要先完成28岁的人生事件");
    const config = definition(project.id);
    const completed = STEPS.every(key => project.steps[key]) && life.skills[config.skillKey] >= config.minimumSkill;
    project.status = completed ? "completed" : "incomplete";
    project.settledRound = DEADLINE;
    project.resultId = project.id + ":" + project.status;
    project[config.finalField] = life.skills[config.skillKey];
    return result(projects, true, completed ? config.completed + " 项目此刻不额外发钱、技能或行动点。" : config.title + "这次尚未完成。已有工资、成长、物品与准备保留，不追加罚款，仍可继续人生。");
  }
  function isUnlocked(life, projectId) {
    if (projectId && !definition(projectId)) return false;
    const projects = normalize(life && life.projects, life);
    return Boolean(projects.current && projects.current.status === "completed" && (!projectId || projects.current.id === projectId));
  }
  function getJobDefinitions() {
    return [
      {
        id: JOB_ID, jobId: JOB_ID, label: "固定客户维修", minAge: 30, points: 2,
        detail: "独立安排熟客的维修，报酬稳定；交付和沟通都由自己承担。",
        cost: "2行动点 · 精力−4 · 压力+2", preview: "收入+14；基础不增加手艺或修理铺",
        requires: [{ type: "project", id: ID, label: "需要完成青年项目：建立固定客源" }, { type: "skill", key: "craft", min: 5, label: "需要手艺5" }],
        effect: { resources: { money: 14, energy: -4, pressure: 2 }, flags: ["worked-project-craft"] }, tags: ["手艺", "独立接活", "精力取舍"],
      },
      {
        id: "project-study-consult", jobId: "project-study-consult", label: "提供专业咨询", minAge: 30, points: 1,
        detail: "用已经验证的方法答复一次具体问题，按次收取报酬；可以接一份后把时间留给别的安排。",
        cost: "1行动点 · 精力−2 · 压力+1", preview: "收入+6；基础不增加学识、学校或晚辈关系",
        requires: [{ type: "project", id: "study-practice-youth-v1", label: "需要完成青年项目：形成专业方法" }, { type: "skill", key: "study", min: 5, label: "需要学识5" }],
        effect: { resources: { money: 6, energy: -2, pressure: 1 }, flags: ["worked-project-study"] }, tags: ["学业", "按次咨询", "安排余地"],
      },
    ];
  }
  function getLifeActionDefinitions() {
    return [{
      id: "project-community-care", label: "安排协作照料", minAge: 30, points: 1,
      detail: "支付共同照料的开销，请熟悉家里情况的人接手一部分，也让晚辈参与分担，自己得以恢复精力。",
      cost: "1行动点 · 现金−3", preview: "精力+2、压力−1、家人和晚辈各+1；基础不增加体谅，关系已满不再增长",
      requires: [{ type: "project", id: "community-network-youth-v1", label: "需要完成青年项目：建立互助网络" }, { type: "skill", key: "empathy", min: 5, label: "需要体谅5" }],
      effect: { resources: { money: -3, energy: 2, pressure: -1 }, relationships: { family: 1, child: 1 }, flags: ["shared-project-care"] },
      goalPoints: { home: 1 }, tags: ["互助", "照料", "现金换精力"],
    }];
  }
  function getJobDefinition(id = JOB_ID) { return getJobDefinitions().find(item => item.id === id) || null; }
  function getView(life, projectId) {
    if (!life) return null;
    const projects = normalize(life.projects, life);
    const project = projects.current;
    if (!project && life.round !== START) return null;
    const config = project ? definition(project.id) : definition(projectId) || REGISTRY.find(item => item.routeId === life.strategy?.routeId) || definition(ID);
    const reason = canAccept(life, projects);
    const steps = STEPS.map(key => {
      const completed = Boolean(project && project.steps[key]);
      const requiredAP = Math.min(...config.steps[key].map(choice => choice.ap));
      const status = completed ? "completed" : life.round > ROUNDS[key] || (life.round === ROUNDS[key] && (life.lastAction || life.actionPoints < requiredAP)) ? "missed" : "pending";
      return { id: key, label: config.labels[key], age: CONTENT.rounds[ROUNDS[key]].age, status, completed, detail: config.details[key], receipt: completed ? copy(project.steps[key]) : null };
    });
    const prep = project && project.steps.preparation;
    const next = steps.find(step => step.status === "pending");
    const status = project ? project.status : reason ? "unavailable" : "available";
    const statusLabel = { active: config.activeLabel, completed: config.completedLabel, incomplete: "这次项目尚未完成", withdrawn: "已退出项目", available: "可以开始", unavailable: "本世不能接入" }[status];
    const outcomes = { completed: config.completed, incomplete: "不解锁新安排；既有工资、物品和成长保留，不追加罚款。", withdrawn: "立即停止项目记录；已经支付的成本不返还，可继续普通工作与照料。" };
    const remainingNodes = Math.max(0, DEADLINE - life.round + (life.lastAction ? 0 : 1));
    const canWithdraw = Boolean(project && project.status === "active");
    const completeCount = steps.filter(step => step.completed).length;
    const missed = steps.filter(step => step.status === "missed");
    const missedNotice = canWithdraw && missed.length ? "已错过" + missed.map(step => step.age + "岁步骤").join("、") + "，本世无法完成这个项目。可退出项目；普通帮工、休息和人生事件仍照常进行。" : "";
    const skill = { key: config.skillKey, label: CONTENT.skills[config.skillKey].label, current: life.skills[config.skillKey], target: config.minimumSkill };
    const requiredActionPoints = STEPS.reduce((sum, key) => sum + Math.min(...config.steps[key].map(choice => choice.ap)), 0);
    return {
      id: config.id, routeId: config.routeId, title: config.title, label: config.title, status, statusLabel,
      visible: true, canAccept: !reason, acceptReason: reason,
      offer: { available: !reason, reason }, accept: { available: !reason, reason },
      withdraw: { available: canWithdraw, reason: canWithdraw ? "已付成本不返还，工资与成长保留" : "没有正在进行的项目" },
      definition: { id: config.id, routeId: config.routeId, title: config.title, startAge: 19, deadlineAge: 28, skillKey: config.skillKey, minimumSkill: config.minimumSkill, ...(config.id === ID ? { minimumCraft: 5 } : {}), requiredActionPoints, totalActionPoints: 8 },
      summary: missedNotice || config.summary, canWithdraw, deadlineAge: 28, remainingNodes,
      remaining: { nodes: remainingNodes, steps: steps.filter(step => !step.completed).map(step => step.id) },
      progress: { current: completeCount, total: STEPS.length }, steps, skill,
      ...(config.id === ID ? { craft: { current: life.skills.craft, target: 5 } } : {}),
      next: project && project.status !== "active" ? outcomes[project.status] : missedNotice || (next ? next.label : "28岁完成人生事件后，按实际步骤和" + skill.label + skill.target + "结算"),
      investment: { actionPoints: prep ? prep.ap : 0, money: prep ? prep.moneySpent : 0, energy: prep ? prep.energySpent : 0 },
      costs: ["接受和退出均为0行动点，无额外奖励；本世只选择一个项目", ...STEPS.map(key => config.labels[key] + "：" + config.details[key]), "青年共8行动点，必要步骤共" + requiredActionPoints + "点，其余自定"],
      alternatives: config.alternatives, outcomes,
      outcome: project && project.resultId ? { id: project.resultId, status, label: statusLabel, detail: outcomes[status] } : null,
      npcReply: project && project.resultId ? outcomes[status] : missedNotice || (completeCount === 3 ? "这些年的准备已经留下记录。28岁那页事情落定后，再看是否具备下一步条件。" : completeCount ? "已经做过的事记在这里，下一步照自己的生活安排来。" : config.alternatives),
      resultId: project && project.resultId || null,
      unlock: { ...(config.unlockKind === "job" ? { jobId: config.unlockId } : { actionId: config.unlockId }), kind: config.unlockKind, unlocked: isUnlocked(life, config.id), minAge: 30 },
    };
  }
  function getOffers(life) {
    if (!life || life.projects?.current || life.round !== START) return [];
    return REGISTRY.map(config => getView(life, config.id));
  }
  function summarize(project) {
    if (!project || project.status === "active") return null;
    const config = definition(project.id);
    demand(config, "项目摘要类型");
    return { id: project.id, status: project.status, resultId: project.resultId, settledRound: project.settledRound, stepsDone: Object.keys(project.steps).length, preparationActionId: project.steps.preparation?.actionId || null, ...(project[config.finalField] !== undefined ? { [config.finalField]: project[config.finalField] } : {}) };
  }
  global.EchoTownProjects = Object.freeze({ VERSION: 1, ID, JOB_ID, accept, withdraw, record, settle, getView, getOffers, normalize, isUnlocked, getJobDefinition, getJobDefinitions, getLifeActionDefinitions, getDefinitions: () => copy(REGISTRY), getDefinition: id => definition(id) ? copy(definition(id)) : null, summarize });
})(window);
