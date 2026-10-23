(function (global) {
  "use strict";

  const CONTENT = window.EchoTownContent;
  const STRATEGY = global.EchoTownStrategy;
  const PROJECTS = global.EchoTownProjects;
  const JOURNEY = global.EchoTownJourney;
  const STORAGE_KEY = "echo-town-generation-save-v9";
  const LEGACY_STORAGE_KEYS = ["echo-town-generation-save-v6", "echo-town-generation-save-v5", "echo-town-generation-save-v4", "echo-town-save", "echo-town-mvp-v1"];
  const SAVE_VERSION = 9;
  const MAX_MONEY = Number.MAX_SAFE_INTEGER;
  const MAX_SAVE_BYTES = 512 * 1024;
  const MAX_HISTORY = 40;
  const MAX_TEXT_LENGTH = 280;
  const RESOURCE_KEYS = Object.keys(CONTENT.resources);
  const SKILL_KEYS = Object.keys(CONTENT.skills);
  const RELATIONSHIP_KEYS = Object.keys(CONTENT.relationships);
  const WORLD_KEYS = Object.keys(CONTENT.world);
  const ATTRIBUTE_KEYS = Object.keys(CONTENT.buildAttributes || {});
  const INTEREST_KEYS = Object.keys(CONTENT.interests || {});
  const CHARACTER_KEYS = Object.keys(CONTENT.characters || {});
  const TALENT_POOL = [...(CONTENT.talents || []), ...(CONTENT.talentDraftPool || [])]
    .filter((item, index, list) => item && list.findIndex((candidate) => candidate.id === item.id) === index);
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
    "worked-project-craft": "为固定客户做过维修",
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
  const ROUTE_LABELS = {
    "study-route": "深造路线",
    "craft-route": "手艺路线",
    "community-route": "公共路线",
    "care-route": "照料路线",
    "interest-route": "兴趣路线",
    "relationship-route": "同行路线",
    "work-route": "工作路线",
    "wander-route": "远行路线",
    "enterprise-route": "经营路线",
    "project-route": "长期项目",
    "handoff-route": "传承路线",
    "health-route": "留有余地",
    "record-route": "记录路线",
  };
  const SEASON_LABELS = { spring: "春汛", summer: "盛夏", autumn: "秋收", winter: "枯水期" };
  const LOCATION_BY_STAGE = {
    childhood: "旧院子与河桥",
    adolescence: "临河学校",
    youth: "长河车站与集市",
    middle: "修理铺与新街",
    later: "旧电影院与镇志室",
  };
  const PRIMARY_CHARACTER_BY_RELATION = {
    family: "mother",
    mentor: "qishu",
    friend: "ahe",
    partner: "zhoulan",
    child: "xiaoman",
    neighbor: "chenshen",
  };
  const OPPORTUNITY_FOCUS = {
    "borrowed-book": ["reading", "linlaoshi"],
    "repair-bench": ["machinery", "qishu"],
    "school-duty": ["teaching", "linlaoshi"],
    "red-envelope": ["cooking", "mother"],
    "club-invite": ["music", "ahe"],
    "first-crush": ["photography", "zhoulan"],
    "summer-job": ["business", "chenshen"],
    "move-out": ["travel", "ahe"],
    "night-market": ["business", "chenshen"],
    "study-group": ["writing", "ahe"],
    "care-burden": ["cooking", "mother"],
    "side-project": ["machinery", "qishu"],
    "old-friend-call": ["writing", "ahe"],
    "apprentice-request": ["teaching", "xiaoman"],
    "community-meeting": ["community", "chenshen"],
    "health-warning": ["sports", "mother"],
    "archive-box": ["ecology", "linlaoshi"],
    "last-letter": ["writing", "ahe"],
  };
  const LIFE_ACTION_INTEREST = {
    "routine-study": "reading",
    "routine-repair": "machinery",
    "routine-social": "community",
    "routine-care": "cooking",
    "routine-rest": "sports",
    "routine-explore": "travel",
    "routine-record": "writing",
    "project-craft-shift": "machinery",
    "project-study-consult": "teaching",
    "project-community-care": "cooking",
  };

  const DEFAULT_STATE = {
    version: SAVE_VERSION,
    introSeen: false,
    world: {
      completedLives: 0,
      town: { shop: 0, bridge: 0, school: 0, market: 0, archive: 0 },
      history: [],
      legacyBank: [],
      collectedLegacyIds: [],
      achievements: [],
      secrets: [],
      moments: [],
      totals: { choices: 0, tests: 0, testWins: 0, workShifts: 0, moneyEarned: 0, moneySpent: 0 },
    },
    currentLife: null,
    screen: "start",
    settings: { fontScale: false, sound: false, volume: 0.6 },
    notice: "",
  };

  let state = clone(DEFAULT_STATE);
  let recoveryRequired = false;
  let runtimeMode = "main";
  let setup = {
    profileId: "town-child",
    talentId: "slow-and-steady",
    talentIds: ["slow-and-steady", "good-memory", "warm-heart"],
    goalId: "learn",
    attributes: { appearance: 5, intelligence: 5, physique: 5, family: 5 },
    routeId: "study",
  };
  let pendingEvents = [];


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
    const talentIds = arguments[5] || [];
    const attributes = arguments[6] || {};
    return hashSeed(["echo-town", generation, profileId, talentId, goalId, ...(talentIds || []), ...ATTRIBUTE_KEYS.map((key) => attributes[key] || 0), ...(legacyIds || [])].join(":"));
  }

  function getProfile(id) {
    return CONTENT.profiles.find((item) => item.id === id) || CONTENT.profiles[0];
  }

  function getTalent(id) {
    return TALENT_POOL.find((item) => item.id === id) || TALENT_POOL[0];
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
    return getLifeActions().find((item) => item.id === id) || null;
  }

  function getLifeActions() {
    return [...CONTENT.lifeActions, ...(PROJECTS?.getLifeActionDefinitions?.() || [])];
  }

  function getOpportunity(id) {
    return CONTENT.opportunities?.find((item) => item.id === id) || null;
  }

  function getJob(id) {
    return getJobs().find((item) => item.id === id) || null;
  }

  function getJobs() {
    const projectJobs = PROJECTS?.getJobDefinitions?.() || (PROJECTS ? [PROJECTS.getJobDefinition()] : []);
    return [...CONTENT.jobs, ...projectJobs];
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

  function getSeason(age) {
    const seasons = ["spring", "summer", "autumn", "winter"];
    return seasons[Math.max(0, Math.floor((Number(age || 6) - 6) / 8)) % seasons.length];
  }

  function getStageFocus(stageId) {
    return CONTENT.stageFocus?.[stageId] || { title: "这一章正在发生", detail: "每个选择都会把你推向一个更具体的问题。" };
  }

  function getMoment(id) {
    return CONTENT.moments.find((item) => item.id === id) || null;
  }

  function momentTriggerMet(life, trigger, context = {}) {
    if (!trigger) return false;
    if (trigger.type === "flag") return life.flags.includes(trigger.key);
    if (trigger.type === "life-action") return context.type === "life-action" && context.actionId === trigger.actionId;
    if (trigger.type === "job") return context.type === "job" && context.jobId === trigger.jobId;
    if (trigger.type === "job-change") return life.jobHistory.length >= 2;
    if (trigger.type === "bill") return context.type === "bill";
    if (trigger.type === "event") return context.type === "event" && context.actionId === trigger.actionId;
    return false;
  }

  function collectMoments(life, context = {}) {
    const newMoments = CONTENT.moments
      .filter((moment) => !life.moments.includes(moment.id) && momentTriggerMet(life, moment.trigger, context))
      .map((moment) => moment.id);
    if (!newMoments.length) return [];
    life.moments = [...new Set([...life.moments, ...newMoments])].slice(0, CONTENT.maxMoments);
    life.newMoments = [...new Set([...(life.newMoments || []), ...newMoments])].slice(0, CONTENT.maxMoments);
    state.world.moments = [...new Set([...(state.world.moments || []), ...newMoments])].slice(0, CONTENT.maxMoments);
    return newMoments;
  }

  function getRound(life) {
    return CONTENT.rounds[clamp(life.round, 0, CONTENT.rounds.length - 1, 0)];
  }

  function getOpportunityAvailability(life, opportunity) {
    if (!opportunity) return { available: false, reason: "机会不存在" };
    if (life.age < Number(opportunity.minAge || 0)) return { available: false, reason: `需要 ${opportunity.minAge} 岁以后` };
    if (opportunity.maxAge && life.age > Number(opportunity.maxAge)) return { available: false, reason: `只在 ${opportunity.maxAge} 岁以前出现` };
    return getAvailability(life, opportunity);
  }

  function drawOpportunities(life) {
    const all = (CONTENT.opportunities || []).filter((item) => life.age >= Number(item.minAge || 0) && (!item.maxAge || life.age <= Number(item.maxAge)));
    const ranked = all.slice().sort((left, right) => {
      const leftFocus = OPPORTUNITY_FOCUS[left.id]?.[0];
      const rightFocus = OPPORTUNITY_FOCUS[right.id]?.[0];
      const leftScore = hashSeed(`${life.seed}:opportunity:${life.round}:${left.id}`) - Number(life.build?.interests?.[leftFocus] || 0) * 1000000;
      const rightScore = hashSeed(`${life.seed}:opportunity:${life.round}:${right.id}`) - Number(life.build?.interests?.[rightFocus] || 0) * 1000000;
      return leftScore - rightScore;
    });
    return ranked.slice(0, 3).map((item) => item.id);
  }

  function prepareOpportunity(life) {
    if (!life) return;
    life.opportunity = {
      drawnIds: drawOpportunities(life),
      selectedId: null,
      skipped: false,
      history: Array.isArray(life.opportunity?.history) ? life.opportunity.history.slice(-CONTENT.maxRounds) : [],
    };
  }

  function opportunityResolved(life) {
    return Boolean(life?.opportunity?.selectedId || life?.opportunity?.skipped);
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

  function normalizeAttributes(value) {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, clamp(source[key], 0, 20, 0)]));
  }

  function normalizeInterests(value) {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(INTEREST_KEYS.map((key) => [key, clamp(source[key], 0, 10, 0)]));
  }

  function normalizeCharacters(value) {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(CHARACTER_KEYS.map((key) => [key, clamp(source[key], 0, 10, 0)]));
  }

  function normalizeTalentIds(value, fallbackId) {
    const ids = Array.isArray(value) && value.length ? value : [fallbackId];
    return ids.map((id) => getTalent(id)?.id).filter(Boolean).filter((id, index, list) => list.indexOf(id) === index).slice(0, CONTENT.talentPickLimit || 3);
  }



  function oldToNewId(id) {
    return LEGACY_ID_MAP[id] || id;
  }




  // A constructive, deliberately conservative migration check. These are
  // future ordinary commands in an isolated copy, never reconstructed history.
  // Uncertain tests, opportunities and purchases are not used as proof.
  // A future test is allowed only when its published minimum guarantees success.
  function proveMigrationGoals(snapshot) {
    const initial = snapshot.currentLife;
    const stageId = getRound(initial).stage;
    const result = { activeGoalIds: [], witnesses: {} };
    if (initial.status !== "active" || (initial.round === CONTENT.rounds.length - 1 && initial.lastAction)) return result;
    const nextRound = CONTENT.rounds[initial.round + 1];
    if (initial.lastAction && (!nextRound || nextRound.stage !== stageId)) return result;
    const saved = { state, setup, pendingEvents, recoveryRequired };
    const primary = { craft: "routine-repair", study: "routine-study", community: "routine-care" };
    const jobs = { craft: "shop-shift", study: "tutor-shift", community: "town-job" };
    const preferred = {
      craft: { 0: "fix-radio", 1: "legacy-tool-practice", 3: "repair-lantern", 4: "learn-bicycle", 5: "join-repair", 8: "fix-bicycle", 10: "return-workshop", 12: "open-workshop", 16: "keep-wet-pages", 20: "train-successor", 21: "open-clock", 22: "handoff-craft" },
      study: { 1: "front-seat", 4: "study-plan", 6: "ask-scholarship", 7: "city-library", 10: "take-promotion", 12: "change-career", 16: "trace-watergate", 17: "return-school", 19: "save-school", 20: "record-life", 22: "handoff-study" },
      community: { 1: "share-notes", 2: "ask-for-help", 3: "invite-shy-child", 4: "comfort-friend", 5: "chain-community-promise", 6: "stay-for-family", 8: "mentor-newcomer", 9: "keep-friendship", 10: "community-speech", 11: "ask-family-share", 13: "talk-through", 14: "support-choice", 15: "organize-evacuation", 18: "write-letter", 19: "invite-town-alumni", 20: "give-away-tools", 21: "call-family", 22: "handoff-community" },
    };
    try {
      for (const routeId of ["craft", "study", "community"]) {
        const goalId = routeId + ":" + stageId;
        // Different legal schedules establish existence, not a balance promise.
        for (const mode of ["work", "train", "recover", "social", "record"]) {
          state = clone(snapshot);
          // Old history cannot influence stage goal checks and is not copied
          // through every projected command; the actual snapshot stays intact.
          state.world.history = [];
          delete state.currentLife.migration;
          delete state.currentLife.strategy;
          STRATEGY.initLife(state.currentLife);
          state.currentLife.strategy.routeId = routeId;
          ensureLedger(state.currentLife);
          recoveryRequired = false;
          pendingEvents = [];
          const commands = [];
          const send = (command) => {
            const dispatched = dispatch(command);
            if (!dispatched.ok) return false;
            commands.push(command);
            return true;
          };
          // Six nodes at most, two life actions and one event per node.
          for (let turn = 0; turn < CONTENT.rounds.length * 5; turn += 1) {
            const life = state.currentLife;
            const round = getRound(life);
            if (round.stage !== stageId || life.status !== "active") break;
            const phase = getLifePhase();
            if (phase === "feedback") {
              const finished = life.strategy.goals[goalId];
              if (finished && finished.status === "achieved") {
                result.activeGoalIds.push(goalId);
                result.witnesses[goalId] = commands;
                break;
              }
              const next = CONTENT.rounds[life.round + 1];
              if (!next || next.stage !== stageId || !send({ type: "ADVANCE_ROUND" })) break;
            } else if (phase === "opportunity") {
              if (!send({ type: "SKIP_OPPORTUNITY" })) break;
            } else if (phase === "management") {
              const target = round.actions.find(action => action.id === preferred[routeId][life.round]);
              const reservedEnergy = Math.max(0, -Number(target && target.effect && target.effect.resources && target.effect.resources.energy || 0));
              const targetSkill = { craft: "craft", study: "study", community: "empathy" }[routeId];
              const minimum = { childhood: routeId === "study" ? 3 : 2, adolescence: routeId === "community" ? 3 : 4, youth: routeId === "community" ? 4 : 5, middle: routeId === "community" ? 6 : 7, later: 6 }[stageId];
              let candidates;
              if (mode === "recover") candidates = ["routine-rest"];
              else if (mode === "social") candidates = ["routine-social", primary[routeId], "routine-rest"];
              else if (mode === "record") candidates = [life.skills.expression < 3 ? "routine-record" : primary[routeId], "routine-social", "routine-rest"];
              else if (mode === "train" && life.skills[targetSkill] < minimum) candidates = [primary[routeId], jobs[routeId], "routine-rest"];
              else candidates = [jobs[routeId], primary[routeId], "routine-rest"];
              let acted = false;
              for (const id of candidates) {
                const command = { type: "LIFE_ACTION", id };
                const preview = previewAction(command);
                if (!preview.available) continue;
                if (id !== "routine-rest" && preview.remaining.energy < reservedEnergy) continue;
                if (send(command)) { acted = true; break; }
              }
              if (!acted && !send({ type: "END_LIFE_ACTIONS" })) break;
            } else if (phase === "event") {
              const ids = [preferred[routeId][life.round], "steady-" + round.id];
              const id = ids.find(id => {
                const source = round.actions.find(action => action.id === id);
                if (!source) return false;
                const preview = previewAction({ type: "EVENT_ACTION", id });
                return preview.available && (!preview.test || preview.test.minimum >= preview.test.difficulty);
              });
              if (!id || !send({ type: "EVENT_ACTION", id })) break;
            } else break;
          }
          if (result.activeGoalIds.includes(goalId)) break;
        }
      }
    } finally {
      state = saved.state;
      setup = saved.setup;
      pendingEvents = saved.pendingEvents;
      recoveryRequired = saved.recoveryRequired;
    }
    return result;
  }

  function connectMigratedGoals(snapshot) {
    const life = snapshot.currentLife;
    if (!life || !life.migration || life.migration.goalAccessVersion === 1) return;
    const migration = life.migration;
    // Do not reopen an already resumed partial stage from an older v8 snapshot.
    const access = migration.round === life.round && migration.stageId === getRound(life).stage && !life.strategy
      ? proveMigrationGoals(snapshot) : { activeGoalIds: [] };
    migration.goalAccessVersion = 1;
    migration.activeGoalIds = access.activeGoalIds;
    migration.deferGoals = access.activeGoalIds.length === 0;
  }

  function normalizeState(saved) {
    const checked = global.EchoTownSave.prepareImport(JSON.stringify(saved));
    if (!checked.ok) throw new Error(checked.message || "存档无效");
    const next = clone(checked.state);
    if (next.currentLife) {
      connectMigratedGoals(next);
      STRATEGY.initLife(next.currentLife, { migrated: Boolean(next.currentLife.migration) });
      ensureLedger(next.currentLife);
      if (PROJECTS) next.currentLife.projects = PROJECTS.normalize(next.currentLife.projects, next.currentLife);
    }
    return next;
  }

  function createLife(profileId, talentId, goalId, buildSetup = setup) {
    const profile = getProfile(profileId);
    const talentIds = Array.isArray(buildSetup.talentIds) ? [...buildSetup.talentIds] : normalizeTalentIds(null, talentId);
    const talent = getTalent(talentIds[0] || talentId);
    const legacyIds = state.world.legacyBank.slice(0, CONTENT.maxLegacyChoices);
    const attributes = normalizeAttributes(buildSetup.attributes);
    const life = {
      _initializing: true,
      status: "active",
      generation: state.world.completedLives + 1,
      age: CONTENT.rounds[0].age,
      round: 0,
      seed: makeLifeSeed(state.world.completedLives + 1, profile.id, talent.id, goalId, legacyIds, talentIds, attributes),
      profileId: profile.id,
      talentId: talent.id,
      goalId: getGoal(goalId).id,
      build: { attributes, talentIds, interests: defaultMap(INTEREST_KEYS), routeTags: [] },
      resources: defaultMap(RESOURCE_KEYS),
      maxResources: { energy: 10 + Math.floor(attributes.physique / 4) },
      skills: defaultMap(SKILL_KEYS),
      relationships: defaultMap(RELATIONSHIP_KEYS),
      characters: defaultMap(CHARACTER_KEYS),
      town: clone(state.world.town),
      actionPoints: CONTENT.actionPointsPerRound,
      sideActionsUsed: 0,
      inventory: [],
      jobId: "none",
      jobShifts: 0,
      jobHistory: [],
      cashflow: { income: 0, expenses: 0, debt: 0 },
      lifeLog: [],
      lifeFeedback: null,
      sceneVisits: [],
      sceneFeedback: null,
      opportunityFeedback: null,
      flags: [...(profile.flags || [])],
      secrets: [],
      progress: defaultMap(CONTENT.goals.map((goal) => goal.id)),
      inheritedLegacyIds: [...legacyIds],
      actions: [],
      lastAction: null,
      carryForward: null,
      outcome: null,
      legacyCandidates: [],
      selectedLegacies: [],
      newAchievements: [],
      newSecrets: [],
      moments: [],
      newMoments: [],
      opportunity: { drawnIds: [], selectedId: null, skipped: false, history: [] },
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
    CHARACTER_KEYS.forEach((key) => {
      const relation = CONTENT.characters[key]?.relation;
      if (relation && key in life.characters) life.characters[key] = clamp(Math.floor(Number(life.relationships[relation] || 0) / 2), 0, 10, 0);
    });
    talentIds.map(getTalent).filter(Boolean).forEach((selectedTalent) => applyEffect(life, selectedTalent.effect, false));
    legacyIds.map(getLegacy).filter(Boolean).forEach((legacy) => applyEffect(life, legacy.effect, false));
    life.resources.money += life.build.attributes.family * 2;
    life.resources.energy = clamp(life.resources.energy, 0, life.maxResources.energy, life.resources.energy);
    life.age = CONTENT.rounds[0].age;
    delete life._initializing;
    STRATEGY.initLife(life);
    if (PROJECTS) life.projects = PROJECTS.normalize(undefined, life);
    life.strategy.routeId = buildSetup.routeId || (goalId === "town" || goalId === "home" || goalId === "connection" ? "community" : profileId === "workshop-heir" ? "craft" : "study");
    ensureLedger(life);
    prepareOpportunity(life);
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
    const beforePhysique = Number(life.build?.attributes?.physique || 0);
    Object.entries(effect.attributes || {}).forEach(([key, amount]) => {
      if (life.build?.attributes && key in life.build.attributes) addValue(life.build.attributes, key, amount, 0, 20);
    });
    life.maxResources.energy += Math.floor(Number(life.build?.attributes?.physique || 0) / 4) - Math.floor(beforePhysique / 4);
    Object.entries(effect.maxResources || {}).forEach(([key, amount]) => {
      if (key in life.maxResources) life.maxResources[key] = clamp(life.maxResources[key] + Number(amount || 0), 10, Number.MAX_SAFE_INTEGER, 10);
    });
    Object.entries(effect.resources || {}).forEach(([key, amount]) => {
      if (key in life.resources) addValue(life.resources, key, amount, 0, key === "energy" ? life.maxResources.energy : key === "money" ? MAX_MONEY : CONTENT.resources[key].max);
    });
    Object.entries(effect.interests || {}).forEach(([key, amount]) => {
      if (life.build?.interests && key in life.build.interests) addValue(life.build.interests, key, amount, 0, 10);
    });
    Object.entries(effect.characters || {}).forEach(([key, amount]) => {
      if (life.characters && key in life.characters) addValue(life.characters, key, amount, 0, 10);
    });
    Object.entries(effect.skills || {}).forEach(([key, amount]) => {
      const ceiling = life._initializing || amount < 0 ? Number.MAX_SAFE_INTEGER : Math.max(life.skills[key], getGrowthCap(life));
      addValue(life.skills, key, amount, 0, ceiling);
    });
    Object.entries(effect.relationships || {}).forEach(([key, amount]) => {
      addValue(life.relationships, key, amount, 0, 10);
      const characterId = PRIMARY_CHARACTER_BY_RELATION[key];
      if (characterId && life.characters) addValue(life.characters, characterId, amount, 0, 10);
    });
    if (includeTown) Object.entries(effect.town || {}).forEach(([key, amount]) => {
      if (key in life.town) addValue(life.town, key, amount, 0, CONTENT.world[key].values.length - 1);
    });
    life.inventory = [...new Set([...life.inventory, ...safeList(effect.items, CONTENT.maxInventory, 60)])].filter((id) => getItem(id)).slice(0, CONTENT.maxInventory);
    life.flags = [...new Set([...life.flags, ...safeList(effect.flags, 20, 80)])].slice(0, 80);
    life.build.routeTags = [...new Set([...(life.build?.routeTags || []), ...safeList(effect.routeTags, 8, 60)])].slice(0, 24);
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
    if (group === "attributes") return Number(life.build?.attributes?.[key] || 0);
    if (group === "interests") return Number(life.build?.interests?.[key] || 0);
    if (group === "characters") return Number(life.characters?.[key] || 0);
    return 0;
  }

  function requirementMet(life, requirement) {
    if (!requirement) return true;
    if (requirement.type === "project") return Boolean(PROJECTS && PROJECTS.isUnlocked(life, requirement.id));
    if (requirement.type === "any") return (requirement.requirements || []).some((item) => requirementMet(life, item));
    if (requirement.type === "all") return (requirement.requirements || []).every((item) => requirementMet(life, item));
    if (requirement.type === "resource") return getLifeStat(life, "resources", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "skill") return getLifeStat(life, "skills", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "attribute") return getLifeStat(life, "attributes", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "interest") return getLifeStat(life, "interests", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "relationship") return getLifeStat(life, "relationships", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "character") return getLifeStat(life, "characters", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "world") return getLifeStat(life, "town", requirement.key) >= Number(requirement.min || 0);
    if (requirement.type === "flag") return life.flags.includes(requirement.key);
    if (requirement.type === "secret") return life.secrets.includes(requirement.key);
    if (requirement.type === "age") return life.age >= Number(requirement.min || 0);
    return STRATEGY.requirementMet(life, requirement);
  }

  function requirementReason(requirement) {
    if (!requirement) return "";
    if (requirement.label) return requirement.label;
    if (requirement.type === "age") return "需要年满 " + requirement.min + " 岁";
    if (requirement.type === "any" || requirement.type === "all") return (requirement.requirements || []).map(requirementReason).join(requirement.type === "any" ? " 或 " : " 且 ");
    const labels = { resource: CONTENT.resources, skill: CONTENT.skills, attribute: CONTENT.buildAttributes, interest: CONTENT.interests, relationship: CONTENT.relationships, character: CONTENT.characters, world: CONTENT.world };
    if (labels[requirement.type]) return "需要" + (labels[requirement.type][requirement.key]?.label || requirement.key) + " " + requirement.min;
    return "需要先完成对应经历或继承";
  }


  function getAvailability(life, action) {
    if (!life || !action) return { available: false, reason: "没有这个行动" };
    const failed = (action.requires || []).find((requirement) => !requirementMet(life, requirement));
    if (failed) return { available: false, reason: requirementReason(failed) };
    const effect = action.points ? getLifeActionEffect(life, action) : action.effect || {};
    for (const key of ["money", "energy", "health"]) {
      const base = Math.max(0, -Number(effect.resources?.[key] || 0));
      const risk = Math.max(0, -Number(action.test?.success?.resources?.[key] || 0), -Number(action.test?.failure?.resources?.[key] || 0));
      if (life.resources[key] < base + risk) {
        return { available: false, reason: CONTENT.resources[key].label + "还差 " + (base + risk - life.resources[key]) + (risk ? "（含风险准备）" : "") };
      }
    }
    return { available: true, reason: "" };
  }

  function getLifeAvailability(life, action) {
    if (life.age < Number(action.minAge || 0)) return { available: false, reason: `需要 ${action.minAge} 岁以后` };
    if (life.actionPoints < Number(action.points || 1)) return { available: false, reason: `还需要 ${action.points} 点生活行动` };
    return getAvailability(life, action);
  }

  function hasItem(life, itemId) {
    return Array.isArray(life.inventory) && life.inventory.includes(itemId);
  }

  function getCurrentRoundRestCount(life) {
    return (life.lifeLog || []).filter((entry) => entry.age === life.age && entry.label === "认真休息").length;
  }


  function getLifeActionCopy(life, action) {
    const effect = getLifeActionEffect(life, action);
    const cost = [String(action.points || 1) + " 行动点"];
    for (const [key, value] of Object.entries(effect.resources || {})) if (value < 0) cost.push(formatDelta(CONTENT.resources[key].label, value));
    const preview = clone(life);
    applyEffect(preview, effect);
    return { cost: cost.join(" · "), preview: getMetricChanges(captureMetrics(life), captureMetrics(preview)).join("；") || `当前数值没有可增加的收益，仍消耗 ${action.points || 1} 行动点` };
  }


  function getLifeActionEffect(life, action) {
    const effect = clone(action.effect || {});
    if (action.id === "routine-rest" && getCurrentRoundRestCount(life) >= 1) effect.resources = { energy: 1 };
    const expectation = { "routine-study": 1, "routine-care": 1, "routine-social": -1, "routine-rest": -1, "routine-explore": -1 }[action.id];
    if (expectation) effect.resources = { ...(effect.resources || {}), expectation };
    const add = (group, key, amount) => {
      effect[group] = { ...(effect[group] || {}) };
      effect[group][key] = Number(effect[group][key] || 0) + amount;
    };
    if (hasItem(life, "toolkit") && ["routine-repair", "shop-shift", "project-craft-shift"].includes(action.id)) add("skills", "craft", 1);
    if (hasItem(life, "study-notebook") && ["routine-study", "routine-record", "tutor-shift", "project-study-consult"].includes(action.id)) add("skills", "study", 1);
    if (hasItem(life, "old-phone") && action.id === "routine-social") add("relationships", "friend", 1);
    if (hasItem(life, "first-aid") && ["routine-care", "routine-rest", "project-community-care"].includes(action.id)) add("resources", "health", 1);
    if (hasItem(life, "warm-coat")) {
      if (action.id === "routine-rest") add("resources", "health", 1);
      if (["night-shift", "courier-shift"].includes(action.id)) add("resources", "health", 1);
    }
    if (hasItem(life, "camera") && ["routine-record", "routine-explore", "town-job"].includes(action.id)) add("town", "archive", 1);
    const interestId = LIFE_ACTION_INTEREST[action.id];
    if (interestId) add("interests", interestId, 1);
    if (action.jobId && life.jobShifts === 0) effect.flags = [...(effect.flags || []), "first-wage"];
    if (action.id === "night-shift") effect.secrets = [...(effect.secrets || []), "last-bus"];
    return effect;
  }

  function getOpportunityEffect(opportunity) {
    const effect = clone(opportunity.effect || {});
    const focus = OPPORTUNITY_FOCUS[opportunity.id] || [];
    effect.interests = { ...(effect.interests || {}) };
    effect.characters = { ...(effect.characters || {}) };
    effect.routeTags = opportunity.routeTags || [];
    if (focus[0]) effect.interests[focus[0]] = Number(effect.interests[focus[0]] || 0) + 1;
    if (focus[1]) effect.characters[focus[1]] = Number(effect.characters[focus[1]] || 0) + 1;
    return effect;
  }

  function getPrimaryLifeActionIds(life) {
    const goal = getGoal(life.goalId);
    const preferredActionByKey = {
      study: "routine-study",
      craft: "routine-repair",
      expression: "routine-record",
      empathy: "routine-care",
      courage: "routine-explore",
      friend: "routine-social",
      partner: "routine-social",
      neighbor: "routine-explore",
      market: "routine-explore",
    };
    const ids = [...({ craft: ["routine-repair"], study: ["routine-study"], community: ["routine-care", "routine-social"] }[life.strategy?.routeId] || [])];
    (goal.preferred || []).forEach((key) => {
      const actionId = preferredActionByKey[key];
      if (actionId && !ids.includes(actionId)) ids.push(actionId);
    });
    if (life.resources.energy <= 4 || life.resources.health <= 4 || life.resources.pressure >= 7) ids.push("routine-rest");
    if (life.age >= 13) ids.push("routine-record");
    if (life.age >= 11) ids.push("routine-explore");
    ids.push("routine-social");
    const availableIds = CONTENT.lifeActions.filter((action) => getLifeAvailability(life, action).available).map((action) => action.id);
    const primary = ids.filter((id, index) => ids.indexOf(id) === index && availableIds.includes(id)).slice(0, 3);
    if (primary.length >= 3) return primary;
    CONTENT.lifeActions.forEach((action) => {
      if (primary.length < 3 && availableIds.includes(action.id) && !primary.includes(action.id)) primary.push(action.id);
    });
    return primary;
  }


  function addGoalPoints(life) {
    const oldGoal = life.goalId;
    CONTENT.goals.forEach((goal) => {
      const status = STRATEGY.getWishStatus({ ...life, goalId: goal.id });
      life.progress[goal.id] = status.completed ? goal.target : Math.min(goal.target - 1, Math.floor((status.progress / Math.max(1, status.target)) * goal.target));
    });
    life.goalId = oldGoal;
    return [];
  }

  function pushLifeLog(life, entry) {
    life.lifeLog = [...(life.lifeLog || []), {
      age: life.age,
      label: safeText(entry.label, 100),
      result: safeText(entry.result, MAX_TEXT_LENGTH),
      kind: safeText(entry.kind, 30),
    }].slice(-CONTENT.maxLifeLog);
  }

  function inspectScene(roundId, clueId) {
    const life = state.currentLife;
    if (!life || life.status !== "active" || life.lastAction || getRound(life).id !== roundId) return;
    const clues = CONTENT.sceneClues?.[roundId] || [];
    const clue = clues.find((item) => item.id === clueId);
    if (!clue || life.sceneVisits.includes(clue.id)) return;
    const before = captureMetrics(life);
    const applied = applyEffect(life, clue.effect || {});
    const after = captureMetrics(life);
    const changes = getMetricChanges(before, after);
    life.sceneVisits = [...life.sceneVisits, clue.id].slice(-80);
    life.sceneFeedback = {
      title: clue.label,
      copy: clue.detail,
      changes,
      newSecrets: applied.newSecrets || [],
    };
    pushLifeLog(life, { label: `观察：${clue.label}`, result: clue.detail, kind: "镜头" });
    if (applied.newSecrets?.length) {
      state.world.secrets = [...new Set([...state.world.secrets, ...applied.newSecrets])];
      life.newSecrets = [...new Set([...(life.newSecrets || []), ...applied.newSecrets])];
    }
    emitAudio("moment");
    persist("镜头细节已记下");
    render();
  }

  function resolveOpportunity(opportunityId) {
    const life = state.currentLife;
    const opportunity = getOpportunity(opportunityId);
    if (!life || life.status !== "active" || life.lastAction || !opportunity || opportunityResolved(life)) return;
    if (!life.opportunity?.drawnIds?.includes(opportunity.id)) return;
    const availability = getOpportunityAvailability(life, opportunity);
    if (!availability.available) {
      showToast(availability.reason || "这次机会还没有到你手里");
      return;
    }
    const before = captureMetrics(life);
    const opportunityEffect = getOpportunityEffect(opportunity);
    const copy = CONTENT.getOpportunityCopy(opportunity, life);
    const applied = applyTransaction(life, opportunityEffect, "opportunity", opportunity.id);
    recordEvidence(life, opportunity.id, "opportunity");
    const milestones = addGoalPoints(life, opportunity.goalPoints || {});
    life.opportunity.selectedId = opportunity.id;
    life.opportunity.skipped = false;
    life.opportunity.history = [...(life.opportunity.history || []), { age: life.age, id: opportunity.id, label: copy.label }].slice(-CONTENT.maxRounds);
    life.opportunityFeedback = {
      title: `机会已接住：${copy.label}`,
      copy: copy.result,
      changes: getMetricChanges(before, captureMetrics(life)),
      newSecrets: applied.newSecrets || [],
      milestones,
      tags: opportunity.tags || [],
    };
    pushLifeLog(life, { label: copy.label, result: copy.result, kind: "机会" });
    state.world.totals.choices += 1;
    if (applied.newSecrets?.length) {
      state.world.secrets = [...new Set([...state.world.secrets, ...applied.newSecrets])];
      life.newSecrets = [...new Set([...(life.newSecrets || []), ...applied.newSecrets])];
    }
    emitAudio("success");
    persist("机会选择已保存");
    render();
  }

  function skipOpportunity() {
    const life = state.currentLife;
    if (!life || life.status !== "active" || life.lastAction || opportunityResolved(life)) return;
    life.opportunity.skipped = true;
    life.opportunity.selectedId = null;
    life.opportunityFeedback = { title: "你让机会先经过", copy: "没有每一扇门都要推开；这次保留选择权，也保留了下一次行动的余地。", changes: [], newSecrets: [], milestones: [], tags: ["保留"] };
    pushLifeLog(life, { label: "跳过一次机会", result: life.opportunityFeedback.copy, kind: "机会" });
    emitAudio("click");
    persist("机会已跳过");
    render();
  }

  function resolveLifeAction(actionId) {
    const life = state.currentLife;
    if (!life || life.status !== "active" || life.lastAction) return;
    if (!opportunityResolved(life)) {
      showToast("先处理本节点的机会牌，再安排生活行动");
      return;
    }
    const action = getLifeAction(actionId) || getJob(actionId);
    if (!action) return;
    const availability = getLifeAvailability(life, action);
    if (!availability.available) {
      showToast(availability.reason || "这个生活安排现在还做不了");
      return;
    }
    const projectBefore = captureProjectReceipt(life);
    const before = captureMetrics(life);
    const beforeItems = new Set(life.inventory);
    const beforeWorldSecrets = new Set(state.world.secrets);
    const effect = getLifeActionEffect(life, action);
    const applied = applyTransaction(life, effect, action.jobId ? "work" : "life", action.id);
    recordEvidence(life, action.id, action.jobId ? "job" : "life-action");
    const goalPoints = { ...(action.goalPoints || {}) };
    if (action.bonusItem === "record" && hasItem(life, "camera")) goalPoints.record = Number(goalPoints.record || 0) + 1;
    const milestones = addGoalPoints(life, goalPoints);
    life.actionPoints -= Number(action.points || 1);
    life.sideActionsUsed += 1;
    if (action.jobId) {
      life.jobId = action.jobId;
      life.jobShifts += 1;
      if (!life.jobHistory.includes(action.jobId)) life.jobHistory.push(action.jobId);
      state.world.totals.workShifts += 1;
    }
    const after = captureMetrics(life);
    const newItems = life.inventory.filter((item) => !beforeItems.has(item));
    const newSecrets = [...new Set([...(applied.newSecrets || []), ...life.secrets.filter((secret) => !beforeWorldSecrets.has(secret))])];
    state.world.secrets = [...new Set([...state.world.secrets, ...life.secrets])];
    life.newSecrets = [...new Set([...(life.newSecrets || []), ...newSecrets])];
    life.flags = [...new Set([...life.flags, ...(action.jobId ? ["worked"] : [])])];
    const newMoments = collectMoments(life, action.jobId ? { type: "job", jobId: action.jobId } : { type: "life-action", actionId: action.id });
    life.lifeFeedback = {
      title: action.label,
      copy: action.jobId ? `${action.label}结束了。${action.detail}` : `${action.label}完成了。${action.detail}`,
      changes: getMetricChanges(before, after),
      newItems,
      newSecrets,
      newMoments,
      milestones,
    };
    emitAudio(action.jobId ? "coin" : "click");
    if (newMoments.length) emitAudio("moment");
    pushLifeLog(life, { label: action.label, result: life.lifeFeedback.copy, kind: action.jobId ? "工作" : "生活" });
    recordProjectAction(life, { type: "LIFE_ACTION", id: actionId, before: projectBefore });
    unlockAchievements(life);
    persist("生活安排已保存");
    render();
  }

  function buyItem(itemId) {
    const life = state.currentLife;
    const item = getItem(itemId);
    if (!life || life.status !== "active" || life.lastAction || !item) return;
    if (!opportunityResolved(life)) { showToast("先处理本节点的机会牌，再购买东西"); return; }
    if (life.actionPoints < 1) { showToast("生活行动点不够了"); return; }
    if (life.inventory.includes(item.id)) { showToast("你已经有这件东西了"); return; }
    if (life.inventory.length >= CONTENT.maxInventory) { showToast(`库存最多放 ${CONTENT.maxInventory} 件东西`); return; }
    if (life.resources.money < item.price) { showToast(`还差 ${item.price - life.resources.money} 元，先去工作或换个便宜的选择`); return; }
    const projectBefore = captureProjectReceipt(life);
    const before = captureMetrics(life);
    const beforeSecrets = new Set(state.world.secrets);
    applyTransaction(life, { resources: { money: -item.price }, items: [item.id], flags: ["bought-item"], secrets: item.id === "camera" ? ["pocket-receipt"] : [] }, "purchase", item.id);
    recordEvidence(life, item.id, "purchase");
    life.actionPoints -= 1;
    life.sideActionsUsed += 1;
    const newSecrets = life.secrets.filter((secret) => !beforeSecrets.has(secret));
    state.world.secrets = [...new Set([...state.world.secrets, ...life.secrets])];
    const after = captureMetrics(life);
    life.newSecrets = [...new Set([...(life.newSecrets || []), ...newSecrets])];
    const newMoments = collectMoments(life, { type: "buy", itemId: item.id });
    life.lifeFeedback = { title: `买下：${item.label}`, copy: item.detail, changes: getMetricChanges(before, after), newItems: [item.id], newSecrets, newMoments };
    emitAudio("coin");
    if (newMoments.length) emitAudio("moment");
    pushLifeLog(life, { label: `购买${item.label}`, result: item.detail, kind: "消费" });
    recordProjectAction(life, { type: "BUY_ITEM", id: itemId, before: projectBefore });
    unlockAchievements(life);
    persist("物品已加入库存");
    render();
  }

  function getAction(actionId, life = state.currentLife) {
    const action = getRound(life)?.actions.find((item) => item.id === actionId) || null;
    return action && JOURNEY ? JOURNEY.resolveEventAction(life, action) : action;
  }

  function captureMetrics(life) {
    return {
      ...Object.fromEntries(RESOURCE_KEYS.map((key) => [`resources.${key}`, life.resources[key]])),
      ...Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [`attributes.${key}`, life.build?.attributes?.[key] || 0])),
      ...Object.fromEntries(INTEREST_KEYS.map((key) => [`interests.${key}`, life.build?.interests?.[key] || 0])),
      ...Object.fromEntries(SKILL_KEYS.map((key) => [`skills.${key}`, life.skills[key]])),
      ...Object.fromEntries(RELATIONSHIP_KEYS.map((key) => [`relationships.${key}`, life.relationships[key]])),
      ...Object.fromEntries(CHARACTER_KEYS.map((key) => [`characters.${key}`, life.characters?.[key] || 0])),
      ...Object.fromEntries(WORLD_KEYS.map((key) => [`town.${key}`, life.town[key]])),
    };
  }

  function getMetricLabel(path) {
    const [group, key] = path.split(".");
    if (group === "resources") return CONTENT.resources[key]?.label || key;
    if (group === "attributes") return CONTENT.buildAttributes[key]?.label || key;
    if (group === "interests") return CONTENT.interests[key]?.label || key;
    if (group === "skills") return CONTENT.skills[key]?.label || key;
    if (group === "relationships") return CONTENT.relationships[key]?.label || key;
    if (group === "characters") return CONTENT.characters[key]?.label || key;
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
    if (!opportunityResolved(life)) {
      showToast("先处理本节点的机会牌，再落地人生事件");
      return;
    }
    const action = getAction(actionId);
    if (!action) return;
    const availability = getAvailability(life, action);
    if (!availability.available) {
      showToast(availability.reason || "这个行动现在还做不了");
      return;
    }
    const before = captureMetrics(life);
    const beforeLevels = Object.fromEntries(SKILL_KEYS.map((key) => [key, getSkillLevel(life.skills[key])]));
    const beforeWorldSecrets = new Set(state.world.secrets);
    const testPreview = getTestPreview(life, action);
    let testResult = null;
    const baseEffect = clone(action.effect || {});
    const pendingFlags = action.test ? (baseEffect.flags || []) : [];
    if (action.test) baseEffect.flags = [];
    const baseResult = applyTransaction(life, baseEffect, "event", action.id, action.id === "take-risk-loan" ? { borrow: 20 } : {});
    if (action.test) {
      const test = action.test;
      const roll = deterministicRoll(life, action);
      const score = testPreview.minimum + roll;
      const success = score >= Number(test.difficulty || 0);
      applyTransaction(life, success ? test.success : test.failure, "event", action.id + (success ? "-success" : "-failure"));
      if (success) applyEffect(life, { flags: pendingFlags });
      testResult = { label: test.label, score, difficulty: test.difficulty, roll, success, text: success ? test.successText : test.failureText };
      state.world.totals.tests += 1;
      if (success) state.world.totals.testWins += 1;
    }
    const recorded = recordEvidence(life, action.id, "event", !testResult || testResult.success, action.journeyVariant);
    const milestones = addGoalPoints(life);
    if (before["resources.pressure"] >= 8 && life.resources.pressure <= 6 && life.resources.happiness >= 7) life.flags.push("second-chance");
    const after = captureMetrics(life);
    const newLevels = SKILL_KEYS.filter((key) => getSkillLevel(life.skills[key]) > beforeLevels[key]).map((key) => `${CONTENT.skills[key].label}达到${getSkillLevelName(key, life.skills[key])}`);
    const newSecrets = [...new Set([...(baseResult.newSecrets || []), ...life.secrets.filter((secret) => !beforeWorldSecrets.has(secret))])];
    state.world.secrets = [...new Set([...state.world.secrets, ...life.secrets])];
    const newMoments = collectMoments(life, { type: "event", actionId: action.id });
    const round = getRound(life);
    const stage = getStage(round.stage);
    const nextRound = CONTENT.rounds[life.round + 1];
    const stageBreak = nextRound && nextRound.stage !== round.stage ? getStage(nextRound.stage) : null;
    life.lastAction = {
      actionId: action.id,
      title: action.label,
      result: testResult?.text ? `${testResult.text} ${action.result}` : action.result,
      future: recorded.consequences?.length ? recorded.consequences.map((item) => item.copy).join(" ") : action.future,
      changes: getMetricChanges(before, after),
      newLevels,
      newSecrets,
      tags: action.tags || [],
      test: testResult,
      stageBreak: stageBreak ? { label: stageBreak.label, range: stageBreak.range, hint: stageBreak.hint } : null,
      newMoments,
      milestones,
      ...(action.journeyVariant ? { journeyVariant: action.journeyVariant } : {}),
    };
    life.carryForward = { title: action.label, copy: getMetricChanges(before, after).join("；") || "这次没有改变资源，你保留了余地。", age: life.age };
    emitAudio(testResult && !testResult.success ? "error" : "success");
    if (newMoments.length) emitAudio("moment");
    life.lifeFeedback = null;
    life.actions.push({ actionId: action.id, round: life.round + 1, age: life.age, label: action.label, result: life.lastAction.result, success: testResult ? testResult.success : true, ...(action.journeyVariant ? { journeyVariant: action.journeyVariant } : {}) });
    life.actions = life.actions.slice(-CONTENT.maxRounds);
    if (!nextRound || nextRound.stage !== round.stage) {
      const goals = STRATEGY.settleStage(life);
      life.lastAction.stageGoals = goals;
      addGoalPoints(life);
    }
    settleProject(life);
    state.world.totals.choices += 1;
    unlockAchievements(life);
    persist("选择已保存");
    render();
  }


  function getOutcome(life) {
    return STRATEGY.getOutcome(life);
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
      talentIds: [...(life.build?.talentIds || [life.talentId])],
      attributes: clone(life.build?.attributes || {}),
      interests: clone(life.build?.interests || {}),
      characters: clone(life.characters || {}),
      routeTags: [...(life.build?.routeTags || [])],
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
      jobHistory: [...life.jobHistory],
      strategy: { routeId: life.strategy.routeId, goals: clone(life.strategy.goals), consequences: clone(life.strategy.consequences) },
      ...(life.projects?.current ? { projects: summarizeProject(life.projects.current) } : {}),
      ledger: { opening: clone(life.ledger.opening), totals: clone(life.ledger.totals) },
      opportunityHistory: [...(life.opportunity?.history || [])],
      momentIds: [...life.moments],
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
    emitAudio("ending");
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
    const paid = Math.min(life.resources.money, bill.cost);
    const shortfall = bill.cost - paid;
    const before = captureMetrics(life);
    applyTransaction(life, { resources: { money: -paid, ...(shortfall ? { pressure: Math.min(3, 1 + Math.ceil(shortfall / 5)) } : {}) }, flags: shortfall ? ["in-debt"] : [] }, "bill", "bill-" + life.round, { debtDelta: shortfall });
    const newMoments = bill.cost ? collectMoments(life, { type: "bill", shortfall }) : [];
    life.lifeFeedback = bill.cost ? {
      title: shortfall ? "账单部分转为欠款" : "生活账单已结清",
      copy: bill.label + " " + bill.cost + " 元，支付 " + paid + " 元" + (shortfall ? "，欠款增加 " + shortfall + " 元。" : "。"),
      changes: getMetricChanges(before, captureMetrics(life)), newItems: [], newSecrets: [], newMoments,
    } : null;
    if (bill.cost) emitAudio(shortfall ? "error" : "bill");
  }

  function advanceRound() {
    const life = state.currentLife;
    if (!life || life.status !== "active" || !life.lastAction) return;
    settleProject(life);
    if (life.round >= CONTENT.rounds.length - 1) {
      finishLife();
      return;
    }
    life.round += 1;
    life.age = CONTENT.rounds[life.round].age;
    life.actionPoints = CONTENT.actionPointsPerRound;
    life.sideActionsUsed = 0;
    life.lastAction = null;
    life.opportunityFeedback = null;
    life.sceneFeedback = null;
    life.resources.energy = Math.min(life.maxResources.energy, life.resources.energy + 3);
    prepareOpportunity(life);
    settleLivingCost(life);
    persist("人生继续保存");
    render();
    emitEvent("scroll-top");
  }

  function toggleLegacy(legacyId) {
    const life = state.currentLife;
    if (!life || life.status !== "complete") return;
    if (!life.legacyCandidates.includes(legacyId)) return;
    const index = life.selectedLegacies.indexOf(legacyId);
    if (index >= 0) life.selectedLegacies.splice(index, 1);
    else if (life.selectedLegacies.length < CONTENT.maxLegacyChoices) life.selectedLegacies.push(legacyId);
    else showToast(`最多选择 ${CONTENT.maxLegacyChoices} 件遗产`);
    persist("遗产选择已保存");
    render();
  }

  function applyLegacyToWorld(legacy) {
    Object.entries(legacy.effect?.town || {}).forEach(([key, amount]) => {
      if (key in state.world.town) addValue(state.world.town, key, amount, 0, CONTENT.world[key].values.length - 1);
    });
  }

  function confirmLegacies() {
    const life = state.currentLife;
    if (!life || life.status !== "complete" || life.selectedLegacies.length < 1) { showToast("请先选择至少一件遗产"); return; }
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

  function getSetupAttributePointTotal(attributes = setup.attributes) {
    return Object.values(attributes || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function startLife() {
    if (state.currentLife?.status === "complete") { state.screen = "ending"; return; }
    if (state.currentLife?.status === "active") {
      state.screen = "game";
      render();
      return;
    }
    const attributePointTotal = getSetupAttributePointTotal();
    if (attributePointTotal !== Number(CONTENT.buildAttributePoints || 20)) {
      showToast(`还剩 ${Math.max(0, Number(CONTENT.buildAttributePoints || 20) - attributePointTotal)} 点基础属性没有分配`);
      return;
    }
    if (setup.talentIds.length !== Number(CONTENT.talentPickLimit || 3)) {
      showToast(`请从起手天赋中选择 ${CONTENT.talentPickLimit || 3} 张`);
      return;
    }
    state.currentLife = createLife(setup.profileId, setup.talentId, setup.goalId, setup);
    state.screen = "game";
    state.notice = "";
    persist("新一世已开始");
    render();
    emitEvent("scroll-top");
  }




  function emitEvent(type, payload = {}) {
    pendingEvents.push({ type, ...payload });
  }

  function emitAudio(kind) {
    emitEvent("audio", { kind });
  }

  function showToast(message) {
    emitEvent("error", { code: "INVALID_ACTION", message: safeText(message, 180) });
  }

  function persist(message = "已保存") {
    emitEvent("persist", { message });
  }

  function render() {
    emitEvent("render");
  }


  function getState() {
    return clone(state);
  }


  function getSetup() {
    return clone(setup);
  }


  function replaceState(nextState) {
    state = normalizeState(nextState);
    recoveryRequired = false;
    if (state.setup) setup = clone(state.setup);
    pendingEvents = [];
    return getState();
  }

  function resetState() {
    state = clone(DEFAULT_STATE);
    recoveryRequired = false;
    setup = {
      profileId: "town-child",
      talentId: "slow-and-steady",
      talentIds: ["slow-and-steady", "good-memory", "warm-heart"],
      goalId: "learn",
      attributes: { appearance: 5, intelligence: 5, physique: 5, family: 5 },
    };
    pendingEvents = [];
    setup.routeId = "study";
    return getState();
  }

  function createPreviewLife(profileId, talentId, goalId, buildSetup = setup) {
    return createLife(profileId, talentId, goalId, buildSetup);
  }

  function getChallengeDefinitions() {
    return [{ id: "craft-start-v1", label: "手艺人的第一世", seed: 277191004, routeId: "craft", rulesVersion: global.EchoTownSave.MODE_CONTRACT.rulesVersion, detail: "同样的起点与机会，尝试完成手艺传承并留足生活。挑战进度独立保存。" }];
  }

  function createChallengeState(id) {
    const definition = getChallengeDefinitions().find((item) => item.id === id);
    if (!definition) throw new Error("挑战不存在");
    const previous = { state, setup, pendingEvents, recoveryRequired };
    try {
      state = clone(DEFAULT_STATE);
      setup = { profileId: "workshop-heir", goalId: "learn", routeId: "craft", talentId: "slow-and-steady", talentIds: ["slow-and-steady", "good-memory", "warm-heart"], attributes: { appearance: 3, intelligence: 5, physique: 6, family: 6 } };
      pendingEvents = [];
      recoveryRequired = false;
      state.introSeen = true;
      state.setup = clone(setup);
      state.currentLife = createLife(setup.profileId, setup.talentId, setup.goalId, setup);
      state.currentLife.seed = definition.seed;
      prepareOpportunity(state.currentLife);
      state.screen = "game";
      return clone(state);
    } finally {
      state = previous.state;
      setup = previous.setup;
      pendingEvents = previous.pendingEvents;
      recoveryRequired = previous.recoveryRequired;
    }
  }

  function dispatch(command = {}) {
    const before = clone(state);
    const beforeSetup = clone(setup);
    pendingEvents = [];
    const type = command.type;
    try {
      if (recoveryRequired && !["HOME", "VIEW_ARCHIVE", "CONTINUE_LIFE", "TOGGLE_FONT", "SET_SOUND", "SET_VOLUME"].includes(type)) throw new Error("原存档已保护。请先导入有效备份，或在设置中清除进度后重新开始");
      const invalidPhase = validateCommandPhase(command);
      if (invalidPhase) throw new Error(invalidPhase);
      if (type === "UPDATE_SETUP") {
        updateSetup(command.patch);
      } else if (type === "SET_PRESET") {
        applyPreset(command.routeId);
      } else if (type === "SET_ROUTE") {
        if (!["craft", "study", "community"].includes(command.routeId)) throw new Error("路线不存在");
        if (!state.currentLife || state.currentLife.status !== "active") throw new Error("请先开始人生");
        state.currentLife.strategy.routeId = command.routeId;
        persist("追踪路线已调整");
      } else if (type === "END_LIFE_ACTIONS") {
        state.currentLife.actionPoints = 0;
        persist("生活安排已结束");
      } else if (type === "REPAY_DEBT") {
        repayDebt(command.amount);
      } else if (type === "ACCEPT_PROJECT" || type === "WITHDRAW_PROJECT") {
        if (!PROJECTS) throw new Error("项目规则暂时不可用");
        const life = state.currentLife;
        const result = type === "ACCEPT_PROJECT" ? PROJECTS.accept(life, command.id) : PROJECTS.withdraw(life);
        if (!result.ok) throw new Error(result.message);
        life.projects = result.projects;
        life.lifeFeedback = { title: type === "ACCEPT_PROJECT" ? "已接下项目" : "已退出项目", copy: result.message, changes: [], newItems: [], newSecrets: [], newMoments: [] };
        persist("项目选择已保存");
        emitAudio("click");
      } else if (type === "SET_VOLUME") {
        state.settings.volume = clamp(command.value, 0, 1, 0.6);
        persist("音量已保存");
      } else if (type === "ENTER_TOWN") {
        state.introSeen = true;
        persist("你走进了回声镇");
        render();
      } else if (type === "START_LIFE") {
        startLife();
      } else if (type === "CONTINUE_LIFE") {
        if (!state.currentLife) throw new Error("还没有正在进行的人生");
        state.screen = state.currentLife.status === "complete" ? "ending" : "game";
        render();
      } else if (type === "LIFE_ACTION") {
        resolveLifeAction(command.id);
      } else if (type === "OPPORTUNITY") {
        resolveOpportunity(command.id);
      } else if (type === "SKIP_OPPORTUNITY") {
        skipOpportunity();
      } else if (type === "BUY_ITEM") {
        buyItem(command.id);
      } else if (type === "EVENT_ACTION") {
        resolveAction(command.id);
      } else if (type === "INSPECT_SCENE") {
        inspectScene(command.roundId, command.clueId);
      } else if (type === "ADVANCE_ROUND") {
        advanceRound();
      } else if (type === "TOGGLE_LEGACY") {
        toggleLegacy(command.id);
      } else if (type === "CONFIRM_LEGACIES") {
        confirmLegacies();
      } else if (type === "HOME") {
        state.screen = "start";
        persist();
        render();
      } else if (type === "VIEW_ARCHIVE") {
        state.screen = "archive";
        render();
      } else if (type === "TOGGLE_FONT") {
        state.settings.fontScale = !state.settings.fontScale;
        persist();
        render();
      } else if (type === "SET_SOUND") {
        state.settings.sound = Boolean(command.enabled);
      } else {
        emitEvent("error", { code: "UNKNOWN_COMMAND", message: "这个操作暂时不可用" });
      }
    } catch (error) {
      state = before;
      setup = beforeSetup;
      emitEvent("error", { code: "COMMAND_FAILED", message: safeText(error.message || "操作没有完成，请重试", 180) });
    }
    const errorEvent = pendingEvents.find((event) => event.type === "error");
    const events = pendingEvents.slice();
    pendingEvents = [];
    if (errorEvent) {
      state = before;
      setup = beforeSetup;
      return { ok: false, state: getState(), events, error: { code: errorEvent.code, messageKey: errorEvent.message } };
    }
    return { ok: true, state: getState(), events };
  }


  function getGrowthCap(life) {
    const stageId = getRound(life).stage;
    return { childhood: 4, adolescence: 6, youth: 8, middle: 10, later: 10 }[stageId] || 10;
  }

  function getLifePhase(source = state) {
    const life = source.currentLife;
    if (!life) return "start";
    if (life.status === "complete") return "ending";
    if (life.lastAction) return "feedback";
    if (!opportunityResolved(life)) return "opportunity";
    return life.actionPoints > 0 ? "management" : "event";
  }

  function captureProjectReceipt(life) {
    return { actionPoints: life.actionPoints, sideActionsUsed: life.sideActionsUsed, money: life.resources.money, energy: life.resources.energy, hadToolkit: hasItem(life, "toolkit"), inventory: [...life.inventory] };
  }

  function recordProjectAction(life, receipt) {
    if (!PROJECTS) return;
    const result = PROJECTS.record(life, { ...receipt, round: life.round });
    if (!result.ok) throw new Error(result.message);
    life.projects = result.projects;
    if (result.changed && life.lifeFeedback) {
      life.lifeFeedback.copy += " " + result.message;
      life.lifeFeedback.changes.push("项目向前推进");
      emitAudio("moment");
    }
  }

  function settleProject(life) {
    if (!PROJECTS) return;
    const result = PROJECTS.settle(life);
    if (!result.ok) throw new Error(result.message);
    life.projects = result.projects;
    if (result.changed && life.lastAction) {
      life.lastAction.projectSummary = result.message;
      life.lastAction.future = result.message + " " + life.lastAction.future;
      emitAudio(life.projects.current.status === "completed" ? "moment" : "bill");
    }
  }

  function summarizeProject(project) {
    if (PROJECTS?.summarize) return PROJECTS.summarize(project);
    return {
      id: project.id,
      status: project.status,
      resultId: project.resultId,
      settledRound: project.settledRound,
      stepsDone: Object.keys(project.steps).length,
      preparationActionId: project.steps.preparation?.actionId || null,
      ...(project.finalCraft !== undefined ? { finalCraft: project.finalCraft } : {}),
    };
  }

  function ensureLedger(life) {
    if (life.ledger) return;
    life.ledger = {
      opening: { money: life.resources.money, debt: life.cashflow.debt, income: life.cashflow.income, expenses: life.cashflow.expenses },
      totals: { income: 0, expenses: 0, borrowed: 0, repaid: 0, unpaid: 0 },
      entries: [],
    };
  }

  function applyTransaction(life, effect = {}, kind, id, options = {}) {
    ensureLedger(life);
    const moneyBefore = life.resources.money;
    const debtBefore = life.cashflow.debt;
    const result = applyEffect(life, effect);
    const money = life.resources.money - moneyBefore;
    const borrowed = Math.max(0, Number(options.borrow || 0));
    const repaid = Math.max(0, Number(options.repay || 0));
    const unpaid = Math.max(0, Number(options.debtDelta || 0));
    life.cashflow.debt += borrowed + unpaid - repaid;
    const income = borrowed || repaid ? 0 : Math.max(0, money);
    const expenses = borrowed || repaid ? 0 : Math.max(0, -money);
    life.cashflow.income += income;
    life.cashflow.expenses += expenses;
    life.ledger.totals.income += income;
    life.ledger.totals.expenses += expenses;
    life.ledger.totals.borrowed += borrowed;
    life.ledger.totals.repaid += repaid;
    life.ledger.totals.unpaid += unpaid;
    state.world.totals.moneyEarned += income;
    state.world.totals.moneySpent += expenses;
    if (money || life.cashflow.debt !== debtBefore) {
      life.ledger.entries.push({ round: life.round, id, kind, money, debt: life.cashflow.debt - debtBefore, balance: life.resources.money });
    }
    return result;
  }

  function recordEvidence(life, id, kind, success = true, journeyVariant) {
    return STRATEGY.record(life, { id, kind, round: life.round, success, journeyVariant });
  }

  function getTestPreview(life, action) {
    if (!action.test) return null;
    const attribute = action.test.skill === "study" ? "intelligence" : (["expression", "empathy"].includes(action.test.skill) || ["open-workshop", "chain-craft-workshop"].includes(action.id)) ? "appearance" : null;
    const attributeBonus = attribute ? Math.floor(Number(life.build.attributes[attribute] || 0) / 4) : 0;
    const luckBonus = life.flags.includes("talent-luck") ? 2 : 0;
    const minimum = Number(life.skills[action.test.skill] || 0) + attributeBonus + luckBonus;
    return { label: action.test.label || "行动检定", minimum, maximum: minimum + 2, difficulty: Number(action.test.difficulty || 0), attributeBonus };
  }

  function getPreviewBenefits(life, projected) {
    const before = captureMetrics(life);
    const after = captureMetrics(projected);
    return Object.keys(before).filter((path) => /^(resources|skills|relationships|town)\./.test(path)).map((path) => {
      const delta = after[path] - before[path];
      const helpful = ["resources.pressure", "resources.expectation"].includes(path) ? delta < 0 : delta > 0;
      return helpful ? { path, label: getMetricLabel(path), delta } : null;
    }).filter(Boolean);
  }

  function getGrowthPreview(life, effect, projected) {
    const cap = getGrowthCap(life);
    const stage = getStage(getRound(life).stage);
    return Object.entries(effect.skills || {}).filter(([, amount]) => amount > 0).map(([key, amount]) => {
      const current = life.skills[key];
      const applied = projected.skills[key] - current;
      const next = CONTENT.rounds.find((round, index) => index > life.round && Number(CONTENT.strategy.trainingCaps[round.stage]) > Math.max(cap, current));
      const nextCap = next ? CONTENT.strategy.trainingCaps[next.stage] : null;
      const label = CONTENT.skills[key].label;
      const capped = applied < amount;
      let reason = "";
      if (capped) {
        reason = label + (applied > 0 ? "本次只能增加 " + applied : current > cap ? "现有 " + current + " 保留不变，已高于" : "已到") + (applied > 0 ? "，达到" : "") + stage.label + "增长上限 " + cap;
        reason += next ? "；" + next.age + " 岁起上限 " + nextCap : "；之后可把本领用于工作、关系或交接";
      }
      return { key, label, current, cap, requested: amount, applied, capped, nextAge: next?.age || null, nextCap, reason };
    });
  }

  function fixedPursuitRequirementsMet(life, requirements) {
    return (requirements || []).every((requirement) => {
      if (requirement.type === "any") return requirement.requirements.some((item) => fixedPursuitRequirementsMet(life, [item]));
      if (requirement.type === "all") return fixedPursuitRequirementsMet(life, requirement.requirements);
      if (["evidence", "legacy", "strategy-goal", "route", "project", "flag", "secret"].includes(requirement.type)) return requirementMet(life, requirement);
      return true;
    });
  }

  function pursuitChecks(life, action) {
    const checks = (action.requires || []).map((requirement) => ({ label: requirementReason(requirement), met: requirementMet(life, requirement) }));
    for (const key of ["money", "energy", "health"]) {
      const amount = Math.max(0, -Number(action.effect?.resources?.[key] || 0)) + Math.max(0, -Number(action.test?.success?.resources?.[key] || 0), -Number(action.test?.failure?.resources?.[key] || 0));
      if (amount) checks.push({ label: "为这件事留出" + CONTENT.resources[key].label + " " + amount, met: life.resources[key] >= amount });
    }
    const test = getTestPreview(life, action);
    if (test) checks.push({ label: test.label + "最低 " + test.minimum + " / " + test.difficulty + (test.minimum < test.difficulty ? "，仍有失败可能" : "，已准备充分"), met: test.minimum >= test.difficulty });
    return checks;
  }

  // This small search spends only the remaining AP on copies. It neither
  // records evidence nor awards projected effects to the actual life.
  function findPursuitPreparation(life, action) {
    const queue = [{ life: clone(life), actions: [] }];
    let playable = null;
    while (queue.length) {
      const candidate = queue.shift();
      if (getAvailability(candidate.life, action).available) {
        playable = playable || candidate;
        if (pursuitChecks(candidate.life, action).every((check) => check.met)) return candidate;
      }
      if (!candidate.life.actionPoints) continue;
      for (const preparation of [...getLifeActions(), ...getJobs()]) {
        if (!getLifeAvailability(candidate.life, preparation).available) continue;
        const projected = clone(candidate.life);
        applyEffect(projected, getLifeActionEffect(projected, preparation));
        projected.actionPoints -= Number(preparation.points || 1);
        projected.lifeLog = [...(projected.lifeLog || []), { age: projected.age, label: preparation.label }];
        queue.push({ life: projected, actions: [...candidate.actions, preparation.id] });
      }
    }
    return playable;
  }

  function getNextPursuit(life = state.currentLife) {
    if (!life || life.status !== "active") return null;
    for (const candidate of STRATEGY.getPursuitCandidates(life)) {
      const futureLife = candidate.round === life.round ? life : { ...life, round: candidate.round, age: candidate.age };
      const action = getAction(candidate.actionId, futureLife);
      if (!fixedPursuitRequirementsMet(life, action.requires)) continue;
      const current = candidate.round === life.round;
      const preparation = current ? findPursuitPreparation(life, action) : null;
      if (current && !preparation) continue;
      const checks = pursuitChecks(life, action);
      const ready = checks.every((check) => check.met);
      const command = current && preparation.actions.length ? { type: "LIFE_ACTION", id: preparation.actions[0] } : current ? { type: "EVENT_ACTION", id: action.id } : null;
      const source = command?.type === "LIFE_ACTION" ? getLifeAction(command.id) || getJob(command.id) : action;
      const available = command ? previewAction(command, life).available : false;
      const reserveEnergy = Math.max(0, -Number(action.effect?.resources?.energy || 0)) + Math.max(0, -Number(action.test?.success?.resources?.energy || 0), -Number(action.test?.failure?.resources?.energy || 0));
      return { ...candidate, label: action.label, detail: action.detail, actionLabel: action.label, status: !current ? "upcoming" : ready ? "ready" : "preparing", checks, reserveEnergy,
        nextStep: { label: command?.type === "LIFE_ACTION" ? "先" + source.label : (current ? "接下来：" : candidate.age + " 岁：") + action.label,
          detail: !current ? "这件事还在后面的节点；现在可把时间给仍能增长的能力、关系或恢复。" : command?.type === "LIFE_ACTION" ? "补足这次选择的实际准备，再处理人生事件。" : !ready ? "可以尝试，但检定仍有失败可能；结果会按实际经历保留。" : getLifePhase({ currentLife: life }) === "management" ? "准备已经足够，可结束生活安排后做这件事。" : "准备已经足够，按当前步骤继续。", command, available } };
    }
    return null;
  }

  function getProjectActionPurpose(life, id) {
    if (!PROJECTS || life.projects?.current?.status !== "active" || life.lastAction) return "";
    const view = PROJECTS.getView(life);
    const step = view.steps.find((item) => item.age === life.age && item.status === "pending");
    const definition = PROJECTS.getDefinition(life.projects.current.id);
    return step && definition.steps[step.id].some((choice) => choice.type === "LIFE_ACTION" && choice.actionId === id) ? "完成项目这一步：" + step.label : "";
  }

  function getLifeRecommendations(life = state.currentLife, pursuit = getNextPursuit(life)) {
    if (!life || getLifePhase({ currentLife: life }) !== "management") return [];
    const route = life.strategy?.routeId;
    const routeSkill = { craft: "craft", study: "study", community: "empathy" }[route];
    const preparedAction = pursuit?.nextStep.command?.type === "LIFE_ACTION" ? pursuit.nextStep.command.id : null;
    return getLifeActions().map((action, index) => {
      const command = { type: "LIFE_ACTION", id: action.id };
      const preview = previewAction(command, life);
      if (!preview.available) return null;
      const project = getProjectActionPurpose(life, action.id);
      const purposes = STRATEGY.getActionPurposes(life, action.id, "life");
      if (!preview.benefits.length && !project && !purposes.length) return null;
      const positive = preview.benefits;
      let score = positive.reduce((sum, item) => sum + Math.abs(item.delta) * (item.path.startsWith("skills.") ? 4 : item.path.startsWith("relationships.") ? 3 : item.path.startsWith("town.") ? 3 : 1), 0);
      if (positive.some((item) => item.path === "skills." + routeSkill)) score += 5;
      if (route === "community" && positive.some((item) => item.path.startsWith("relationships."))) score += 4;
      if (project) score += 80;
      if (purposes.length) score += 20;
      if (action.id === preparedAction) score += 100;
      if (positive.some((item) => item.path === "resources.energy") && (life.resources.energy <= 3 || (pursuit?.round === life.round && life.resources.energy < pursuit.reserveEnergy))) score += 50;
      if (positive.some((item) => item.path === "resources.health") && life.resources.health <= 3) score += 30;
      if (positive.some((item) => item.path === "resources.pressure") && life.resources.pressure >= 8) score += 30;
      const reserve = pursuit?.round === life.round && preview.remaining.energy < pursuit.reserveEnergy;
      if (reserve && action.id !== preparedAction) score -= 45;
      const reason = project || (action.id === preparedAction ? "为「" + pursuit.actionLabel + "」补足准备" : purposes[0]) || "本次仍可获得" + positive.slice(0, 3).map((item) => formatDelta(item.label, item.delta)).join("、");
      return { id: action.id, label: action.label, command, reason: reason + (reserve ? "；注意给人生事件留出 " + pursuit.reserveEnergy + " 精力" : ""), preview, score, index };
    }).filter(Boolean).sort((left, right) => right.score - left.score || left.index - right.index).slice(0, 3).map(({ score, index, ...item }) => item);
  }

  function previewAction(command, sourceLife = state.currentLife) {
    const life = sourceLife;
    if (!life || life.status !== "active") return { available: false, reason: "请先开始这一世", cost: "", changes: [], benefits: [], growth: [], notices: [], remaining: {}, test: null };
    const type = command.type;
    let action;
    if (type === "LIFE_ACTION") action = getLifeAction(command.id) || getJob(command.id);
    if (type === "OPPORTUNITY") action = getOpportunity(command.id);
    if (type === "EVENT_ACTION") action = getAction(command.id, life);
    if (type === "BUY_ITEM") {
      const item = getItem(command.id);
      if (item) action = { ...item, points: 1, effect: { resources: { money: -item.price }, items: [item.id] } };
    }
    if (!action) return { available: false, reason: "行动不存在", cost: "", changes: [], benefits: [], growth: [], notices: [], remaining: {}, test: null };
    const phase = getLifePhase({ currentLife: life });
    const expected = { OPPORTUNITY: "opportunity", LIFE_ACTION: "management", BUY_ITEM: "management", EVENT_ACTION: "event" }[type];
    let availability = type === "OPPORTUNITY" ? getOpportunityAvailability(life, action) : type === "LIFE_ACTION" || type === "BUY_ITEM" ? getLifeAvailability(life, action) : getAvailability(life, action);
    if (phase !== expected) availability = { available: false, reason: phase === "opportunity" ? "先选择或跳过机会" : phase === "management" ? "先完成或结束生活安排" : "请先推进到对应步骤" };
    if (type === "OPPORTUNITY" && !life.opportunity.drawnIds.includes(action.id)) availability = { available: false, reason: "本节点没有抽到这个机会" };
    if (type === "BUY_ITEM" && life.inventory.includes(action.id)) availability = { available: false, reason: "已经拥有" };
    if (type === "BUY_ITEM" && life.inventory.length >= CONTENT.maxInventory) availability = { available: false, reason: "物品栏已满" };
    const effect = type === "LIFE_ACTION" ? getLifeActionEffect(life, action) : type === "OPPORTUNITY" ? getOpportunityEffect(action) : action.effect || {};
    const projected = clone(life);
    applyEffect(projected, effect);
    const ap = Number(action.points || 0);
    const costs = [];
    if (ap) costs.push(ap + " 行动点");
    for (const key of ["money", "energy", "health"]) {
      const delta = Number(effect.resources?.[key] || 0);
      if (delta < 0) costs.push(CONTENT.resources[key].label + " " + delta);
    }
    const changes = getMetricChanges(captureMetrics(life), captureMetrics(projected));
    const growth = getGrowthPreview(life, effect, projected);
    const benefits = getPreviewBenefits(life, projected);
    const notices = growth.filter((item) => item.capped).map((item) => item.reason);
    changes.push(...notices);
    if (command.id === "take-risk-loan") changes.push("负债+20（借款不计收入）");
    const test = getTestPreview(life, action);
    const outcomes = {};
    if (test) {
      for (const [key, branch] of [["成功", action.test.success], ["失败", action.test.failure]]) {
        const outcome = clone(projected);
        applyEffect(outcome, branch || {});
        outcomes[key === "成功" ? "success" : "failure"] = { money: outcome.resources.money, energy: outcome.resources.energy, actionPoints: Math.max(0, life.actionPoints - ap) };
        const deltas = getMetricChanges(captureMetrics(projected), captureMetrics(outcome));
        if (deltas.length) changes.push(key + "时：" + deltas.join("、"));
      }
    }
    const requirements = (action.requires || []).map((requirement) => ({ label: requirementReason(requirement), met: requirementMet(life, requirement) }));
    if (action.minAge) requirements.unshift({ label: "需要年满 " + action.minAge + " 岁", met: life.age >= action.minAge });
    if (action.maxAge) requirements.push({ label: "不晚于 " + action.maxAge + " 岁", met: life.age <= action.maxAge });
    return { ...availability, requirements, cost: costs.join(" · ") || "不消耗行动点或资源", changes, benefits, growth, notices, remaining: { money: projected.resources.money, energy: projected.resources.energy, actionPoints: Math.max(0, life.actionPoints - ap) }, test, outcomes: test ? outcomes : null };
  }

  function validateCommandPhase(command) {
    const type = command.type;
    if (runtimeMode !== "main") {
      if (["UPDATE_SETUP", "SET_PRESET", "TOGGLE_LEGACY", "CONFIRM_LEGACIES"].includes(type)) return "挑战使用固定开局；回到主人生后可调整构筑与交接遗产";
      if (type === "START_LIFE" && state.currentLife?.status !== "active") return "挑战已结束，请重开挑战或回到主人生";
    }
    const phase = getLifePhase();
    const allowed = {
      ACCEPT_PROJECT: ["opportunity", "management"], WITHDRAW_PROJECT: ["opportunity", "management", "event", "feedback"],
      OPPORTUNITY: ["opportunity"], SKIP_OPPORTUNITY: ["opportunity"],
      LIFE_ACTION: ["management"], BUY_ITEM: ["management"], END_LIFE_ACTIONS: ["management"],
      EVENT_ACTION: ["event"], ADVANCE_ROUND: ["feedback"],
      TOGGLE_LEGACY: ["ending"], CONFIRM_LEGACIES: ["ending"],
      INSPECT_SCENE: ["opportunity", "management", "event"],
      REPAY_DEBT: ["opportunity", "management", "event"],
    };
    if (allowed[type] && !allowed[type].includes(phase)) return "当前步骤不能执行此操作";
    if (["OPPORTUNITY", "LIFE_ACTION", "BUY_ITEM", "EVENT_ACTION"].includes(type)) {
      const preview = previewAction(command);
      if (!preview.available) return preview.reason;
    }
    if (type === "INSPECT_SCENE") {
      const life = state.currentLife;
      if (command.roundId !== getRound(life).id || life.sceneVisits.includes(command.clueId) || !(CONTENT.sceneClues[command.roundId] || []).some((item) => item.id === command.clueId)) return "只能观察当前节点尚未记录的细节";
    }
    return "";
  }

  function repayDebt(amount) {
    const life = state.currentLife;
    const maximum = Math.min(life.resources.money, life.cashflow.debt);
    const value = amount === undefined ? maximum : Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) throw new Error("还款金额须在现有现金和欠款范围内");
    applyTransaction(life, { resources: { money: -value } }, "repay", "repay-" + life.round, { repay: value });
    life.lifeFeedback = { title: "还款 " + value + " 元", copy: "剩余欠款 " + life.cashflow.debt + " 元。还款不占用生活行动点。", changes: ["现金-" + value, "负债-" + value], newItems: [], newSecrets: [], newMoments: [] };
    addGoalPoints(life);
    persist("还款已记录");
  }

  function updateSetup(patch = {}) {
    const next = { ...setup, ...clone(patch) };
    if (!CONTENT.profiles.some((item) => item.id === next.profileId) || !CONTENT.goals.some((item) => item.id === next.goalId)) throw new Error("构筑选项不存在");
    if (!["craft", "study", "community"].includes(next.routeId)) throw new Error("路线不存在");
    if (!Array.isArray(next.talentIds) || next.talentIds.length > 3 || new Set(next.talentIds).size !== next.talentIds.length || next.talentIds.some((id) => !TALENT_POOL.some((item) => item.id === id))) throw new Error("请选择最多三个不同天赋");
    if (ATTRIBUTE_KEYS.some((key) => !Number.isInteger(next.attributes?.[key]) || next.attributes[key] < 0 || next.attributes[key] > 10) || getSetupAttributePointTotal(next.attributes) > 20) throw new Error("属性须在0至10之间，总计不超过20点");
    next.talentId = next.talentIds[0] || setup.talentId;
    setup = next;
    state.setup = clone(setup);
    persist("开局构筑已保存");
  }

  function applyPreset(routeId) {
    const presets = {
      craft: { profileId: "workshop-heir", goalId: "learn", attributes: { appearance: 3, intelligence: 5, physique: 6, family: 6 } },
      study: { profileId: "scholar", goalId: "learn", attributes: { appearance: 3, intelligence: 8, physique: 5, family: 4 } },
      community: { profileId: "town-child", goalId: "town", attributes: { appearance: 6, intelligence: 4, physique: 5, family: 5 } },
    };
    if (!presets[routeId]) throw new Error("路线不存在");
    updateSetup({ ...presets[routeId], routeId, talentIds: ["slow-and-steady", "good-memory", "warm-heart"] });
    state.introSeen = true;
  }


  global.EchoTownEngine = {
    constants: {
      CONTENT,
      STORAGE_KEY,
      LEGACY_STORAGE_KEYS,
      SAVE_VERSION,
      MAX_SAVE_BYTES,
      MAX_HISTORY,
      RESOURCE_KEYS,
      SKILL_KEYS,
      RELATIONSHIP_KEYS,
      WORLD_KEYS,
      ATTRIBUTE_KEYS,
      INTEREST_KEYS,
      CHARACTER_KEYS,
      TALENT_POOL,
      FLAG_LABELS,
      LEGACY_ID_MAP,
      ROUTE_LABELS,
      SEASON_LABELS,
      LOCATION_BY_STAGE,
      PRIMARY_CHARACTER_BY_RELATION,
      OPPORTUNITY_FOCUS,
      LIFE_ACTION_INTEREST,
    },
    isRecord,
    safeText,
    safeList,
    clamp,
    clone,
    escapeHtml,
    hashSeed,
    makeLifeSeed,
    normalizeTalentIds,
    normalizeState,
    getState,
    getSetup,
    replaceState,
    resetState,
    createPreviewLife,
    getChallengeDefinitions,
    createChallengeState,
    getRuntimeMode: () => runtimeMode,
    setRuntimeMode: (slotId) => {
      if (slotId !== "main" && !getChallengeDefinitions().some((item) => item.id === slotId)) throw new Error("模式不存在");
      runtimeMode = slotId;
    },
    dispatch,
    previewAction,
    getNextPursuit,
    getLifeRecommendations,
    getLifePhase,
    getProjectView: (life = state.currentLife) => PROJECTS ? PROJECTS.getView(life) : null,
    getJobs,
    getLifeActions,
    getStageGoals: (life) => STRATEGY.getGoals(life),
    getAllStageGoals: (life) => STRATEGY.getAllGoals(life),
    getConsequences: (life) => STRATEGY.getConsequences(life),
    setRecoveryRequired: (required) => { recoveryRequired = Boolean(required); },
    getWishStatus: (life) => STRATEGY.getWishStatus(life),
    getAvailableEventActions: (life) => getRound(life).actions.map((action) => getAction(action.id, life)),
    getGrowthCap,
    requirementMet,
    getProfile,
    getTalent,
    getGoal,
    getLegacy,
    getItem,
    getLifeAction,
    getOpportunity,
    getJob,
    getLivingCost,
    getAchievement,
    getSecret,
    getStage,
    getSeason,
    getStageFocus,
    getMoment,
    getRound,
    getOpportunityAvailability,
    opportunityResolved,
    getAvailability,
    hasItem,
    prepareOpportunity,
    getLifeAvailability,
    getLifeActionCopy,
    getPrimaryLifeActionIds,
    getAction,
    getSkillLevel,
    getSkillLevelName,
    getBestSkill,
  };

})(window);
