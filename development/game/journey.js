(function (global) {
  "use strict";

  // Deterministic read models and event definitions only. No state, DOM,
  // storage, random numbers, dispatch, or reward settlement lives here.
  const CONTENT = global.EchoTownContent;
  if (!CONTENT) throw new Error("journey.js requires content.js");
  const clone = value => JSON.parse(JSON.stringify(value));
  const list = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === "string" ? value : "";
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const PROJECTS = {
    "craft-customers-youth-v1": { routeId: "craft", label: "建立固定客源", npcId: "qishu", jobId: "project-craft-shift" },
    "study-practice-youth-v1": { routeId: "study", label: "把知识变成可交付的方法", npcId: "linlaoshi", jobId: "project-study-consult" },
    "community-network-youth-v1": { routeId: "community", label: "建立共同照料的联系", npcId: "chenshen", actionId: "project-community-care" },
  };
  const REPAIRS = {
    "chain-craft-workshop": {
      id: "journey-craft-repair-v1", sourceId: "chain-craft-trial", sourceRoundId: "youth-mentor", targetRoundId: "middle-store",
      label: "先用小单补完旧维修单", detail: "21岁那次试修没有通过。先接范围较小的返修单，多花一点精力核查，只承担这一笔能交代清楚的维修。",
      cost: "钱 −6 · 精力 −2 · 手艺检定 6", preview: "成功：钱 +3、手艺 +1、修理铺 +1；失败：压力 +2。小单返修不计为开办作坊。",
      effect: { resources: { money: -6, energy: -2 } },
      test: { skill: "craft", difficulty: 6, label: "小单返修检定", success: { resources: { money: 3 }, skills: { craft: 1 }, town: { shop: 1 } }, failure: { resources: { pressure: 2 } }, successText: "这次故障核查通过了，小单按约交付。规模较小，没有顺带扩张集市。", failureText: "小单仍需要返工。你保留了问题记录，没有把它算成已交付。" },
      result: "那张有过失败记录的维修单，被你重新拿上了工作台。", future: "这次真实交付结果会成为后续经营与交接的依据；过去那次试修仍保留为失败。",
    },
    "chain-study-report": {
      id: "journey-study-recheck-v1", sourceId: "chain-study-trial", sourceRoundId: "youth-mentor", targetRoundId: "middle-ledger",
      label: "先补查旧笔记里讲不清的证据", detail: "21岁的试讲留下了讲不清的部分。多花一段精力重新核对，只提交这次查实的范围。",
      cost: "精力 −3 · 学识检定 6", preview: "成功：学识 +1、镇志 +1；失败：压力 +1",
      effect: { resources: { energy: -3 } },
      test: { skill: "study", difficulty: 6, label: "补查证据检定", success: { skills: { study: 1 }, town: { archive: 1 } }, failure: { resources: { pressure: 1 } }, successText: "补查的证据对上了。镇志只收入这一段可复查的结论。", failureText: "补查仍有缺口。你没有把未核实的部分写成定论。" },
      result: "当年没讲清的地方，这次被划成了一项可以查证的工作。", future: "镇志只按这次实际完成的范围增长，21岁的试讲结果不会被改写。",
    },
    "chain-community-flood": {
      id: "journey-community-replan-v1", sourceId: "chain-community-roster", sourceRoundId: "middle-family", targetRoundId: "middle-flood",
      label: "重排接应名单再疏散", detail: "32岁那次分工没能谈成。现在先花精力重新确认谁能接应，把范围收拢到确实能相互照应的人。",
      cost: "精力 −3 · 体谅检定 6", preview: "成功：邻里 +2、河桥 +1；失败：压力 +2",
      effect: { resources: { energy: -3 } },
      test: { skill: "empathy", difficulty: 6, label: "重排接应检定", success: { relationships: { neighbor: 2 }, town: { bridge: 1 } }, failure: { resources: { pressure: 2 } }, successText: "重新确认的人都接上了应。范围比最初设想的小，这次没有同时照管集市。", failureText: "接应时间仍有冲突。你没有把尚未落实的帮助写成已经完成。" },
      result: "旧轮值表没有直接拿来用，名字和时间被重新核实了一遍。", future: "邻里与河桥只按这次实际协作结算，过去的家庭分歧仍留在记录里。",
    },
  };

  function roundIndex(id) { return CONTENT.rounds.findIndex(round => round.id === id); }
  function actionDefinition(id) {
    for (const round of CONTENT.rounds) {
      const found = round.actions.find(action => action.id === id);
      if (found) return found;
    }
    return null;
  }
  function evidence(life, id, round) {
    return list(life?.strategy?.evidence).filter(entry => entry.id === id && entry.kind === "event" && (round === undefined || entry.round === round));
  }
  function resolveEventAction(life, action) {
    if (!action) return null;
    const result = clone(action);
    const variant = REPAIRS[action.id];
    if (!variant || life?.round !== roundIndex(variant.targetRoundId)) return result;
    const sourceRound = roundIndex(variant.sourceRoundId);
    if (!evidence(life, variant.sourceId, sourceRound).some(entry => entry.success === false)) return result;
    // Immutable past evidence selects one version. Existing lastAction is never read
    // or rewritten: replaying this view cannot change already-settled feedback.
    for (const key of ["label", "detail", "cost", "preview", "effect", "test", "result", "future"]) result[key] = clone(variant[key]);
    result.journeyVariant = variant.id;
    return result;
  }

  function getEventContext(life) {
    const round = CONTENT.rounds[life?.round];
    if (!round || life.lastAction) return null;
    for (const action of round.actions) {
      const resolved = resolveEventAction(life, action);
      if (resolved.journeyVariant) return { id: resolved.journeyVariant, actionId: action.id, copy: resolved.detail, sourceIds: [REPAIRS[action.id].sourceId], rule: { cost: resolved.cost, preview: resolved.preview } };
    }
    return null;
  }

  function eventRecords(life) {
    return list(life?.actions).flatMap((entry, index) => {
      const id = text(entry.actionId || entry.id);
      const knownRound = CONTENT.rounds.findIndex(round => round.actions.some(action => action.id === id));
      const round = Number.isInteger(entry.round) && entry.round >= 1 && entry.round <= CONTENT.rounds.length ? entry.round - 1 : knownRound;
      if (round < 0 || !CONTENT.rounds[round] || round > number(life.round)) return [];
      const proof = evidence(life, id, round);
      const success = proof.some(item => item.success === false) ? false : proof.some(item => item.success === true) ? true : null;
      return [{ id, kind: "event", round, age: CONTENT.rounds[round].age, stageId: CONTENT.rounds[round].stage, label: text(entry.label) || actionDefinition(id)?.label || "一次已记录的选择", result: text(entry.result), success, variantId: text(entry.journeyVariant) || null, proof: { kind: "event", actionIndex: index, actionId: id, round, evidence: proof.map(clone) } }];
    });
  }

  function costFor(life, source) {
    const ids = [source.id, `${source.id}-success`, `${source.id}-failure`];
    const entries = list(life?.ledger?.entries).flatMap((entry, index) => ids.includes(entry.id) && entry.round === source.round ? [{ index, ...clone(entry) }] : []);
    const cashPaid = entries.reduce((sum, entry) => sum + Math.max(0, -number(entry.money)), 0);
    const cashReceived = entries.reduce((sum, entry) => sum + Math.max(0, number(entry.money)), 0);
    const debtAdded = entries.reduce((sum, entry) => sum + Math.max(0, number(entry.debt)), 0);
    const debtRepaid = entries.reduce((sum, entry) => sum + Math.max(0, -number(entry.debt)), 0);
    const lines = [];
    if (cashPaid) lines.push(`账本支出 ${cashPaid} 元`);
    if (cashReceived) lines.push(`账本入账 ${cashReceived} 元${debtAdded ? "（含借款）" : ""}`);
    if (debtAdded) lines.push(`借款增加 ${debtAdded} 元`);
    if (debtRepaid) lines.push(`偿还借款 ${debtRepaid} 元`);
    return { cashPaid, cashReceived, debtAdded, debtRepaid, ledgerEntries: entries, measured: entries.length > 0, lines, unknown: entries.length ? [] : ["这次选择没有可单独追溯的现金记录"] };
  }

  function projectRecord(life) {
    const current = life?.projects?.current;
    if (!current || !PROJECTS[current.id]) return null;
    let view = null;
    if (global.EchoTownProjects?.getView) {
      try { view = global.EchoTownProjects.getView(life); } catch (_) { return null; }
    }
    const definition = PROJECTS[current.id];
    const receipts = Object.values(current.steps || {}).filter(step => Number.isInteger(step.round) && step.round <= number(life.round));
    return {
      id: current.id, routeId: definition.routeId, npcId: definition.npcId,
      label: view?.title || definition.label, status: current.status, acceptedRound: current.acceptedRound,
      settledRound: current.settledRound, lastRound: Math.max(current.acceptedRound, ...receipts.map(step => step.round), current.settledRound ?? 0), resultId: current.resultId || null, result: text(view?.outcome?.detail), completedSteps: receipts.length,
      receipts: clone(receipts), costs: { actionPoints: receipts.reduce((sum, item) => sum + number(item.ap), 0), moneySpent: receipts.reduce((sum, item) => sum + number(item.moneySpent), 0), energySpent: receipts.reduce((sum, item) => sum + number(item.energySpent), 0) },
      unlock: view?.unlock ? clone(view.unlock) : null,
    };
  }

  const STAGE_PRIORITY = {
    childhood: ["ask-for-help", "hide-fever", "fix-radio", "front-seat", "invite-shy-child", "share-notes", "repair-lantern", "legacy-tool-practice"],
    adolescence: ["leave-for-school", "stay-for-family", "ask-scholarship", "chain-craft-promise", "chain-study-plan", "chain-community-promise", "comfort-friend"],
    youth: ["chain-craft-trial", "chain-study-trial", "take-promotion", "community-speech", "return-workshop", "confess-love", "avoid-relationship", "keep-friendship"],
    middle: ["chain-craft-workshop", "chain-study-report", "chain-community-flood", "open-workshop", "organize-evacuation", "trace-watergate", "take-risk-loan", "ask-family-share", "talk-through"],
    later: ["handoff-craft", "handoff-study", "handoff-community", "train-successor", "record-life", "save-school", "invite-town-alumni", "give-away-tools", "write-letter", "visit-old-friend"],
  };
  const DECISION_ECHO = {
    "ask-for-help": "你把难受说出来，照料这件事不再只靠自己猜。",
    "hide-fever": "你把上课放在休息前面。这份记录也提醒后来的人：坚持有身体上的代价。",
    "fix-radio": "拆开收音机，是你最早一次把一个问题留在手里慢慢弄清。",
    "front-seat": "你把位置留给了学习，后来是否把知识用起来，仍要看下一段经历。",
    "leave-for-school": "你真的离开了熟悉的地方；学过的东西往后还要接受工作与生活的检验。",
    "stay-for-family": "你把这一阶段留给了镇上的工作，眼前的收入也占用了离开的机会。",
    "take-risk-loan": "钱先到账，债务也同时留下。回望这次决定时，借来的钱不能算成赚到的钱。",
    "avoid-relationship": "你明确把这段时间给了工作，也把关系留在了这次选择之外。",
    "keep-friendship": "这次你选择保留朋友的位置；后来是否再联系，要由新的行动回答。",
  };
  function decision(life, source) {
    const costs = costFor(life, source);
    let echo = DECISION_ECHO[source.id] || source.result;
    if (source.success === false) echo = source.result || "这次检定没有通过；尝试已发生，成果没有被补记。";
    if (source.id.startsWith("steady-")) echo = `面对“${CONTENT.rounds[source.round].title}”，你这次没有增加承诺，继续保留手里的资源。`;
    return { ...clone(source), echo, costs, laterSourceIds: Object.entries(REPAIRS).filter(([, item]) => item.sourceId === source.id).map(([id]) => id) };
  }
  function getStageDecisions(life) {
    const records = eventRecords(life);
    return CONTENT.stages.map(stage => {
      const candidates = records.filter(record => record.stageId === stage.id);
      const priority = STAGE_PRIORITY[stage.id] || [];
      const chosen = priority.map(id => candidates.find(record => record.id === id)).find(Boolean) || candidates[candidates.length - 1] || null;
      const lastRound = CONTENT.rounds.reduce((last, round, index) => round.stage === stage.id ? index : last, -1);
      const reached = number(life?.round) >= CONTENT.rounds.findIndex(round => round.stage === stage.id);
      const ended = number(life?.round) > lastRound || records.some(record => record.round === lastRound);
      return { stageId: stage.id, label: stage.label, status: !reached ? "future" : ended ? "settled" : "current", decision: chosen ? decision(life, chosen) : null };
    });
  }

  const NPC_CHAPTERS = {
    qishu: [
      { id: "qishu-small-repair", ids: ["fix-radio", "repair-lantern"], good: "你开始肯把零件一件件看清。以后接活，先说清哪一段是自己能负责的。" },
      { id: "qishu-method", ids: ["chain-craft-promise", "learn-bicycle", "join-repair"], good: "你留下了练习和维修的做法。下次碰到真的故障，拿它来对照，别只记住做顺的那一步。" },
      { id: "qishu-trial", ids: ["chain-craft-trial", "fix-bicycle"], good: "这回的车经过了检验。下一次接单，时间和材料也要一起算进去。", failed: "车还有没修完的地方。这张旧单别丢，36岁接单时可以先做范围较小的返修，少拿一点成果，多花精力查清楚。" },
      { id: "qishu-workshop", ids: ["chain-craft-workshop", "open-workshop"], good: "这次经营的结果已经记下。店里的本事要能被别人接过去，才不全压在你一个人身上。", failed: "这次经营没有通过检验。已经花掉的成本留在账上，没完成的成果也不要替自己写上。" },
      { id: "qishu-handoff", ids: ["train-successor", "give-away-tools", "handoff-craft"], good: "你已经做过一次交接。最后选下工具时，下一世八岁就能沿着它的刻痕多一种拆装选择。" },
    ],
    linlaoshi: [
      { id: "lin-seat", ids: ["front-seat", "read-comic"], good: "你给学习留过一个位置。后来会不会用，还要让一个真实问题来问你。" },
      { id: "lin-method", ids: ["chain-study-plan", "legacy-notebook-method", "study-plan", "ask-scholarship"], good: "你认真处理过学习这件事。把方法交给别人以前，留一页写下自己还没想通的地方。", failed: "这一回争取的结果没有落定。先保留过程，后面的学习和辅导仍然可以继续。" },
      { id: "lin-teaching", ids: ["chain-study-trial", "mentor-newcomer"], good: "你已经试过把会做的事讲给别人。能讲清和能核实，是下一步要一起练的两件事。", failed: "这次没能讲清楚。49岁遇到旧账时，可以多花精力补查证据，只交出较小但可核对的一段。" },
      { id: "lin-evidence", ids: ["chain-study-report", "trace-watergate", "publish-ledger"], good: "你把这次查实的部分留进了记录。后来的人可以接着查，不必只相信你的结论。", failed: "编号还没有全部对上。疑点也应留下，别因为已经投入时间就把它当作定论。" },
      { id: "lin-handoff", ids: ["save-school", "record-life", "handoff-study"], good: "你已经为学习或记录留下过一项具体成果。选下批注笔记后，下一世十三岁能沿旧批注整理方法。", failed: "这次保留或交接没有通过检验。回顾会留下这次努力，但不会把它写成已经完成。" },
    ],
    chenshen: [
      { id: "chen-help", ids: ["ask-for-help", "invite-shy-child", "join-river-team"], good: "你有过一次把人拉进事情里的选择。以后要共同承担，先问清别人能做到哪一步。" },
      { id: "chen-rota", ids: ["chain-community-promise", "community-speech"], good: "你已经试着把彼此的时间和事情说到明处。名单上写一个名字，就得知道那个人有没有空。", failed: "这次说明没能让大家一起行动。先把分歧留下，以后再谈具体分工。" },
      { id: "chen-family", ids: ["chain-community-roster", "ask-family-share", "legacy-letter-share"], good: "你实际商量过一次分担。紧急的时候也要重问一遍，别把旧承诺当成永远有空。", failed: "这次分工没有谈成。47岁河水涨上来时，先重排接应名单，会多花精力，也只照管确认得了的范围。" },
      { id: "chen-flood", ids: ["chain-community-flood", "organize-evacuation", "repair-bridge-adult"], good: "这次帮助真正落了地。以后传联系表，要连谁能接应、谁还需要照顾一起写清。", failed: "这晚的协作还有遗漏。名单需要跟着人的处境改，不能把没接上的帮助算作已经送到。" },
      { id: "chen-handoff", ids: ["invite-town-alumni", "handoff-community"], good: "你已经亲自把人重新联系起来。若留下书信，下一世三十二岁会多一条安排共同照料的路。", failed: "这次召集没有按预想完成。留下没联系上的部分，下一次才知道先找谁。" },
    ],
    ahe: [
      { id: "ahe-childhood", ids: ["yard-play", "share-notes", "invite-shy-child"], good: "你小时候给同伴留过位置。朋友不是自动跟着年岁增加的，后来还要有人先开口。" },
      { id: "ahe-adolescence", ids: ["comfort-friend", "join-river-team", "join-literature"], good: "你有过一次把时间留给同伴的选择。离开学校以后，联系就不再靠每天碰面了。" },
      { id: "ahe-boundary", ids: ["keep-friendship", "avoid-relationship", "confess-love"], good: "二十四岁那一页，你把关系放在了自己选的位置。回信、见面或继续忙下去，都还要再做一次选择。", failed: "这次表达没有得到预想中的回应。之后是否再联系，仍由你来决定。" },
      { id: "ahe-letter", ids: ["write-letter", "visit-old-friend", "archive-postcard"], good: "你对那张明信片做了一个实际回应。这一页和当年怎样安排关系，都还在同一份记录里。" },
      { id: "ahe-return", ids: ["invite-town-alumni", "write-final-page", "handoff-community"], good: "你最后还记着把人的名字留下。下一世若接到书信，可以把约定变成一次具体的共同照料。", failed: "这次召集没能完成。已经做过的联系会留下，没见到的人也不会被虚构成到场。" },
    ],
  };

  function getNpcTimeline(life, npcId) {
    const npc = CONTENT.characters[npcId];
    if (!npc || !NPC_CHAPTERS[npcId]) return { npcId, label: npc?.label || "", entries: [], current: null };
    const records = eventRecords(life);
    const entries = [];
    for (const chapter of NPC_CHAPTERS[npcId]) {
      const source = chapter.ids.map(id => records.find(record => record.id === id)).find(Boolean);
      if (!source) continue;
      const copy = source.success === false ? chapter.failed || "这次结果没有达到预想。已经付出的部分会保留，未完成的成果不补记。" : source.success === null ? "这一页留下了当时的选择，旧记录没有提供足以重判结果的证据。" : source.id === "publish-ledger" ? "你把账页交进了镇志，也让别人补上记得的日期。公开了材料，还需要继续核对。" : chapter.good;
      entries.push({ id: chapter.id, npcId, age: source.age, sourceIds: [source.id], proof: clone(source.proof), status: source.success === null ? "recorded" : source.success ? "completed" : "attempted", text: copy, recalledChoice: source.label });
    }
    // A project response only names the project actually accepted, never the route
    // currently selected in the UI. It adds no events or relationship points.
    const project = projectRecord(life);
    if (project && project.npcId === npcId) {
      const copy = project.status === "completed" ? `你接受的“${project.label}”已经按真实步骤结算。${project.result}` : project.status === "incomplete" ? `“${project.label}”这次还有缺项。${project.result}` : project.status === "withdrawn" ? `你已退出“${project.label}”。已经做过的工作与付过的成本仍在记录里。` : `你接受了“${project.label}”，目前已实际完成${project.completedSteps}个步骤。相关步骤共用了${project.costs.actionPoints}点行动，选择下一步以前先看看还有多少余地。`;
      entries.push({ id: `npc-project:${project.id}:${project.status}:${project.completedSteps}`, npcId, age: CONTENT.rounds[project.lastRound]?.age || 19, sourceIds: [project.id], proof: { kind: "project", id: project.id, resultId: project.resultId, receipts: project.receipts }, status: project.status, text: copy, recalledChoice: project.label });
    }
    entries.sort((a, b) => a.age - b.age);
    entries.forEach((entry, index) => {
      const previous = entries[index - 1];
      entry.previousId = previous?.id || null;
      entry.previousSourceIds = previous?.sourceIds.slice() || [];
      entry.text = `${previous ? `你${previous.age}岁选过“${previous.recalledChoice}”。` : ""}${entry.text}`;
    });
    return { npcId, label: npc.label, role: npc.role, entries, current: entries[entries.length - 1] || null };
  }

  const MARKERS = [
    { id: "opened-radio", label: "拆过的收音机", icon: "tool", sources: ["fix-radio"], copy: "零件被你拆开研究过。" },
    { id: "repair-notes", label: "留下的维修步骤", icon: "tool", sources: ["chain-craft-promise"], copy: "少年时写下的步骤，后来可以拿来试修。" },
    { id: "workshop-delivery", label: "已交付的维修单", icon: "tool", sources: ["chain-craft-workshop"], copy: "这次订单的实际交付已经记入履历。" },
    { id: "checked-pages", label: "核对过的账页", icon: "book", sources: ["chain-study-report", "trace-watergate"], copy: "已经查实的部分，可以留给后来的人复核。" },
    { id: "answered-rota", label: "落实的接应名单", icon: "bridge", sources: ["chain-community-flood", "organize-evacuation"], copy: "名单上的协作在这次事件里实际完成过。" },
    { id: "reply-page", label: "写下的回信", icon: "letter", sources: ["write-letter"], copy: "你认真写过回信；记录不会替对方编造回音。" },
    { id: "kept-school", label: "保留下来的学校", icon: "book", sources: ["save-school"], copy: "保留方案实际通过了检验。" },
    { id: "handed-tools", label: "交出去的手艺", icon: "tool", sources: ["train-successor", "give-away-tools", "handoff-craft"], copy: "一次真实的工具或手艺交接已经发生。" },
  ];
  function getWorldView(life) {
    const records = eventRecords(life);
    const markers = MARKERS.flatMap(marker => {
      const source = records.find(record => marker.sources.includes(record.id) && record.success === true);
      return source ? [{ id: marker.id, label: marker.label, icon: marker.icon, copy: marker.copy, age: source.age, sourceIds: [source.id], proof: clone(source.proof) }] : [];
    });
    const project = projectRecord(life);
    if (project?.status === "completed") markers.push({ id: `project:${project.id}`, label: project.label, icon: project.routeId === "craft" ? "tool" : project.routeId === "study" ? "book" : "letter", copy: project.result, age: 28, sourceIds: [project.id], proof: { kind: "project", resultId: project.resultId } });
    return { markers, stages: getStageDecisions(life), currentStageId: CONTENT.rounds[life?.round]?.stage || null };
  }

  const LEGACY_PATHS = [
    { id: "small-tool", routeId: "craft", actionId: "legacy-tool-practice", roundId: "childhood-school", copy: "8岁沿工具刻痕练一次拆装；再决定是否把青年时间投入固定客源。", fallback: "先把下一世的手艺起点用在一次具体拆装上。" },
    { id: "study-notebook", routeId: "study", actionId: "legacy-notebook-method", roundId: "adolescence-exam", copy: "13岁整理旧批注；这份记录能成为21岁试讲的替代入口。", fallback: "把批注带进下一世，再用一次真实试讲检验方法。" },
    { id: "friend-letter", routeId: "community", actionId: "legacy-letter-share", roundId: "middle-family", copy: "32岁按旧信约定安排共同照料，不要求先达到既有体谅门槛。", fallback: "让下一世的关系基础变成一次具体的共同照料。" },
  ];
  function getLegacyPaths(life, selectedIds) {
    const selected = new Set(list(selectedIds === undefined ? life?.selectedLegacies : selectedIds));
    const candidates = new Set(list(life?.legacyCandidates));
    const inherited = new Set(list(life?.inheritedLegacyIds));
    return LEGACY_PATHS.map(path => {
      const legacy = CONTENT.legacies.find(item => item.id === path.id);
      const action = actionDefinition(path.actionId);
      return { ...clone(path), label: legacy?.label || path.id, benefit: legacy?.detail || "", actionLabel: action?.label || "", age: CONTENT.rounds[roundIndex(path.roundId)]?.age || null, selected: selected.has(path.id), available: candidates.has(path.id), inherited: inherited.has(path.id), command: { type: "SET_PRESET", routeId: path.routeId }, proof: { legacyId: path.id, actionId: path.actionId, requires: clone(action?.requires || []) } };
    });
  }

  function getReview(life, options = {}) {
    const stages = getStageDecisions(life);
    const records = eventRecords(life);
    const meaningful = stages.filter(stage => stage.decision && !stage.decision.id.startsWith("steady-"));
    const shortlist = [meaningful.find(stage => stage.stageId === "adolescence") || meaningful[0], meaningful.find(stage => stage.stageId === "middle"), meaningful.find(stage => stage.stageId === "later")];
    const choices = [];
    for (const stage of shortlist.concat(meaningful, stages)) if (stage?.decision && !choices.some(item => item.id === stage.decision.id) && choices.length < 3) choices.push(clone(stage.decision));
    const project = projectRecord(life);
    const paths = getLegacyPaths(life, options.legacyIds);
    const selectedIds = list(options.legacyIds === undefined ? life?.selectedLegacies : options.legacyIds);
    const legacies = paths.concat(CONTENT.legacies.filter(item => selectedIds.includes(item.id) && !paths.some(path => path.id === item.id)).map(item => ({ id: item.id, label: item.label, copy: item.nextUse || item.detail, benefit: item.detail, selected: true, available: list(life?.legacyCandidates).includes(item.id), routeId: null })));
    const selected = legacies.filter(item => item.selected);
    const allowInheritance = options.mode !== "challenge" && options.allowInheritance !== false;
    const nextStrategies = (allowInheritance ? paths : []).filter(item => item.selected || item.available).map(path => ({ routeId: path.routeId, legacyId: path.id, label: path.label, copy: path.copy, actionId: path.actionId, age: path.age, command: clone(path.command), selected: path.selected, triedBefore: records.some(record => record.id === path.actionId) }));
    const totals = life?.ledger?.totals;
    const costs = { income: number(life?.cashflow?.income), expenses: number(life?.cashflow?.expenses), debt: number(life?.cashflow?.debt), borrowed: totals ? number(totals.borrowed) : null, repaid: totals ? number(totals.repaid) : null, health: number(life?.resources?.health), pressure: number(life?.resources?.pressure), project: project?.costs || null, ledgerAvailable: Boolean(totals), migrated: Boolean(life?.migration) };
    const failed = choices.filter(item => item.success === false);
    const completed = choices.filter(item => item.success === true);
    const title = failed.length && completed.length ? "做成的、没做成的，都留在这几页里。" : project?.status === "completed" ? `从一次准备到“${project.label}”。` : selected.length && allowInheritance ? `这一世的选择，准备交给${selected.map(item => item.label).join("、")}。` : choices.length ? "回看这几次真正做过的选择。" : "旧记录仍在，新的回望等待新的经历。";
    return { version: 1, mode: options.mode || "generation", challenge: options.mode === "challenge" && options.challenge ? clone(options.challenge) : null, allowInheritance, generation: number(life?.generation), age: number(life?.age), title, outcomeTitle: text(life?.outcome?.title), routeId: text(life?.strategy?.routeId), stages, choices, costs, project, legacies, nextStrategies, proof: { actionCount: records.length, choiceIds: choices.map(item => item.id), projectId: project?.id || null }, missing: choices.length < 3 ? "现有记录不足三次；没有补造未发生的选择。" : "" };
  }

  global.EchoTownJourney = Object.freeze({ VERSION: 1, getVariantDefinitions: () => Object.entries(REPAIRS).map(([actionId, variant]) => ({ actionId, ...clone(variant) })), resolveEventAction, getEventContext, getStageDecisions, getNpcTimeline, getWorldView, getLegacyPaths, getReview });
})(window);
