(function () {
  "use strict";

  const CONTENT = window.EchoTownContent;
  const STORAGE_KEY = "echo-town-generation-save";
  const LEGACY_STORAGE_KEYS = ["echo-town-save", "echo-town-mvp-v1"];
  const SAVE_VERSION = 4;
  const MAX_SAVE_BYTES = 512 * 1024;
  const MAX_HISTORY = 20;
  const MAX_TEXT_LENGTH = 240;
  const RESOURCE_LIMITS = { money: [0, 8], energy: [0, 6], health: [0, 3] };
  const TRAIT_LIMITS = { craft: [0, 6], care: [0, 6], nerve: [0, 6], insight: [0, 6] };
  const RELATIONSHIP_LIMITS = { master: [0, 4], neighbor: [0, 4], apprentice: [0, 4] };
  const METRIC_LABELS = {
    money: "钱", energy: "精力", health: "身体", craft: "手艺", care: "照料", nerve: "胆量", insight: "洞察",
    master: "师傅关系", neighbor: "邻里关系", apprentice: "学徒关系", shop: "修理铺", bridge: "河桥", trust: "邻里", archive: "旧账"
  };

  const DEFAULT_STATE = {
    version: SAVE_VERSION,
    world: {
      completedLives: 0,
      town: { shop: 0, bridge: 0, trust: 0, archive: 0 },
      people: { master: 0, neighbor: 0, apprentice: 0 },
      legacyBank: [],
      history: [],
      lastEcho: "这座镇子还没有收到上一世留下的东西。"
    },
    settings: { fontScale: "normal" },
    currentLife: null,
    screen: "start",
    notice: ""
  };

  let state = loadState();
  let setup = { profileId: "apprentice", goalId: "shop" };
  let toastTimer = null;

  const $ = (selector) => document.querySelector(selector);

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function safeText(value, limit = MAX_TEXT_LENGTH) {
    return typeof value === "string" ? value.slice(0, limit) : "";
  }

  function safeList(value, limit, textLimit = MAX_TEXT_LENGTH) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item) => typeof item === "string").map((item) => safeText(item, textLimit)))].slice(-limit);
  }

  function clamp(value, min, max, fallback = min) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(parsed)));
  }

  function cloneDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function escapeHtml(value) {
    return safeText(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
  }

  function makeLifeSeed(generation, historyLength = 0) {
    let hash = 2166136261;
    const source = `echo-town-generation:${generation}:${historyLength}`;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function getProfile(id) {
    return CONTENT.profiles.find((item) => item.id === id) || CONTENT.profiles[0];
  }

  function getGoal(id) {
    return CONTENT.goals.find((item) => item.id === id) || CONTENT.goals[0];
  }

  function getLegacy(id) {
    return CONTENT.legacies.find((item) => item.id === id) || null;
  }

  function getRound(life) {
    return CONTENT.rounds[clamp(life.round, 0, CONTENT.rounds.length - 1, 0)];
  }

  function isSavePayload(value) {
    return isRecord(value) && Number(value.version) === SAVE_VERSION && isRecord(value.world)
      && (value.currentLife == null || isRecord(value.currentLife));
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => {
      if (!isRecord(entry)) return null;
      return {
        generation: clamp(entry.generation, 1, 9999, 1),
        profileId: safeText(entry.profileId, 40),
        goalId: safeText(entry.goalId, 40),
        outcomeKey: safeText(entry.outcomeKey, 40),
        outcomeTitle: safeText(entry.outcomeTitle, 100),
        goalProgress: clamp(entry.goalProgress, 0, 20, 0),
        goalTarget: clamp(entry.goalTarget, 1, 20, 1),
        actions: Array.isArray(entry.actions) ? entry.actions.filter(isRecord).slice(0, 12).map((action) => ({
          round: clamp(action.round, 1, 99, 1),
          id: safeText(action.id, 60),
          label: safeText(action.label, 100)
        })) : [],
        legacyIds: safeList(entry.legacyIds, 4, 60),
        town: isRecord(entry.town) ? Object.fromEntries(Object.keys(CONTENT.town).map((key) => [key, clamp(entry.town[key], 0, 3, 0)])) : {},
        echo: safeText(entry.echo) || "这一世留下了一件还会继续起作用的东西。"
      };
    }).filter(Boolean).slice(-MAX_HISTORY);
  }

  function normalizeLife(savedLife) {
    if (!isRecord(savedLife)) return null;
    const resources = isRecord(savedLife.resources) ? savedLife.resources : {};
    const traits = isRecord(savedLife.traits) ? savedLife.traits : {};
    const relationships = isRecord(savedLife.relationships) ? savedLife.relationships : {};
    const current = {
      generation: clamp(savedLife.generation, 1, 9999, 1),
      seed: clamp(savedLife.seed, 0, 4294967295, makeLifeSeed(savedLife.generation, 0)),
      profileId: CONTENT.profiles.some((item) => item.id === savedLife.profileId) ? savedLife.profileId : CONTENT.profiles[0].id,
      goalId: CONTENT.goals.some((item) => item.id === savedLife.goalId) ? savedLife.goalId : CONTENT.goals[0].id,
      round: clamp(savedLife.round, 0, CONTENT.maxRounds - 1, 0),
      maxRounds: CONTENT.maxRounds,
      resources: Object.fromEntries(Object.keys(RESOURCE_LIMITS).map((key) => [key, clamp(resources[key], ...RESOURCE_LIMITS[key], RESOURCE_LIMITS[key][0])])),
      traits: Object.fromEntries(Object.keys(TRAIT_LIMITS).map((key) => [key, clamp(traits[key], ...TRAIT_LIMITS[key], TRAIT_LIMITS[key][0])])),
      relationships: Object.fromEntries(Object.keys(RELATIONSHIP_LIMITS).map((key) => [key, clamp(relationships[key], ...RELATIONSHIP_LIMITS[key], RELATIONSHIP_LIMITS[key][0])])),
      goalProgress: clamp(savedLife.goalProgress, 0, getGoal(savedLife.goalId).target, 0),
      flags: safeList(savedLife.flags, 30, 60),
      inheritedLegacyIds: safeList(savedLife.inheritedLegacyIds, 4, 60),
      actionLog: Array.isArray(savedLife.actionLog) ? savedLife.actionLog.filter(isRecord).slice(0, CONTENT.maxRounds).map((action) => ({
        round: clamp(action.round, 1, 99, 1), id: safeText(action.id, 60), label: safeText(action.label, 100)
      })) : [],
      lastAction: isRecord(savedLife.lastAction) ? {
        id: safeText(savedLife.lastAction.id, 60),
        label: safeText(savedLife.lastAction.label, 100),
        result: safeText(savedLife.lastAction.result),
        future: safeText(savedLife.lastAction.future),
        changes: safeList(savedLife.lastAction.changes, 12, 100),
        goalDelta: clamp(savedLife.lastAction.goalDelta, 0, 5, 0)
      } : null,
      outcome: isRecord(savedLife.outcome) ? {
        key: safeText(savedLife.outcome.key, 40), title: safeText(savedLife.outcome.title, 100), copy: safeText(savedLife.outcome.copy), echo: safeText(savedLife.outcome.echo)
      } : null,
      legacyCandidates: safeList(savedLife.legacyCandidates, 12, 60),
      selectedLegacies: safeList(savedLife.selectedLegacies, 2, 60),
      status: savedLife.status === "complete" ? "complete" : "active"
    };
    return current;
  }

  function normalizeState(saved) {
    const fresh = cloneDefault();
    const savedWorld = isRecord(saved.world) ? saved.world : {};
    const world = { ...fresh.world, ...savedWorld };
    const savedTown = isRecord(savedWorld.town) ? savedWorld.town : {};
    world.completedLives = clamp(savedWorld.completedLives, 0, 9999, 0);
    world.town = Object.fromEntries(Object.keys(CONTENT.town).map((key) => [key, clamp(savedTown[key], 0, 3, 0)]));
    world.people = isRecord(savedWorld.people)
      ? Object.fromEntries(Object.keys(RELATIONSHIP_LIMITS).map((key) => [key, clamp(savedWorld.people[key], 0, 4, 0)]))
      : { ...fresh.world.people };
    world.legacyBank = safeList(savedWorld.legacyBank, 4, 60);
    world.history = normalizeHistory(savedWorld.history);
    world.lastEcho = safeText(savedWorld.lastEcho) || fresh.world.lastEcho;
    const currentLife = normalizeLife(saved.currentLife);
    let screen = ["start", "game", "ending", "archive"].includes(saved.screen) ? saved.screen : "start";
    if (screen === "archive" && !world.history.length) screen = "start";
    if ((screen === "game" || screen === "ending") && !currentLife) screen = "start";
    return {
      ...fresh,
      version: SAVE_VERSION,
      world,
      settings: { ...fresh.settings, ...(isRecord(saved.settings) ? saved.settings : {}) },
      currentLife,
      screen,
      notice: safeText(saved.notice, 180)
    };
  }

  function loadState() {
    let previousVersionFound = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (isSavePayload(saved)) return normalizeState(saved);
      previousVersionFound = LEGACY_STORAGE_KEYS.some((key) => Boolean(localStorage.getItem(key)));
    } catch (error) {
      previousVersionFound = false;
    }
    const fresh = cloneDefault();
    if (previousVersionFound) fresh.notice = "检测到旧版镇志。旧版仍保留在旧提交中；当前切片从新的世代玩法开始。";
    return fresh;
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function persist(message) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (message) showToast(message);
      const status = $("#save-status");
      if (status) status.textContent = "已保存到本地";
      return true;
    } catch (error) {
      const status = $("#save-status");
      if (status) status.textContent = "仅保留在当前页面";
      showToast("本地存档暂不可用，当前页面仍可继续");
      return false;
    }
  }

  function exportSave() {
    try {
      const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "echo-town-generation-save.json";
      link.click();
      URL.revokeObjectURL(url);
      showToast("新世代存档已导出");
    } catch (error) {
      showToast("当前浏览器不支持导出存档");
    }
  }

  function importSave(file) {
    if (!file) return;
    if (Number(file.size) > MAX_SAVE_BYTES) {
      showToast("存档文件过大，未做修改");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!isSavePayload(imported)) throw new Error("unsupported save version");
        state = normalizeState(imported);
        persist("世代存档已导入");
        render();
      } catch (error) {
        showToast("存档格式不正确或不是当前切片版本，未做修改");
      }
    };
    reader.onerror = () => showToast("存档读取失败，未做修改");
    reader.readAsText(file);
  }

  function createLife(profileId, goalId) {
    const profile = getProfile(profileId);
    const life = {
      generation: state.world.completedLives + 1,
      seed: makeLifeSeed(state.world.completedLives + 1, state.world.history.length),
      profileId: profile.id,
      goalId: getGoal(goalId).id,
      round: 0,
      maxRounds: CONTENT.maxRounds,
      resources: { money: 0, energy: 0, health: 3 },
      traits: { craft: 0, care: 0, nerve: 0, insight: 0 },
      relationships: { master: 0, neighbor: 0, apprentice: 0 },
      goalProgress: 0,
      flags: [...(profile.flags || [])],
      inheritedLegacyIds: [...state.world.legacyBank],
      actionLog: [],
      lastAction: null,
      outcome: null,
      legacyCandidates: [],
      selectedLegacies: [],
      status: "active"
    };
    Object.entries(profile.start || {}).forEach(([key, value]) => {
      if (key in RESOURCE_LIMITS) life.resources[key] = clamp(value, ...RESOURCE_LIMITS[key], 0);
      if (key in TRAIT_LIMITS) life.traits[key] = clamp(value, ...TRAIT_LIMITS[key], 0);
      if (key in RELATIONSHIP_LIMITS) life.relationships[key] = clamp(value, ...RELATIONSHIP_LIMITS[key], 0);
    });
    state.world.legacyBank.map(getLegacy).filter(Boolean).forEach((legacy) => applyEffect(life, legacy.effect, false));
    return life;
  }

  function addValue(target, key, amount, limits) {
    if (!Object.prototype.hasOwnProperty.call(limits, key)) return;
    const [min, max] = limits[key];
    target[key] = clamp((target[key] || 0) + Number(amount || 0), min, max, min);
  }

  function addWorld(key, amount = 1) {
    if (!Object.prototype.hasOwnProperty.call(CONTENT.town, key)) return;
    state.world.town[key] = clamp((state.world.town[key] || 0) + Number(amount || 0), 0, 3, 0);
  }

  function applyEffect(life, effect = {}, includeTown = true) {
    Object.entries(effect.resources || {}).forEach(([key, amount]) => addValue(life.resources, key, amount, RESOURCE_LIMITS));
    Object.entries(effect.traits || {}).forEach(([key, amount]) => addValue(life.traits, key, amount, TRAIT_LIMITS));
    Object.entries(effect.relationships || {}).forEach(([key, amount]) => addValue(life.relationships, key, amount, RELATIONSHIP_LIMITS));
    if (includeTown) Object.entries(effect.town || {}).forEach(([key, amount]) => addWorld(key, amount));
    (effect.flags || []).forEach((flag) => {
      if (typeof flag === "string" && !life.flags.includes(flag)) life.flags.push(flag);
    });
  }

  function captureMetrics(life) {
    return {
      ...Object.fromEntries(Object.entries(life.resources).map(([key, value]) => [`resources.${key}`, value])),
      ...Object.fromEntries(Object.entries(life.traits).map(([key, value]) => [`traits.${key}`, value])),
      ...Object.fromEntries(Object.entries(life.relationships).map(([key, value]) => [`relationships.${key}`, value])),
      ...Object.fromEntries(Object.entries(state.world.town).map(([key, value]) => [`town.${key}`, value]))
    };
  }

  function getMetricLabel(path) {
    const key = path.split(".").pop();
    return METRIC_LABELS[key] || key;
  }

  function formatDelta(label, delta) {
    if (!delta) return "";
    return `${label} ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
  }

  function getMetricChanges(before, after) {
    return Object.keys(after).map((path) => {
      const delta = after[path] - before[path];
      return delta ? formatDelta(getMetricLabel(path), delta) : "";
    }).filter(Boolean).slice(0, 12);
  }

  function requirementMet(life, requirement) {
    if (!requirement) return true;
    if (requirement.type === "any") return (requirement.requirements || []).some((item) => requirementMet(life, item));
    if (requirement.type === "flag") return life.flags.includes(requirement.key);
    if (requirement.type === "flagAny") return (requirement.keys || []).some((key) => life.flags.includes(key));
    if (requirement.type === "resource") return Number(life.resources[requirement.key] || 0) >= Number(requirement.min || 0);
    if (requirement.type === "trait") return Number(life.traits[requirement.key] || 0) >= Number(requirement.min || 0);
    if (requirement.type === "relationship") return Number(life.relationships[requirement.key] || 0) >= Number(requirement.min || 0);
    if (requirement.type === "town") return Number(state.world.town[requirement.key] || 0) >= Number(requirement.min || 0);
    return true;
  }

  function requirementReason(requirement) {
    return requirement.label || "当前基础还不够";
  }

  function getAvailability(life, action) {
    const failed = (action.requires || []).find((requirement) => !requirementMet(life, requirement));
    return failed ? { available: false, reason: requirementReason(failed) } : { available: true, reason: "" };
  }

  function getAction(actionId) {
    const round = getRound(state.currentLife);
    return round?.actions.find((item) => item.id === actionId) || null;
  }

  function resolveAction(actionId) {
    const life = state.currentLife;
    if (!life || life.status !== "active" || life.lastAction) return;
    const action = getAction(actionId);
    if (!action) return;
    const availability = getAvailability(life, action);
    if (!availability.available) {
      showToast(availability.reason);
      return;
    }
    const before = captureMetrics(life);
    applyEffect(life, action.effect, true);
    const goalPoints = action.goalPoints || action.effect?.goalPoints || {};
    const goalDelta = Number(goalPoints[life.goalId] || 0);
    const goal = getGoal(life.goalId);
    life.goalProgress = clamp(life.goalProgress + goalDelta, 0, goal.target, 0);
    const after = captureMetrics(life);
    life.lastAction = {
      id: action.id,
      label: action.label,
      result: action.result,
      future: action.future,
      changes: getMetricChanges(before, after),
      goalDelta
    };
    life.actionLog.push({ round: life.round + 1, id: action.id, label: action.label });
    persist();
    render();
    setTimeout(() => $("#advance-round")?.focus(), 30);
  }

  function getOutcome(life) {
    const goal = getGoal(life.goalId);
    const complete = life.goalProgress >= goal.target;
    const close = life.goalProgress >= Math.max(1, goal.target - 1);
    if (complete) {
      return {
        key: "goal-complete",
        title: `${goal.label}：做到了`,
        copy: `你没有把所有事情都做完，但你把“${goal.label}”推进到了可以交给下一双手的程度。`,
        echo: `第${life.generation}世，你把${goal.measure}推进到了${life.goalProgress}/${goal.target}。`
      };
    }
    if (close) {
      return {
        key: "goal-close",
        title: "差一步，也留下了基础",
        copy: `这一世没有完全抵达“${goal.label}”，但你留下的资源、关系和选择，让下一世不必从原点开始。`,
        echo: `第${life.generation}世，${goal.measure}停在${life.goalProgress}/${goal.target}，还差的一步留给后来的人。`
      };
    }
    return {
      key: "goal-open",
      title: "目标没有做完，但方向留下了",
      copy: `你没有完成“${goal.label}”，也没有白走这一世。下一世可以从你已经碰过的地方继续。`,
      echo: `第${life.generation}世没有完成${goal.measure}，但留下了一个明确的起点。`
    };
  }

  function getLegacyCandidates(life) {
    return CONTENT.legacies.filter((legacy) => (legacy.requires || []).every((requirement) => requirementMet(life, requirement))).slice(0, 6);
  }

  function summarizeTown() {
    return Object.keys(CONTENT.town).map((key) => ({
      key,
      label: CONTENT.town[key].label,
      value: CONTENT.town[key].values[clamp(state.world.town[key], 0, 3, 0)]
    }));
  }

  function finishLife() {
    const life = state.currentLife;
    if (!life || life.status !== "active") return;
    life.status = "complete";
    life.outcome = getOutcome(life);
    life.legacyCandidates = getLegacyCandidates(life).map((legacy) => legacy.id);
    state.world.completedLives = Math.max(state.world.completedLives, life.generation);
    Object.keys(RELATIONSHIP_LIMITS).forEach((key) => {
      state.world.people[key] = Math.max(state.world.people[key] || 0, life.relationships[key] || 0);
    });
    state.world.lastEcho = life.outcome.echo;
    state.world.history.push({
      generation: life.generation,
      profileId: life.profileId,
      goalId: life.goalId,
      outcomeKey: life.outcome.key,
      outcomeTitle: life.outcome.title,
      goalProgress: life.goalProgress,
      goalTarget: getGoal(life.goalId).target,
      actions: [...life.actionLog],
      legacyIds: [],
      town: { ...state.world.town },
      echo: life.outcome.echo
    });
    state.world.history = state.world.history.slice(-MAX_HISTORY);
    state.screen = "ending";
    persist();
    render();
  }

  function advanceRound() {
    const life = state.currentLife;
    if (!life || life.status !== "active" || !life.lastAction) return;
    if (life.round >= CONTENT.maxRounds - 1) {
      finishLife();
      return;
    }
    life.round += 1;
    life.lastAction = null;
    persist();
    render();
    setTimeout(() => $("[data-action='choose-action']")?.focus(), 30);
  }

  function toggleLegacy(legacyId) {
    const life = state.currentLife;
    if (!life || life.status !== "complete" || !life.legacyCandidates.includes(legacyId)) return;
    const index = life.selectedLegacies.indexOf(legacyId);
    if (index >= 0) {
      life.selectedLegacies.splice(index, 1);
    } else if (life.selectedLegacies.length < 2) {
      life.selectedLegacies.push(legacyId);
    } else {
      showToast("最多选择两件遗产");
      return;
    }
    persist();
    render();
  }

  function applyLegacyToWorld(legacy) {
    if (!legacy) return;
    Object.entries(legacy.effect?.town || {}).forEach(([key, amount]) => addWorld(key, amount));
  }

  function confirmLegacies() {
    const life = state.currentLife;
    if (!life || life.status !== "complete" || !life.selectedLegacies.length) {
      showToast("至少选择一件遗产，下一世才知道从哪里开始");
      return;
    }
    life.selectedLegacies.map(getLegacy).filter(Boolean).forEach(applyLegacyToWorld);
    state.world.legacyBank = [...life.selectedLegacies];
    const historyEntry = state.world.history[state.world.history.length - 1];
    if (historyEntry && historyEntry.generation === life.generation) historyEntry.legacyIds = [...life.selectedLegacies];
    state.currentLife = null;
    state.screen = "start";
    persist("遗产已交给下一世");
    render();
    setTimeout(() => $("#profile-options button")?.focus(), 30);
  }

  function startLife() {
    if (state.currentLife?.status === "active" && !window.confirm("当前人生还没有结算，开启新一世会放弃这一页。确定吗？")) return;
    state.notice = "";
    state.currentLife = createLife(setup.profileId, setup.goalId);
    state.screen = "game";
    persist();
    render();
  }

  function renderStart() {
    const active = state.currentLife?.status === "active";
    $("#continue-life").classList.toggle("is-hidden", !active);
    $("#start-life").textContent = state.world.completedLives ? "开始下一世" : "开始第一世";
    $("#start-notice").textContent = state.notice || "";
    $("#start-notice").classList.toggle("is-hidden", !state.notice);
    $("#generation-label").textContent = state.world.completedLives ? `已经走过 ${state.world.completedLives} 世` : "还没有人写下第一行";
    $("#start-echo").textContent = state.world.lastEcho;
    $("#start-town").innerHTML = summarizeTown().map((item) => `<div class="town-mini-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("");
    $("#view-archive").classList.toggle("is-hidden", !state.world.history.length);
    $("#profile-options").innerHTML = CONTENT.profiles.map((profile) => `<button class="selection-card ${setup.profileId === profile.id ? "is-selected" : ""}" type="button" data-action="select-profile" data-profile-id="${profile.id}"><span class="selection-check">${setup.profileId === profile.id ? "✓" : ""}</span><strong>${escapeHtml(profile.label)}</strong><span>${escapeHtml(profile.detail)}</span></button>`).join("");
    $("#goal-options").innerHTML = CONTENT.goals.map((goal) => `<button class="selection-card ${setup.goalId === goal.id ? "is-selected" : ""}" type="button" data-action="select-goal" data-goal-id="${goal.id}"><span class="selection-check">${setup.goalId === goal.id ? "✓" : ""}</span><strong>${escapeHtml(goal.label)}</strong><span>${escapeHtml(goal.detail)}</span></button>`).join("");
    const profile = getProfile(setup.profileId);
    const goal = getGoal(setup.goalId);
    $("#start-summary").textContent = `你将以“${profile.label}”开始，目标是“${goal.label}”。`;
    $("#incoming-legacy").innerHTML = state.world.legacyBank.length
      ? `<p class="section-note">上一世留下的基础，会直接改变这一世的起点：</p>${state.world.legacyBank.map((id) => { const legacy = getLegacy(id); return legacy ? `<div class="incoming-item"><strong>${escapeHtml(legacy.label)}</strong><span>${escapeHtml(legacy.nextUse)}</span></div>` : ""; }).join("")}`
      : `<p class="empty-note">这是第一世。你会从一个普通但具体的处境开始。</p>`;
  }

  function renderResource(key, value, max) {
    const label = METRIC_LABELS[key];
    return `<div class="resource-row"><div class="resource-heading"><span>${escapeHtml(label)}</span><strong>${value} / ${max}</strong></div><div class="resource-bar"><span style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></span></div></div>`;
  }

  function renderGame() {
    const life = state.currentLife;
    if (!life) return;
    const round = getRound(life);
    const goal = getGoal(life.goalId);
    const profile = getProfile(life.profileId);
    const feedbackVisible = Boolean(life.lastAction);
    $("#game-generation").textContent = `第 ${life.generation} 世 · ${profile.label}`;
    $("#round-label").textContent = `第 ${life.round + 1} / ${CONTENT.maxRounds} 回合`;
    $("#round-progress").setAttribute("aria-valuenow", String(life.round + 1));
    $("#round-progress").style.width = `${((life.round + 1) / CONTENT.maxRounds) * 100}%`;
    $("#phase-label").textContent = CONTENT.phases[round.phase]?.label || "这一回合";
    $("#phase-hint").textContent = CONTENT.phases[round.phase]?.hint || "";
    $("#goal-label").textContent = goal.label;
    $("#goal-detail").textContent = goal.detail;
    $("#goal-progress-label").textContent = `${life.goalProgress} / ${goal.target}`;
    $("#goal-progress").style.width = `${Math.min(100, (life.goalProgress / goal.target) * 100)}%`;
    $("#situation-label").textContent = `当前处境：${profile.label}`;
    $("#event-title").textContent = round.title;
    $("#event-copy").textContent = round.copy;
    $("#inherited-strip").classList.toggle("is-hidden", !life.inheritedLegacyIds.length);
    $("#inherited-strip").innerHTML = life.inheritedLegacyIds.length ? `<strong>上一世带来的起点</strong>${life.inheritedLegacyIds.map((id) => { const legacy = getLegacy(id); return legacy ? `<span>${escapeHtml(legacy.label)}：${escapeHtml(legacy.nextUse)}</span>` : ""; }).join("")}` : "";
    $("#action-list").innerHTML = round.actions.map((action, index) => {
      const availability = getAvailability(life, action);
      const disabled = feedbackVisible || !availability.available;
      return `<button class="action-card ${availability.available ? "" : "is-locked"}" type="button" data-action="choose-action" data-action-id="${action.id}" ${disabled ? "disabled" : ""}><span class="action-number">${index + 1}</span><span class="action-body"><strong>${escapeHtml(action.label)}</strong><span>${escapeHtml(action.detail)}</span><em>${escapeHtml(action.cost)}</em></span><span class="action-result"><b>${escapeHtml(action.preview)}</b>${availability.available ? `<small>选择后会告诉你下一步</small>` : `<small>🔒 ${escapeHtml(availability.reason)}</small>`}</span></button>`;
    }).join("");
    $("#feedback").classList.toggle("is-hidden", !feedbackVisible);
    if (feedbackVisible) {
      $("#feedback-title").textContent = `你选择了：${life.lastAction.label}`;
      $("#feedback-copy").textContent = life.lastAction.result;
      $("#feedback-future").textContent = life.lastAction.future;
      $("#feedback-changes").innerHTML = life.lastAction.changes.length ? life.lastAction.changes.map((item) => `<span>${escapeHtml(item)}</span>`).join("") : `<span>没有数值变化，但你留下了一个方向。</span>`;
      $("#advance-round").textContent = life.round >= CONTENT.maxRounds - 1 ? "查看这一世结算 →" : "进入下一回合 →";
    }
    $("#resource-list").innerHTML = [
      renderResource("money", life.resources.money, RESOURCE_LIMITS.money[1]),
      renderResource("energy", life.resources.energy, RESOURCE_LIMITS.energy[1]),
      renderResource("health", life.resources.health, RESOURCE_LIMITS.health[1])
    ].join("");
    $("#trait-list").innerHTML = [
      ["craft", life.traits.craft], ["care", life.traits.care], ["nerve", life.traits.nerve], ["insight", life.traits.insight]
    ].map(([key, value]) => `<span class="trait-chip"><b>${value}</b>${METRIC_LABELS[key]}</span>`).join("");
    $("#relationship-list").innerHTML = Object.entries(life.relationships).map(([key, value]) => `<div class="relationship-row"><span>${escapeHtml(METRIC_LABELS[key])}</span><strong>${value}</strong></div>`).join("");
    $("#town-list").innerHTML = summarizeTown().map((item) => `<div class="town-state-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("");
  }

  function renderEnding() {
    const life = state.currentLife;
    if (!life) return;
    const goal = getGoal(life.goalId);
    const profile = getProfile(life.profileId);
    const outcome = life.outcome || getOutcome(life);
    const candidates = life.legacyCandidates.map(getLegacy).filter(Boolean);
    $("#ending-title").textContent = outcome.title;
    $("#ending-copy").textContent = outcome.copy;
    $("#ending-context").textContent = `第 ${life.generation} 世 · ${profile.label} · 目标完成度 ${life.goalProgress} / ${goal.target}`;
    $("#ending-goal").innerHTML = `<strong>${escapeHtml(goal.label)}</strong><span>${life.goalProgress} / ${goal.target} · ${escapeHtml(goal.measure)}</span>`;
    $("#ending-echo").textContent = outcome.echo;
    $("#ending-changes").innerHTML = summarizeTown().map((item) => `<div class="town-state-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("");
    $("#legacy-count").textContent = `${life.selectedLegacies.length} / 2`;
    $("#legacy-list").innerHTML = candidates.length ? candidates.map((legacy) => `<button class="legacy-card ${life.selectedLegacies.includes(legacy.id) ? "is-selected" : ""}" type="button" data-action="select-legacy" data-legacy-id="${legacy.id}"><span class="legacy-check">${life.selectedLegacies.includes(legacy.id) ? "✓" : ""}</span><strong>${escapeHtml(legacy.label)}</strong><span>${escapeHtml(legacy.detail)}</span><em>下一世：${escapeHtml(legacy.nextUse)}</em></button>`).join("") : `<p class="empty-note">这一世还没有形成可交接的特殊遗产，但小镇状态和人生记录仍会保留。</p>`;
    const confirm = $("#confirm-legacy");
    confirm.disabled = !life.selectedLegacies.length;
    confirm.textContent = life.selectedLegacies.length ? "把遗产交给下一世 →" : "先选择至少一件遗产";
  }

  function renderArchive() {
    $("#archive-life-count").textContent = `${state.world.completedLives} 世`;
    $("#archive-town").innerHTML = summarizeTown().map((item) => `<div class="town-state-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("");
    const history = [...state.world.history].reverse();
    $("#archive-timeline").innerHTML = history.length ? history.map((entry) => {
      const goal = getGoal(entry.goalId);
      const profile = getProfile(entry.profileId);
      const legacies = (entry.legacyIds || []).map(getLegacy).filter(Boolean).map((legacy) => `<span class="archive-tag">带出：${escapeHtml(legacy.label)}</span>`).join("");
      const actions = (entry.actions || []).slice(-3).map((action) => `<span class="archive-tag">${escapeHtml(action.label)}</span>`).join("");
      return `<article class="archive-entry"><div class="archive-entry-top"><strong>第 ${entry.generation} 世</strong><span>${escapeHtml(profile.label)}</span></div><h2>${escapeHtml(entry.outcomeTitle)}</h2><p>${escapeHtml(goal.label)} · 完成度 ${entry.goalProgress} / ${entry.goalTarget}</p><p class="archive-echo">${escapeHtml(entry.echo)}</p><div class="archive-tags">${actions}${legacies || "<span class=\"archive-tag\">没有选择特殊遗产</span>"}</div></article>`;
    }).join("") : `<p class="empty-note">还没有完整的一世。先完成一次结算，镇志才会记录你留下了什么。</p>`;
  }

  function render() {
    document.body.classList.toggle("large-text", state.settings.fontScale === "large");
    $("#font-toggle").setAttribute("aria-pressed", String(state.settings.fontScale === "large"));
    $("#screen-start").classList.toggle("is-hidden", state.screen !== "start");
    $("#screen-game").classList.toggle("is-hidden", state.screen !== "game");
    $("#screen-ending").classList.toggle("is-hidden", state.screen !== "ending");
    $("#screen-archive").classList.toggle("is-hidden", state.screen !== "archive");
    renderStart();
    if (state.screen === "game") renderGame();
    if (state.screen === "ending") renderEnding();
    if (state.screen === "archive") renderArchive();
  }

  function handleAction(action, element) {
    if (action === "select-profile") {
      setup.profileId = element.dataset.profileId;
      render();
    }
    if (action === "select-goal") {
      setup.goalId = element.dataset.goalId;
      render();
    }
    if (action === "start-life") startLife();
    if (action === "continue-life") { state.screen = "game"; render(); }
    if (action === "choose-action") resolveAction(element.dataset.actionId);
    if (action === "advance-round") advanceRound();
    if (action === "select-legacy") toggleLegacy(element.dataset.legacyId);
    if (action === "confirm-legacy") confirmLegacies();
    if (action === "home") { state.screen = "start"; persist(); render(); }
    if (action === "view-archive") { state.screen = "archive"; render(); }
    if (action === "toggle-font") {
      state.settings.fontScale = state.settings.fontScale === "large" ? "normal" : "large";
      persist(state.settings.fontScale === "large" ? "已切换大字模式" : "已恢复普通字号");
      render();
    }
    if (action === "export-save") exportSave();
    if (action === "erase-save" && window.confirm("确定清除当前世代存档和小镇记忆吗？旧版存档不会被改动。")) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* 页面仍可继续 */ }
      state = cloneDefault();
      render();
      showToast("当前世代存档已清除");
    }
  }

  document.addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (element) handleAction(element.dataset.action, element);
  });

  document.addEventListener("keydown", (event) => {
    const life = state.currentLife;
    if (state.screen !== "game" || !life || life.status !== "active" || life.lastAction) return;
    const index = Number(event.key) - 1;
    const action = getRound(life)?.actions[index];
    if (action) resolveAction(action.id);
  });

  $("#import-input").addEventListener("change", (event) => {
    importSave(event.target.files[0]);
    event.target.value = "";
  });

  window.addEventListener("beforeunload", () => {
    if (state.currentLife) persist();
  });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  render();
})();
