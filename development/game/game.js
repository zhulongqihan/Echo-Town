(function () {
  "use strict";

  const CONTENT = window.EchoTownContent;
  const STORAGE_KEY = "echo-town-generation-save";
  const LEGACY_STORAGE_KEYS = ["echo-town-generation-save-v5", "echo-town-generation-save-v4", "echo-town-save", "echo-town-mvp-v1"];
  const SAVE_VERSION = 6;
  const MAX_SAVE_BYTES = 512 * 1024;
  const MAX_HISTORY = 40;
  const MAX_TEXT_LENGTH = 280;
  const RESOURCE_KEYS = Object.keys(CONTENT.resources);
  const SKILL_KEYS = Object.keys(CONTENT.skills);
  const RELATIONSHIP_KEYS = Object.keys(CONTENT.relationships);
  const WORLD_KEYS = Object.keys(CONTENT.world);
  const FLAG_LABELS = {
    "yard-friend": "院子里的朋友",
    radio: "收音机线索",
    "paper-fold": "画报折角",
    "shop-key": "没有锁上的门",
    workshop: "正式作坊",
    "left-town": "走出小镇",
    mentor: "带过新人",
    letter: "旧友来信",
    successor: "培养了接班人",
    "life-record": "写下人生记录",
    "clock-opened": "拆过祁叔的钟",
    "echo-heard": "听见第十三声",
    "worked-shop": "修理铺帮过工",
    "worked-tutor": "教过一个学生",
    "worked-market": "在集市跑过摊",
    "worked-courier": "走过一趟远路",
    "worked-night": "熬过一班夜",
    "worked-town": "接过小镇项目",
    "in-debt": "账单压在身上",
    "bought-item": "给生活添了一件东西",
    "first-wage": "拿到第一笔工资",
  };
  const LEGACY_ID_MAP = {
    "work-habit": "steady-habit",
    "old-address": "friend-letter",
    toolbox: "small-tool",
    "apprentice-notebook": "apprentice-notes",
    "customer-list": "friend-letter",
    "town-key": "shop-key",
    "complete-record": "town-register",
    "outside-view": "travel-postcard",
    "warm-letter": "family-recipe",
  };

  const DEFAULT_STATE = {
    version: SAVE_VERSION,
    world: {
      completedLives: 0,
      town: { shop: 0, bridge: 0, school: 0, market: 0, archive: 0 },
      history: [],
      legacyBank: [],
      collectedLegacyIds: [],
      achievements: [],
      secrets: [],
      totals: { choices: 0, tests: 0, testWins: 0, workShifts: 0, moneyEarned: 0, moneySpent: 0 },
    },
    currentLife: null,
    screen: "start",
    settings: { fontScale: false },
    notice: "",
  };

  let state = loadState();
  let setup = { profileId: "town-child", talentId: "slow-and-steady", goalId: "learn" };
  let toastTimer = null;

  const $ = (selector) => document.querySelector(selector);

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function safeText(value, limit = MAX_TEXT_LENGTH) {
    return String(value ?? "").slice(0, limit);
  }

  function safeList(value, limit, textLimit = MAX_TEXT_LENGTH) {
    return Array.isArray(value) ? value.slice(0, limit).map((item) => safeText(item, textLimit)) : [];
  }

  function clamp(value, min, max, fallback = min) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return safeText(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function hashSeed(source) {
    let hash = 2166136261;
    const text = String(source);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function makeLifeSeed(generation, profileId, talentId, goalId, legacyIds) {
    return hashSeed(["echo-town", generation, profileId, talentId, goalId, ...(legacyIds || [])].join(":"));
  }

  function getProfile(id) {
    return CONTENT.profiles.find((item) => item.id === id) || CONTENT.profiles[0];
  }

  function getTalent(id) {
    return CONTENT.talents.find((item) => item.id === id) || CONTENT.talents[0];
  }

  function getGoal(id) {
    return CONTENT.goals.find((item) => item.id === id) || CONTENT.goals[0];
  }

  function getLegacy(id) {
    return CONTENT.legacies.find((item) => item.id === id) || null;
  }

  function getItem(id) {
    return CONTENT.items.find((item) => item.id === id) || null;
  }

  function getLifeAction(id) {
    return CONTENT.lifeActions.find((item) => item.id === id) || null;
  }

  function getJob(id) {
    return CONTENT.jobs.find((item) => item.id === id) || null;
  }

  function getLivingCost(age) {
    return CONTENT.livingCosts.find((item) => age <= item.maxAge) || CONTENT.livingCosts[CONTENT.livingCosts.length - 1];
  }

  function getAchievement(id) {
    return CONTENT.achievements.find((item) => item.id === id) || null;
  }

  function getSecret(id) {
    return CONTENT.secrets.find((item) => item.id === id) || null;
  }

  function getStage(id) {
    return CONTENT.stages.find((item) => item.id === id) || CONTENT.stages[0];
  }

  function getRound(life) {
    return CONTENT.rounds[clamp(life.round, 0, CONTENT.rounds.length - 1, 0)];
  }

  function defaultMap(keys, min = 0) {
    return Object.fromEntries(keys.map((key) => [key, min]));
  }

  function normalizeMap(value, keys, limits) {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(keys.map((key) => {
      const [min, max] = limits[key] || [0, 10];
      return [key, clamp(source[key], min, max, min)];
    }));
  }

  function normalizeTown(value) {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(WORLD_KEYS.map((key) => [key, clamp(source[key], 0, CONTENT.world[key].values.length - 1, 0)]));
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(-MAX_HISTORY).filter(isRecord).map((entry) => ({
      generation: clamp(entry.generation, 1, 9999, 1),
      age: clamp(entry.age, 1, 120, 75),
      profileId: safeText(entry.profileId, 50),
      talentId: safeText(entry.talentId, 50),
      goalId: safeText(entry.goalId, 50),
      outcomeTitle: safeText(entry.outcomeTitle, 120),
      outcomeCopy: safeText(entry.outcomeCopy, MAX_TEXT_LENGTH),
      goalProgress: clamp(entry.goalProgress, 0, 99, 0),
      goalTarget: clamp(entry.goalTarget, 1, 99, 8),
      bestSkill: safeText(entry.bestSkill, 50),
      activityCount: clamp(entry.activityCount, 0, CONTENT.maxLifeLog + CONTENT.maxRounds, 23),
      jobId: safeText(entry.jobId, 50),
      cashflow: {
        income: clamp(entry.cashflow?.income, 0, 99999, 0),
        expenses: clamp(entry.cashflow?.expenses, 0, 99999, 0),
        debt: clamp(entry.cashflow?.debt, 0, 99999, 0),
      },
      inventory: safeList(entry.inventory, CONTENT.maxInventory, 60).filter((id, index, list) => getItem(id) && list.indexOf(id) === index),
      lifeLog: Array.isArray(entry.lifeLog) ? entry.lifeLog.slice(-12).filter(isRecord).map((item) => ({
        age: clamp(item.age, 1, 120, 6),
        label: safeText(item.label, 100),
        result: safeText(item.result, MAX_TEXT_LENGTH),
        kind: safeText(item.kind, 30),
      })) : [],
      actions: Array.isArray(entry.actions) ? entry.actions.slice(-CONTENT.maxRounds).filter(isRecord).map((action) => ({
        round: clamp(action.round, 1, CONTENT.maxRounds, 1),
        age: clamp(action.age, 1, 120, 6),
        label: safeText(action.label, 100),
        result: safeText(action.result, MAX_TEXT_LENGTH),
        success: action.success !== false,
      })) : [],
      legacyIds: safeList(entry.legacyIds, CONTENT.maxLegacyChoices, 60),
      achievementIds: safeList(entry.achievementIds, 20, 60),
      secretIds: safeList(entry.secretIds, 20, 60),
    }));
  }

  function oldToNewId(id) {
    return LEGACY_ID_MAP[id] || id;
  }

  function normalizeLife(savedLife) {
    if (!isRecord(savedLife) || !isRecord(savedLife.skills)) return null;
    const maxEnergy = clamp(savedLife.maxResources?.energy, 10, 12, 10);
    const resourceLimits = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, [0, key === "energy" ? maxEnergy : CONTENT.resources[key].max]]));
    const resources = normalizeMap(savedLife.resources, RESOURCE_KEYS, resourceLimits);
    const skills = normalizeMap(savedLife.skills, SKILL_KEYS, Object.fromEntries(SKILL_KEYS.map((key) => [key, [0, 10]])));
    const relationships = normalizeMap(savedLife.relationships, RELATIONSHIP_KEYS, Object.fromEntries(RELATIONSHIP_KEYS.map((key) => [key, [0, 10]])));
    return {
      status: savedLife.status === "complete" ? "complete" : "active",
      generation: clamp(savedLife.generation, 1, 9999, 1),
      age: clamp(savedLife.age, 1, 120, 6),
      round: clamp(savedLife.round, 0, CONTENT.maxRounds - 1, 0),
      seed: clamp(savedLife.seed, 0, 4294967295, makeLifeSeed(savedLife.generation, savedLife.profileId, savedLife.talentId, savedLife.goalId, savedLife.inheritedLegacyIds)),
      profileId: getProfile(savedLife.profileId).id,
      talentId: getTalent(savedLife.talentId).id,
      goalId: getGoal(savedLife.goalId).id,
      resources,
      maxResources: { energy: maxEnergy },
      skills,
      relationships,
      town: normalizeTown(savedLife.town),
      actionPoints: clamp(savedLife.actionPoints, 0, CONTENT.actionPointsPerRound, CONTENT.actionPointsPerRound),
      sideActionsUsed: clamp(savedLife.sideActionsUsed, 0, CONTENT.maxLifeLog, 0),
      inventory: safeList(savedLife.inventory, CONTENT.maxInventory, 60).filter((id, index, list) => getItem(id) && list.indexOf(id) === index),
      jobId: getJob(savedLife.jobId)?.id || "none",
      jobShifts: clamp(savedLife.jobShifts, 0, CONTENT.maxLifeLog, 0),
      cashflow: {
        income: clamp(savedLife.cashflow?.income, 0, 99999, 0),
        expenses: clamp(savedLife.cashflow?.expenses, 0, 99999, 0),
        debt: clamp(savedLife.cashflow?.debt, 0, 99999, 0),
      },
      lifeLog: Array.isArray(savedLife.lifeLog) ? savedLife.lifeLog.slice(-CONTENT.maxLifeLog).filter(isRecord).map((entry) => ({
        age: clamp(entry.age, 1, 120, 6),
        label: safeText(entry.label, 100),
        result: safeText(entry.result, MAX_TEXT_LENGTH),
        kind: safeText(entry.kind, 30),
      })) : [],
      lifeFeedback: isRecord(savedLife.lifeFeedback) ? savedLife.lifeFeedback : null,
      flags: safeList(savedLife.flags, 80, 80),
      secrets: safeList(savedLife.secrets, CONTENT.secrets.length, 60),
      progress: normalizeMap(savedLife.progress, CONTENT.goals.map((goal) => goal.id), Object.fromEntries(CONTENT.goals.map((goal) => [goal.id, [0, goal.target]]))),
      inheritedLegacyIds: safeList(savedLife.inheritedLegacyIds, CONTENT.maxLegacyChoices, 60),
      actions: Array.isArray(savedLife.actions) ? savedLife.actions.slice(-CONTENT.maxRounds).filter(isRecord) : [],
      lastAction: isRecord(savedLife.lastAction) ? savedLife.lastAction : null,
      outcome: isRecord(savedLife.outcome) ? savedLife.outcome : null,
      legacyCandidates: safeList(savedLife.legacyCandidates, 20, 60),
      selectedLegacies: safeList(savedLife.selectedLegacies, CONTENT.maxLegacyChoices, 60),
      newAchievements: safeList(savedLife.newAchievements, 20, 60),
      newSecrets: safeList(savedLife.newSecrets, 20, 60),
    };
  }

  function normalizeState(saved) {
    const fresh = clone(DEFAULT_STATE);
    if (!isRecord(saved)) return fresh;
    const savedWorld = isRecord(saved.world) ? saved.world : {};
    const oldTown = isRecord(savedWorld.town) ? savedWorld.town : {};
    const world = {
      completedLives: clamp(savedWorld.completedLives, 0, 9999, 0),
      town: normalizeTown({ ...oldTown, shop: oldTown.shop ?? 0, archive: oldTown.archive ?? 0 }),
      history: normalizeHistory(savedWorld.history),
      legacyBank: safeList(savedWorld.legacyBank, CONTENT.maxLegacyChoices, 60).map(oldToNewId).filter((id, index, list) => getLegacy(id) && list.indexOf(id) === index),
      collectedLegacyIds: safeList(savedWorld.collectedLegacyIds, CONTENT.legacies.length, 60).map(oldToNewId).filter((id, index, list) => getLegacy(id) && list.indexOf(id) === index),
      achievements: safeList(savedWorld.achievements, CONTENT.achievements.length, 60).filter((id, index, list) => getAchievement(id) && list.indexOf(id) === index),
      secrets: safeList(savedWorld.secrets, CONTENT.secrets.length, 60).filter((id, index, list) => getSecret(id) && list.indexOf(id) === index),
      totals: {
        choices: clamp(savedWorld.totals?.choices, 0, 99999, 0),
        tests: clamp(savedWorld.totals?.tests, 0, 99999, 0),
        testWins: clamp(savedWorld.totals?.testWins, 0, 99999, 0),
        workShifts: clamp(savedWorld.totals?.workShifts, 0, 99999, 0),
        moneyEarned: clamp(savedWorld.totals?.moneyEarned, 0, 9999999, 0),
        moneySpent: clamp(savedWorld.totals?.moneySpent, 0, 9999999, 0),
      },
    };
    const isRichSave = Number(saved.version) === SAVE_VERSION && isRecord(saved.currentLife) && isRecord(saved.currentLife.skills);
    const currentLife = isRichSave ? normalizeLife(saved.currentLife) : null;
    fresh.version = SAVE_VERSION;
    fresh.world = world;
    fresh.currentLife = currentLife;
    fresh.screen = currentLife && ["start", "game", "ending"].includes(saved.screen) ? saved.screen : "start";
    fresh.settings.fontScale = Boolean(saved.settings?.fontScale);
    fresh.notice = safeText(saved.notice, MAX_TEXT_LENGTH);
    return fresh;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Number(saved.version) === SAVE_VERSION) return normalizeState(saved);
      }
      const fresh = clone(DEFAULT_STATE);
      if (LEGACY_STORAGE_KEYS.some((key) => Boolean(localStorage.getItem(key)))) {
        fresh.notice = "检测到旧版人生存档。旧存档仍被保留；生活经营版将从新一世开始，避免把两套规则混在一起。";
      }
      return fresh;
    } catch (error) {
      return { ...clone(DEFAULT_STATE), notice: "本地存档读取失败，当前可以重新开始；请先导出备份。" };
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = safeText(message, 180);
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function persist(message = "已保存") {
    try {
      state.version = SAVE_VERSION;
      const payload = JSON.stringify(state);
      if (payload.length > MAX_SAVE_BYTES) throw new Error("save-too-large");
      localStorage.setItem(STORAGE_KEY, payload);
      const status = $("#save-status");
      if (status) status.textContent = message;
    } catch (error) {
      const status = $("#save-status");
      if (status) status.textContent = "保存失败，请导出备份";
      showToast("本地保存失败，但当前页面仍可继续；请导出存档");
    }
  }

  function exportSave() {
    try {
      const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `echo-town-save-v${SAVE_VERSION}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("存档已导出");
    } catch (error) {
      showToast("存档导出失败");
    }
  }

  function importSave(file) {
    if (!file || file.size > MAX_SAVE_BYTES) {
      showToast("导入失败：文件超过 512 KiB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!isRecord(imported) || Number(imported.version) !== SAVE_VERSION) throw new Error("wrong-version");
        const normalized = normalizeState(imported);
        if (!normalized || normalized.version !== SAVE_VERSION) throw new Error("invalid-save");
        state = normalized;
        persist("已导入并保存");
        render();
        showToast("存档已导入");
      } catch (error) {
        showToast("导入失败：需要生活经营版 v6 存档，当前存档未改变");
      }
    };
    reader.onerror = () => showToast("导入失败：无法读取文件");
    reader.readAsText(file);
  }

  function createLife(profileId, talentId, goalId) {
    const profile = getProfile(profileId);
    const talent = getTalent(talentId);
    const legacyIds = state.world.legacyBank.slice(0, CONTENT.maxLegacyChoices);
    const life = {
      status: "active",
      generation: state.world.completedLives + 1,
      age: CONTENT.rounds[0].age,
      round: 0,
      seed: makeLifeSeed(state.world.completedLives + 1, profile.id, talent.id, goalId, legacyIds),
      profileId: profile.id,
      talentId: talent.id,
      goalId: getGoal(goalId).id,
      resources: defaultMap(RESOURCE_KEYS),
      maxResources: { energy: 10 },
      skills: defaultMap(SKILL_KEYS),
      relationships: defaultMap(RELATIONSHIP_KEYS),
      town: clone(state.world.town),
      actionPoints: CONTENT.actionPointsPerRound,
      sideActionsUsed: 0,
      inventory: [],
      jobId: "none",
      jobShifts: 0,
      cashflow: { income: 0, expenses: 0, debt: 0 },
      lifeLog: [],
      lifeFeedback: null,
      flags: [...(profile.flags || [])],
      secrets: [],
      progress: defaultMap(CONTENT.goals.map((goal) => goal.id)),
      inheritedLegacyIds: [...legacyIds],
      actions: [],
      lastAction: null,
      outcome: null,
      legacyCandidates: [],
      selectedLegacies: [],
      newAchievements: [],
      newSecrets: [],
    };
    Object.entries(profile.start || {}).forEach(([key, value]) => {
      if (key in life.resources) life.resources[key] = clamp(value, 0, CONTENT.resources[key].max, 0);
    });
    Object.entries(profile.skills || {}).forEach(([key, value]) => {
      if (key in life.skills) life.skills[key] = clamp(value, 0, 10, 0);
    });
    Object.entries(profile.relationships || {}).forEach(([key, value]) => {
      if (key in life.relationships) life.relationships[key] = clamp(value, 0, 10, 0);
    });
    applyEffect(life, talent.effect, false);
    legacyIds.map(getLegacy).filter(Boolean).forEach((legacy) => applyEffect(life, legacy.effect, false));
    life.resources.energy = clamp(life.resources.energy, 0, life.maxResources.energy, life.resources.energy);
    life.age = CONTENT.rounds[0].age;
    return life;
  }

  function addValue(target, key, amount, min, max) {
    if (!(key in target)) return;
    target[key] = clamp(Number(target[key]) + Number(amount || 0), min, max, min);
  }

  function applyEffect(life, effect = {}, includeTown = true) {
    const beforeFlags = new Set(life.flags);
    const beforeSecrets = new Set(life.secrets);
    const beforeItems = new Set(life.inventory || []);
    Object.entries(effect.maxResources || {}).forEach(([key, amount]) => {
      if (key in life.maxResources) life.maxResources[key] = clamp(life.maxResources[key] + Number(amount || 0), 10, 12, 10);
    });
    Object.entries(effect.resources || {}).forEach(([key, amount]) => {
      if (key in life.resources) addValue(life.resources, key, amount, 0, key === "energy" ? life.maxResources.energy : CONTENT.resources[key].max);
    });
    Object.entries(effect.skills || {}).forEach(([key, amount]) => addValue(life.skills, key, amount, 0, 10));
    Object.entries(effect.relationships || {}).forEach(([key, amount]) => addValue(life.relationships, key, amount, 0, 10));
    if (includeTown) Object.entries(effect.town || {}).forEach(([key, amount]) => {
      if (key in life.town) addValue(life.town, key, amount, 0, CONTENT.world[key].values.length - 1);
    });
    life.inventory = [...new Set([...life.inventory, ...safeList(effect.items, CONTENT.maxInventory, 60)])].filter((id) => getItem(id)).slice(0, CONTENT.maxInventory);
    life.flags = [...new Set([...life.flags, ...safeList(effect.flags, 20, 80)])].slice(0, 80);
    life.secrets = [...new Set([...life.secrets, ...safeList(effect.secrets, CONTENT.secrets.length, 60)])].filter((id) => getSecret(id));
    return {
      newFlags: life.flags.filter((flag) => !beforeFlags.has(flag)),
      newSecrets: life.secrets.filter((secret) => !beforeSecrets.has(secret)),
      newItems: life.inventory.filter((item) => !beforeItems.has(item)),
    };
  }

  function getLifeStat(life, group, key) {
    if (group === "resources") return Number(life.resources[key] || 0);
    if (group === "skills") return Number(life.skills[key] || 0);
    if (group === "relationships") return Number(life.relationships[key] || 0);
    if (group === "town") return Number(life.town[key] || 0);
    return 0;
  }

  function requirementMet(life, requirement) {
    if (!requirement) return true;
    if (requirement.type === "any") return (requirement.requirements || []).some((item) => requirementMet(life, item));
    if (requirement.type === "all") return (requirement.requirements || []).every((item) => requirementMet(life, item));
    if (requirement.type === "resource") return getLifeStat(life, "resources", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "skill") return getLifeStat(life, "skills", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "relationship") return getLifeStat(life, "relationships", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "world") return getLifeStat(life, "town", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "flag") return life.flags.includes(requirement.key);
    if (requirement.type === "secret") return life.secrets.includes(requirement.key);
    if (requirement.type === "age") return life.age >= Number(requirement.min || 0);
    return true;
  }

  function requirementReason(requirement) {
    if (!requirement) return "";
    if (requirement.type === "any" || requirement.type === "all") return requirement.label || "需要满足前置条件";
    return requirement.label || "需要满足前置条件";
  }

  function getAvailability(life, action) {
    const failed = (action.requires || []).find((requirement) => !requirementMet(life, requirement));
    return { available: !failed, reason: failed ? requirementReason(failed) : "" };
  }

  function getLifeAvailability(life, action) {
    if (life.age < Number(action.minAge || 0)) return { available: false, reason: `需要 ${action.minAge} 岁以后` };
    if (life.actionPoints < Number(action.points || 1)) return { available: false, reason: `还需要 ${action.points} 点生活行动` };
    return getAvailability(life, action);
  }

  function hasItem(life, itemId) {
    return Array.isArray(life.inventory) && life.inventory.includes(itemId);
  }

  function getLifeActionEffect(life, action) {
    const effect = clone(action.effect || {});
    const bonus = action.bonusItem && hasItem(life, action.bonusItem) ? action.bonusItem : "";
    const bonusEffects = {
      study: { skills: { study: 1 } },
      repair: { skills: { craft: 1 } },
      social: { relationships: { friend: 1 } },
      care: { resources: { health: 1 }, relationships: { family: 1 } },
      rest: { resources: { health: 1 } },
    };
    if (bonusEffects[bonus]) {
      Object.entries(bonusEffects[bonus]).forEach(([group, values]) => {
        effect[group] = { ...(effect[group] || {}) };
        Object.entries(values).forEach(([key, value]) => { effect[group][key] = Number(effect[group][key] || 0) + value; });
      });
    }
    return effect;
  }

  function addGoalPoints(life, goalPoints = {}) {
    Object.entries(goalPoints).forEach(([goalId, amount]) => {
      life.progress[goalId] = clamp(Number(life.progress[goalId] || 0) + Number(amount || 0), 0, getGoal(goalId)?.target || 8, 0);
    });
  }

  function pushLifeLog(life, entry) {
    life.lifeLog = [...(life.lifeLog || []), {
      age: life.age,
      label: safeText(entry.label, 100),
      result: safeText(entry.result, MAX_TEXT_LENGTH),
      kind: safeText(entry.kind, 30),
    }].slice(-CONTENT.maxLifeLog);
  }

  function resolveLifeAction(actionId) {
    const life = state.currentLife;
    if (!life || life.status !== "active" || life.lastAction) return;
    const action = getLifeAction(actionId) || getJob(actionId);
    if (!action) return;
    const availability = getLifeAvailability(life, action);
    if (!availability.available) {
      showToast(availability.reason || "这个生活安排现在还做不了");
      return;
    }
    const before = captureMetrics(life);
    const beforeItems = new Set(life.inventory);
    const effect = getLifeActionEffect(life, action);
    const firstWage = Boolean(action.jobId && life.jobShifts === 0);
    effect.flags = [...(effect.flags || []), ...(firstWage ? ["first-wage"] : [])];
    if (action.id === "night-shift") effect.secrets = [...(effect.secrets || []), "last-bus"];
    const applied = applyEffect(life, effect);
    const goalPoints = { ...(action.goalPoints || {}) };
    if (action.bonusItem === "record" && hasItem(life, "camera")) goalPoints.record = Number(goalPoints.record || 0) + 1;
    addGoalPoints(life, goalPoints);
    life.actionPoints -= Number(action.points || 1);
    life.sideActionsUsed += 1;
    if (action.jobId) {
      life.jobId = action.jobId;
      life.jobShifts += 1;
      state.world.totals.workShifts += 1;
      state.world.totals.moneyEarned += Math.max(0, Number(effect.resources?.money || 0));
    }
    const income = Math.max(0, Number(effect.resources?.money || 0));
    const expenses = Math.max(0, -Number(effect.resources?.money || 0));
    life.cashflow.income += income;
    life.cashflow.expenses += expenses;
    state.world.secrets = [...new Set([...state.world.secrets, ...life.secrets])];
    const after = captureMetrics(life);
    const newItems = life.inventory.filter((item) => !beforeItems.has(item));
    const newSecrets = [...new Set([...(applied.newSecrets || []), ...life.secrets.filter((secret) => !state.world.secrets.includes(secret))])];
    life.newSecrets = [...new Set([...(life.newSecrets || []), ...newSecrets])];
    life.lifeFeedback = {
      title: action.label,
      copy: action.jobId ? `${action.label}结束了。${action.detail}` : `${action.label}完成了。${action.detail}`,
      changes: getMetricChanges(before, after),
      newItems,
      newSecrets,
    };
    pushLifeLog(life, { label: action.label, result: life.lifeFeedback.copy, kind: action.jobId ? "工作" : "生活" });
    life.flags = [...new Set([...life.flags, ...(action.jobId ? ["worked"] : [])])];
    unlockAchievements(life);
    persist("生活安排已保存");
    render();
  }

  function buyItem(itemId) {
    const life = state.currentLife;
    const item = getItem(itemId);
    if (!life || life.status !== "active" || life.lastAction || !item) return;
    if (life.actionPoints < 1) { showToast("生活行动点不够了"); return; }
    if (life.inventory.includes(item.id)) { showToast("你已经有这件东西了"); return; }
    if (life.inventory.length >= CONTENT.maxInventory) { showToast(`库存最多放 ${CONTENT.maxInventory} 件东西`); return; }
    if (life.resources.money < item.price) { showToast(`还差 ${item.price - life.resources.money} 元，先去工作或换个便宜的选择`); return; }
    const before = captureMetrics(life);
    const beforeSecrets = new Set(state.world.secrets);
    applyEffect(life, { resources: { money: -item.price }, items: [item.id], flags: ["bought-item"], secrets: item.id === "camera" ? ["pocket-receipt"] : [] });
    life.actionPoints -= 1;
    life.sideActionsUsed += 1;
    life.cashflow.expenses += item.price;
    state.world.totals.moneySpent += item.price;
    const newSecrets = life.secrets.filter((secret) => !beforeSecrets.has(secret));
    state.world.secrets = [...new Set([...state.world.secrets, ...life.secrets])];
    const after = captureMetrics(life);
    life.newSecrets = [...new Set([...(life.newSecrets || []), ...newSecrets])];
    life.lifeFeedback = { title: `买下：${item.label}`, copy: item.detail, changes: getMetricChanges(before, after), newItems: [item.id], newSecrets };
    pushLifeLog(life, { label: `购买${item.label}`, result: item.detail, kind: "消费" });
    unlockAchievements(life);
    persist("物品已加入库存");
    render();
  }

  function getAction(actionId) {
    const round = getRound(state.currentLife);
    return round?.actions.find((action) => action.id === actionId) || null;
  }

  function captureMetrics(life) {
    return {
      ...Object.fromEntries(RESOURCE_KEYS.map((key) => [`resources.${key}`, life.resources[key]])),
      ...Object.fromEntries(SKILL_KEYS.map((key) => [`skills.${key}`, life.skills[key]])),
      ...Object.fromEntries(RELATIONSHIP_KEYS.map((key) => [`relationships.${key}`, life.relationships[key]])),
      ...Object.fromEntries(WORLD_KEYS.map((key) => [`town.${key}`, life.town[key]])),
    };
  }

  function getMetricLabel(path) {
    const [group, key] = path.split(".");
    if (group === "resources") return CONTENT.resources[key]?.label || key;
    if (group === "skills") return CONTENT.skills[key]?.label || key;
    if (group === "relationships") return CONTENT.relationships[key]?.label || key;
    if (group === "town") return CONTENT.world[key]?.label || key;
    return key;
  }

  function formatDelta(label, delta) {
    return `${label}${delta > 0 ? "+" : ""}${delta}`;
  }

  function getMetricChanges(before, after) {
    return Object.keys(before).map((path) => {
      const delta = after[path] - before[path];
      return delta ? formatDelta(getMetricLabel(path), delta) : null;
    }).filter(Boolean);
  }

  function getSkillLevel(value) {
    if (value >= 8) return 4;
    if (value >= 6) return 3;
    if (value >= 4) return 2;
    if (value >= 2) return 1;
    return 0;
  }

  function getSkillLevelName(key, value) {
    return CONTENT.skills[key]?.levels[getSkillLevel(value)] || "入门";
  }

  function getBestSkill(life) {
    return SKILL_KEYS.slice().sort((left, right) => life.skills[right] - life.skills[left])[0];
  }

  function deterministicRoll(life, action) {
    const raw = hashSeed(`${life.seed}:${life.round}:${action.id}`);
    return raw % 3;
  }

  function unlockAchievements(life) {
    const unlocked = [];
    CONTENT.achievements.forEach((achievement) => {
      if (state.world.achievements.includes(achievement.id)) return;
      const passed = (achievement.requires || []).every((requirement) => achievementRequirementMet(life, requirement));
      if (passed) {
        state.world.achievements.push(achievement.id);
        unlocked.push(achievement.id);
      }
    });
    life.newAchievements = [...new Set([...(life.newAchievements || []), ...unlocked])];
    return unlocked;
  }

  function achievementRequirementMet(life, requirement) {
    if (!requirement) return true;
    if (requirement.type === "world") return Number(state.world[requirement.key] || 0) >= Number(requirement.min || 0);
    if (requirement.type === "count") return Array.isArray(state.world[requirement.group]) && state.world[requirement.group].length >= Number(requirement.min || 0);
    if (requirement.type === "lifeCount") return Array.isArray(life[requirement.group]) && life[requirement.group].length >= Number(requirement.min || 0);
    if (requirement.type === "countFlags") return life.flags.filter((flag) => flag.startsWith(requirement.prefix || "")).length >= Number(requirement.min || 0);
    if (requirement.type === "anyStat") return Object.values(life[requirement.group] || {}).some((value) => Number(value) >= Number(requirement.min || 0));
    if (requirement.type === "statCount") return Object.values(life[requirement.group] || life.town || {}).filter((value) => Number(value) >= Number(requirement.min || 0)).length >= Number(requirement.count || 1);
    if (requirement.type === "lifeStat") return getLifeStat(life, requirement.group, requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "secret") return state.world.secrets.includes(requirement.key) || life.secrets.includes(requirement.key);
    if (requirement.type === "flag") return life.flags.includes(requirement.key);
    if (requirement.type === "any") return (requirement.requirements || []).some((item) => achievementRequirementMet(life, item));
    if (requirement.type === "all") return (requirement.requirements || []).every((item) => achievementRequirementMet(life, item));
    return false;
  }

  function resolveAction(actionId) {
    const life = state.currentLife;
    if (!life || life.status !== "active" || life.lastAction) return;
    const action = getAction(actionId);
    if (!action) return;
    const availability = getAvailability(life, action);
    if (!availability.available) {
      showToast(availability.reason || "这个行动现在还做不了");
      return;
    }
    const before = captureMetrics(life);
    const beforeLevels = Object.fromEntries(SKILL_KEYS.map((key) => [key, getSkillLevel(life.skills[key])]));
    const baseResult = applyEffect(life, action.effect);
    addGoalPoints(life, action.goalPoints || {});
    let testResult = null;
    if (action.test) {
      const test = action.test;
      const roll = deterministicRoll(life, action);
      const luckBonus = life.flags.includes("talent-luck") ? 2 : 0;
      const score = Number(life.skills[test.skill] || 0) + roll + luckBonus;
      const success = score >= Number(test.difficulty || 0);
      applyEffect(life, success ? test.success : test.failure);
      testResult = { label: test.label, score, difficulty: test.difficulty, roll, success, text: success ? test.successText : test.failureText };
      state.world.totals.tests += 1;
      if (success) state.world.totals.testWins += 1;
    }
    if (before.resources?.pressure >= 8 && life.resources.pressure <= 6 && life.resources.happiness >= 7) life.flags.push("second-chance");
    const after = captureMetrics(life);
    const newLevels = SKILL_KEYS.filter((key) => getSkillLevel(life.skills[key]) > beforeLevels[key]).map((key) => `${CONTENT.skills[key].label}达到${getSkillLevelName(key, life.skills[key])}`);
    const newSecrets = [...new Set([...(baseResult.newSecrets || []), ...life.secrets.filter((secret) => !state.world.secrets.includes(secret))])];
    state.world.secrets = [...new Set([...state.world.secrets, ...life.secrets])];
    const round = getRound(life);
    const stage = getStage(round.stage);
    const nextRound = CONTENT.rounds[life.round + 1];
    const stageBreak = nextRound && nextRound.stage !== round.stage ? getStage(nextRound.stage) : null;
    life.lastAction = {
      actionId: action.id,
      title: action.label,
      result: testResult?.text ? `${testResult.text} ${action.result}` : action.result,
      future: action.future,
      changes: getMetricChanges(before, after),
      newLevels,
      newSecrets,
      tags: action.tags || [],
      test: testResult,
      stageBreak: stageBreak ? { label: stageBreak.label, range: stageBreak.range, hint: stageBreak.hint } : null,
    };
    life.lifeFeedback = null;
    life.actions.push({ round: life.round + 1, age: life.age, label: action.label, result: life.lastAction.result, success: testResult ? testResult.success : true });
    life.actions = life.actions.slice(-CONTENT.maxRounds);
    state.world.totals.choices += 1;
    unlockAchievements(life);
    persist("选择已保存");
    render();
  }

  function getOutcome(life) {
    const goal = getGoal(life.goalId);
    const goalProgress = Number(life.progress[life.goalId] || 0);
    const best = life.skills[getBestSkill(life)];
    const relationshipTotal = Object.values(life.relationships).reduce((sum, value) => sum + value, 0);
    if (life.resources.health <= 0) return { title: "你走得太急，身体先替你按下了暂停。", copy: "这一生并不只由完成了什么组成。你留下了许多方法，却也提醒下一世：不要把自己当成不会坏的机器。", tone: "代价", score: Math.max(1, Math.round(goalProgress + relationshipTotal / 4)) };
    if (goalProgress >= goal.target && best >= 8) return { title: "你把想做的事，做成了别人可以继续的事。", copy: "这不是一条人人都能复制的路，但它在你的手里变成了真实的履历、关系和方法。", tone: "传说", score: 100 };
    if (goalProgress >= goal.target && life.resources.happiness >= 6) return { title: "你把这一生过成了自己认得出的样子。", copy: "目标完成不是人生的标准答案，但它证明你曾经在有限的时间里，把重要的东西放到了前面。", tone: "圆满", score: 85 };
    if (relationshipTotal >= 18 || life.resources.happiness >= 8) return { title: "有人会替你记得，你曾经来过。", copy: "你没有完成所有目标，但很多人的日子因为遇见你而少了一点孤单。", tone: "有人记得", score: 70 };
    return { title: "你没有得到标准答案，但留下了下一步。", copy: "有些人生要等下一世回头看，才知道哪一次选择其实已经改变了方向。", tone: "未完", score: 55 };
  }

  function getLegacyCandidates(life) {
    const available = CONTENT.legacies.filter((legacy) => (legacy.requires || []).every((requirement) => requirementMet(life, requirement)));
    const unique = [];
    available.forEach((legacy) => {
      if (!unique.some((item) => item.id === legacy.id)) unique.push(legacy);
    });
    return unique.slice(0, 10);
  }

  function buildHistoryEntry(life) {
    const goal = getGoal(life.goalId);
    return {
      generation: life.generation,
      age: life.age,
      profileId: life.profileId,
      talentId: life.talentId,
      goalId: life.goalId,
      outcomeTitle: life.outcome.title,
      outcomeCopy: life.outcome.copy,
      goalProgress: life.progress[life.goalId],
      goalTarget: goal.target,
      bestSkill: getBestSkill(life),
      activityCount: life.actions.length + life.lifeLog.length,
      jobId: life.jobId,
      cashflow: clone(life.cashflow),
      inventory: [...life.inventory],
      lifeLog: life.lifeLog.slice(-12),
      actions: life.actions.slice(-CONTENT.maxRounds),
      legacyIds: [],
      achievementIds: life.newAchievements || [],
      secretIds: life.newSecrets || [],
    };
  }

  function finishLife() {
    const life = state.currentLife;
    if (!life || life.status !== "active") return;
    life.status = "complete";
    life.outcome = getOutcome(life);
    life.legacyCandidates = getLegacyCandidates(life).map((legacy) => legacy.id);
    state.world.completedLives += 1;
    state.world.town = clone(life.town);
    unlockAchievements(life);
    state.world.history.push(buildHistoryEntry(life));
    state.world.history = state.world.history.slice(-MAX_HISTORY);
    state.screen = "ending";
    persist("这一生已封存");
    render();
  }

  function settleLivingCost(life) {
    const bill = getLivingCost(life.age);
    if (!bill.cost) {
      life.lifeFeedback = null;
      return;
    }
    const before = captureMetrics(life);
    const available = life.resources.money;
    const paid = Math.min(available, bill.cost);
    const shortfall = Math.max(0, bill.cost - available);
    life.cashflow.expenses += paid;
    life.cashflow.debt += shortfall;
    state.world.totals.moneySpent += paid;
    if (shortfall) {
      applyEffect(life, { resources: { money: -available, pressure: Math.min(3, 1 + Math.ceil(shortfall / 5)) }, flags: ["in-debt"] });
    } else {
      applyEffect(life, { resources: { money: -paid } });
    }
    const after = captureMetrics(life);
    life.lifeFeedback = {
      title: shortfall ? "生活账单没有完全付清" : "生活账单已结算",
      copy: shortfall ? `这一阶段的${bill.label}是${bill.cost}元，你先付了${paid}元，剩下的压力会留在账上。` : `这一阶段的${bill.label}花了${paid}元，日子暂时稳住了。`,
      changes: getMetricChanges(before, after),
      newItems: [],
      newSecrets: [],
    };
    if (shortfall) pushLifeLog(life, { label: "生活账单", result: life.lifeFeedback.copy, kind: "账单" });
  }

  function advanceRound() {
    const life = state.currentLife;
    if (!life || life.status !== "active" || !life.lastAction) return;
    if (life.round >= CONTENT.rounds.length - 1) {
      finishLife();
      return;
    }
    life.round += 1;
    life.age = CONTENT.rounds[life.round].age;
    life.actionPoints = CONTENT.actionPointsPerRound;
    life.sideActionsUsed = 0;
    life.lastAction = null;
    settleLivingCost(life);
    persist("人生继续保存");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleLegacy(legacyId) {
    const life = state.currentLife;
    if (!life || life.status !== "complete") return;
    if (!life.legacyCandidates.includes(legacyId)) return;
    const index = life.selectedLegacies.indexOf(legacyId);
    if (index >= 0) life.selectedLegacies.splice(index, 1);
    else if (life.selectedLegacies.length < CONTENT.maxLegacyChoices) life.selectedLegacies.push(legacyId);
    else showToast(`最多选择 ${CONTENT.maxLegacyChoices} 件遗产`);
    render();
  }

  function applyLegacyToWorld(legacy) {
    Object.entries(legacy.effect?.town || {}).forEach(([key, amount]) => {
      if (key in state.world.town) addValue(state.world.town, key, amount, 0, CONTENT.world[key].values.length - 1);
    });
  }

  function confirmLegacies() {
    const life = state.currentLife;
    if (!life || life.status !== "complete" || life.selectedLegacies.length < 1) return;
    const selected = life.selectedLegacies.map(getLegacy).filter(Boolean);
    selected.forEach(applyLegacyToWorld);
    state.world.legacyBank = selected.map((legacy) => legacy.id);
    state.world.collectedLegacyIds = [...new Set([...state.world.collectedLegacyIds, ...state.world.legacyBank])].slice(-CONTENT.legacies.length);
    const historyEntry = state.world.history[state.world.history.length - 1];
    if (historyEntry) historyEntry.legacyIds = [...state.world.legacyBank];
    unlockAchievements(life);
    state.currentLife = null;
    state.screen = "start";
    state.notice = `上一世留下了：${selected.map((legacy) => legacy.label).join("、")}。下一世会从这些基础开始。`;
    persist("遗产已交接");
    render();
  }

  function startLife() {
    if (state.currentLife?.status === "active") {
      state.screen = "game";
      render();
      return;
    }
    state.currentLife = createLife(setup.profileId, setup.talentId, setup.goalId);
    state.screen = "game";
    state.notice = "";
    persist("新一世已开始");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderTown(containerId, town) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = WORLD_KEYS.map((key) => {
      const level = clamp(town[key], 0, CONTENT.world[key].values.length - 1, 0);
      const world = CONTENT.world[key];
      return `<div class="town-state-row"><span>${escapeHtml(world.label)}</span><strong>${escapeHtml(world.values[level])}</strong></div>`;
    }).join("");
  }

  function renderStart() {
    const active = state.currentLife?.status === "active";
    const profile = getProfile(setup.profileId);
    const talent = getTalent(setup.talentId);
    const goal = getGoal(setup.goalId);
    $("#generation-label").textContent = state.world.completedLives ? `已走过 ${state.world.completedLives} 世` : "还没有人写下第一行";
    $("#start-echo").textContent = state.world.history.length ? `“${state.world.history[state.world.history.length - 1].outcomeTitle}”` : "“这座镇子还没有收到上一世留下的东西。”";
    renderTown("#start-town", state.world.town);
    $("#start-life").textContent = active ? "进入当前人生 →" : `开始第 ${state.world.completedLives + 1} 世 →`;
    $("#continue-life").classList.toggle("is-hidden", !active);
    $("#view-archive").classList.toggle("is-hidden", state.world.history.length === 0);
    const notice = $("#start-notice");
    notice.textContent = state.notice;
    notice.classList.toggle("is-hidden", !state.notice);
    $("#achievement-count").textContent = `${state.world.achievements.length} / ${CONTENT.achievements.length}`;
    $("#secret-count").textContent = `${state.world.secrets.length} / ${CONTENT.secrets.length}`;
    $("#legacy-count-home").textContent = `${state.world.collectedLegacyIds.length} / ${CONTENT.legacies.length}`;
    $("#profile-options").innerHTML = CONTENT.profiles.map((item) => `<button class="selection-card ${item.id === setup.profileId ? "is-selected" : ""}" data-action="choose-profile" data-id="${item.id}" aria-pressed="${item.id === setup.profileId}"><span class="selection-check">${item.id === setup.profileId ? "●" : "○"}</span><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join("");
    $("#talent-options").innerHTML = CONTENT.talents.map((item) => `<button class="selection-card ${item.id === setup.talentId ? "is-selected" : ""}" data-action="choose-talent" data-id="${item.id}" aria-pressed="${item.id === setup.talentId}"><span class="selection-check">${item.id === setup.talentId ? "●" : "○"}</span><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join("");
   $("#goal-options").innerHTML = CONTENT.goals.map((item) => `<button class="selection-card ${item.id === setup.goalId ? "is-selected" : ""}" data-action="choose-goal" data-id="${item.id}" aria-pressed="${item.id === setup.goalId}"><span class="selection-check">${item.id === setup.goalId ? "●" : "○"}</span><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join("");
   $("#start-summary").innerHTML = `<strong>${escapeHtml(profile.label)}</strong> · 天赋“${escapeHtml(talent.label)}” · 本世愿望“${escapeHtml(goal.label)}”`;
    const previewLife = createLife(profile.id, talent.id, goal.id);
   $("#start-preview").innerHTML = [
      ...RESOURCE_KEYS.slice(0, 4).map((key) => `<span>${escapeHtml(CONTENT.resources[key].label)} ${previewLife.resources[key] || 0}</span>`),
      ...SKILL_KEYS.slice(0, 3).map((key) => `<span>${escapeHtml(CONTENT.skills[key].label)} ${previewLife.skills[key] || 0}</span>`),
    ].join("");
    const incoming = $("#incoming-legacy");
    incoming.innerHTML = state.world.legacyBank.length ? `<span class="incoming-title">上一世的基础</span>${state.world.legacyBank.map((id) => { const legacy = getLegacy(id); return legacy ? `<div class="incoming-item"><strong>${escapeHtml(legacy.label)}</strong><span>${escapeHtml(legacy.nextUse)}</span></div>` : ""; }).join("")}` : `<span class="empty-note">第一世没有遗产；以后每一世都可以亲手选择带走什么。</span>`;
  }

  function renderResourceList(life) {
    $("#resource-list").innerHTML = RESOURCE_KEYS.map((key) => {
      const resource = CONTENT.resources[key];
      const max = key === "energy" ? life.maxResources.energy : resource.max;
      const value = life.resources[key];
      const percent = Math.round((value / max) * 100);
      return `<div class="resource-item"><div class="resource-heading"><span>${escapeHtml(resource.label)}</span><strong>${value} / ${max}</strong></div><div class="resource-bar ${key === "pressure" ? "is-pressure" : ""}"><span style="width:${percent}%"></span></div></div>`;
    }).join("");
  }

  function renderSkillList(life) {
    $("#skill-list").innerHTML = SKILL_KEYS.map((key) => {
      const skill = CONTENT.skills[key];
      const value = life.skills[key];
      const level = getSkillLevel(value);
      return `<div class="skill-row"><div class="skill-heading"><span>${escapeHtml(skill.label)}</span><strong>${escapeHtml(skill.levels[level])} · ${value}/10</strong></div><div class="skill-bar"><span style="width:${value * 10}%"></span></div></div>`;
    }).join("");
  }

  function renderRelationshipList(life) {
    $("#relationship-list").innerHTML = RELATIONSHIP_KEYS.map((key) => `<div class="relationship-row"><span>${escapeHtml(CONTENT.relationships[key].label)}</span><strong>${life.relationships[key]} / 10</strong></div>`).join("");
  }

  function renderLifeTags(life) {
    const flags = life.flags.filter((flag) => FLAG_LABELS[flag]).slice(-8);
    $("#life-tags").innerHTML = flags.length ? flags.map((flag) => `<span class="tag-chip">${escapeHtml(FLAG_LABELS[flag])}</span>`).join("") : `<span class="empty-note">每一次行动都会写下一枚标签。</span>`;
  }

  function renderLifeManagement(life) {
    const blocked = Boolean(life.lastAction);
    const nextRound = CONTENT.rounds[life.round + 1];
    const bill = getLivingCost(nextRound?.age || life.age);
    $("#life-action-points").textContent = `${life.actionPoints} / ${CONTENT.actionPointsPerRound}`;
    $("#living-cost").textContent = bill.cost ? `下一节点预计生活费 ${bill.cost} 元` : "下一节点由家里承担日常";
    $("#cashflow").textContent = `本世收入 ${life.cashflow.income} · 支出 ${life.cashflow.expenses} · 账上压力 ${life.cashflow.debt}`;
    const renderOption = (action) => {
      const availability = getLifeAvailability(life, action);
      const disabled = blocked || !availability.available;
      const reason = blocked ? "先完成右侧的人生事件" : availability.reason;
      return `<button class="life-action-card ${disabled ? "is-locked" : ""}" data-action="life-action" data-life-action-id="${action.id}" ${disabled ? "disabled" : ""}><span class="life-action-type">${action.jobId ? "工作" : "生活"}</span><span class="life-action-body"><strong>${escapeHtml(action.label)}</strong><span>${escapeHtml(action.detail)}</span><small>${escapeHtml(action.cost)}</small>${disabled ? `<b>${escapeHtml(reason)}</b>` : `<em>${escapeHtml(action.preview)}</em>`}</span><span class="life-action-points">-${action.points || 1}点</span></button>`;
    };
    $("#life-action-list").innerHTML = CONTENT.lifeActions.map(renderOption).join("");
    $("#job-list").innerHTML = CONTENT.jobs.map(renderOption).join("");
    const currentJob = getJob(life.jobId);
    $("#job-status").innerHTML = currentJob ? `<strong>${escapeHtml(currentJob.label)}</strong><span>已上班 ${life.jobShifts} 班 · 这份工作会留在履历里</span>` : `<strong>还没有固定工作</strong><span>你可以先学习、休息，也可以在15岁以后找一份合适的班。</span>`;
    $("#inventory-limit").textContent = `${life.inventory.length} / ${CONTENT.maxInventory} 格`;
    $("#inventory-list").innerHTML = life.inventory.length ? life.inventory.map((id) => { const item = getItem(id); return item ? `<span class="inventory-item"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>` : ""; }).join("") : `<span class="empty-note">库存还是空的。钱不只用来存，也可以买回时间和选择。</span>`;
    $("#shop-list").innerHTML = CONTENT.items.map((item) => {
      const owned = hasItem(life, item.id);
      const unavailable = blocked || owned || life.actionPoints < 1 || life.resources.money < item.price || life.inventory.length >= CONTENT.maxInventory;
      const reason = owned ? "已拥有" : life.resources.money < item.price ? `还差 ${item.price - life.resources.money} 元` : blocked ? "先完成本节点事件" : "购买";
      return `<button class="shop-item ${unavailable ? "is-locked" : ""}" data-action="buy-item" data-item-id="${item.id}" ${unavailable ? "disabled" : ""}><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span><b>${owned ? "已拥有" : `${item.price} 元 · ${reason}`}</b></button>`;
    }).join("");
    const feedback = life.lifeFeedback;
    $("#life-feedback").innerHTML = feedback ? `<strong>${escapeHtml(feedback.title)}</strong><span>${escapeHtml(feedback.copy)}</span><div>${[...(feedback.changes || []), ...(feedback.newItems || []).map((id) => `获得${getItem(id)?.label || id}`), ...(feedback.newSecrets || []).map((id) => `发现彩蛋：${getSecret(id)?.label || id}`)].map((item) => `<em>${escapeHtml(item)}</em>`).join("")}</div>` : `<span>先安排生活，再处理本节点事件。3点行动可以自由组合。</span>`;
  }

  function renderGame() {
    const life = state.currentLife;
    if (!life) return;
    const round = getRound(life);
    const stage = getStage(round.stage);
    const goal = getGoal(life.goalId);
    const progress = Number(life.progress[life.goalId] || 0);
    const percent = Math.round(((life.round + 1) / CONTENT.maxRounds) * 100);
    $("#game-generation").textContent = `第 ${life.generation} 世 · ${life.age} 岁`;
    $("#round-label").textContent = `成长节点 ${life.round + 1} / ${CONTENT.maxRounds}`;
    $("#stage-label").textContent = `${stage.label} · ${stage.range}`;
    $("#stage-hint").textContent = stage.hint;
    document.querySelectorAll(".life-map [data-stage]").forEach((item) => item.classList.toggle("is-current", item.dataset.stage === stage.id));
    $("#round-progress").setAttribute("aria-valuenow", life.round + 1);
    $("#round-progress").setAttribute("aria-valuemax", CONTENT.maxRounds);
    $("#round-progress span").style.width = `${percent}%`;
    $("#goal-label").textContent = goal.label;
    $("#goal-detail").textContent = goal.detail;
    $("#goal-progress-label").textContent = `${progress} / ${goal.target}`;
    $("#goal-progress").style.width = `${Math.min(100, Math.round((progress / goal.target) * 100))}%`;
    $("#situation-label").textContent = `${stage.label} · ${round.age} 岁`;
    $("#event-title").textContent = round.title;
    $("#event-copy").textContent = round.copy;
    $("#inherited-strip").innerHTML = life.inheritedLegacyIds.length ? `<strong>你从上一世接过来</strong>${life.inheritedLegacyIds.map((id) => { const legacy = getLegacy(id); return legacy ? `<span>${escapeHtml(legacy.label)}：${escapeHtml(legacy.nextUse)}</span>` : ""; }).join("")}` : `<strong>这是第一世</strong><span>这一次的每个选择，都将成为以后可以继承的基础。</span>`;
    $("#inherited-strip").classList.remove("is-hidden");
    $("#action-list").innerHTML = round.actions.map((action, index) => {
      const availability = getAvailability(life, action);
      const locked = Boolean(life.lastAction) || !availability.available;
      const lockReason = life.lastAction ? "先完成当前事件反馈" : availability.reason;
      const test = action.test ? `<span class="action-test">${escapeHtml(action.test.label)}：${escapeHtml(CONTENT.skills[action.test.skill]?.label || action.test.skill)} + 命运点 ≥ ${action.test.difficulty}</span>` : "";
      const tags = (action.tags || []).map((tag) => `<em>${escapeHtml(tag)}</em>`).join("");
      return `<button class="action-card ${locked ? "is-locked" : ""}" data-action="choose-action" data-action-id="${action.id}" ${locked ? "disabled" : ""}><span class="action-number">${index + 1}</span><span class="action-body"><strong>${escapeHtml(action.label)}</strong><span>${escapeHtml(action.detail)}</span><small>${escapeHtml(action.cost)}</small>${test}${locked ? `<b class="action-lock">锁定：${escapeHtml(lockReason)}</b>` : `<span class="action-tags">${tags}</span>`}</span><span class="action-result"><b>${escapeHtml(action.preview)}</b><small>选后会写入人生记录，并影响后面的路线。</small></span></button>`;
    }).join("");
    renderLifeManagement(life);
    const feedback = $("#feedback");
    feedback.classList.toggle("is-hidden", !life.lastAction);
    if (life.lastAction) {
      $("#feedback-title").textContent = life.lastAction.title;
      $("#feedback-copy").textContent = life.lastAction.result;
      $("#feedback-future").textContent = life.lastAction.future;
      $("#feedback-changes").innerHTML = [...life.lastAction.changes, ...life.lastAction.newLevels].map((change) => `<span>${escapeHtml(change)}</span>`).join("") || `<span>这次没有数值变化，但它会留在你的履历里。</span>`;
      $("#feedback-test").innerHTML = life.lastAction.test ? `<strong>${life.lastAction.test.success ? "检定成功" : "检定未通过"}</strong><span>${escapeHtml(life.lastAction.test.label)}：${life.lastAction.test.score} / ${life.lastAction.test.difficulty}（命运点 ${life.lastAction.test.roll}）</span>` : "";
      $("#feedback-secret").innerHTML = life.lastAction.newSecrets.length ? life.lastAction.newSecrets.map((id) => { const secret = getSecret(id); return secret ? `<div><strong>发现彩蛋：${escapeHtml(secret.label)}</strong><span>${escapeHtml(secret.detail)}</span></div>` : ""; }).join("") : "";
      $("#feedback-stage").innerHTML = life.lastAction.stageBreak ? `<strong>下一阶段：${escapeHtml(life.lastAction.stageBreak.label)} · ${escapeHtml(life.lastAction.stageBreak.range)}</strong><span>${escapeHtml(life.lastAction.stageBreak.hint)}</span>` : "";
      $("#advance-round").textContent = life.round >= CONTENT.maxRounds - 1 ? "封存这一生，选择遗产 →" : "继续长大 →";
    }
    renderResourceList(life);
    renderSkillList(life);
    renderRelationshipList(life);
    renderLifeTags(life);
    renderTown("#town-list", life.town);
    const nextRounds = CONTENT.rounds.slice(life.round + 1, life.round + 4);
    $("#upcoming-list").innerHTML = nextRounds.length ? nextRounds.map((item) => `<span>${item.age}岁 · ${escapeHtml(item.title)}</span>`).join("") : `<span>人生的最后一页已经来到。</span>`;
  }

  function renderEnding() {
    const life = state.currentLife;
    if (!life) return;
    const goal = getGoal(life.goalId);
    $("#ending-title").textContent = life.outcome.title;
    $("#ending-copy").textContent = life.outcome.copy;
    $("#ending-context").textContent = `第 ${life.generation} 世 · ${life.age} 岁 · ${getProfile(life.profileId).label} · 天赋：${getTalent(life.talentId).label}`;
    $("#ending-goal").innerHTML = `<strong>${life.progress[life.goalId]} / ${goal.target}</strong><span>${escapeHtml(goal.label)} · ${escapeHtml(life.outcome.tone)}</span>`;
    $("#ending-score").textContent = `${life.outcome.score} 分`;
    $("#ending-best-skill").textContent = `${CONTENT.skills[getBestSkill(life)].label} · ${life.skills[getBestSkill(life)]}/10`;
    $("#ending-actions-count").textContent = `${life.actions.length} 个事件`;
    $("#ending-life-actions-count").textContent = `${life.lifeLog.length} 次安排`;
    $("#ending-cashflow").textContent = `${life.cashflow.income - life.cashflow.expenses} 元`;
    $("#ending-echo").textContent = life.lastAction?.future || "你留下的基础，会在下一世变成新的选择。";
    renderTown("#ending-changes", life.town);
    $("#ending-achievements").innerHTML = life.newAchievements.length ? life.newAchievements.map((id) => { const item = getAchievement(id); return item ? `<div class="reward-item"><strong>${escapeHtml(item.icon)} ${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div>` : ""; }).join("") : `<span class="empty-note">这一世没有新成就，但每个选择仍写进了镇志。</span>`;
    $("#ending-secrets").innerHTML = life.newSecrets.length ? life.newSecrets.map((id) => { const item = getSecret(id); return item ? `<div class="reward-item"><strong>彩蛋：${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div>` : ""; }).join("") : `<span class="empty-note">还有一些彩蛋藏在不同的选择路线里。</span>`;
    const candidates = life.legacyCandidates.map(getLegacy).filter(Boolean);
    $("#legacy-count").textContent = `${life.selectedLegacies.length} / ${CONTENT.maxLegacyChoices}`;
    $("#legacy-list").innerHTML = candidates.map((legacy) => `<button class="legacy-card ${life.selectedLegacies.includes(legacy.id) ? "is-selected" : ""}" data-action="choose-legacy" data-id="${legacy.id}" aria-pressed="${life.selectedLegacies.includes(legacy.id)}"><span class="legacy-check">${life.selectedLegacies.includes(legacy.id) ? "✓" : "＋"}</span><strong>${escapeHtml(legacy.label)}</strong><span>${escapeHtml(legacy.detail)}</span><em>下一世：${escapeHtml(legacy.nextUse)}</em></button>`).join("");
    const confirm = $("#confirm-legacy");
    confirm.disabled = life.selectedLegacies.length < 1;
    confirm.textContent = life.selectedLegacies.length ? `把 ${life.selectedLegacies.length} 件基础交给下一世 →` : "先选择至少一件遗产";
  }

  function renderAchievements() {
    $("#achievement-list").innerHTML = CONTENT.achievements.map((item) => {
      const unlocked = state.world.achievements.includes(item.id);
      return `<div class="achievement-item ${unlocked ? "is-unlocked" : ""}"><span class="achievement-icon">${unlocked ? escapeHtml(item.icon) : "?"}</span><div><strong>${unlocked ? escapeHtml(item.label) : "未解锁的成就"}</strong><span>${unlocked ? escapeHtml(item.detail) : "完成更多人生，看看它会在什么时候出现。"}</span></div></div>`;
    }).join("");
  }

  function renderSecrets() {
    $("#secret-list").innerHTML = CONTENT.secrets.map((item) => {
      const found = state.world.secrets.includes(item.id);
      return `<div class="secret-item ${found ? "is-found" : ""}"><span>${found ? "◌" : "?"}</span><div><strong>${found ? escapeHtml(item.label) : "尚未听见的回声"}</strong><span>${found ? escapeHtml(item.detail) : "它藏在某一个不急着求结果的选择里。"}</span></div></div>`;
    }).join("");
  }

  function renderArchive() {
    $("#archive-life-count").textContent = `${state.world.completedLives} 世`;
    $("#archive-achievement-count").textContent = `${state.world.achievements.length} / ${CONTENT.achievements.length}`;
    $("#archive-secret-count").textContent = `${state.world.secrets.length} / ${CONTENT.secrets.length}`;
    $("#archive-legacy-count").textContent = `${state.world.collectedLegacyIds.length} / ${CONTENT.legacies.length}`;
    renderTown("#archive-town", state.world.town);
    renderAchievements();
    renderSecrets();
    const history = [...state.world.history].reverse();
    $("#archive-timeline").innerHTML = history.length ? history.map((entry) => {
      const profile = getProfile(entry.profileId);
      const talent = getTalent(entry.talentId);
      const goal = getGoal(entry.goalId);
      const legacyTags = (entry.legacyIds || []).map((id) => getLegacy(id)).filter(Boolean).map((item) => `<span class="archive-tag">带出：${escapeHtml(item.label)}</span>`).join("");
      const actionTags = (entry.actions || []).slice(-5).map((action) => `<span class="archive-tag">${escapeHtml(action.label)}</span>`).join("");
      const lifeTags = (entry.lifeLog || []).slice(-4).map((item) => `<span class="archive-tag archive-life-tag">${escapeHtml(item.label)}</span>`).join("");
      const job = getJob(entry.jobId);
      return `<article class="archive-entry"><div class="archive-entry-top"><strong>第 ${entry.generation} 世</strong><span>${entry.age} 岁封存</span><span>${escapeHtml(profile.label)}</span></div><div><h2>${escapeHtml(entry.outcomeTitle)}</h2><p>${escapeHtml(goal.label)} · ${entry.goalProgress} / ${entry.goalTarget} · 天赋“${escapeHtml(talent.label)}”</p><p class="archive-echo">${escapeHtml(entry.outcomeCopy)}</p><p class="archive-economy">${entry.activityCount || 23} 次生活与事件安排 · ${job ? escapeHtml(job.label) : "没有固定工作"} · 现金流 ${Number(entry.cashflow?.income || 0) - Number(entry.cashflow?.expenses || 0)} 元</p><div class="archive-tags">${lifeTags}${actionTags}${legacyTags || "<span class=\"archive-tag\">没有交接特殊遗产</span>"}</div></div></article>`;
    }).join("") : `<div class="empty-archive"><strong>镇志还没有第一页。</strong><span>完成一世以后，这里会记录你的目标、选择、遗产和留下的回声。</span></div>`;
  }

  function render() {
    document.body.classList.toggle("large-text", state.settings.fontScale);
    $("#font-toggle").setAttribute("aria-pressed", String(state.settings.fontScale));
    $("#font-toggle").textContent = state.settings.fontScale ? "普通字" : "大字模式";
    ["start", "game", "ending", "archive"].forEach((screen) => $(`#screen-${screen}`).classList.toggle("is-hidden", state.screen !== screen));
    renderStart();
    if (state.screen === "game") renderGame();
    if (state.screen === "ending") renderEnding();
    if (state.screen === "archive") renderArchive();
  }

  function handleAction(action, element) {
    if (action === "choose-profile") { setup.profileId = element.dataset.id; render(); }
    if (action === "choose-talent") { setup.talentId = element.dataset.id; render(); }
    if (action === "choose-goal") { setup.goalId = element.dataset.id; render(); }
    if (action === "start-life") startLife();
    if (action === "continue-life") { state.screen = "game"; render(); }
    if (action === "life-action") resolveLifeAction(element.dataset.lifeActionId);
    if (action === "buy-item") buyItem(element.dataset.itemId);
    if (action === "choose-action") resolveAction(element.dataset.actionId);
    if (action === "advance-round") advanceRound();
    if (action === "choose-legacy") { toggleLegacy(element.dataset.id); }
    if (action === "confirm-legacy") confirmLegacies();
    if (action === "home") { state.screen = "start"; persist(); render(); }
    if (action === "view-archive") { state.screen = "archive"; render(); }
    if (action === "toggle-font") { state.settings.fontScale = !state.settings.fontScale; persist(); render(); }
    if (action === "export-save") exportSave();
    if (action === "erase-save") {
      if (window.confirm("确定清除丰富版当前世代吗？导出的 JSON 备份不会被删除。")) {
        state = clone(DEFAULT_STATE);
        setup = { profileId: "town-child", talentId: "slow-and-steady", goalId: "learn" };
        try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* 页面仍可继续 */ }
        render();
        showToast("丰富版当前世代已清除");
      }
    }
  }

  document.addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (element) handleAction(element.dataset.action, element);
  });
  $("#import-input").addEventListener("change", (event) => importSave(event.target.files?.[0]));
  document.addEventListener("keydown", (event) => {
    if (state.screen !== "game" || !state.currentLife || state.currentLife.lastAction || !["1", "2", "3"].includes(event.key)) return;
    const action = getRound(state.currentLife)?.actions[Number(event.key) - 1];
    if (action) resolveAction(action.id);
  });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  render();
})();
