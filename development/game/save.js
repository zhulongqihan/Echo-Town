(function (global) {
  "use strict";

  const CONTRACT = Object.freeze({
    storageKey: "echo-town-generation-save-v9",
    previousStorageKey: "echo-town-generation-save-v8",
    v7StorageKey: "echo-town-generation-save",
    backupKey: "echo-town-generation-save-v9-before-import",
    v8BackupPrefix: "echo-town-generation-save-v8-original-",
    v7BackupPrefix: "echo-town-generation-save-v7-original-",
    legacyStorageKeys: Object.freeze([
      "echo-town-generation-save-v6", "echo-town-generation-save-v5",
      "echo-town-generation-save-v4", "echo-town-save", "echo-town-mvp-v1",
    ]),
    version: 9,
    acceptedVersions: Object.freeze([7, 8, 9]),
    maxBytes: 512 * 1024,
    maxInputBytes: 2 * 1024 * 1024,
  });
  const RESOURCE_KEYS = ["money", "energy", "health", "happiness", "pressure", "expectation"];
  const SKILL_KEYS = ["study", "craft", "expression", "empathy", "courage"];
  const RELATIONSHIP_KEYS = ["family", "mentor", "friend", "partner", "child", "neighbor"];
  const TOWN_KEYS = ["shop", "bridge", "school", "market", "archive"];
  const GOAL_KEYS = ["learn", "home", "connection", "town", "record", "free"];
  const ROUND_AGES = [6, 8, 10, 11, 13, 15, 17, 19, 21, 24, 28, 32, 36, 40, 44, 47, 49, 52, 56, 60, 65, 70, 75];
  const CLEARED_MARKER = '{"version":9,"cleared":true}';
  const PREVIOUS_CLEARED_MARKER = '{"version":8,"cleared":true}';
  const PRIMARY_KEYS = Object.freeze([
    Object.freeze([CONTRACT.storageKey, 9]),
    Object.freeze([CONTRACT.previousStorageKey, 8]),
    Object.freeze([CONTRACT.v7StorageKey, 7]),
  ]);
  const ROUTES = ["craft", "study", "community"];
  const STAGES = ["childhood", "adolescence", "youth", "middle", "later"];

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function error(code, message, path) {
    const result = new Error(message);
    result.code = code;
    if (path) result.path = path;
    return result;
  }

  function failure(caught, fallback = "INVALID_SAVE") {
    return {
      ok: false,
      code: caught.code || fallback,
      message: caught.code ? caught.message : "存档结构不完整或状态不一致",
      ...(caught.path ? { path: caught.path } : {}),
    };
  }

  function requireValue(condition, path) {
    if (!condition) throw error("INVALID_SAVE", "存档结构不完整或状态不一致", path);
  }

  function number(value, path, minimum = 0, maximum = Number.MAX_SAFE_INTEGER, integer = false) {
    requireValue(typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum && (!integer || Number.isInteger(value)), path);
  }

  function string(value, path) {
    requireValue(typeof value === "string", path);
  }

  function list(value, path, maximum, check = string) {
    requireValue(Array.isArray(value) && value.length <= maximum, path);
    value.forEach((item, index) => check(item, `${path}[${index}]`));
  }

  function numericMap(value, keys, path) {
    requireValue(isRecord(value), path);
    keys.forEach((key) => number(value[key], `${path}.${key}`));
    Object.entries(value).forEach(([key, amount]) => number(amount, `${path}.${key}`));
  }

  function optionalList(value, key, path, maximum, check = string) {
    if (value[key] !== undefined) list(value[key], `${path}.${key}`, maximum, check);
  }

  function actionEntry(entry, path) {
    requireValue(isRecord(entry), path);
    number(entry.round, `${path}.round`, 1, 23, true);
    number(entry.age, `${path}.age`, 1, 120, true);
    string(entry.label, `${path}.label`);
    string(entry.result, `${path}.result`);
    if (entry.success !== undefined) requireValue(typeof entry.success === "boolean", `${path}.success`);
  }

  function logEntry(entry, path) {
    requireValue(isRecord(entry), path);
    number(entry.age, `${path}.age`, 1, 120, true);
    ["label", "result", "kind"].forEach((key) => string(entry[key], `${path}.${key}`));
  }

  function opportunityEntry(entry, path) {
    requireValue(isRecord(entry), path);
    number(entry.age, `${path}.age`, 1, 120, true);
    string(entry.id, `${path}.id`);
    string(entry.label, `${path}.label`);
  }

  function milestoneEntry(entry, path) {
    requireValue(isRecord(entry), path);
    string(entry.goalId, `${path}.goalId`);
    string(entry.label, `${path}.label`);
    if (entry.detail !== undefined) string(entry.detail, `${path}.detail`);
  }

  function feedback(value, path, eventFeedback = false) {
    if (value === null || value === undefined) return;
    requireValue(isRecord(value), path);
    string(value.title, `${path}.title`);
    list(value.changes, `${path}.changes`, 100);
    if (eventFeedback) {
      ["actionId", "result", "future"].forEach((key) => string(value[key], `${path}.${key}`));
      list(value.newLevels, `${path}.newLevels`, 100);
      list(value.newSecrets, `${path}.newSecrets`, 100);
      if (value.test !== null && value.test !== undefined) {
        requireValue(isRecord(value.test), `${path}.test`);
        requireValue(typeof value.test.success === "boolean", `${path}.test.success`);
        string(value.test.label, `${path}.test.label`);
        ["score", "difficulty", "roll"].forEach((key) => number(value.test[key], `${path}.test.${key}`, -Number.MAX_SAFE_INTEGER));
      }
      if (value.stageBreak !== null && value.stageBreak !== undefined) {
        requireValue(isRecord(value.stageBreak), `${path}.stageBreak`);
        ["label", "range", "hint"].forEach((key) => string(value.stageBreak[key], `${path}.stageBreak.${key}`));
      }
    } else {
      string(value.copy, `${path}.copy`);
    }
    ["newItems", "newSecrets", "newMoments", "tags"].forEach((key) => optionalList(value, key, path, 100));
    optionalList(value, "milestones", path, 100, milestoneEntry);
  }

  function validateLedger(ledger, path, historical = false) {
    requireValue(isRecord(ledger), path);
    numericMap(ledger.opening, ["money", "debt", "income", "expenses"], `${path}.opening`);
    numericMap(ledger.totals, ["income", "expenses", "borrowed", "repaid", "unpaid"], `${path}.totals`);
    if (!historical || ledger.entries !== undefined) {
      list(ledger.entries, `${path}.entries`, 4096, (entry, entryPath) => {
        requireValue(isRecord(entry), entryPath);
        number(entry.round, `${entryPath}.round`, 0, 22, true);
        string(entry.id, `${entryPath}.id`);
        string(entry.kind, `${entryPath}.kind`);
        number(entry.money, `${entryPath}.money`, -Number.MAX_SAFE_INTEGER);
        number(entry.debt, `${entryPath}.debt`, -Number.MAX_SAFE_INTEGER);
        number(entry.balance, `${entryPath}.balance`);
      });
    }
  }

  const PROJECT_SPECS = Object.freeze({
    "craft-customers-youth-v1": { finalField: "finalCraft", preparationIds: ["routine-repair", "toolkit"], workIds: ["shop-shift", "shop-shift"], workKind: "job", workAp: 2, workEnergy: 2, prepareEnergy: 2, itemPrice: 12 },
    "study-practice-youth-v1": { finalField: "finalStudy", preparationIds: ["routine-study", "study-notebook"], workIds: ["tutor-shift", "tutor-shift"], workKind: "job", workAp: 2, workEnergy: 2, prepareEnergy: 2, itemPrice: 10 },
    "community-network-youth-v1": { finalField: "finalEmpathy", preparationIds: ["routine-record"], workIds: ["routine-care", "routine-social"], workKind: "life", workAp: 1, workEnergy: 1, prepareEnergy: 1, itemPrice: null },
  });
  const PROJECT_STEP_ROUNDS = { firstWork: 7, preparation: 8, returnWork: 9 };

  function knownFields(value, fields, path) {
    requireValue(isRecord(value) && Object.keys(value).every(key => fields.includes(key)), path);
  }

  function initialProjects(life) {
    const eligible = life.status === "active" && (life.round < 7 || (life.round === 7 && life.actionPoints === 2 && life.sideActionsUsed === 0 && !life.lastAction));
    return { version: 1, eligibleFromRound: eligible ? 7 : null, current: null };
  }

  // Keep standalone imports strict even when the gameplay module is absent.
  // Current-life receipts require their original evidence; historical summaries
  // are display records only and never become current project receipts.
  function validateProjects(projects, path, historical = false, life = null) {
    if (projects === undefined || (historical && projects === null)) return;
    if (historical) {
      requireValue(isRecord(projects) && Object.prototype.hasOwnProperty.call(PROJECT_SPECS, projects.id), `${path}.id`);
      const spec = PROJECT_SPECS[projects.id], finalField = spec.finalField;
      knownFields(projects, ["id", "status", "resultId", "settledRound", "stepsDone", "preparationActionId", finalField], path);
      requireValue(["completed", "incomplete", "withdrawn"].includes(projects.status), `${path}.status`);
      requireValue(projects.resultId === projects.id + ":" + projects.status, `${path}.resultId`);
      number(projects.settledRound, `${path}.settledRound`, 7, 10, true);
      number(projects.stepsDone, `${path}.stepsDone`, 0, 3, true);
      requireValue([null, ...spec.preparationIds].includes(projects.preparationActionId), `${path}.preparationActionId`);
      if (projects.stepsDone === 0) requireValue(projects.preparationActionId === null, `${path}.preparationActionId`);
      if (projects.stepsDone === 3) requireValue(projects.preparationActionId !== null, `${path}.preparationActionId`);
      if (projects.status === "withdrawn") requireValue(projects[finalField] === undefined, `${path}.${finalField}`);
      else {
        requireValue(projects.settledRound === 10, `${path}.settledRound`);
        number(projects[finalField], `${path}.${finalField}`, 0, Number.MAX_SAFE_INTEGER, true);
        requireValue((projects.status === "completed") === (projects.stepsDone === 3 && projects[finalField] >= 5), `${path}.status`);
      }
      return;
    }
    knownFields(projects, ["version", "eligibleFromRound", "current"], path);
    requireValue(projects.version === 1, `${path}.version`);
    requireValue(projects.eligibleFromRound === 7 || projects.eligibleFromRound === null, `${path}.eligibleFromRound`);
    requireValue(Object.prototype.hasOwnProperty.call(projects, "current"), `${path}.current`);
    if (projects.current !== null) {
      const item = projects.current, itemPath = `${path}.current`;
      requireValue(projects.eligibleFromRound === 7, `${path}.eligibleFromRound`);
      requireValue(isRecord(item) && Object.prototype.hasOwnProperty.call(PROJECT_SPECS, item.id), `${itemPath}.id`);
      const spec = PROJECT_SPECS[item.id], finalField = spec.finalField;
      knownFields(item, ["id", "status", "acceptedRound", "steps", "settledRound", "resultId", finalField], itemPath);
      requireValue(["active", "completed", "incomplete", "withdrawn"].includes(item.status), `${itemPath}.status`);
      requireValue(item.acceptedRound === 7, `${itemPath}.acceptedRound`);
      knownFields(item.steps, Object.keys(PROJECT_STEP_ROUNDS), `${itemPath}.steps`);
      for (const [key, step] of Object.entries(item.steps)) {
        const stepPath = `${itemPath}.steps.${key}`;
        knownFields(step, ["round", "type", "actionId", "slot", "receiptId", "ap", "moneySpent", "energySpent"], stepPath);
        requireValue(step.round === PROJECT_STEP_ROUNDS[key], `${stepPath}.round`);
        const purchase = key === "preparation" && step.type === "BUY_ITEM" && spec.preparationIds.length === 2 && step.actionId === spec.preparationIds[1];
        const practice = key === "preparation" && step.type === "LIFE_ACTION" && step.actionId === spec.preparationIds[0];
        const work = key !== "preparation" && step.type === "LIFE_ACTION" && step.actionId === spec.workIds[key === "firstWork" ? 0 : 1];
        requireValue(purchase || practice || work, `${stepPath}.actionId`);
        const ap = work ? spec.workAp : 1;
        number(step.slot, `${stepPath}.slot`, 1, ap === 2 ? 1 : 2, true);
        requireValue(step.receiptId === [item.id, step.round, step.slot, step.type, step.actionId].join(":"), `${stepPath}.receiptId`);
        requireValue(step.ap === ap, `${stepPath}.ap`);
        requireValue(step.moneySpent === (purchase ? spec.itemPrice : 0), `${stepPath}.moneySpent`);
        requireValue(step.energySpent === (purchase ? 0 : work ? spec.workEnergy : spec.prepareEnergy), `${stepPath}.energySpent`);
        if (life) {
          requireValue(step.round <= life.round, `${stepPath}.round`);
          if (step.round === life.round) requireValue(life.sideActionsUsed >= step.slot, `${stepPath}.slot`);
          const evidence = purchase
            ? life.inventory.includes(step.actionId) && (life.ledger?.entries || []).some(entry => entry.round === 8 && entry.kind === "purchase" && entry.id === step.actionId && entry.money === -step.moneySpent)
            : (life.strategy?.evidence || []).some(entry => entry.round === step.round && entry.kind === (key === "preparation" ? "life" : spec.workKind) && entry.id === step.actionId && entry.success === true);
          requireValue(evidence, `${stepPath}.evidence`);
        }
      }
      if (life) {
        const currentSteps = Object.values(item.steps).filter(step => step.round === life.round);
        const currentApSpent = currentSteps.reduce((sum, step) => sum + step.ap, 0);
        const otherActions = Math.max(0, life.sideActionsUsed - currentSteps.length);
        if (currentSteps.length) requireValue(life.actionPoints <= 2 - currentApSpent - otherActions, `${itemPath}.steps.actionPoints`);
      }
      if (item.status === "active") {
        requireValue(item.settledRound === undefined && item.resultId === undefined && item[finalField] === undefined, itemPath);
        if (life) {
          requireValue(life.status === "active" && life.round >= 7 && life.round <= 10, `${itemPath}.status`);
          // Engine settlement briefly has this shape internally, but no saved
          // feedback may leave an active project past its only settlement point.
          requireValue(!(life.round === 10 && life.lastAction), `${itemPath}.status`);
        }
      } else {
        requireValue(item.resultId === item.id + ":" + item.status, `${itemPath}.resultId`);
        number(item.settledRound, `${itemPath}.settledRound`, 7, 10, true);
        requireValue(Object.values(item.steps).every(step => step.round <= item.settledRound), `${itemPath}.steps`);
        if (life) requireValue(item.settledRound <= life.round, `${itemPath}.settledRound`);
        if (item.status === "withdrawn") requireValue(item[finalField] === undefined, `${itemPath}.${finalField}`);
        else {
          requireValue(item.settledRound === 10, `${itemPath}.settledRound`);
          number(item[finalField], `${itemPath}.${finalField}`, 0, Number.MAX_SAFE_INTEGER, true);
          const completed = Object.keys(PROJECT_STEP_ROUNDS).every(key => item.steps[key]) && item[finalField] >= 5;
          requireValue((item.status === "completed") === completed, `${itemPath}.status`);
          if (life) {
            const action = life.actions.find(entry => entry.round === 11 && entry.age === 28);
            requireValue(Boolean(action) && (life.strategy?.evidence || []).some(entry => entry.round === 10 && entry.kind === "event" && entry.id === action.actionId), `${itemPath}.settledRound`);
            requireValue(life.round > 10 || life.status === "complete" || (life.round === 10 && life.lastAction?.actionId === action.actionId), `${itemPath}.settledRound`);
          }
        }
      }
    }
    if (typeof global.EchoTownProjects?.normalize === "function") {
      // Supply private copies so validation cannot change memory or a candidate.
      try { global.EchoTownProjects.normalize(clone(projects), life ? clone(life) : undefined); }
      catch (caught) { throw error("INVALID_SAVE", "项目记录与已发生的行动不一致", path); }
    }
  }

  function validateStrategy(strategy, path, historical = false, currentRound = 22) {
    requireValue(isRecord(strategy), path);
    if (!historical || strategy.version !== undefined) requireValue(strategy.version === 1, `${path}.version`);
    requireValue(ROUTES.includes(strategy.routeId), `${path}.routeId`);
    requireValue(isRecord(strategy.goals) && Object.keys(strategy.goals).length <= 15, `${path}.goals`);
    Object.entries(strategy.goals).forEach(([key, goal]) => {
      const goalPath = `${path}.goals.${key}`;
      const parts = key.split(":");
      requireValue(parts.length === 2 && ROUTES.includes(parts[0]) && STAGES.includes(parts[1]), goalPath);
      requireValue(isRecord(goal) && ["achieved", "missed", "legacy-settled"].includes(goal.status), goalPath);
      number(goal.round, `${goalPath}.round`, 0, currentRound, true);
      if (goal.id !== undefined) requireValue(goal.id === key, `${goalPath}.id`);
      if (goal.routeId !== undefined) requireValue(goal.routeId === parts[0], `${goalPath}.routeId`);
      if (goal.stageId !== undefined) requireValue(goal.stageId === parts[1], `${goalPath}.stageId`);
      optionalList(goal, "checks", goalPath, 4, (value, itemPath) => requireValue(typeof value === "boolean", itemPath));
      optionalList(goal, "conditions", goalPath, 4, (condition, itemPath) => {
        requireValue(isRecord(condition), itemPath);
        string(condition.label, `${itemPath}.label`);
        requireValue(typeof condition.met === "boolean", `${itemPath}.met`);
      });
    });
    if (!historical || strategy.evidence !== undefined) {
      const seen = new Set();
      list(strategy.evidence, `${path}.evidence`, 256, (entry, entryPath) => {
        requireValue(isRecord(entry), entryPath);
        string(entry.id, `${entryPath}.id`);
        requireValue(["event", "job", "life", "opportunity"].includes(entry.kind), `${entryPath}.kind`);
        number(entry.round, `${entryPath}.round`, 0, currentRound, true);
        requireValue(typeof entry.success === "boolean", `${entryPath}.success`);
        const key = JSON.stringify([entry.round, entry.kind, entry.id]);
        requireValue(!seen.has(key), entryPath);
        seen.add(key);
      });
    }
    const consequences = new Set();
    list(strategy.consequences, `${path}.consequences`, 3, (entry, entryPath) => {
      requireValue(isRecord(entry), entryPath);
      string(entry.id, `${entryPath}.id`);
      number(entry.round, `${entryPath}.round`, 0, currentRound, true);
      requireValue(typeof entry.success === "boolean", `${entryPath}.success`);
      ["label", "copy", "chainId", "sourceActionId"].forEach((key) => { if (entry[key] !== undefined) string(entry[key], `${entryPath}.${key}`); });
      if (entry.routeId !== undefined) requireValue(ROUTES.includes(entry.routeId), `${entryPath}.routeId`);
      if (entry.age !== undefined) number(entry.age, `${entryPath}.age`, 1, 120, true);
      requireValue(!consequences.has(entry.id), entryPath);
      consequences.add(entry.id);
    });
    if (!historical || strategy.migratedThroughStage !== undefined) {
      requireValue(strategy.migratedThroughStage === null || STAGES.includes(strategy.migratedThroughStage), `${path}.migratedThroughStage`);
    }
  }

  const JOURNEY_VARIANTS = Object.freeze({
    "journey-craft-repair-v1": { actionId: "chain-craft-workshop", round: 12, sourceId: "chain-craft-trial", sourceRound: 8 },
    "journey-study-recheck-v1": { actionId: "chain-study-report", round: 16, sourceId: "chain-study-trial", sourceRound: 8 },
    "journey-community-replan-v1": { actionId: "chain-community-flood", round: 15, sourceId: "chain-community-roster", sourceRound: 11 },
  });
  function validateJourney(owner, path, historical = false) {
    (owner.actions || []).forEach((action, index) => {
      if (action.journeyVariant === undefined) return;
      const itemPath = `${path}.actions[${index}].journeyVariant`;
      requireValue(typeof action.journeyVariant === "string" && Object.prototype.hasOwnProperty.call(JOURNEY_VARIANTS, action.journeyVariant), itemPath);
      const rule = JOURNEY_VARIANTS[action.journeyVariant];
      requireValue(action.actionId === rule.actionId && action.round === rule.round + 1 && action.age === ROUND_AGES[rule.round], itemPath);
      requireValue(owner.actions.some(source => source.round === rule.sourceRound + 1 && source.age === ROUND_AGES[rule.sourceRound] && source.actionId === rule.sourceId && source.success === false), itemPath);
      if (!historical) requireValue(owner.strategy?.evidence?.some(source => source.round === rule.sourceRound && source.kind === "event" && source.id === rule.sourceId && source.success === false), itemPath);
    });
    if (owner.lastAction) {
      const latest = owner.actions?.[owner.actions.length - 1];
      if (owner.lastAction.journeyVariant !== undefined || latest?.journeyVariant !== undefined) requireValue(owner.lastAction.journeyVariant === latest?.journeyVariant && owner.lastAction.actionId === latest?.actionId, `${path}.lastAction.journeyVariant`);
    }
  }

  function historyEntry(entry, path) {
    requireValue(isRecord(entry), path);
    number(entry.generation, `${path}.generation`, 1, Number.MAX_SAFE_INTEGER, true);
    number(entry.age, `${path}.age`, 1, 120, true);
    ["profileId", "talentId", "goalId", "outcomeTitle", "outcomeCopy", "bestSkill"].forEach((key) => string(entry[key], `${path}.${key}`));
    number(entry.goalProgress, `${path}.goalProgress`);
    number(entry.goalTarget, `${path}.goalTarget`, 1);
    if (entry.cashflow !== undefined) numericMap(entry.cashflow, ["income", "expenses", "debt"], `${path}.cashflow`);
    ["talentIds", "routeTags", "inventory", "legacyIds", "achievementIds", "secretIds", "momentIds", "jobHistory"].forEach((key) => optionalList(entry, key, path, 100));
    optionalList(entry, "actions", path, 23, actionEntry);
    validateJourney(entry, path, true);
    optionalList(entry, "lifeLog", path, 120, logEntry);
    optionalList(entry, "opportunityHistory", path, 23, opportunityEntry);
    if (entry.ledger !== undefined) validateLedger(entry.ledger, `${path}.ledger`, true);
    if (entry.strategy !== undefined) validateStrategy(entry.strategy, `${path}.strategy`, true);
    if (entry.projects !== undefined) validateProjects(entry.projects, `${path}.projects`, true);
  }

  function validateLife(life, saved) {
    const path = "currentLife";
    requireValue(isRecord(life), path);
    requireValue(["active", "complete"].includes(life.status), `${path}.status`);
    number(life.generation, `${path}.generation`, 1, Number.MAX_SAFE_INTEGER, true);
    number(life.round, `${path}.round`, 0, 22, true);
    number(life.age, `${path}.age`, 1, 120, true);
    requireValue(life.age === ROUND_AGES[life.round], `${path}.age`);
    number(life.seed, `${path}.seed`, 0, 4294967295, true);
    ["profileId", "talentId", "goalId", "jobId"].forEach((key) => string(life[key], `${path}.${key}`));
    numericMap(life.resources, RESOURCE_KEYS, `${path}.resources`);
    numericMap(life.skills, SKILL_KEYS, `${path}.skills`);
    numericMap(life.relationships, RELATIONSHIP_KEYS, `${path}.relationships`);
    numericMap(life.town, TOWN_KEYS, `${path}.town`);
    numericMap(life.progress, GOAL_KEYS, `${path}.progress`);
    numericMap(life.cashflow, ["income", "expenses", "debt"], `${path}.cashflow`);
    numericMap(life.maxResources, ["energy"], `${path}.maxResources`);
    number(life.actionPoints, `${path}.actionPoints`, 0, 2, true);
    ["sideActionsUsed", "jobShifts"].forEach((key) => number(life[key], `${path}.${key}`, 0, Number.MAX_SAFE_INTEGER, true));
    const listLimits = {
      inventory: 100, jobHistory: 100, sceneVisits: 80, flags: 80, secrets: 100,
      inheritedLegacyIds: 3, legacyCandidates: 20, selectedLegacies: 3,
      newAchievements: 100, newSecrets: 100, moments: 100, newMoments: 100,
    };
    Object.entries(listLimits).forEach(([key, maximum]) => list(life[key], `${path}.${key}`, maximum));
    list(life.actions, `${path}.actions`, 23, actionEntry);
    list(life.lifeLog, `${path}.lifeLog`, 120, logEntry);
    feedback(life.lastAction, `${path}.lastAction`, true);
    validateJourney(life, path);
    ["lifeFeedback", "sceneFeedback", "opportunityFeedback"].forEach((key) => feedback(life[key], `${path}.${key}`));
    if (life.carryForward !== null && life.carryForward !== undefined) {
      requireValue(isRecord(life.carryForward), `${path}.carryForward`);
      string(life.carryForward.title, `${path}.carryForward.title`);
      string(life.carryForward.copy, `${path}.carryForward.copy`);
      number(life.carryForward.age, `${path}.carryForward.age`, 1, 120, true);
    }
    const opportunity = life.opportunity;
    requireValue(isRecord(opportunity), `${path}.opportunity`);
    list(opportunity.drawnIds, `${path}.opportunity.drawnIds`, 3);
    requireValue(new Set(opportunity.drawnIds).size === opportunity.drawnIds.length, `${path}.opportunity.drawnIds`);
    requireValue(typeof opportunity.skipped === "boolean", `${path}.opportunity.skipped`);
    requireValue(opportunity.selectedId === null || typeof opportunity.selectedId === "string", `${path}.opportunity.selectedId`);
    if (opportunity.selectedId !== null) requireValue(opportunity.drawnIds.includes(opportunity.selectedId) && !opportunity.skipped, `${path}.opportunity.selectedId`);
    list(opportunity.history, `${path}.opportunity.history`, 23, opportunityEntry);
    const resolved = opportunity.selectedId !== null || opportunity.skipped;
    if (!resolved) requireValue(opportunity.drawnIds.length > 0 && !life.lastAction && life.actionPoints === 2, `${path}.opportunity`);
    if (life.lastAction) {
      const latest = life.actions[life.actions.length - 1];
      requireValue(resolved && Boolean(latest) && latest.round === life.round + 1 && latest.age === life.age, `${path}.lastAction`);
    }
    {
      requireValue(isRecord(life.build), `${path}.build`);
      numericMap(life.build.attributes, ["appearance", "intelligence", "physique", "family"], `${path}.build.attributes`);
      numericMap(life.build.interests, [], `${path}.build.interests`);
      list(life.build.talentIds, `${path}.build.talentIds`, 3);
      list(life.build.routeTags, `${path}.build.routeTags`, 100);
    }
    if (life.characters !== undefined) numericMap(life.characters, [], `${path}.characters`);
    if (life.strategy !== undefined) {
      validateStrategy(life.strategy, `${path}.strategy`, false, life.round);
      if (typeof global.EchoTownStrategy?.initLife === "function") {
        const canonical = global.EchoTownStrategy.initLife(clone(life));
        for (const [key, fields] of [["evidence", ["id", "kind", "round", "success"]], ["consequences", ["id", "round", "success"]]]) {
          const project = (entries) => entries.map((entry) => fields.map((field) => entry[field]));
          requireValue(JSON.stringify(project(life.strategy[key])) === JSON.stringify(project(canonical[key])), `${path}.strategy.${key}`);
        }
      }
    }
    if (life.ledger !== undefined) validateLedger(life.ledger, `${path}.ledger`);
    if (life.projects !== undefined) validateProjects(life.projects, `${path}.projects`, false, life);
    if (life.migration !== undefined) {
      requireValue(isRecord(life.migration) && life.migration.fromVersion === 7, `${path}.migration`);
      number(life.migration.round, `${path}.migration.round`, 0, 22, true);
      requireValue(STAGES.includes(life.migration.stageId) && life.migration.stageId === stageForRound(life.migration.round), `${path}.migration.stageId`);
      requireValue(typeof life.migration.deferGoals === "boolean", `${path}.migration.deferGoals`);
      if (life.migration.goalAccessVersion !== undefined) {
        requireValue(life.migration.goalAccessVersion === 1, `${path}.migration.goalAccessVersion`);
        list(life.migration.activeGoalIds, `${path}.migration.activeGoalIds`, 3, (id, itemPath) => {
          requireValue(ROUTES.some(routeId => id === routeId + ":" + life.migration.stageId), itemPath);
        });
        requireValue(new Set(life.migration.activeGoalIds).size === life.migration.activeGoalIds.length, `${path}.migration.activeGoalIds`);
      }
      numericMap(life.migration.legacyGoalProgress, GOAL_KEYS, `${path}.migration.legacyGoalProgress`);
    }
    if (life.status === "complete") {
      requireValue(saved.screen !== "game", "screen");
      requireValue(isRecord(life.outcome), `${path}.outcome`);
      ["title", "copy", "tone"].forEach((key) => string(life.outcome[key], `${path}.outcome.${key}`));
      number(life.outcome.score, `${path}.outcome.score`, -Number.MAX_SAFE_INTEGER);
      optionalList(life.outcome, "consequences", `${path}.outcome`, 100, (item, itemPath) => {
        if (typeof item === "string") return;
        requireValue(isRecord(item), itemPath);
        ["label", "detail", "copy"].forEach((key) => { if (item[key] !== undefined) string(item[key], `${itemPath}.${key}`); });
      });
      requireValue(life.generation === saved.world.completedLives, `${path}.generation`);
      requireValue(life.selectedLegacies.every((id) => life.legacyCandidates.includes(id)), `${path}.selectedLegacies`);
    } else {
      requireValue(saved.screen !== "ending", "screen");
      requireValue(life.outcome === null, `${path}.outcome`);
      requireValue(life.generation === saved.world.completedLives + 1, `${path}.generation`);
    }
  }

  function validateState(saved, acceptedVersions = CONTRACT.acceptedVersions) {
    try {
      requireValue(isRecord(saved), "state");
      if (!acceptedVersions.includes(saved.version)) throw error("WRONG_VERSION", "需要 v7、v8 或 v9 存档");
      requireValue(isRecord(saved.world), "world");
      number(saved.world.completedLives, "world.completedLives", 0, Number.MAX_SAFE_INTEGER, true);
      numericMap(saved.world.town, TOWN_KEYS, "world.town");
      list(saved.world.history, "world.history", 40, historyEntry);
      ["legacyBank", "collectedLegacyIds", "achievements", "secrets", "moments"].forEach((key) => list(saved.world[key], `world.${key}`, key === "legacyBank" ? 3 : 100));
      numericMap(saved.world.totals, ["choices", "tests", "testWins", "workShifts", "moneyEarned", "moneySpent"], "world.totals");
      requireValue(["start", "game", "ending", "archive"].includes(saved.screen), "screen");
      requireValue(typeof saved.introSeen === "boolean", "introSeen");
      requireValue(isRecord(saved.settings), "settings");
      ["fontScale", "sound"].forEach((key) => requireValue(typeof saved.settings[key] === "boolean", `settings.${key}`));
      if (saved.settings.volume !== undefined) number(saved.settings.volume, "settings.volume", 0, 1);
      if (saved.notice !== undefined) string(saved.notice, "notice");
      if (saved.setup !== undefined) {
        const setup = saved.setup;
        requireValue(isRecord(setup), "setup");
        ["profileId", "talentId", "goalId"].forEach((key) => string(setup[key], `setup.${key}`));
        requireValue(ROUTES.includes(setup.routeId), "setup.routeId");
        list(setup.talentIds, "setup.talentIds", 3);
        requireValue(new Set(setup.talentIds).size === setup.talentIds.length, "setup.talentIds");
        numericMap(setup.attributes, ["appearance", "intelligence", "physique", "family"], "setup.attributes");
        Object.values(setup.attributes).forEach((value) => number(value, "setup.attributes", 0, 10, true));
        requireValue(Object.values(setup.attributes).reduce((sum, value) => sum + value, 0) <= 20, "setup.attributes");
      }
      if (saved.currentLife === null) requireValue(!["game", "ending"].includes(saved.screen), "screen");
      else validateLife(saved.currentLife, saved);
      return { ok: true };
    } catch (caught) {
      return failure(caught);
    }
  }

  function byteLength(value) {
    if (typeof global.TextEncoder === "function") return new global.TextEncoder().encode(value).length;
    if (typeof global.Blob === "function") return new global.Blob([value]).size;
    let bytes = 0;
    for (const character of value) {
      const point = character.codePointAt(0);
      bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    }
    return bytes;
  }

  // Compact JSON is the sole persistent/export wire format. Do not add timestamps
  // by default: the same state must fit the same size limit on every round trip.
  function serialize(state, options = {}) {
    const payload = options.includeTimestamp === true ? { ...clone(state), exportedAt: new Date().toISOString() } : state;
    const text = JSON.stringify(payload);
    if (typeof text !== "string") throw error("INVALID_SAVE", "没有可导出的存档");
    if (byteLength(text) > CONTRACT.maxBytes) throw error("SAVE_TOO_LARGE", "有效存档超过 512 KiB，请先导出已有备份");
    return text;
  }

  function stageForRound(round) {
    return global.EchoTownContent?.rounds?.[round]?.stage || (round < 4 ? "childhood" : round < 7 ? "adolescence" : round < 11 ? "youth" : round < 17 ? "middle" : "later");
  }

  // Migration is additive. No normalization, truncation, rule replay or regrading.
  function migrateV7ToV8(saved) {
    const validated = validateState(saved, [7, 8]);
    if (!validated.ok) throw error(validated.code, validated.message, validated.path);
    const migrated = clone(saved);
    migrated.version = 8;
    if (migrated.settings.volume === undefined) migrated.settings.volume = 0.6;
    if (saved.version === 7 && migrated.currentLife) {
      const life = migrated.currentLife;
      life.migration = {
        fromVersion: 7,
        round: life.round,
        stageId: stageForRound(life.round),
        deferGoals: true,
        legacyGoalProgress: clone(life.progress),
      };
    }
    return migrated;
  }

  function migrateV8ToV9(saved) {
    const validated = validateState(saved, [8, 9]);
    if (!validated.ok) throw error(validated.code, validated.message, validated.path);
    const migrated = clone(saved);
    migrated.version = 9;
    // Only an empty project is added: old work/ledger/history never becomes
    // new project progress, and earlier v7 strategy admission stays intact.
    if (saved.version === 8 && migrated.currentLife && migrated.currentLife.projects === undefined) {
      migrated.currentLife.projects = initialProjects(migrated.currentLife);
    }
    return migrated;
  }

  function migrateToCurrent(saved) {
    const validated = validateState(saved);
    if (!validated.ok) throw error(validated.code, validated.message, validated.path);
    if (saved.version === 9) return clone(saved);
    return migrateV8ToV9(saved.version === 7 ? migrateV7ToV8(saved) : saved);
  }

  // options.normalize is accepted for call-site compatibility, but deliberately
  // not executed: the old normalizer discards v8 fields and rewrites v7 history.
  function prepareImport(text, options = {}) {
    void options;
    if (typeof text !== "string") return { ok: false, code: "INVALID_JSON", message: "存档不是有效 JSON" };
    if (byteLength(text) > CONTRACT.maxInputBytes) return { ok: false, code: "INPUT_TOO_LARGE", message: "导入文件超过 2 MiB" };
    let imported;
    try {
      imported = JSON.parse(text);
    } catch (caught) {
      return { ok: false, code: "INVALID_JSON", message: "存档不是有效 JSON" };
    }
    const validated = validateState(imported);
    if (!validated.ok) return validated;
    try {
      const state = migrateToCurrent(imported);
      const migratedValid = validateState(state, [CONTRACT.version]);
      if (!migratedValid.ok) return migratedValid;
      const payload = serialize(state);
      return { ok: true, state, payload, sourceVersion: imported.version, migrated: imported.version !== CONTRACT.version, rawSource: text };
    } catch (caught) {
      return failure(caught);
    }
  }

  function getStorage(options) {
    if (Object.prototype.hasOwnProperty.call(options, "storage")) return options.storage;
    try { return global.localStorage || null; } catch (caught) { return null; }
  }

  // Select exactly one source, in version precedence order. A corrupt source
  // or a clear marker stops the search; neither may resurrect an older save.
  function findPrimary(storage) {
    for (const [sourceKey, expectedVersion] of PRIMARY_KEYS) {
      const rawSource = storage.getItem(sourceKey);
      if (rawSource === null || rawSource === undefined) continue;
      const cleared = (expectedVersion === 9 && rawSource === CLEARED_MARKER)
        || (expectedVersion === 8 && rawSource === PREVIOUS_CLEARED_MARKER);
      return { sourceKey, expectedVersion, rawSource, cleared };
    }
    return null;
  }

  // Read-only. The composition root normalizes a candidate, commits migration,
  // and only then replaces its in-memory state. No older key is modified.
  function load(options = {}) {
    const storage = getStorage(options);
    if (!storage) return { ok: false, code: "STORAGE_UNAVAILABLE", message: "本地存档不可用，请及时导出备份" };
    try {
      const primary = findPrimary(storage);
      if (primary && !primary.cleared) {
        const { sourceKey, expectedVersion, rawSource } = primary;
        const result = prepareImport(rawSource);
        if (!result.ok) return { ...result, sourceKey, rawSource, recoveryRequired: true };
        if (result.sourceVersion !== expectedVersion) return { ok: false, code: "WRONG_STORAGE_VERSION", message: "本地存档版本与存储位置不一致，原档已保留", sourceKey, rawSource, recoveryRequired: true };
        return { ...result, sourceKey, needsCommit: expectedVersion !== CONTRACT.version };
      }
      const state = options.defaultState === undefined ? null : clone(options.defaultState);
      if (state) {
        const validated = validateState(state, [CONTRACT.version]);
        if (!validated.ok) return validated;
        if (state.settings.volume === undefined) state.settings.volume = 0.6;
      }
      const legacyFound = CONTRACT.legacyStorageKeys.some((key) => storage.getItem(key) !== null);
      return { ok: true, state, empty: true, cleared: Boolean(primary?.cleared), needsCommit: false, sourceKey: primary?.sourceKey || null, ...(legacyFound ? { message: "检测到更早版本存档，原档仍被保留" } : {}) };
    } catch (caught) {
      return { ok: false, code: "STORAGE_READ_FAILED", message: "本地存档读取失败，原档未改动" };
    }
  }

  function rawBackupKey(storage, rawSource, sourceVersion) {
    let hash = 2166136261;
    for (let index = 0; index < rawSource.length; index += 1) hash = Math.imul(hash ^ rawSource.charCodeAt(index), 16777619);
    const namespace = sourceVersion === 7 ? CONTRACT.v7BackupPrefix : CONTRACT.v8BackupPrefix;
    const prefix = `${namespace}${(hash >>> 0).toString(16)}-${byteLength(rawSource)}`;
    let key = prefix;
    let suffix = 0;
    let existing = storage.getItem(key);
    while (existing !== null && existing !== undefined && existing !== rawSource) {
      key = `${prefix}-${++suffix}`;
      existing = storage.getItem(key);
    }
    return key;
  }

  // localStorage.setItem is the commit point. All validation and backup writes
  // happen first; only the caller may replace its current in-memory state.
  function commitImport(prepared, currentState, options = {}) {
    const storage = getStorage(options);
    if (!storage) return { ok: false, code: "STORAGE_UNAVAILABLE", message: "本地存档不可用，当前进度未改变" };
    if (!prepared?.ok) return { ok: false, code: "INVALID_PREPARED_SAVE", message: "导入内容尚未通过校验" };
    const validated = validateState(prepared.state, [CONTRACT.version]);
    if (!validated.ok) return validated;
    let state;
    let payload;
    let backupPayload;
    try {
      state = clone(prepared.state);
      payload = serialize(state);
      if (!options.startupMigration) {
        const currentValidated = validateState(currentState);
        if (!currentValidated.ok) return { ...currentValidated, code: "BACKUP_INVALID", message: "当前进度无法备份，导入未提交" };
        backupPayload = serialize(currentState);
      }
    } catch (caught) {
      return failure(caught);
    }
    let sourceBackupKey = null;
    try {
      if (options.startupMigration) {
        requireValue([7, 8].includes(prepared.sourceVersion) && typeof prepared.rawSource === "string", "startupMigration");
        requireValue(prepared.sourceKey === (prepared.sourceVersion === 8 ? CONTRACT.previousStorageKey : CONTRACT.v7StorageKey), "startupMigration.sourceKey");
        const primary = findPrimary(storage);
        if (!primary || primary.cleared || primary.sourceKey !== prepared.sourceKey || primary.expectedVersion !== prepared.sourceVersion || primary.rawSource !== prepared.rawSource) {
          return { ok: false, code: "STORAGE_CHANGED", message: "本地进度已经变化，请重新读取后再迁移" };
        }
      } else {
        // Preserve the latest caller memory, which may be newer than its disk save.
        storage.setItem(CONTRACT.backupKey, backupPayload);
        if ([7, 8].includes(prepared.sourceVersion)) {
          requireValue(typeof prepared.rawSource === "string", "rawSource");
          sourceBackupKey = rawBackupKey(storage, prepared.rawSource, prepared.sourceVersion);
          if (storage.getItem(sourceBackupKey) !== prepared.rawSource) storage.setItem(sourceBackupKey, prepared.rawSource);
        }
      }
    } catch (caught) {
      return { ok: false, code: "BACKUP_WRITE_FAILED", message: "备份未能保存，当前进度未改变" };
    }
    try {
      storage.setItem(CONTRACT.storageKey, payload);
    } catch (caught) {
      return { ok: false, code: "STORAGE_WRITE_FAILED", message: "导入未能保存，当前进度未改变" };
    }
    return { ok: true, state, payload, sourceBackupKey, message: options.message || "已导入并保存" };
  }

  function persist(state, options = {}) {
    const storage = getStorage(options);
    if (!storage) return { ok: false, code: "STORAGE_UNAVAILABLE", message: "本地存档不可用" };
    const validated = validateState(state, [CONTRACT.version]);
    if (!validated.ok) return validated;
    try {
      const primary = findPrimary(storage);
      if (primary && !primary.cleared) {
        const current = prepareImport(primary.rawSource);
        if (!current.ok || current.sourceVersion !== primary.expectedVersion) return { ok: false, code: "RECOVERY_REQUIRED", message: "原存档已保护，请先导入有效备份或明确清除进度" };
        if (primary.expectedVersion !== CONTRACT.version) return { ok: false, code: "MIGRATION_REQUIRED", message: "旧存档需要先完成迁移，原档未改变" };
      }
      const payload = serialize(state);
      storage.setItem(CONTRACT.storageKey, payload);
      return { ok: true, payload, message: options.message || "已保存" };
    } catch (caught) {
      return caught.code ? failure(caught) : { ok: false, code: "STORAGE_WRITE_FAILED", message: "本地保存失败" };
    }
  }

  // The marker prevents the next startup from resurrecting preserved v8/v7.
  // One atomic write also lets callers reset memory only after success.
  function remove(options = {}) {
    const storage = getStorage(options);
    if (!storage) return { ok: false, code: "STORAGE_UNAVAILABLE", message: "本地存档不可用" };
    try {
      storage.setItem(CONTRACT.storageKey, CLEARED_MARKER);
      return { ok: true };
    } catch (caught) {
      return { ok: false, code: "STORAGE_WRITE_FAILED", message: "清除失败，原档仍被保留" };
    }
  }

  const MODE_CONTRACT = Object.freeze({
    pointerKey: "echo-town-mode-selection-v1",
    snapshotPrefix: "echo-town-mode-snapshot-v1:",
    challengeStorageKey: "echo-town-challenge-craft-start-v1-save-v9",
    challengeBackupKey: "echo-town-challenge-craft-start-v1-before-import",
    recoveryBackupPrefixes: Object.freeze({ main: "echo-town-mode-main-recovery-raw-", "craft-start-v1": "echo-town-challenge-craft-start-v1-recovery-raw-" }),
    challengeId: "craft-start-v1", rulesVersion: "6.2.0", seed: 277191004,
  });
  const SLOT_IDS = ["main", MODE_CONTRACT.challengeId];
  function slotIdValid(slotId) { requireValue(SLOT_IDS.includes(slotId), "slotId"); }
  function getModeDefinitions() {
    return [{ id: "main", label: "主人生" }, { id: MODE_CONTRACT.challengeId, label: "手艺人的第一世", rulesVersion: MODE_CONTRACT.rulesVersion, seed: MODE_CONTRACT.seed }];
  }
  function modeStorage(options) {
    const storage = getStorage(options);
    if (!storage) throw error("STORAGE_UNAVAILABLE", "本地存档不可用，当前进度未改变");
    return storage;
  }
  function readModeIndex(storage) {
    const raw = storage.getItem(MODE_CONTRACT.pointerKey);
    if (raw === null || raw === undefined) return { raw: null, value: { version: 1, activeSlotId: "main", refs: { main: null, [MODE_CONTRACT.challengeId]: null } }, exists: false };
    let value;
    try { value = JSON.parse(raw); } catch (_) { throw error("MODE_RECOVERY_REQUIRED", "模式记录损坏，原进度已保护"); }
    try {
      knownFields(value, ["version", "activeSlotId", "refs"], "modes");
      requireValue(value.version === 1, "modes.version"); slotIdValid(value.activeSlotId);
      knownFields(value.refs, SLOT_IDS, "modes.refs");
      SLOT_IDS.forEach(id => {
        const ref = value.refs[id];
        requireValue(ref === null || typeof ref === "string" && ref.startsWith(`${MODE_CONTRACT.snapshotPrefix}${id}:`) && /^[a-f0-9]+-[0-9]+(?:-[0-9]+)?$/.test(ref.slice(`${MODE_CONTRACT.snapshotPrefix}${id}:`.length)), `modes.refs.${id}`);
      });
    } catch (_) { throw error("MODE_RECOVERY_REQUIRED", "模式记录损坏，原进度已保护"); }
    return { raw, value, exists: true };
  }
  function getActiveSlot(options = {}) {
    try { const index = readModeIndex(modeStorage(options)); return { ok: true, slotId: index.value.activeSlotId }; }
    catch (caught) { return { ...failure(caught, "STORAGE_READ_FAILED"), recoveryRequired: true }; }
  }
  function requireActive(slotId, index) {
    slotIdValid(slotId);
    if (slotId !== index.value.activeSlotId) throw error("WRONG_ACTIVE_SLOT", "当前模式已经改变，请重新读取进度");
  }
  function validateChallengeState(state) {
    const result = validateState(state, [CONTRACT.version]);
    if (!result.ok) throw error(result.code, result.message, result.path);
    const life = state.currentLife;
    requireValue(isRecord(life), "challenge.currentLife");
    requireValue(life.generation === 1 && life.seed === MODE_CONTRACT.seed, "challenge.start");
    requireValue(life.profileId === "workshop-heir" && life.goalId === "learn" && life.talentId === "slow-and-steady", "challenge.profile");
    requireValue(state.world.completedLives === (life.status === "complete" ? 1 : 0), "challenge.completedLives");
    requireValue(state.world.history.length === state.world.completedLives, "challenge.history");
    requireValue(state.world.legacyBank.length === 0 && life.inheritedLegacyIds.length === 0, "challenge.legacy");
    const setup = state.setup;
    requireValue(isRecord(setup) && setup.profileId === "workshop-heir" && setup.goalId === "learn" && setup.routeId === "craft" && setup.talentId === "slow-and-steady", "challenge.setup");
    requireValue(JSON.stringify(setup.talentIds) === JSON.stringify(["slow-and-steady", "good-memory", "warm-heart"]), "challenge.setup.talentIds");
    Object.entries({ appearance: 3, intelligence: 5, physique: 6, family: 6 }).forEach(([key, value]) => requireValue(setup.attributes[key] === value, `challenge.setup.attributes.${key}`));
    return state;
  }
  function serializeSlot(slotId, state) {
    slotIdValid(slotId);
    if (slotId === "main") return serialize(state);
    validateChallengeState(state);
    const payload = JSON.stringify({ format: "echo-town-challenge", version: 1, challengeId: MODE_CONTRACT.challengeId, rulesVersion: MODE_CONTRACT.rulesVersion, state });
    if (byteLength(payload) > CONTRACT.maxBytes) throw error("SAVE_TOO_LARGE", "有效存档超过 512 KiB，未保存");
    return payload;
  }
  function prepareSlotImport(slotId, text, options = {}) {
    try {
      slotIdValid(slotId);
      if (slotId === "main") { const result = prepareImport(text, options); return result.ok ? { ...result, slotId } : result; }
      requireValue(typeof text === "string", "challenge.file");
      if (byteLength(text) > CONTRACT.maxInputBytes) return { ok: false, code: "INPUT_TOO_LARGE", message: "导入文件超过 2 MiB" };
      let envelope;
      try { envelope = JSON.parse(text); } catch (_) { return { ok: false, code: "INVALID_JSON", message: "存档不是有效 JSON" }; }
      knownFields(envelope, ["format", "version", "challengeId", "rulesVersion", "state"], "challenge");
      requireValue(envelope.format === "echo-town-challenge" && envelope.version === 1 && envelope.challengeId === MODE_CONTRACT.challengeId && envelope.rulesVersion === MODE_CONTRACT.rulesVersion, "challenge.identity");
      validateChallengeState(envelope.state);
      const state = clone(envelope.state);
      const payload = serializeSlot(slotId, state);
      return { ok: true, slotId, state, payload, sourceVersion: 9, migrated: false, rawSource: text };
    } catch (caught) { return failure(caught); }
  }
  function primaryForSlot(storage, index, slotId) {
    const ref = index.value.refs[slotId];
    if (ref !== null) {
      const rawSource = storage.getItem(ref);
      if (typeof rawSource !== "string") throw error("MODE_RECOVERY_REQUIRED", "模式引用的进度缺失，原记录已保护");
      return { sourceKey: ref, expectedVersion: 9, rawSource, cleared: rawSource === CLEARED_MARKER };
    }
    if (slotId === "main") return findPrimary(storage);
    const rawSource = storage.getItem(MODE_CONTRACT.challengeStorageKey);
    return rawSource === null || rawSource === undefined ? null : { sourceKey: MODE_CONTRACT.challengeStorageKey, expectedVersion: 9, rawSource, cleared: rawSource === CLEARED_MARKER };
  }
  // The adapter is private and read-only: callers cannot choose arbitrary keys,
  // and a challenge can never observe a main or legacy source through it.
  function slotReadAdapter(storage, slotId, primary) {
    let currentRaw = primary?.rawSource ?? null;
    if (slotId !== "main" && primary && !primary.cleared) {
      const parsed = prepareSlotImport(slotId, currentRaw);
      if (!parsed.ok) throw error(parsed.code, parsed.message, parsed.path);
      currentRaw = serialize(parsed.state);
    }
    return { getItem(key) {
      if (key === CONTRACT.storageKey) return primary?.expectedVersion === 9 ? currentRaw : null;
      if (slotId === "main" && primary?.sourceKey === key) return currentRaw;
      if (slotId === "main" && CONTRACT.legacyStorageKeys.includes(key)) return storage.getItem(key);
      return null;
    } };
  }
  function loadSlot(slotId, options = {}) {
    try {
      slotIdValid(slotId);
      const storage = modeStorage(options), index = readModeIndex(storage);
      const primary = primaryForSlot(storage, index, slotId);
      const loaded = load({ ...options, storage: slotReadAdapter(storage, slotId, primary) });
      if (!loaded.ok) return { ...loaded, slotId, recoveryRequired: true };
      if (loaded.state && slotId !== "main") validateChallengeState(loaded.state);
      return { ...loaded, slotId, sourceKey: primary?.sourceKey || null,
        rawSource: primary?.rawSource, modeIndexRaw: index.raw,
        modeSource: { slotId, key: primary?.sourceKey || null, raw: primary?.rawSource ?? null } };
    } catch (caught) { return { ...failure(caught, "STORAGE_READ_FAILED"), slotId, recoveryRequired: true }; }
  }
  function loadMain(options = {}) { return loadSlot("main", options); }
  function loadActive(options = {}) {
    const active = getActiveSlot(options);
    if (!active.ok) return active;
    const slotId = active.slotId;
    const loaded = loadSlot(slotId, { ...options, defaultState: slotId === "main" ? options.defaultState : undefined });
    if (!loaded.ok || slotId === "main" || !loaded.empty) return loaded;
    try {
      requireValue(typeof options.createTarget === "function", "createTarget");
      const state = options.createTarget(slotId);
      validateChallengeState(state);
      return { ...loaded, state: clone(state), needsCommit: true };
    } catch (caught) { return failure(caught); }
  }
  function assertUnchanged(storage, index, sources = []) {
    const current = storage.getItem(MODE_CONTRACT.pointerKey) ?? null;
    if (current !== index.raw) throw error("STORAGE_CHANGED", "本地进度已经变化，请重新读取后再操作");
    sources.forEach(source => {
      if (!source) return;
      if (source.recovery) {
        if ((storage.getItem(source.key) ?? null) !== source.raw) throw error("STORAGE_CHANGED", "恢复期间原始进度已经变化，请重新读取");
        return;
      }
      const primary = primaryForSlot(storage, index, source.slotId);
      if ((primary?.sourceKey || null) !== source.key || (primary?.rawSource ?? null) !== source.raw) throw error("STORAGE_CHANGED", "本地进度已经变化，请重新读取后再操作");
    });
  }
  function snapshot(storage, slotId, payload, protectedKeys) {
    let hash = 2166136261;
    for (let n = 0; n < payload.length; n += 1) hash = Math.imul(hash ^ payload.charCodeAt(n), 16777619);
    const prefix = `${MODE_CONTRACT.snapshotPrefix}${slotId}:${(hash >>> 0).toString(16)}-${byteLength(payload)}`;
    let key = prefix, suffix = 0, existing = storage.getItem(key);
    while (existing !== null && existing !== undefined && existing !== payload || (existing === null || existing === undefined) && protectedKeys.has(key)) { key = `${prefix}-${++suffix}`; existing = storage.getItem(key); }
    if (existing !== payload) storage.setItem(key, payload);
    return key;
  }
  function collectSnapshots(storage) {
    // Cleanup is best effort after commit, never a reason to report a committed
    // transaction as failed. Read the latest pointer again before deleting.
    try {
      if (typeof storage.key !== "function" || typeof storage.removeItem !== "function") return;
      const index = readModeIndex(storage);
      if (!index.exists) return;
      const keep = new Set(Object.values(index.value.refs));
      // Recovery backups preserve both the exact corrupt raw payload and its
      // original reference. Do not let later successful autosaves erase it.
      for (let n = 0; n < storage.length; n += 1) {
        const key = storage.key(n);
        if (typeof key !== "string" || !Object.values(MODE_CONTRACT.recoveryBackupPrefixes).some(prefix => key.startsWith(prefix))) continue;
        try {
          const backup = JSON.parse(storage.getItem(key));
          if (backup?.format === "echo-town-recovery-source" && backup.version === 1 && SLOT_IDS.includes(backup.slotId) && typeof backup.sourceKey === "string" && backup.sourceKey.startsWith(`${MODE_CONTRACT.snapshotPrefix}${backup.slotId}:`)) keep.add(backup.sourceKey);
        } catch (_) { /* An unreadable backup never authorizes removal of an active ref. */ }
      }
      const stale = [];
      for (let n = 0; n < storage.length; n += 1) {
        const key = storage.key(n);
        if (typeof key === "string" && key.startsWith(MODE_CONTRACT.snapshotPrefix) && !keep.has(key)) stale.push(key);
      }
      for (const key of stale) {
        if ((storage.getItem(MODE_CONTRACT.pointerKey) ?? null) !== index.raw) return;
        storage.removeItem(key);
      }
    } catch (_) { /* Current refs remain usable even if storage denies cleanup. */ }
  }
  function commitSnapshots(storage, index, payloads, activeSlotId, sources = []) {
    assertUnchanged(storage, index, sources);
    const next = clone(index.value);
    const protectedKeys = new Set(Object.values(index.value.refs));
    if (typeof storage.key === "function") for (let n = 0; n < storage.length; n += 1) {
      const key = storage.key(n);
      if (typeof key !== "string" || !Object.values(MODE_CONTRACT.recoveryBackupPrefixes).some(prefix => key.startsWith(prefix))) continue;
      try { const backup = JSON.parse(storage.getItem(key)); if (backup?.format === "echo-town-recovery-source" && backup.version === 1 && SLOT_IDS.includes(backup.slotId) && typeof backup.sourceKey === "string") protectedKeys.add(backup.sourceKey); } catch (_) {}
    }
    Object.entries(payloads).forEach(([slotId, payload]) => { next.refs[slotId] = snapshot(storage, slotId, payload, protectedKeys); });
    assertUnchanged(storage, index, sources);
    next.activeSlotId = activeSlotId;
    storage.setItem(MODE_CONTRACT.pointerKey, JSON.stringify(next));
    collectSnapshots(storage);
  }
  function validatedPayload(slotId, state) {
    const valid = validateState(state, [CONTRACT.version]);
    if (!valid.ok) throw error(valid.code, valid.message, valid.path);
    return serializeSlot(slotId, state);
  }
  function commitLoad(loaded, options = {}) {
    try {
      requireValue(loaded?.ok && SLOT_IDS.includes(loaded.slotId), "loaded");
      const storage = modeStorage(options), index = readModeIndex(storage);
      requireActive(loaded.slotId, index);
      if (index.raw !== loaded.modeIndexRaw) throw error("STORAGE_CHANGED", "模式记录已经变化，请重新读取");
      assertUnchanged(storage, index, [loaded.modeSource]);
      if (!loaded.needsCommit) return { ...loaded, state: loaded.state ? clone(loaded.state) : null };
      const payload = validatedPayload(loaded.slotId, loaded.state);
      if (!index.exists && loaded.slotId === "main") {
        const result = commitImport(loaded, null, { ...options, storage, startupMigration: true });
        return { ...result, slotId: "main" };
      }
      commitSnapshots(storage, index, { [loaded.slotId]: payload }, loaded.slotId, [loaded.modeSource]);
      return { ok: true, slotId: loaded.slotId, state: clone(loaded.state), payload };
    } catch (caught) { return failure(caught, "STORAGE_WRITE_FAILED"); }
  }
  function persistSlot(slotId, state, options = {}) {
    try {
      const storage = modeStorage(options), index = readModeIndex(storage);
      requireActive(slotId, index);
      if (!index.exists && slotId === "main") return { ...persist(state, { ...options, storage }), slotId };
      const loaded = loadSlot(slotId, { storage });
      if (!loaded.ok) return { ...loaded, code: "RECOVERY_REQUIRED" };
      if (loaded.needsCommit) return { ok: false, code: "MIGRATION_REQUIRED", message: "旧存档需要先完成迁移" };
      const payload = validatedPayload(slotId, state);
      commitSnapshots(storage, index, { [slotId]: payload }, slotId, [loaded.modeSource]);
      return { ok: true, slotId, payload, message: options.message || "已保存" };
    } catch (caught) { return failure(caught, "STORAGE_WRITE_FAILED"); }
  }
  function persistMain(state, options = {}) { return persistSlot("main", state, options); }
  function recoverySource(storage, index, slotId) {
    const ref = index.value.refs[slotId];
    if (ref !== null) return { recovery: true, key: ref, raw: storage.getItem(ref) ?? null };
    const primary = primaryForSlot(storage, index, slotId);
    requireValue(Boolean(primary), "recovery.source");
    return { recovery: true, key: primary.sourceKey, raw: primary.rawSource };
  }
  function saveRecoverySource(storage, slotId, source) {
    const payload = JSON.stringify({ format: "echo-town-recovery-source", version: 1, slotId, sourceKey: source.key, rawSource: source.raw });
    let hash = 2166136261;
    for (let n = 0; n < payload.length; n += 1) hash = Math.imul(hash ^ payload.charCodeAt(n), 16777619);
    const prefix = `${MODE_CONTRACT.recoveryBackupPrefixes[slotId]}${(hash >>> 0).toString(16)}-${byteLength(payload)}`;
    let key = prefix, suffix = 0, existing = storage.getItem(key);
    while (existing !== null && existing !== undefined && existing !== payload) { key = `${prefix}-${++suffix}`; existing = storage.getItem(key); }
    if (existing !== payload) storage.setItem(key, payload);
    return key;
  }
  function commitSlotImport(slotId, prepared, currentState, options = {}) {
    try {
      const storage = modeStorage(options), index = readModeIndex(storage);
      requireActive(slotId, index);
      requireValue(prepared?.ok && (prepared.slotId === slotId || slotId === "main" && prepared.slotId === undefined), "prepared.slotId");
      if (!index.exists && slotId === "main" && !options.recovery) return { ...commitImport(prepared, currentState, { ...options, storage }), slotId };
      const state = clone(prepared.state), payload = validatedPayload(slotId, state);
      const loaded = loadSlot(slotId, { storage });
      if (options.recovery && loaded.ok) throw error("STORAGE_CHANGED", "原槽位现在已有有效进度，请重新读取后再决定导入");
      const damagedSource = loaded.ok ? null : recoverySource(storage, index, slotId);
      const sources = [damagedSource || loaded.modeSource];
      // A boot recovery shell is not a playable challenge and must never
      // replace the last valid before-import backup. Preserve its damaged
      // disk source separately; ordinary imports still back up latest memory.
      const backupPayload = options.recovery ? null : validatedPayload(slotId, currentState);
      const backupKey = slotId === "main" ? CONTRACT.backupKey : MODE_CONTRACT.challengeBackupKey;
      let sourceBackupKey = null, recoveryBackupKey = null;
      assertUnchanged(storage, index, sources);
      try {
        if (damagedSource) recoveryBackupKey = saveRecoverySource(storage, slotId, damagedSource);
        if (backupPayload !== null) storage.setItem(backupKey, backupPayload);
        if (slotId === "main" && [7, 8].includes(prepared.sourceVersion)) {
          requireValue(typeof prepared.rawSource === "string", "rawSource");
          sourceBackupKey = rawBackupKey(storage, prepared.rawSource, prepared.sourceVersion);
          if (storage.getItem(sourceBackupKey) !== prepared.rawSource) storage.setItem(sourceBackupKey, prepared.rawSource);
        }
      } catch (_) { return { ok: false, code: "BACKUP_WRITE_FAILED", message: "备份未能保存，当前进度未改变" }; }
      commitSnapshots(storage, index, { [slotId]: payload }, slotId, sources);
      return { ok: true, slotId, state, payload, sourceBackupKey, recoveryBackupKey, message: options.message || "已导入并保存" };
    } catch (caught) { return failure(caught, "STORAGE_WRITE_FAILED"); }
  }
  function commitMainImport(prepared, currentState, options = {}) { return commitSlotImport("main", prepared, currentState, options); }
  function removeSlot(slotId, options = {}) {
    try {
      const storage = modeStorage(options), index = readModeIndex(storage);
      requireActive(slotId, index);
      if (!index.exists && slotId === "main") return { ...remove({ ...options, storage }), slotId };
      commitSnapshots(storage, index, { [slotId]: CLEARED_MARKER }, slotId);
      return { ok: true, slotId };
    } catch (caught) { return failure(caught, "STORAGE_WRITE_FAILED"); }
  }
  function removeMain(options = {}) { return removeSlot("main", options); }
  function switchSlot(targetSlotId, currentState, options = {}) {
    try {
      slotIdValid(targetSlotId);
      slotIdValid(options.expectedSourceSlotId);
      requireValue(typeof options.normalize === "function", "normalize");
      requireValue(!options.resetTarget || targetSlotId !== "main", "resetTarget");
      const storage = modeStorage(options), index = readModeIndex(storage), sourceSlotId = index.value.activeSlotId;
      requireActive(options.expectedSourceSlotId, index);
      const source = loadSlot(sourceSlotId, { storage });
      if (!source.ok) return source;
      const target = targetSlotId === sourceSlotId ? source : loadSlot(targetSlotId, { storage, defaultState: targetSlotId === "main" ? options.defaultState : undefined });
      if (!target.ok) return target;
      const current = options.normalize(clone(currentState));
      const sourcePayload = validatedPayload(sourceSlotId, current);
      let candidate;
      if (options.resetTarget || targetSlotId !== "main" && target.empty) {
        requireValue(typeof options.createTarget === "function", "createTarget");
        candidate = options.createTarget(targetSlotId);
      } else candidate = targetSlotId === sourceSlotId ? current : target.state;
      requireValue(candidate !== null && candidate !== undefined, "targetState");
      const state = options.normalize(clone(candidate));
      const targetPayload = validatedPayload(targetSlotId, state);
      if (options.resetTarget) storage.setItem(MODE_CONTRACT.challengeBackupKey, targetSlotId === sourceSlotId ? sourcePayload : target.empty ? targetPayload : validatedPayload(targetSlotId, target.state));
      commitSnapshots(storage, index, { [sourceSlotId]: sourcePayload, [targetSlotId]: targetPayload }, targetSlotId, [source.modeSource, target.modeSource]);
      return { ok: true, slotId: targetSlotId, state: clone(state), payload: targetPayload };
    } catch (caught) { return failure(caught, "STORAGE_WRITE_FAILED"); }
  }


  global.EchoTownSave = {
    CONTRACT, clone, byteLength, serialize, validateState, validateProjects,
    migrateV7ToV8, migrateV8ToV9, migrateToCurrent, findPrimary,
    prepareImport, commitImport: commitMainImport, load: loadMain, persist: persistMain, parse: prepareImport,
    import: prepareImport, remove: removeMain,
    MODE_CONTRACT, getModeDefinitions, getActiveSlot, loadSlot, loadActive, commitLoad,
    persistSlot, prepareSlotImport, commitSlotImport, removeSlot, serializeSlot, switchSlot,
  };
})(window);
