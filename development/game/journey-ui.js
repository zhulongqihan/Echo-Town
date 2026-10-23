(function (global) {
  "use strict";
  const JOURNEY = global.EchoTownJourney;
  if (!JOURNEY) throw new Error("journey-ui.js requires journey.js");
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const ROUTES = { craft: "手艺谋生", study: "学业职业", community: "关系共建" };
  const NPCS = ["qishu", "linlaoshi", "chenshen", "ahe"];
  let bound = false, downloading = false, renderContext = {};
  function context() {
    const slot = global.EchoTown?.save?.getActiveSlot?.() ?? global.EchoTownSave?.getActiveSlot?.();
    const modes = global.EchoTownModes?.getView?.();
    const mode = renderContext.mode || (typeof slot === "string" ? slot : slot?.mode || slot?.id);
    return { mode: mode === "challenge" || modes?.challenge ? "challenge" : "generation", allowInheritance: renderContext.allowInheritance !== false && !modes?.challenge, challenge: modes?.challenge ? { id: modes.slotId, label: modes.label, rulesVersion: modes.rulesVersion } : null };
  }
  function section(id, parent, title) {
    let element = document.getElementById(id);
    if (!element && parent) {
      element = document.createElement("section"); element.id = id;
      element.className = "journey-section";
      if (title) element.setAttribute("aria-label", title);
      parent.appendChild(element);
    }
    return element;
  }
  function resultLabel(choice) { return choice.success === true ? "结果已完成" : choice.success === false ? "检定未通过" : "旧制经历 · 不重判结果"; }
  function costCopy(choice) { return choice.costs.lines.length ? choice.costs.lines.join("；") : "这次没有现金收支记录"; }
  function renderPeople(life) {
    const element = section("journey-people", $("#drawer-people"), "人物与这几段经历");
    if (!element) return;
    const opened = new Set(Array.from(element.querySelectorAll("details[open]")).map(item => item.dataset.npcId));
    const timelines = NPCS.map(id => JOURNEY.getNpcTimeline(life, id)).filter(item => item.entries.length);
    element.innerHTML = `<h3>后来再聊起</h3>${timelines.length ? timelines.map(timeline => `<details class="journey-npc" data-npc-id="${escape(timeline.npcId)}"${opened.has(timeline.npcId) ? " open" : ""}><summary>${escape(timeline.label)}<span>${timeline.entries.length} 段回应</span></summary><ol>${timeline.entries.map(entry => `<li><p class="journey-meta">${entry.age} 岁 · ${escape(entry.recalledChoice)}</p><p>${escape(entry.text)}</p></li>`).join("")}</ol></details>`).join("") : `<p class="empty-note">和人物有关的选择发生后，这里会留下后来的回应。</p>`}`;
    const stages = JOURNEY.getStageDecisions(life).filter(stage => stage.decision);
    element.insertAdjacentHTML("beforeend", `<details class="journey-stages"><summary>这几段人生里的决定</summary>${stages.map(stage => `<article><p class="journey-meta">${escape(stage.label)} · ${stage.decision.age} 岁</p><h4>${escape(stage.decision.label)}</h4><p>${escape(stage.decision.echo)}</p><p class="journey-meta">${escape(resultLabel(stage.decision))} · ${escape(costCopy(stage.decision))}</p></article>`).join("") || `<p>眼前这一页尚未做出决定。</p>`}</details>`);
  }
  function renderWorld(life) {
    const world = JOURNEY.getWorldView(life);
    let tokens = $("#scene-world-tokens");
    if (!tokens && $("#town-scene")) {
      tokens = document.createElement("div"); tokens.id = "scene-world-tokens";
      tokens.className = "scene-world-tokens"; tokens.setAttribute("aria-label", "选择留下的实物与成果");
      $("#town-scene").appendChild(tokens);
    }
    const symbols = { tool: "⌁", book: "▤", bridge: "⌒", letter: "✉" };
    if (tokens) tokens.innerHTML = world.markers.slice().sort((a, b) => a.age - b.age).slice(-1).map(marker => `<button id="world-${escape(marker.id)}" class="scene-world-token" data-scene-action="open-drawer" data-drawer-tab="scene" title="${escape(marker.copy)}"><span aria-hidden="true">${symbols[marker.icon] || "◇"}</span><span><small>${marker.age}岁留下</small>${escape(marker.label)}</span></button>`).join("");
    const element = section("journey-world", $("#drawer-scene"), "留在场景里的痕迹");
    if (element) element.innerHTML = `<h3>留在这里的痕迹</h3>${world.markers.length ? `<ul class="journey-world-records">${world.markers.map(marker => `<li><strong>${escape(marker.label)}</strong><span>${marker.age} 岁</span><p>${escape(marker.copy)}</p></li>`).join("")}</ul>` : `<p class="empty-note">做过的事会逐渐留在这里。查看场景不消耗行动点。</p>`}`;
    const trigger = $(".scene-heading .scene-view-button");
    if (trigger) { trigger.textContent = world.markers.length ? `查看 ${world.markers.length} 处留痕` : "查看场景细节"; trigger.classList.toggle("has-journey-records", Boolean(world.markers.length)); }
    for (const stage of world.stages) if (stage.decision) {
      const button = document.querySelector(`[data-scene-action="timeline"][data-round="${stage.decision.round}"]`);
      if (button) { button.dataset.journeyDecision = "true"; button.title = `${stage.decision.age} 岁 · ${stage.decision.label} · ${resultLabel(stage.decision)}`; }
    }
  }
  function renderEnding(life) {
    const parent = $("#screen-ending");
    const element = section("journey-review", parent, "这一世真正做过的选择");
    if (!element) return;
    const summary = $("#ending-summary");
    if (summary && element.previousElementSibling !== summary) summary.after(element);
    const review = JOURNEY.getReview(life, context());
    const selected = review.legacies.filter(item => item.selected);
    element.innerHTML = `<div class="journey-heading"><div><p class="journey-meta">几页真正发生过的事</p><h2>${escape(review.title)}</h2></div><button class="button button-secondary" data-journey-action="download-card"${downloading ? " disabled" : ""}>${downloading ? "正在生成人生卡…" : "保存人生卡 PNG"}</button></div><ol class="journey-review-list">${review.choices.map(choice => `<li><p class="journey-meta">${choice.age} 岁 · ${escape(resultLabel(choice))}</p><h3>${escape(choice.label)}</h3><p>${escape(choice.result || choice.echo)}</p><p class="journey-cost">${escape(costCopy(choice))}</p></li>`).join("")}</ol>${review.missing ? `<p class="journey-meta">${escape(review.missing)}</p>` : ""}<details class="journey-proofs"><summary>五个阶段分别留下了什么</summary>${review.stages.map(stage => `<p><strong>${escape(stage.label)}</strong> ${stage.decision ? `${stage.decision.age} 岁 · ${escape(stage.decision.label)}：${escape(stage.decision.echo)}` : "尚无可追溯的选择记录"}</p>`).join("")}</details>${review.allowInheritance ? `<div class="journey-inheritance"><h3>${selected.length ? "选中的基础，将这样继续" : "选定遗产后，可以这样继续"}</h3><p class="journey-meta">${selected.length ? "下方交接后，遗产才进入下一世。开局推荐仍可以修改。" : "先在遗产列表里选择；这里的建议不会自动发放物品或开始新一世。"}</p>${review.nextStrategies.map(item => `<article><strong>${escape(item.label)}</strong><p>${escape(item.copy)}</p><button class="text-button" data-journey-action="preset" data-route-id="${escape(item.routeId)}" data-legacy-id="${escape(item.legacyId)}"${item.selected ? "" : " disabled"}>${item.selected ? `预填下一世：${escape(ROUTES[item.routeId])}` : "先选中这件遗产"}</button></article>`).join("")}</div>` : ""}<p id="journey-card-status" class="journey-meta" role="status" aria-live="polite" tabindex="-1"></p>`;
  }
  function render(state = global.EchoTownEngine.getState(), options = {}) {
    renderContext = options;
    const life = state.currentLife;
    if (!life) return;
    if (state.screen === "game") {
      renderPeople(life); renderWorld(life);
      const timeline = JOURNEY.getNpcTimeline(life, currentNpc(life));
      if (timeline.current && $("#scene-npc-name")) $("#scene-npc-name").textContent = timeline.label;
    }
    if (state.screen === "ending") renderEnding(life);
  }
  function currentNpc(life) {
    // The actual accepted project takes precedence over the tracking selector.
    const project = JOURNEY.getReview(life).project;
    return project?.npcId || ({ craft: "qishu", study: "linlaoshi", community: "chenshen" }[life.strategy?.routeId] || "qishu");
  }
  function bind() {
    if (bound) return;
    bound = true;
    // Bind after Scene.bind: the scene owns opening/closing and geometry. This
    // listener only substitutes a response when actual recorded evidence exists.
    document.addEventListener("click", async event => {
      const control = event.target.closest("[data-journey-action], [data-scene-action='npc-response']");
      if (!control || control.disabled) return;
      const life = global.EchoTownEngine.getState().currentLife;
      if (!life) return;
      if (control.dataset.sceneAction === "npc-response") {
        const timeline = JOURNEY.getNpcTimeline(life, currentNpc(life));
        if (!timeline.current) return;
        $("#npc-response-name").textContent = `${timeline.label} · ${timeline.current.age} 岁后再聊起`;
        $("#npc-response-copy").textContent = timeline.current.text;
        return;
      }
      if (control.dataset.journeyAction === "preset") {
        const path = JOURNEY.getLegacyPaths(life).find(item => item.routeId === control.dataset.routeId && item.id === control.dataset.legacyId && item.selected);
        if (!path || life.status !== "complete" || context().mode === "challenge") return;
        const result = global.EchoTownUI.dispatch(path.command);
        const current = document.querySelector(`[data-journey-action="preset"][data-route-id="${path.routeId}"]`);
        if (result.ok) current?.focus({ preventScroll: true });
        return;
      }
      if (control.dataset.journeyAction === "download-card" && !downloading) {
        downloading = true; control.disabled = true; control.textContent = "正在生成人生卡…";
        try {
          if (!global.EchoTownJourneyCard) throw new Error("人生卡组件没有加载，文字回顾仍可查看");
          const result = await global.EchoTownJourneyCard.download(JOURNEY.getReview(life, context()));
          const status = $("#journey-card-status");
          if (status) { status.textContent = `已生成 ${result.filename}，并发起本地下载。`; status.focus({ preventScroll: true }); }
        } catch (error) {
          const status = $("#journey-card-status");
          if (status) { status.textContent = error.message || "人生卡生成失败，游戏进度未受影响。"; status.focus({ preventScroll: true }); }
        } finally { downloading = false; if (control.isConnected) { control.disabled = false; control.textContent = "保存人生卡 PNG"; } }
      }
    });
  }
  global.EchoTownJourneyUI = Object.freeze({ bind, render });
})(window);
