(function (global) {
  "use strict";

  const ENGINE = global.EchoTownEngine;
  const SAVE = global.EchoTownSave;
  const MODES = global.EchoTownModes;
  const CONTENT = global.EchoTownContent;
  const AUDIO = global.EchoTownAudio || { supported: false, setEnabled: () => false, isEnabled: () => false, getStatus: () => ({ supported: false, enabled: false }), play: () => {} };
  const {
    RESOURCE_KEYS,
    SKILL_KEYS,
    RELATIONSHIP_KEYS,
    WORLD_KEYS,
    ATTRIBUTE_KEYS,
    INTEREST_KEYS,
    CHARACTER_KEYS,
    TALENT_POOL,
    FLAG_LABELS,
    ROUTE_LABELS,
    SEASON_LABELS,
    LOCATION_BY_STAGE,
    PRIMARY_CHARACTER_BY_RELATION,
    OPPORTUNITY_FOCUS,
    LIFE_ACTION_INTEREST,
  } = ENGINE.constants;
  const {
    isRecord,
    safeText,
    safeList,
    clamp,
    clone,
    escapeHtml,
    hashSeed,
    normalizeTalentIds,
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
    getLifeAvailability,
    getLifeActionCopy,
    getPrimaryLifeActionIds,
    getAction,
    getSkillLevel,
    getSkillLevelName,
    getBestSkill,
  } = ENGINE;
  const STORAGE_KEY = SAVE.CONTRACT.storageKey;
  const SAVE_VERSION = SAVE.CONTRACT.version;
  const MAX_IMPORT_BYTES = SAVE.CONTRACT.maxInputBytes;
  const ROUTES = [{ id: "craft", label: "手艺谋生", detail: "练手艺、接订单，再把作坊交给后来人。" }, { id: "study", label: "学业职业", detail: "学习、辅导与调查，留下一套能用的知识。" }, { id: "community", label: "关系共建", detail: "维护关系、共同承担，完成小镇的公共事务。" }];
  let bound = false;
  let state = ENGINE.getState();
  let setup = ENGINE.getSetup();
  let toastTimer = null;

  const $ = (selector) => document.querySelector(selector);

  function syncRuntime() {
    state = ENGINE.getState();
    setup = ENGINE.getSetup();
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = safeText(message, 180);
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function renderAudioControl() {
    const button = $("#audio-toggle");
    if (!button) return;
    const status = AUDIO.getStatus();
    const requested = Boolean(state.settings.sound);
    if (!requested && AUDIO.isEnabled()) AUDIO.setEnabled(false);
    button.disabled = !status.supported;
    button.setAttribute("aria-pressed", String(requested));
    button.textContent = !status.supported ? "当前浏览器配乐不可用" : requested ? "关闭配乐" : "打开配乐";
    const volume = Math.round(Number(state.settings.volume ?? 0.7) * 100);
    if (document.activeElement !== $("#volume-control")) $("#volume-control").value = String(volume);
    $("#volume-label").textContent = `${volume}%`;
    AUDIO.setVolume?.(volume / 100);
  }

  function persist(message = "已保存") {
    syncRuntime();
    const result = MODES.persist({ message });
    const status = $("#save-status");
    if (result.ok) {
      if (status) status.textContent = message;
      return result;
    }
    if (status) status.textContent = "保存失败，请导出备份";
    showToast("本地保存失败，但当前页面仍可继续；请导出存档");
    return result;
  }

  function toggleAudio() {
    if (!AUDIO.supported) {
      showToast("当前浏览器不支持配乐，游戏文字与画面不受影响");
      return;
    }
    const enabled = !AUDIO.isEnabled();
    const activated = AUDIO.setEnabled(enabled);
    ENGINE.dispatch({ type: "SET_SOUND", enabled: Boolean(enabled && activated) });
    syncRuntime();
    persist(state.settings.sound ? "配乐已打开" : "配乐已关闭");
    render();
  }

  function dispatchCommand(command) {
    const activeElement = document.activeElement;
    const activeData = activeElement?.dataset ? { ...activeElement.dataset } : {};
    const before = ENGINE.getLifePhase?.(ENGINE.getState());
    const result = ENGINE.dispatch(command);
    syncRuntime();
    (result.events || []).forEach((event) => {
      if (event.type === "audio") AUDIO.play(event.kind);
      if (event.type === "persist") persist(event.message);
      if (event.type === "error") showToast(event.message);
    });
    render();
    if (result.ok) {
      const after = ENGINE.getLifePhase?.(state);
      let selector = after !== before && state.screen === "game" ? ({ opportunity: "#opportunity-panel", management: "#life-management", event: "#event-panel", feedback: "#feedback" }[after]) : command.type === "INSPECT_SCENE" ? "#scene-feedback" : command.type === "LIFE_ACTION" || command.type === "BUY_ITEM" || command.type === "REPAY_DEBT" ? "#life-feedback" : command.type === "EVENT_ACTION" ? "#feedback" : null;
      if (["ACCEPT_PROJECT", "WITHDRAW_PROJECT"].includes(command.type)) selector = { opportunity: "#opportunity-panel", management: "#project-desk", event: "#event-panel", feedback: "#feedback" }[after];
      if (["UPDATE_SETUP", "SET_PRESET"].includes(command.type) && activeData.action) {
        const control = [...document.querySelectorAll("[data-action]")].find((item) => Object.entries(activeData).every(([key, value]) => item.dataset[key] === value));
        control?.focus({ preventScroll: true });
      }
      if (["START_LIFE", "ADVANCE_ROUND", "CONFIRM_LEGACIES", "HOME", "CONTINUE_LIFE"].includes(command.type)) {
        window.scrollTo({ top: 0, behavior: "instant" });
        if (selector && $(selector)) { $(selector).setAttribute("tabindex", "-1"); $(selector).focus({ preventScroll: true }); }
      } else if (selector) focusResult(selector);
    }
    return result;
  }

  function focusResult(selector) {
    const drawer = $("#town-drawer[open]");
    let element = $(selector);
    if (drawer) {
      element = drawer.querySelector("#drawer-feedback") || drawer.querySelector(".drawer-close");
      if (element?.id === "drawer-feedback") {
        const feedback = state.currentLife?.lifeFeedback;
        element.hidden = false;
        element.textContent = feedback ? [feedback.title, feedback.copy, ...(feedback.changes || [])].filter(Boolean).join(" ") : "操作已完成。";
      }
    }
    if (!element || element.closest(".is-hidden")) return;
    element.setAttribute("tabindex", "-1");
    element.focus({ preventScroll: true });
    const rect = element.getBoundingClientRect();
    const scroller = element.closest(".operation-scroll, .drawer-content");
    const bounds = scroller?.getBoundingClientRect();
    if (bounds ? rect.top < bounds.top || rect.bottom > bounds.bottom : rect.top < 0 || rect.top > window.innerHeight * 0.7) element.scrollIntoView({ block: "start", behavior: "instant" });
  }

  function preview(type, id, fallback) {
    return ENGINE.previewAction ? ENGINE.previewAction({ type, id }) : { available: fallback?.available ?? true, reason: fallback?.reason || "", changes: [], remaining: null, test: null };
  }

  function previewText(result, fallback = "") {
    const changes = (result.changes || []).map((item) => typeof item === "string" ? item : "").filter(Boolean).join(" · ");
    return changes || fallback;
  }

  function costText(result, fallback = "") {
    if (typeof result.cost === "string") return [result.cost, ...(result.requirements || []).map((requirement) => `${requirement.met ? "✓" : "○"} ${requirement.label}`)].join(" · ");
    if (!result.cost || typeof result.cost !== "object") return fallback;
    const keys = { actionPoints: "行动点", money: "元", energy: "精力", health: "身体", pressure: "压力" };
    const parts = Object.entries(keys).filter(([key]) => Number(result.cost[key]) > 0).map(([key, label]) => `${result.cost[key]} ${label}`);
    return parts.length ? `消耗 ${parts.join(" · ")}` : "无资源消耗";
  }

  function remainingText(result) {
    if (!result.available || !result.remaining) return "";
    if (result.outcomes) {
      const format = (value) => `${value.money} 元、精力 ${value.energy}`;
      return `成功后：${format(result.outcomes.success)}；失败后：${format(result.outcomes.failure)}`;
    }
    return `执行后：${result.remaining.money} 元 · 精力 ${result.remaining.energy} · ${result.remaining.actionPoints} 行动点`;
  }

  function getWish(life) {
    return ENGINE.getWishStatus ? ENGINE.getWishStatus(life) : { completed: false, detail: getGoal(life.goalId).detail, progress: Number(life.progress?.[life.goalId] || 0), target: getGoal(life.goalId).target };
  }

  function exportSave() {
    try {
      syncRuntime();
      const payload = MODES.serialize();
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = MODES.getView().challenge ? `echo-town-${MODES.getSlotId()}-v${SAVE_VERSION}.json` : `echo-town-save-v${SAVE_VERSION}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("存档已导出");
    } catch (error) {
      showToast("存档导出失败");
    }
  }

  function importSave(file) {
    if (!file) return;
    const importSlot = MODES.getSlotId();
    if (file.size > MAX_IMPORT_BYTES) {
      showToast("导入失败：原始文件不能超过 2 MiB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (MODES.getSlotId() !== importSlot) { showToast("读取期间已切换模式，请在需要的模式里重新导入"); return; }
      let prepared;
      try {
        prepared = MODES.prepareImport(reader.result);
        if (prepared.ok) prepared.state = ENGINE.normalizeState(prepared.state);
      } catch (error) {
        showToast("导入失败：存档无法安全恢复，当前进度未改变");
        return;
      }
      if (!prepared.ok) {
        showToast(`导入失败：${prepared.message || "存档无效"}，当前进度未改变`);
        return;
      }
      const result = MODES.commitImport(prepared);
      if (!result.ok) {
        showToast(`导入失败：${result.message || "本地保存失败"}，当前进度未改变`);
        return;
      }
      syncRuntime();
      render();
      $("#save-status").textContent = "已导入并保存";
      showToast(prepared.migrated ? "旧存档已迁移，原始备份已保留" : "存档已导入，原进度已备份");
    };
    reader.onerror = () => showToast("导入失败：无法读取文件");
    reader.readAsText(file);
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

  function getDraftTalents() {
    const selected = (Array.isArray(setup.talentIds) ? setup.talentIds : normalizeTalentIds(null, setup.talentId));
    const selectedTalents = selected.map(getTalent).filter(Boolean);
    const ranked = TALENT_POOL.slice().sort((left, right) => {
      const leftScore = hashSeed(`draft:${state.world.completedLives + 1}:${setup.profileId}:${setup.goalId}:${left.id}`);
      const rightScore = hashSeed(`draft:${state.world.completedLives + 1}:${setup.profileId}:${setup.goalId}:${right.id}`);
      return leftScore - rightScore;
    });
    return [...selectedTalents, ...ranked].filter((item, index, list) => item && list.findIndex((candidate) => candidate.id === item.id) === index).slice(0, CONTENT.talentDraftSize || 10);
  }

  function getAttributePointTotal(attributes = setup.attributes) {
    return ATTRIBUTE_KEYS.reduce((sum, key) => sum + Number(attributes?.[key] || 0), 0);
  }

  function renderStart() {
    const active = state.currentLife?.status === "active";
    const firstVisit = !state.introSeen && state.world.completedLives === 0 && !active;
    const profile = getProfile(setup.profileId);
    const selectedTalentIds = (Array.isArray(setup.talentIds) ? setup.talentIds : normalizeTalentIds(null, setup.talentId));
    const talents = selectedTalentIds.map(getTalent).filter(Boolean);
    const talent = talents[0] || getTalent(setup.talentId) || TALENT_POOL[0];
    const goal = getGoal(setup.goalId);
    $("#generation-label").textContent = state.world.completedLives ? `已走过 ${state.world.completedLives} 世` : "还没有人写下第一行";
    $("#start-echo").textContent = state.world.history.length ? `“${state.world.history[state.world.history.length - 1].outcomeTitle}”` : "“这座镇子还没有收到上一世留下的东西。”";
    renderTown("#start-town", state.world.town);
    const setupReady = selectedTalentIds.length === Number(CONTENT.talentPickLimit || 3) && getAttributePointTotal() === Number(CONTENT.buildAttributePoints || 20);
    $("#start-life").textContent = active ? "进入当前人生 →" : setupReady ? `开始第 ${state.world.completedLives + 1} 世 →` : "先完成天赋与属性构筑";
    $("#start-life").disabled = !active && !setupReady;
    $("#continue-life").classList.toggle("is-hidden", !active);
    $("#view-archive").classList.toggle("is-hidden", state.world.history.length === 0);
    const notice = $("#start-notice");
    notice.textContent = state.notice;
    notice.classList.toggle("is-hidden", !state.notice);
    $("#arrival-panel")?.classList.toggle("is-hidden", !firstVisit);
    $("#route-presets")?.classList.toggle("is-hidden", firstVisit || active);
    $("#preset-list").innerHTML = ROUTES.map((route) => `<button class="preset-option ${setup.routeId === route.id ? "is-selected" : ""}" data-action="choose-preset" data-id="${route.id}" aria-pressed="${setup.routeId === route.id}"><strong>${route.label}</strong><span>${route.detail}</span></button>`).join("");
    $("#setup-layout")?.classList.toggle("is-hidden", firstVisit);
    $("#start-action-panel")?.classList.toggle("is-hidden", firstVisit);
    document.querySelector(".start-tools")?.classList.toggle("is-hidden", firstVisit);
    const lore = CONTENT.worldLore || {};
    if ($("#arrival-intro")) $("#arrival-intro").textContent = lore.intro || "先在镇子里走一走，再决定从哪里开始。";
    if ($("#arrival-locations")) {
      $("#arrival-locations").innerHTML = (lore.locations || []).map((location) => `<div class="arrival-location"><strong>${escapeHtml(location.label)}</strong><span>${escapeHtml(location.detail)}</span></div>`).join("");
    }
    $("#achievement-count").textContent = `${state.world.achievements.length} / ${CONTENT.achievements.length}`;
    $("#secret-count").textContent = `${state.world.secrets.length} / ${CONTENT.secrets.length}`;
    $("#legacy-count-home").textContent = `${state.world.collectedLegacyIds.length} / ${CONTENT.legacies.length}`;
    const startMomentCount = $("#moment-count");
    if (startMomentCount) startMomentCount.textContent = `${state.world.moments.length} / ${CONTENT.maxMoments}`;
    $("#profile-options").innerHTML = CONTENT.profiles.map((item) => `<button class="selection-card ${item.id === setup.profileId ? "is-selected" : ""}" data-action="choose-profile" data-id="${item.id}" aria-pressed="${item.id === setup.profileId}"><span class="selection-check">${item.id === setup.profileId ? "●" : "○"}</span><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join("");
    const draftTalents = getDraftTalents();
    $("#talent-options").innerHTML = draftTalents.map((item, index) => { const selected = selectedTalentIds.includes(item.id); return `<button class="selection-card talent-draft-card ${selected ? "is-selected" : ""}" data-action="choose-talent" data-id="${item.id}" aria-pressed="${selected}"><span class="selection-check">${selected ? "✓" : String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></button>`; }).join("");
    $("#attribute-options").innerHTML = ATTRIBUTE_KEYS.map((key) => { const value = Number(setup.attributes?.[key] || 0); const attribute = CONTENT.buildAttributes[key]; return `<div class="attribute-card"><div><strong>${escapeHtml(attribute.label)}</strong><span>${escapeHtml(attribute.detail)}</span></div><div class="attribute-stepper"><button class="stepper-button" data-action="adjust-attribute" data-attribute="${key}" data-delta="-1" aria-label="减少${escapeHtml(attribute.label)}">−</button><b>${value}</b><button class="stepper-button" data-action="adjust-attribute" data-attribute="${key}" data-delta="1" aria-label="增加${escapeHtml(attribute.label)}">＋</button></div></div>`; }).join("");
    $("#attribute-points-left").textContent = `剩余 ${Math.max(0, (CONTENT.buildAttributePoints || 20) - getAttributePointTotal())} 点`;
    $("#goal-options").innerHTML = CONTENT.goals.map((item) => `<button class="selection-card ${item.id === setup.goalId ? "is-selected" : ""}" data-action="choose-goal" data-id="${item.id}" aria-pressed="${item.id === setup.goalId}"><span class="selection-check">${item.id === setup.goalId ? "●" : "○"}</span><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join("");
    $("#profile-choice-summary").textContent = `已选：${profile.label}`;
    $("#talent-choice-summary").textContent = `已选 ${talents.length} / ${CONTENT.talentPickLimit || 3}`;
    $("#goal-choice-summary").textContent = `已选：${goal.label}`;
    $("#start-summary").innerHTML = `<strong>${escapeHtml(profile.label)}</strong> · ${talents.map((item) => `天赋“${escapeHtml(item.label)}”`).join("、")} · 本世愿望“${escapeHtml(goal.label)}”`;
     const previewLife = ENGINE.createPreviewLife(profile.id, talent.id, goal.id, setup);
   $("#start-preview").innerHTML = [
      ...RESOURCE_KEYS.slice(0, 4).map((key) => `<span>${escapeHtml(CONTENT.resources[key].label)} ${previewLife.resources[key] || 0}</span>`),
       ...ATTRIBUTE_KEYS.map((key) => `<span>${escapeHtml(CONTENT.buildAttributes[key].label)} ${previewLife.build.attributes[key] || 0}</span>`),
       `<span>精力上限 ${previewLife.maxResources.energy}</span>`,
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
      const percent = Math.min(1, Math.max(0, value / max));
      return `<div class="resource-item"><div class="resource-heading"><span>${escapeHtml(resource.label)}</span><strong>${value}${key === "money" ? " 元" : ` / ${max}`}</strong></div>${key === "money" ? "" : `<div class="resource-bar ${key === "pressure" ? "is-pressure" : ""}"><span style="--progress-scale:${percent}"></span></div>`}</div>`;
    }).join("");
  }

  function renderSkillList(life) {
    $("#skill-list").innerHTML = SKILL_KEYS.map((key) => {
      const skill = CONTENT.skills[key];
      const value = life.skills[key];
      const level = getSkillLevel(value);
      return `<div class="skill-row"><div class="skill-heading"><span>${escapeHtml(skill.label)}</span><strong>${escapeHtml(skill.levels[level])} · ${value}/10</strong></div><div class="skill-bar"><span style="--progress-scale:${value / 10}"></span></div></div>`;
    }).join("");
  }

  function renderAttributeList(life) {
    const container = $("#attribute-list");
    if (!container) return;
    container.innerHTML = ATTRIBUTE_KEYS.map((key) => {
      const value = Number(life.build?.attributes?.[key] || 0);
      const attribute = CONTENT.buildAttributes[key];
      return `<div class="attribute-row"><div class="attribute-heading"><span>${escapeHtml(attribute.label)}</span><strong>${value}</strong></div><div class="attribute-bar"><span style="--progress-scale:${Math.min(1, value / 20)}"></span></div></div>`;
    }).join("");
  }

  function renderRelationshipList(life) {
    $("#relationship-list").innerHTML = RELATIONSHIP_KEYS.map((key) => `<div class="relationship-row"><span>${escapeHtml(CONTENT.relationships[key].label)}</span><strong>${life.relationships[key]} / 10</strong></div>`).join("");
  }

  function renderInterestList(life) {
    const container = $("#interest-list");
    if (!container) return;
    const ranked = INTEREST_KEYS.slice().sort((left, right) => Number(life.build?.interests?.[right] || 0) - Number(life.build?.interests?.[left] || 0));
    container.innerHTML = ranked.map((key) => {
      const value = Number(life.build?.interests?.[key] || 0);
      const interest = CONTENT.interests[key];
      return `<div class="interest-row"><div class="interest-heading"><span>${escapeHtml(interest.label)}</span><strong>${value}/10</strong></div><div class="interest-bar"><span style="--progress-scale:${value / 10}"></span></div></div>`;
    }).join("");
  }

  function getCharacterState(value) {
    if (value >= 8) return "会在难处出现";
    if (value >= 5) return "愿意说真话";
    if (value >= 2) return "见过几次面";
    return "还没真正认识";
  }

  function renderCharacterList(life) {
    const container = $("#character-list");
    if (!container) return;
    container.innerHTML = CHARACTER_KEYS.map((key) => {
      const character = CONTENT.characters[key];
      const value = Number(life.characters?.[key] || 0);
      return `<div class="character-row"><div><strong>${escapeHtml(character.label)}</strong><span>${escapeHtml(character.role)}</span></div><div><b>${value}/10</b><small>${getCharacterState(value)}</small></div></div>`;
    }).join("");
  }

  function renderLifeTags(life) {
    const flags = life.flags.filter((flag) => FLAG_LABELS[flag]).slice(-8);
    const routes = (life.build?.routeTags || []).filter((route) => ROUTE_LABELS[route]).slice(-6);
    $("#life-tags").innerHTML = flags.length || routes.length ? [...routes.map((route) => `<span class="tag-chip route-chip">${escapeHtml(ROUTE_LABELS[route])}</span>`), ...flags.map((flag) => `<span class="tag-chip">${escapeHtml(FLAG_LABELS[flag])}</span>`)].join("") : `<span class="empty-note">每一次行动都会写下一枚标签。</span>`;
  }

  function renderMomentList(containerId, foundIds, showLocked = false) {
    const container = $(containerId);
    if (!container) return;
    const found = new Set(foundIds || []);
    container.innerHTML = CONTENT.moments.map((moment) => {
      const unlocked = found.has(moment.id);
      if (!unlocked && !showLocked) return "";
      return `<article class="moment-item ${unlocked ? "is-found" : "is-locked"}"><span class="moment-mark">${unlocked ? "✦" : "·"}</span><div><strong>${unlocked ? escapeHtml(moment.label) : "尚未发生的片段"}</strong><span>${unlocked ? escapeHtml(moment.detail) : "它会在某个真实的生活安排里出现。"}</span></div></article>`;
    }).join("") || `<span class="empty-note">先安排一次生活，给这一世留下第一段具体记忆。</span>`;
  }

  function renderOpportunityPanel(life) {
    const opportunity = life.opportunity || { drawnIds: [], selectedId: null, skipped: false };
    const resolved = opportunityResolved(life);
    const chosen = getOpportunity(opportunity.selectedId);
    $("#opportunity-state").textContent = chosen ? "已接住" : opportunity.skipped ? "已跳过" : "任选其一";
    $("#opportunity-note").textContent = "不消耗行动点；现金和精力成本会当场扣除，也可以跳过。";
    $("#opportunity-list").innerHTML = opportunity.drawnIds.map(getOpportunity).filter(Boolean).map((item) => {
      const result = preview("OPPORTUNITY", item.id, getOpportunityAvailability(life, item));
      const disabled = resolved || !result.available || Boolean(life.lastAction);
      return `<button class="opportunity-card ${item.id === opportunity.selectedId ? "is-selected" : ""}" data-action="choose-opportunity" data-id="${item.id}" ${disabled ? "disabled" : ""}><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span><small>${escapeHtml(costText(result, item.cost))}</small><em>${escapeHtml(result.available ? previewText(result, item.preview) : result.reason)}</em><small class="action-remaining">${escapeHtml(remainingText(result))}</small></button>`;
    }).join("") || `<span class="empty-note">这次没有新的机会，跳过后继续安排生活。</span>`;
    $("#skip-opportunity").classList.toggle("is-hidden", resolved);
    $("#skip-opportunity").disabled = resolved || Boolean(life.lastAction);
    const feedback = $("#opportunity-feedback");
    const result = life.opportunityFeedback;
    feedback.classList.toggle("is-hidden", !result);
    feedback.innerHTML = result ? `<strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.copy)}</span><div>${(result.changes || []).map((item) => `<em>${escapeHtml(item)}</em>`).join("")}</div>` : "";
  }

  function renderLifeManagement(life) {
    const blocked = Boolean(life.lastAction) || !opportunityResolved(life);
    const nextRound = CONTENT.rounds[life.round + 1];
    const bill = nextRound ? getLivingCost(nextRound.age) : { cost: 0 };
    $("#life-action-points").textContent = `${life.actionPoints} / ${CONTENT.actionPointsPerRound} 点`;
    $("#management-note").textContent = "行动可分配给成长、关系或工作；也可提前结束，留住资源。";
    $("#living-cost").textContent = nextRound ? `下个节点生活费 ${bill.cost} 元` : "已是最后一个节点";
    $("#cashflow").textContent = `收入 ${life.cashflow.income} · 支出 ${life.cashflow.expenses} · 借款 ${life.cashflow.debt} 元`;
    const renderOption = (action) => {
      const result = preview("LIFE_ACTION", action.id, getLifeAvailability(life, action));
      const disabled = blocked || !result.available;
      const reason = life.lastAction ? "本节点事件已结束" : !opportunityResolved(life) ? "先处理机会" : result.reason;
      const copy = getLifeActionCopy(life, action);
      return `<button class="life-action-card" data-action="life-action" data-life-action-id="${action.id}" ${disabled ? "disabled" : ""}><span class="life-action-body"><strong>${escapeHtml(action.label)} <span class="inline-cost">${action.points || 1} 行动点</span></strong><small>${escapeHtml(costText(result, copy.cost))}</small><em>${escapeHtml(disabled ? reason : previewText(result, copy.preview))}</em>${disabled ? "" : `<small class="action-remaining">${escapeHtml(remainingText(result))}</small>`}</span></button>`;
    };
    const primaryIds = getPrimaryLifeActionIds(life);
    if (life.age >= 15 && (life.resources.energy <= 3 || life.resources.pressure >= 8)) primaryIds.unshift("routine-rest");
    const primaryActions = [...new Set(primaryIds)].map(getLifeAction).filter(Boolean).slice(0, life.age >= 15 ? 1 : 3);
    const primarySet = new Set(primaryActions.map((action) => action.id));
    $("#life-action-list").innerHTML = primaryActions.map(renderOption).join("");
    const projectView = ENGINE.getProjectView(life);
    const communityAction = projectView?.unlock?.kind === "life" && projectView.unlock.unlocked ? ENGINE.getLifeAction(projectView.unlock.actionId) : null;
    if (communityAction && life.age >= communityAction.minAge) {
      $("#life-action-list").insertAdjacentHTML("beforeend", renderOption(communityAction));
      primarySet.add(communityAction.id);
    }
    $("#life-action-secondary-list").innerHTML = ENGINE.getLifeActions().filter((action) => !primarySet.has(action.id) && (!action.requires?.some((requirement) => requirement.type === "project") || getLifeAvailability(life, action).available)).map(renderOption).join("");
    const route = ENGINE.getStageGoals?.(life)?.routeId || life.routeId || life.strategy?.routeId || "craft";
    const routeJob = { craft: "shop-shift", study: "tutor-shift", community: "town-job" }[route];
    const jobs = ENGINE.getJobs();
    const projectJob = projectView?.unlock?.kind === "job" ? jobs.find((job) => job.id === projectView.unlock.jobId) : null;
    const independentWork = projectJob && life.age >= projectJob.minAge && projectView.unlock.unlocked;
    const stableJob = getJob(projectView?.routeId === "study" ? "tutor-shift" : "shop-shift");
    const visibleJobs = independentWork ? [stableJob, projectJob] : jobs.filter((job) => life.age >= job.minAge && !job.requires?.some((requirement) => requirement.type === "project")).sort((a, b) => Number(getLifeAvailability(life, b).available) - Number(getLifeAvailability(life, a).available) || Number(b.id === routeJob) - Number(a.id === routeJob)).slice(0, 1);
    const visibleJobIds = new Set(visibleJobs.map((job) => job.id));
    $("#work-section").classList.toggle("is-hidden", life.age < 15);
    $("#job-list").innerHTML = visibleJobs.map(renderOption).join("");
    $("#other-job-list").innerHTML = jobs.filter((job) => !visibleJobIds.has(job.id)).map(renderOption).join("");
    const currentJob = getJob(life.jobId);
    $("#job-status").innerHTML = currentJob ? `<strong>${escapeHtml(currentJob.label)}</strong><span>上班 ${life.jobShifts} 次 · 做过 ${life.jobHistory.length} 种工作</span>` : `<span>15 岁以后，可以用行动点换取工资。</span>`;
    $("#inventory-limit").textContent = `${life.inventory.length} / ${CONTENT.maxInventory} 格`;
    $("#inventory-list").innerHTML = life.inventory.map(getItem).filter(Boolean).map((item) => `<span class="inventory-item"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>`).join("") || `<span class="empty-note">还没有物品。展开集市查看用途。</span>`;
    $("#shop-list").innerHTML = CONTENT.items.map((item) => {
      const result = preview("BUY_ITEM", item.id, { available: !hasItem(life, item.id) && life.actionPoints > 0 && life.resources.money >= item.price && life.inventory.length < CONTENT.maxInventory });
      const owned = hasItem(life, item.id);
      return `<button class="shop-item" data-action="buy-item" data-item-id="${item.id}" ${blocked || !result.available ? "disabled" : ""}><span><strong>${escapeHtml(item.label)} · ${item.price} 元</strong><small>${escapeHtml(item.detail)}</small><small>${escapeHtml(owned ? "已拥有" : result.available ? remainingText(result) : result.reason)}</small></span><b>${owned ? "已拥有" : "购买"}</b></button>`;
    }).join("");
    const feedback = life.lifeFeedback;
    const projectNotice = Boolean(life.projects?.current && ["开始建立固定客源", "已退出客源项目", "已接下项目", "已退出项目"].includes(feedback?.title));
    $("#life-feedback").classList.toggle("is-hidden", !feedback || projectNotice);
    $("#life-feedback").innerHTML = feedback ? `<strong>${escapeHtml(feedback.title)}</strong><span>${escapeHtml(feedback.copy)}</span><div>${[...(feedback.changes || []), ...(feedback.newItems || []).map((id) => `获得${getItem(id)?.label || id}`), ...(feedback.newSecrets || []).map((id) => `彩蛋：${getSecret(id)?.label || id}`), ...(feedback.newMoments || []).map((id) => `片段：${getMoment(id)?.label || id}`)].map((item) => `<em>${escapeHtml(item)}</em>`).join("")}</div>` : "";
    $("#management-more-summary").textContent = `物品 ${life.inventory.length}/${CONTENT.maxInventory} · 片段 ${life.moments.length}`;
    $("#life-moment-count").textContent = `${life.moments.length} / ${CONTENT.maxMoments}`;
    renderMomentList("#life-moments", life.moments);
    $("#repay-panel").classList.toggle("is-hidden", !life.cashflow.debt);
    const repayMaximum = Math.max(0, Math.min(life.resources.money, life.cashflow.debt));
    const input = $("#repay-amount");
    input.max = String(repayMaximum);
    if (document.activeElement !== input) input.value = String(repayMaximum);
    $("[data-action='repay-debt']").disabled = repayMaximum < 1 || blocked;
    $("#repay-note").textContent = `待还 ${life.cashflow.debt} 元；不消耗行动点`;
    $("#end-life-actions").textContent = `结束生活安排${life.actionPoints ? `（放弃余下 ${life.actionPoints} 点）` : ""} →`;
  }

  function renderStrategyFocus(life, round, stage) {
    const summary = ENGINE.getStageGoals?.(life);
    const routeId = summary?.routeId || life.routeId || life.strategy?.routeId || "craft";
    const goals = summary?.goals || [];
    const current = goals.find((goal) => goal.routeId === routeId) || goals[0];
    const stageRounds = CONTENT.rounds.filter((item) => item.stage === round.stage);
    const deadline = stageRounds[stageRounds.length - 1]?.age || life.age;
    const remaining = stageRounds.filter((item) => item.age >= life.age).length;
    $("#route-select").value = routeId;
    $("#stage-goal-label").textContent = `${summary?.stageLabel || stage.label}目标 · ${deadline} 岁结算 · 余 ${remaining} 个节点`;
    $("#chapter-focus-title").textContent = current?.label || ROUTES.find((route) => route.id === routeId)?.label || "给这一阶段留下成果";
    const statuses = { pending: "进行中", ready: "条件已满足，阶段末记入成果", achieved: "已完成", missed: "未完成，仍可继续下一阶段", "legacy-settled": "旧制经历 · 不追补、不判失败" };
    $("#chapter-focus-detail").textContent = current ? statuses[current.status] || current.detail : getStageFocus(stage.id).detail;
    const unmet = current?.conditions?.filter((condition) => !condition.met) || [];
    $("#stage-goal-progress").textContent = current?.status === "legacy-settled" ? "新规则从后续完整阶段接入；原有资源与经历保留。" : unmet.length ? `下一步：${unmet.map((condition) => condition.label).join("；")}` : current ? "保持成果，继续安排这一段人生。" : "每个阶段独立结算，晚年也可以转向。";
    $("#stage-goal-list").innerHTML = goals.map((goal) => `<section class="goal-track ${goal.routeId === routeId ? "is-selected" : ""}"><strong>${escapeHtml(ROUTES.find((route) => route.id === goal.routeId)?.label || goal.label)} · ${escapeHtml(statuses[goal.status] || "进行中")}</strong><p>${escapeHtml(goal.detail || "")}</p><ul>${(goal.conditions || []).map((condition) => `<li class="${condition.met ? "is-met" : ""}">${condition.met ? "✓" : "○"} ${escapeHtml(condition.label)}${condition.current !== undefined && condition.target !== undefined ? `（${condition.current}/${condition.target}）` : ""}</li>`).join("")}</ul></section>`).join("");
    const next = CONTENT.rounds[life.round + 1];
    const bill = next ? getLivingCost(next.age).cost : 0;
    $("#resource-summary").innerHTML = `<span>现金 <strong>${life.resources.money} 元</strong></span><span>精力 <strong>${life.resources.energy}/${life.maxResources.energy}</strong></span><span>行动 <strong>${life.actionPoints}/${CONTENT.actionPointsPerRound}</strong></span><span>${next ? "下笔生活费" : "生活费"} <strong>${next ? `${bill} 元` : "已结清"}</strong></span>${life.cashflow.debt ? `<span class="resource-debt">借款 <strong>${life.cashflow.debt} 元</strong></span>` : ""}`;
    $("#challenge-title").textContent = round.title;
    $("#challenge-copy").textContent = round.copy;
    const actions = ENGINE.getAvailableEventActions ? ENGINE.getAvailableEventActions(life) : round.actions;
    $("#challenge-tests").innerHTML = actions.filter((action) => action.test).map((action) => {
      const result = preview("EVENT_ACTION", action.id);
      const test = result.test;
      return `<span>${escapeHtml(action.label)}：${test ? `${escapeHtml(test.label)} ${test.minimum}—${test.maximum} / 门槛 ${test.difficulty}` : `检定门槛 ${action.test.difficulty}`}</span>`;
    }).join("") || `<span>这一页包含可以稳妥推进人生的选择。</span>`;
    const cap = { childhood: 4, adolescence: 6, youth: 8, middle: 10, later: 10 }[stage.id] || 10;
    $("#skill-list").insertAdjacentHTML("beforeend", `<p class="skill-cap-note">本阶段新增长上限 ${cap}。达到上限后可投入收入、关系和成果；已有数值保留。</p>`);
  }

  function renderPhase(life) {
    const phase = ENGINE.getLifePhase ? ENGINE.getLifePhase(state) : life.lastAction ? "feedback" : !opportunityResolved(life) ? "opportunity" : life.actionPoints > 0 ? "management" : "event";
    const steps = [{ id: "opportunity", label: "机会" }, { id: "management", label: "生活" }, { id: "event", label: "事件" }, { id: "feedback", label: "结果" }];
    const index = steps.findIndex((step) => step.id === phase);
    $("#phase-steps").innerHTML = steps.map((step, at) => `<li class="${at === index ? "is-current" : at < index ? "is-done" : ""}" ${at === index ? 'aria-current="step"' : ""}><span aria-hidden="true">${at < index ? "✓" : at + 1}</span>${step.label}</li>`).join("");
    $("#opportunity-panel").classList.toggle("is-hidden", phase !== "opportunity");
    $("#life-management").classList.toggle("is-hidden", phase !== "management");
    $("#event-panel").classList.toggle("is-hidden", phase !== "event");
    $("#feedback").classList.toggle("is-hidden", phase !== "feedback");
    $("#challenge-preview").classList.toggle("is-hidden", phase === "event" || phase === "feedback");
    const previous = [];
    if (opportunityResolved(life)) {
      const selected = getOpportunity(life.opportunity?.selectedId);
      previous.push({ title: selected ? `机会：${selected.label}` : "机会：这次跳过", copy: life.opportunityFeedback?.copy || "没有为机会花费资源。", changes: life.opportunityFeedback?.changes || [] });
    }
    if (index >= 2) {
      const result = life.lifeFeedback;
      previous.push({ title: result?.title || "生活安排已结束", copy: result?.copy || "你保留了这一段的资源，继续面对人生事件。", changes: result?.changes || [] });
    }
    $("#past-steps").classList.toggle("is-hidden", !previous.length);
    $("#past-steps-title").textContent = previous[previous.length - 1]?.title || "已完成的安排";
    $("#past-steps-copy").innerHTML = previous.map((item) => `<div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.copy)}</p><span>${item.changes.map(escapeHtml).join(" · ")}</span></div>`).join("");
  }

  function renderGame() {
    const life = state.currentLife;
    if (!life) return;
    const round = getRound(life);
    const stage = getStage(round.stage);
    const eventArt = CONTENT.media?.eventArt?.[round.id];
    const art = eventArt || CONTENT.media?.stageArt?.[stage.id];
    const artContainer = $("#event-art");
    const artImage = $("#stage-art");
    if (art && artImage) {
      if (!artImage.dataset.fallbackBound) {
        artImage.addEventListener("error", () => {
          artImage.hidden = true;
          if (artContainer) artContainer.classList.add("is-unavailable");
        });
        artImage.addEventListener("load", () => {
          artImage.hidden = false;
          artContainer?.classList.remove("is-unavailable");
        });
        artImage.dataset.fallbackBound = "true";
      }
      const artSource = art.src.replace(/\.png$/, ".webp");
      if (artImage.getAttribute("src") !== artSource) {
        artImage.src = artSource;
        artImage.hidden = false;
        artContainer?.classList.remove("is-unavailable");
      }
      artImage.alt = art.alt;
      if (artImage.complete && artImage.naturalWidth === 0) {
        artImage.hidden = true;
        artContainer?.classList.add("is-unavailable");
      }
      $("#stage-art-caption").textContent = art.caption;
      artContainer?.classList.toggle("is-event-art", Boolean(eventArt));
      const badge = $("#scene-art-badge");
      if (badge) {
        badge.textContent = eventArt ? "本节点镜头" : "阶段全景";
        badge.classList.toggle("is-event", Boolean(eventArt));
      }
    }
    const season = getSeason(round.age);
    AUDIO.setScene(stage.id, season, life.resources.pressure, round.id);
    const goal = getGoal(life.goalId);
    const wish = getWish(life);
    const progress = Number(wish.progress || 0);
    const percent = Math.round(((life.round + 1) / CONTENT.maxRounds) * 100);
    $("#game-generation").textContent = `第 ${life.generation} 世 · ${life.age} 岁`;
    $("#round-label").textContent = `成长节点 ${life.round + 1} / ${CONTENT.maxRounds}`;
    $("#stage-label").textContent = `${stage.label} · ${stage.range} · ${SEASON_LABELS[season]}`;
    $("#stage-hint").textContent = `${LOCATION_BY_STAGE[stage.id] || "回声镇"} · ${stage.hint}`;
    const focus = getStageFocus(stage.id);
    $("#chapter-focus-title").textContent = focus.title;
    $("#chapter-focus-detail").textContent = focus.detail;
    document.querySelectorAll(".life-map [data-stage]").forEach((item) => item.classList.toggle("is-current", item.dataset.stage === stage.id));
    $("#round-progress").setAttribute("aria-valuenow", life.round + 1);
    $("#round-progress").setAttribute("aria-valuemax", CONTENT.maxRounds);
    $("#round-progress span").style.setProperty("--progress-scale", String(percent / 100));
    $("#goal-label").textContent = goal.label;
    $("#goal-detail").textContent = wish.detail || goal.detail;
    $("#goal-progress-label").textContent = wish.completed ? "已完成" : `${progress} / ${wish.target || 1}`;
    $("#goal-progress").style.setProperty("--progress-scale", String(Math.min(1, progress / (wish.target || 1))));
    $("#goal-milestone").textContent = wish.completed ? "已经留下了真实成果" : "根据实际经历与成果判断";
    $("#situation-label").textContent = `${stage.label} · ${round.age} 岁`;
    const eventOrderHint = document.querySelector(".event-meta span:last-child");
    if (eventOrderHint) eventOrderHint.textContent = "选择一项，推进这一段人生";
    $("#event-title").textContent = round.title;
    $("#event-copy").textContent = round.copy;
    $("#inherited-strip").innerHTML = life.inheritedLegacyIds.length ? `<strong>你从上一世接过来</strong>${life.inheritedLegacyIds.map((id) => { const legacy = getLegacy(id); return legacy ? `<span>${escapeHtml(legacy.label)}：${escapeHtml(legacy.nextUse)}</span>` : ""; }).join("")}` : `<strong>这是第一世</strong><span>这一次的每个选择，都将成为以后可以继承的基础。</span>`;
    $("#inherited-strip").classList.remove("is-hidden");
    const carry = life.carryForward;
    const carryForward = $("#carry-forward");
    if (carryForward) {
      carryForward.innerHTML = carry && !life.lastAction ? `<strong>上一页留下的回声</strong><span>${escapeHtml(carry.title)}：${escapeHtml(carry.copy)}</span>` : "";
      carryForward.classList.toggle("is-hidden", !carry || Boolean(life.lastAction));
    }
    const eventActions = ENGINE.getAvailableEventActions ? ENGINE.getAvailableEventActions(life) : round.actions;
    const goalIds = new Set();
    const collectIds = (condition) => {
      for (const key of ["ids", "firstIds", "nextIds"]) (condition[key] || []).forEach((id) => goalIds.add(id));
      (condition.conditions || []).forEach(collectIds);
    };
    CONTENT.strategy.goals.find((goal) => goal.stageId === round.stage && goal.routeId === life.strategy.routeId)?.conditions.forEach(collectIds);
    const score = (action) => Number(getAvailability(life, action).available) * 10 + Number(action.strategy?.routeId === life.strategy.routeId) * 3 + Number(goalIds.has(action.id)) * 2;
    const preferred = eventActions.filter((action) => !action.strategy?.conservative).slice().sort((a, b) => score(b) - score(a)).slice(0, 2);
    const conservative = eventActions.filter((action) => action.strategy?.conservative);
    const primaryIds = new Set([...preferred, ...conservative].map((action) => action.id));
    const orderedActions = [...preferred, ...conservative, ...eventActions.filter((action) => !primaryIds.has(action.id))];
    const cards = orderedActions.map((action, index) => {
      const result = preview("EVENT_ACTION", action.id, getAvailability(life, action));
      const locked = Boolean(life.lastAction) || !result.available;
      const test = result.test ? `<span class="action-test">${escapeHtml(result.test.label)}：预计 ${result.test.minimum}—${result.test.maximum}，门槛 ${result.test.difficulty}</span>` : "";
      return `<button class="action-card" data-action="choose-action" data-action-id="${action.id}" data-shortcut="${index + 1}" ${locked ? "disabled" : ""}><span class="action-number">${index + 1}</span><span class="action-body"><strong>${escapeHtml(action.label)}</strong><span>${escapeHtml(action.detail || "")}</span><small>${escapeHtml(costText(result, action.cost || ""))}</small>${test}<em>${escapeHtml(locked ? result.reason || "本节点已选择" : previewText(result, action.preview || ""))}</em>${locked ? "" : `<small class="action-remaining">${escapeHtml(remainingText(result))}</small>`}</span></button>`;
    });
    $("#action-list").innerHTML = cards.slice(0, primaryIds.size).join("") + (cards.length > primaryIds.size ? `<details class="quiet-details other-event-actions"><summary>其它人生选择（${cards.length - primaryIds.size}）</summary><div class="action-list">${cards.slice(primaryIds.size).join("")}</div></details>` : "");
    const clues = CONTENT.sceneClues?.[round.id] || [];
    const sceneClues = $("#scene-clues");
    if (sceneClues) {
      sceneClues.innerHTML = clues.length ? clues.map((clue, index) => {
        const visited = life.sceneVisits.includes(clue.id);
        return `<button class="scene-clue ${visited ? "is-visited" : ""}" data-action="inspect-scene" data-scene-round="${escapeHtml(round.id)}" data-scene-id="${escapeHtml(clue.id)}" ${visited ? "disabled" : ""}><span class="scene-clue-index">${visited ? "✓" : String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(clue.label)}</strong><small>${visited ? "已写入这一页" : "点击查看这件小事"}</small></span><em>${visited ? "已发现" : "＋线索"}</em></button>`;
      }).join("") : `<span class="empty-note">这一页暂时没有可放大的细节，先看看机会牌和生活安排。</span>`;
      const clueCount = $("#scene-clue-count");
      if (clueCount) clueCount.textContent = `${life.sceneVisits.filter((id) => clues.some((clue) => clue.id === id)).length} / ${clues.length}`;
    }
    const sceneFeedback = $("#scene-feedback");
    const sceneResult = life.sceneFeedback;
    if (sceneFeedback) {
      sceneFeedback.classList.toggle("is-hidden", !sceneResult);
      sceneFeedback.innerHTML = sceneResult ? `<strong>${escapeHtml(sceneResult.title)}</strong><span>${escapeHtml(sceneResult.copy)}</span><div>${(sceneResult.changes || []).map((item) => `<em>${escapeHtml(item)}</em>`).join("") || "<em>这件小事没有改变数值，但已经留在你的记录里。</em>"}</div>` : "";
    }
    renderOpportunityPanel(life);
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
      $("#feedback-goal").innerHTML = (life.lastAction.milestones || []).length ? life.lastAction.milestones.map((milestone) => { const milestoneGoal = getGoal(milestone.goalId); const prefix = milestone.goalId === life.goalId ? "愿望里程碑" : `${milestoneGoal?.label || "成长"}里程碑`; return `<strong>${escapeHtml(prefix)}：${escapeHtml(milestone.label)}</strong><span>${escapeHtml(milestone.detail || "这一段路已经留下了新的方向。")}</span>`; }).join("") : "";
      $("#feedback-stage").innerHTML = life.lastAction.stageBreak ? `<strong>下一阶段：${escapeHtml(life.lastAction.stageBreak.label)} · ${escapeHtml(life.lastAction.stageBreak.range)}</strong><span>${escapeHtml(life.lastAction.stageBreak.hint)}</span>` : "";
      $("#feedback-moment").innerHTML = life.lastAction.newMoments?.length ? life.lastAction.newMoments.map((id) => { const moment = getMoment(id); return moment ? `<div><strong>人生片段：${escapeHtml(moment.label)}</strong><span>${escapeHtml(moment.detail)}</span></div>` : ""; }).join("") : "";
      $("#advance-round").textContent = life.round >= CONTENT.maxRounds - 1 ? "封存这一生，选择遗产 →" : "继续长大 →";
    }
    renderResourceList(life);
    renderAttributeList(life);
    renderSkillList(life);
    renderRelationshipList(life);
    renderInterestList(life);
    renderCharacterList(life);
    renderLifeTags(life);
    renderTown("#town-list", life.town);
    const nextRounds = CONTENT.rounds.slice(life.round + 1, life.round + 4);
    renderStrategyFocus(life, round, stage);
    renderPhase(life, round);
    $("#upcoming-list").innerHTML = nextRounds.length ? nextRounds.map((item) => `<span>${item.age}岁 · ${escapeHtml(item.title)}</span>`).join("") : `<span>人生的最后一页已经来到。</span>`;
  }

  function renderEnding() {
    const life = state.currentLife;
    if (!life) return;
    const goal = getGoal(life.goalId);
    if (!life.outcome) return;
    $("#ending-title").textContent = life.outcome.title;
    $("#ending-copy").textContent = life.outcome.copy;
    const endingTalents = (life.build?.talentIds || [life.talentId]).map(getTalent).filter(Boolean).map((item) => item.label);
    const strongestInterestId = INTEREST_KEYS.slice().sort((left, right) => Number(life.build?.interests?.[right] || 0) - Number(life.build?.interests?.[left] || 0))[0];
    const closestCharacterId = CHARACTER_KEYS.slice().sort((left, right) => Number(life.characters?.[right] || 0) - Number(life.characters?.[left] || 0))[0];
    const endingInterest = strongestInterestId && Number(life.build?.interests?.[strongestInterestId] || 0) > 0 ? `兴趣：${CONTENT.interests[strongestInterestId].label}` : "兴趣：还在寻找";
    const endingCharacter = closestCharacterId && Number(life.characters?.[closestCharacterId] || 0) > 0 ? `同行：${CONTENT.characters[closestCharacterId].label}` : "同行：还没留下名字";
    $("#ending-context").textContent = `第 ${life.generation} 世 · ${life.age} 岁 · ${getProfile(life.profileId).label} · 天赋：${endingTalents.join("、")} · ${endingInterest} · ${endingCharacter}`;
    const wish = getWish(life);
    $("#ending-goal").innerHTML = `<strong>${wish.completed ? "愿望已完成" : "仍有未完成的心愿"}</strong><span>${escapeHtml(goal.label)} · ${escapeHtml(wish.detail || life.outcome.tone)}</span>`;
    $("#ending-score").textContent = `${life.outcome.score} 分`;
    $("#ending-best-skill").textContent = `${CONTENT.skills[getBestSkill(life)].label} · ${life.skills[getBestSkill(life)]}/10`;
    $("#ending-actions-count").textContent = `${life.actions.length} 个事件`;
    $("#ending-life-actions-count").textContent = `${life.lifeLog.length} 次安排 · ${life.opportunity?.history?.length || 0} 次机会`;
    $("#ending-cashflow").textContent = `${life.cashflow.income - life.cashflow.expenses} 元`;
    $("#ending-echo").textContent = life.lastAction?.future || "你留下的基础，会在下一世变成新的选择。";
    renderTown("#ending-changes", life.town);
    $("#ending-achievements").innerHTML = life.newAchievements.length ? life.newAchievements.map((id) => { const item = getAchievement(id); return item ? `<div class="reward-item"><strong>${escapeHtml(item.icon)} ${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div>` : ""; }).join("") : `<span class="empty-note">这一世没有新成就，但每个选择仍写进了镇志。</span>`;
    $("#ending-secrets").innerHTML = life.newSecrets.length ? life.newSecrets.map((id) => { const item = getSecret(id); return item ? `<div class="reward-item"><strong>彩蛋：${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div>` : ""; }).join("") : `<span class="empty-note">还有一些彩蛋藏在不同的选择路线里。</span>`;
    $("#ending-moments").innerHTML = life.newMoments.length ? life.newMoments.map((id) => { const item = getMoment(id); return item ? `<div class="reward-item"><strong>片段：${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div>` : ""; }).join("") : `<span class="empty-note">这一世还没有收集到新片段，下一次生活安排可能会留下它。</span>`;
    const achieved = life.outcome.achievedGoalIds || [];
    const allGoals = ENGINE.getAllStageGoals?.(life) || [];
    const achievedGoals = allGoals.filter((goal) => goal.completed || goal.status === "achieved");
    const route = ROUTES.find((item) => item.id === life.outcome.routeId);
    $("#ending-results").innerHTML = wish.legacy ? `<p>旧制经历 · 原有结局与愿望结算保留</p><p>三条路线的阶段成果从下一世完整启用。</p>` : `<p>${escapeHtml(route ? route.label : life.outcome.tone)} · ${achieved.length} 项阶段成果</p>${achievedGoals.length ? `<ul>${achievedGoals.map((goal) => `<li>${escapeHtml(goal.label)}</li>`).join("")}</ul>` : ""}<p>${escapeHtml(wish.completed ? "这一世的愿望已完成。" : wish.detail || "还有一些未完成的事。")}</p>`;
    const consequences = ENGINE.getConsequences?.(life) || [];
    $("#ending-costs").innerHTML = `<p>借款 ${life.cashflow.debt} 元 · 身体 ${life.resources.health} · 压力 ${life.resources.pressure}</p>${consequences.map((item) => `<p>${escapeHtml(typeof item === "string" ? item : item?.label || item?.detail || item?.copy || "")}</p>`).join("")}`;
    $("#ending-inheritance").innerHTML = `<p>可交接 ${life.legacyCandidates.length} 件基础，最多带走 ${CONTENT.maxLegacyChoices} 件。</p><p>在下方选择后，可以预见它们怎样帮助下一世。</p>`;
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
    $("#archive-moment-count").textContent = `${state.world.moments.length} / ${CONTENT.maxMoments}`;
    renderTown("#archive-town", state.world.town);
    renderAchievements();
    renderSecrets();
    renderMomentList("#moment-list", state.world.moments, true);
    const history = [...state.world.history].reverse();
    $("#archive-timeline").innerHTML = history.length ? history.map((entry) => {
      const profile = getProfile(entry.profileId);
      const talents = (entry.talentIds?.length ? entry.talentIds : [entry.talentId]).map(getTalent).filter(Boolean);
      const goal = getGoal(entry.goalId);
      const legacyTags = (entry.legacyIds || []).map((id) => getLegacy(id)).filter(Boolean).map((item) => `<span class="archive-tag">带出：${escapeHtml(item.label)}</span>`).join("");
      const actionTags = (entry.actions || []).slice(-5).map((action) => `<span class="archive-tag">${escapeHtml(action.label)}</span>`).join("");
      const lifeTags = (entry.lifeLog || []).slice(-4).map((item) => `<span class="archive-tag archive-life-tag">${escapeHtml(item.label)}</span>`).join("");
      const momentTags = (entry.momentIds || []).map((id) => getMoment(id)).filter(Boolean).slice(-4).map((item) => `<span class="archive-tag archive-moment-tag">片段：${escapeHtml(item.label)}</span>`).join("");
      const job = getJob(entry.jobId);
      return `<article class="archive-entry"><div class="archive-entry-top"><strong>第 ${entry.generation} 世</strong><span>${entry.age} 岁封存</span><span>${escapeHtml(profile.label)}</span></div><div><h2>${escapeHtml(entry.outcomeTitle)}</h2><p>${escapeHtml(goal.label)} · ${entry.goalProgress} / ${entry.goalTarget} · 天赋“${talents.map((item) => escapeHtml(item.label)).join("、")}”</p><p class="archive-echo">${escapeHtml(entry.outcomeCopy)}</p><p class="archive-economy">${entry.activityCount || 23} 次生活与事件安排 · ${entry.opportunityHistory?.length || 0} 次机会牌 · ${job ? escapeHtml(job.label) : "没有固定工作"} · 现金流 ${Number(entry.cashflow?.income || 0) - Number(entry.cashflow?.expenses || 0)} 元</p><div class="archive-tags">${lifeTags}${actionTags}${momentTags}${legacyTags || "<span class=\"archive-tag\">没有交接特殊遗产</span>"}</div></div></article>`;
    }).join("") : `<div class="empty-archive"><strong>镇志还没有第一页。</strong><span>完成一世以后，这里会记录你的目标、选择、遗产和留下的回声。</span></div>`;
  }

  function syncResponsiveDetails() {
    const compact = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    document.querySelectorAll("[data-responsive-details]").forEach((details) => {
      if (details.dataset.initialized) return;
      details.open = false;
      details.dataset.initialized = "true";
    });
    const lifeActionMore = $("#life-action-more");
    if (lifeActionMore && !lifeActionMore.dataset.initialized) {
      lifeActionMore.open = false;
      lifeActionMore.dataset.initialized = "true";
    }
  }

  function render() {
    syncRuntime();
    document.body.classList.toggle("large-text", Boolean(state.settings.fontScale));
    syncResponsiveDetails();
    $("#font-toggle").setAttribute("aria-pressed", String(state.settings.fontScale));
    $("#font-toggle").textContent = state.settings.fontScale ? "普通字" : "大字模式";
    renderAudioControl();
    ["start", "game", "ending", "archive"].forEach((screen) => $(`#screen-${screen}`).classList.toggle("is-hidden", state.screen !== screen));
    if (state.screen === "start") renderStart();
    if (state.screen === "game") renderGame();
    if (state.screen === "ending") renderEnding();
    if (state.screen === "archive") renderArchive();
    global.EchoTownScene?.render(state);
    global.EchoTownJourneyUI?.render(state);
    renderModes();
  }

  function renderModes() {
    const mode = MODES.getView();
    $("#mode-label").textContent = mode.challenge ? `固定起点 · ${mode.label}` : "主人生";
    $("#mode-main").classList.toggle("is-hidden", !mode.challenge);
    $("#mode-challenge").classList.toggle("is-hidden", mode.challenge);
    $("#mode-restart").classList.toggle("is-hidden", !mode.challenge);
    $("#mode-description").textContent = mode.challenge ? `规则 ${mode.rulesVersion} · 第1世，6—75岁。可自由改变安排；此处导入、导出和清除只针对挑战。` : "固定起点 · 同一套规则和机会，试一种不同的安排。主人生与挑战各自保存。";
    const challengeEnding = mode.challenge && state.screen === "ending";
    $("#screen-ending .legacy-section").classList.toggle("is-hidden", challengeEnding);
    $("#confirm-legacy").classList.toggle("is-hidden", challengeEnding);
    $("#challenge-ending-actions").classList.toggle("is-hidden", !challengeEnding);
    if (challengeEnding) $("#ending-inheritance").innerHTML = "<p>这场固定起点挑战已经结束。保存人生卡、换一种安排重试，或回到主人生继续传承。</p>";
    if (mode.challenge && state.screen === "start") {
      $("#quick-start").textContent = state.currentLife?.status === "complete" ? "查看挑战结果 →" : "继续这场挑战 →";
      $("#setup-layout").classList.add("is-hidden");
      $("#route-presets").classList.add("is-hidden");
      $("#start-life").classList.add("is-hidden");
      $(".quick-start-actions [data-scene-action='customize']").classList.add("is-hidden");
    } else {
      $("#start-life").classList.remove("is-hidden");
      $(".quick-start-actions [data-scene-action='customize']").classList.remove("is-hidden");
    }
  }

  function switchMode(slotId, resetTarget = false) {
    const result = MODES.switchTo(slotId, { resetTarget });
    if (!result.ok) { showToast(result.message || "切换失败，当前进度已保留"); return result; }
    AUDIO.setEnabled(false);
    AUDIO.setVolume?.(ENGINE.getState().settings.volume);
    $("#mode-menu").open = false;
    global.EchoTownScene?.closeDrawer();
    render();
    $("#save-status").textContent = `${MODES.getView().label} · 已保存`;
    const heading = document.querySelector(`#screen-${state.screen} h1`);
    if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
    return result;
  }


  function handleAction(action, element) {
    if (action === "switch-mode") return switchMode(element.dataset.slotId);
    if (action === "restart-challenge") {
      if (!window.confirm("将这场挑战从6岁重新开始？当前挑战会被替换，主人生完整保留。")) return;
      return switchMode("craft-start-v1", true);
    }
    if (action === "quick-start") {
      if (state.currentLife) return dispatchCommand({ type: "CONTINUE_LIFE" });
      const ready = state.introSeen && normalizeTalentIds(setup.talentIds, setup.talentId).length === Number(CONTENT.talentPickLimit || 3) && getAttributePointTotal() === Number(CONTENT.buildAttributePoints || 20);
      if (ready) return dispatchCommand({ type: "START_LIFE" });
      const configured = dispatchCommand({ type: "SET_PRESET", routeId: "craft" });
      if (configured.ok) return dispatchCommand({ type: "START_LIFE" });
      return configured;
    }
    if (action === "accept-project") return dispatchCommand({ type: "ACCEPT_PROJECT", id: element.dataset.projectId });
    if (action === "withdraw-project") return dispatchCommand({ type: "WITHDRAW_PROJECT" });
    if (action === "enter-town") {
      dispatchCommand({ type: "ENTER_TOWN" });
      $("#setup-profile")?.scrollIntoView({ block: "start" });
      $("#setup-profile")?.setAttribute("open", "");
      return;
    }
    if (action === "choose-profile") {
      dispatchCommand({ type: "UPDATE_SETUP", patch: { profileId: element.dataset.id } });
      $("#setup-talent").open = true;
      return;
    }
    if (action === "choose-talent") {
      const id = element.dataset.id;
      const selected = (Array.isArray(setup.talentIds) ? setup.talentIds : normalizeTalentIds(null, setup.talentId));
      let talentIds;
      if (selected.includes(id)) talentIds = selected.filter((talentId) => talentId !== id);
      else if (selected.length < Number(CONTENT.talentPickLimit || 3)) talentIds = [...selected, id];
      else {
        showToast(`最多选择 ${CONTENT.talentPickLimit || 3} 张天赋`);
        return;
      }
      dispatchCommand({ type: "UPDATE_SETUP", patch: { talentIds, talentId: talentIds[0] || id } });
      if (setup.talentIds.length === Number(CONTENT.talentPickLimit || 3)) $("#setup-attributes").open = true;
      return;
    }
    if (action === "adjust-attribute") {
      const key = element.dataset.attribute;
      const delta = Number(element.dataset.delta || 0);
      if (!ATTRIBUTE_KEYS.includes(key) || !delta) return;
      const current = Number(setup.attributes?.[key] || 0);
      const total = getAttributePointTotal();
      if (delta > 0 && (current >= 10 || total >= Number(CONTENT.buildAttributePoints || 20))) {
        showToast(current >= 10 ? "单项属性最多 10 点" : "20 点已经分配完了");
        return;
      }
      if (delta < 0 && current <= 0) return;
      dispatchCommand({ type: "UPDATE_SETUP", patch: { attributes: { ...setup.attributes, [key]: clamp(current + delta, 0, 10, current) } } });
      if (getAttributePointTotal() === Number(CONTENT.buildAttributePoints || 20)) $("#setup-goal").open = true;
      return;
    }
    if (action === "choose-goal") {
      dispatchCommand({ type: "UPDATE_SETUP", patch: { goalId: element.dataset.id } });
      return;
    }
    if (action === "choose-preset") return dispatchCommand({ type: "SET_PRESET", routeId: element.dataset.id });
    if (action === "end-life-actions") return dispatchCommand({ type: "END_LIFE_ACTIONS" });
    if (action === "repay-debt") return dispatchCommand({ type: "REPAY_DEBT", amount: Number($("#repay-amount").value) });
    if (action === "apply-update") { window.dispatchEvent(new CustomEvent("echo-town-apply-update")); return; }
    if (action === "import-save") return $("#import-input").click();
    if (action === "test-audio") {
      if (!AUDIO.testSound?.()) showToast("当前浏览器无法试听，请检查声音权限");
      else showToast("正在试听；配乐开关保持不变");
      return;
    }
    if (action === "start-life") return dispatchCommand({ type: "START_LIFE" });
    if (action === "continue-life") return dispatchCommand({ type: "CONTINUE_LIFE" });
    if (action === "life-action") return dispatchCommand({ type: "LIFE_ACTION", id: element.dataset.lifeActionId });
    if (action === "choose-opportunity") return dispatchCommand({ type: "OPPORTUNITY", id: element.dataset.id });
    if (action === "skip-opportunity") return dispatchCommand({ type: "SKIP_OPPORTUNITY" });
    if (action === "buy-item") return dispatchCommand({ type: "BUY_ITEM", id: element.dataset.itemId });
    if (action === "choose-action") return dispatchCommand({ type: "EVENT_ACTION", id: element.dataset.actionId });
    if (action === "inspect-scene") return dispatchCommand({ type: "INSPECT_SCENE", roundId: element.dataset.sceneRound, clueId: element.dataset.sceneId });
    if (action === "advance-round") return dispatchCommand({ type: "ADVANCE_ROUND" });
    if (action === "choose-legacy") return dispatchCommand({ type: "TOGGLE_LEGACY", id: element.dataset.id });
    if (action === "confirm-legacy") return dispatchCommand({ type: "CONFIRM_LEGACIES" });
    if (action === "home") return dispatchCommand({ type: "HOME" });
    if (action === "view-archive") return dispatchCommand({ type: "VIEW_ARCHIVE" });
    if (action === "toggle-font") return dispatchCommand({ type: "TOGGLE_FONT" });
    if (action === "toggle-audio") return toggleAudio();
    if (action === "export-save") return exportSave();
    if (action === "erase-save") {
      if (!window.confirm(MODES.getView().challenge ? "清除当前挑战并回到相同起点？主人生完整保留。请先导出需要的挑战存档。" : "确定清除主人生进度、镇志和收藏吗？这会重新开始第一世。请先导出需要保留的存档。挑战存档会保留。")) return;
      const removed = MODES.remove();
      if (!removed?.ok) { showToast("清除失败，当前进度已保留"); return; }
      state = ENGINE.getState();
      setup = ENGINE.getSetup();
      render();
      showToast("当前世代已清除");
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    global.EchoTownScene?.bind();
    global.EchoTownJourneyUI?.bind();
    document.addEventListener("click", (event) => {
      const element = event.target.closest("[data-action]");
      if (element && !element.disabled) handleAction(element.dataset.action, element);
    });
    function resumeAudio() {
      const current = ENGINE.getState();
      AUDIO.setVolume?.(current.settings.volume ?? 0.7);
      if (current.settings.sound && !AUDIO.isEnabled()) AUDIO.setEnabled(true);
    }
    document.addEventListener("pointerdown", resumeAudio);
    document.addEventListener("keydown", resumeAudio);
    window.addEventListener("echo-town-audio-error", () => {
      ENGINE.dispatch({ type: "SET_SOUND", enabled: false });
      persist("配乐被浏览器拦截");
      showToast("浏览器拦截了配乐，请再次点击“打开配乐”");
      render();
    });
    window.addEventListener("echo-town-update-ready", () => {
      $("#update-game").classList.remove("is-hidden");
      $("#save-status").textContent = "新版已备好";
    });
    $("#import-input").addEventListener("change", (event) => {
      importSave(event.target.files?.[0]);
      event.target.value = "";
    });
    $("#route-select").addEventListener("change", (event) => dispatchCommand({ type: "SET_ROUTE", routeId: event.target.value }));
    $("#volume-control").addEventListener("input", (event) => {
      const value = Number(event.target.value) / 100;
      AUDIO.setVolume?.(value);
      $("#volume-label").textContent = `${Math.round(value * 100)}%`;
    });
    $("#volume-control").addEventListener("change", (event) => dispatchCommand({ type: "SET_VOLUME", value: Number(event.target.value) / 100 }));
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || $("dialog[open]") || event.target.closest("input,select,textarea,button,summary,a,[contenteditable='true']")) return;
      const current = ENGINE.getState();
      if (current.screen !== "game" || !current.currentLife || ENGINE.getLifePhase?.(current) !== "event" || !/^[1-9]$/.test(event.key)) return;
      const button = document.querySelector(`[data-action="choose-action"][data-shortcut="${event.key}"]`);
      if (button && !button.disabled && button.getClientRects().length && !button.closest("details:not([open])")) { event.preventDefault(); dispatchCommand({ type: "EVENT_ACTION", id: button.dataset.actionId }); }
    });

  }


  global.EchoTownUI = { bind, render, dispatch: dispatchCommand, showToast };
})(window);
