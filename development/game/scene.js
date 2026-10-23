(function (global) {
  "use strict";

  // Scene is a projection of engine state. Gameplay buttons use UI's existing
  // data-action dispatcher; looking at the town never issues an engine command.
  const ENGINE = global.EchoTownEngine;
  const CONTENT = global.EchoTownContent;
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) => ENGINE.escapeHtml(String(value ?? ""));
  const TABS = { people: "人物与经历", inventory: "背包与集市", ledger: "这一世的账本", goals: "阶段目标与回声", scene: "这一页的细节", project: "这一世的项目" };
  const PLACES = { childhood: "临河的老院子", adolescence: "学校与修理铺", youth: "长河街口", middle: "灯还亮着的街坊", later: "河桥边的晚风" };
  const SPEAKERS = { craft: "qishu", study: "linlaoshi", community: "chenshen" };
  let bound = false;
  let lastRoundKey = "";
  let drawerSource = null;
  let drawerSourceKey = null;
  let drawerTab = "people";

  // Resolve the same event/stage artwork chosen by UI.renderGame.
  function getScenePlace(round) {
    const art = CONTENT.media?.eventArt?.[round?.id] || CONTENT.media?.stageArt?.[round?.stage];
    return art?.place || PLACES[round?.stage] || "回声镇";
  }

  function text(selector, value) {
    const element = $(selector);
    if (element) element.textContent = String(value ?? "");
  }

  function projectView(life) {
    return typeof ENGINE.getProjectView === "function" ? ENGINE.getProjectView(life) : null;
  }

  function currentSpeaker(life) {
    const id = SPEAKERS[projectView(life)?.routeId || life.strategy?.routeId] || "qishu";
    return { id, ...(CONTENT.characters[id] || { label: "镇上的熟人", role: "" }) };
  }

  function replyFor(life) {
    const view = projectView(life);
    if (view?.npcReply) return view.npcReply;
    const evidence = life.strategy?.evidence || [];
    const achieved = (ids) => evidence.some((entry) => ids.includes(entry.id) && entry.success);
    if (achieved(["open-workshop"])) return "作坊已经开张。接下来还要留足生活费，把下一班活做稳。";
    if (achieved(["fix-bicycle", "chain-craft-trial"])) return "修好的车已经交到对方手里。再接活之前，看看精力和工具够不够。";
    if (achieved(["chain-study-report", "trace-watergate"])) return "这回核对的结果有了证据。把方法留下，后来的人才有办法再查一次。";
    if (achieved(["chain-community-flood", "organize-evacuation"])) return "这次疏散已经完成。还有哪些人需要照应，可以去人物和关系里看看。";
    if (life.resources.energy < 2) return "今天的精力已经不多了。先歇一歇，或者结束生活安排，别急着再接一班活。";
    if (life.cashflow?.debt > 0) return `账上还有 ${life.cashflow.debt} 元借款。先看下一笔生活费，再决定还多少。`;
    if ((life.inventory || []).includes("toolkit")) return "工具已经在你手里了。练习和修理工作会用到它，能做多少先看这次的预览。";
    if (life.age < 15) return "先把练习做扎实。十五岁以后，再用两点生活行动去试一班真正的工作。";
    return "练习和上班都占用这段日子的行动点。先看要做的事，再留一点精力给自己。";
  }

  function renderHotspots(life) {
    const phase = ENGINE.getLifePhase({ currentLife: life });
    const route = life.strategy?.routeId || "craft";
    const practice = route === "study" ? { id: "routine-study", label: "翻开笔记 · 学习" } : route === "community" ? { id: "routine-care", label: "回家看看 · 照料" } : { id: "routine-repair", label: "拿起工具 · 练习" };
    const spots = [
      { ...practice, x: 27, y: 61 },
      { id: "routine-rest", label: "坐一会儿 · 休息", x: 12, y: 43 },
      { tab: "inventory", label: "街角集市 · 看看工具", x: 73, y: 55 },
    ];
    $("#scene-hotspots").innerHTML = spots.map((spot) => {
      if (spot.tab) return `<button class="scene-hotspot is-view" style="--hotspot-x:${spot.x}%;--hotspot-y:${spot.y}%" data-scene-action="open-drawer" data-drawer-tab="${spot.tab}"><span class="hotspot-dot" aria-hidden="true"></span><span>${escape(spot.label)}<small>查看不花行动点</small></span></button>`;
      const preview = ENGINE.previewAction({ type: "LIFE_ACTION", id: spot.id });
      const available = Boolean(preview.available && phase === "management");
      const reason = phase !== "management" ? "先处理右侧当前步骤" : preview.reason;
      const capped = (preview.growth || []).filter((item) => item.capped && item.applied === 0).map((item) => item.label + "已达本阶段上限").join("、");
      const hint = available ? [preview.cost, capped].filter(Boolean).join(" · ") : reason;
      return `<button class="scene-hotspot ${available ? "is-ready" : "is-unavailable"}" style="--hotspot-x:${spot.x}%;--hotspot-y:${spot.y}%" data-action="life-action" data-life-action-id="${spot.id}" ${available ? "" : "disabled"} title="${escape(available ? [preview.cost, ...(preview.notices || [])].join("；") : reason)}"><span class="hotspot-dot" aria-hidden="true"></span><span>${escape(spot.label)}<small>${escape(hint)}</small></span></button>`;
    }).join("");
  }

  function renderProject(life) {
    const view = projectView(life);
    const visible = Boolean(view && view.visible !== false);
    const phase = ENGINE.getLifePhase({ currentLife: life });
    $("#project-desk").classList.toggle("is-hidden", !visible || phase !== "management");
    $("#scene-project-mark").classList.toggle("is-hidden", !visible);
    $("#town-scene").classList.toggle("has-project", visible);
    if (!visible) {
      $("#project-detail").innerHTML = "<p class=\"empty-note\">这一段人生没有待处理的项目。练习、工作和人生事件仍可照常进行。</p>";
      return;
    }
    const steps = Array.isArray(view.steps) ? view.steps : [];
    const current = Number(view.progress?.current ?? steps.filter((step) => step.completed).length);
    const total = Number(view.progress?.total ?? steps.length);
    const settled = ["completed", "incomplete", "withdrawn"].includes(view.status);
    $("#project-desk").classList.toggle("is-settled", settled);
    $("#project-desk").classList.toggle("is-active", view.status === "active");
    text("#project-title", view.title);
    text("#project-status-label", view.statusLabel || "当前项目");
    const offerSummary = view.accept?.available ? `准备占青年8点行动中的${view.definition.requiredActionPoints}点，${view.skill.label}须达到${view.skill.target}；28岁结算。可选项目，本世只选一个。` : view.accept?.reason || view.summary || "";
    text("#project-summary", view.status === "active" ? view.next || view.summary || "" : view.outcome?.detail || offerSummary);
    const stepMarkup = steps.map((step) => `<span class="${step.completed ? "is-complete" : step.status === "missed" ? "is-missed" : ""}">${step.completed ? "✓" : step.status === "missed" ? "已错过 ·" : "○"} ${escape(step.label)}</span>`).join("");
    $("#project-steps").innerHTML = stepMarkup;
    const actionButtons = [];
    if (view.accept && ["available", "unavailable", "offer"].includes(view.status)) actionButtons.push(`<button class="button button-primary" data-action="accept-project" data-project-id="${escape(view.id)}" ${view.accept.available ? "" : "disabled"}>开始${escape(view.title)}</button>`);
    if (view.withdraw && view.status === "active") actionButtons.push(`<button class="text-button" data-action="withdraw-project" data-project-id="${escape(view.id)}" ${view.withdraw.available ? "" : "disabled"}>退出项目</button>${view.withdraw.reason ? `<small>${escape(view.withdraw.reason)}</small>` : ""}`);
    $("#project-actions").innerHTML = actionButtons.join("");
    $("#scene-project-mark").innerHTML = `<span>${escape(view.statusLabel || "当前项目")}</span><strong>${escape(view.title)}</strong>${total > 0 ? `<div class="project-track" role="progressbar" aria-label="项目准备进度" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(total, Math.max(0, current))}"><span style="--project-progress:${Math.min(1, Math.max(0, current / total))}"></span></div><small>${current} / ${total} 项准备</small>` : ""}`;
    const costs = Array.isArray(view.costs) ? `<ul>${view.costs.map((cost) => `<li>${escape(cost)}</li>`).join("")}</ul>` : "";
    const craft = view.skill && !settled ? `<p>结算还需要${escape(view.skill.label)} ${Number(view.skill.target)}，当前 ${Number(view.skill.current)}。</p>` : "";
    const outcomeCopy = view.outcome ? typeof view.outcome === "string" ? view.outcome : view.outcome.detail || view.outcome.label || "" : view.outcomes?.completed || "";
    $("#project-detail").innerHTML = `<h3>${escape(view.title)}</h3><p>${escape(view.summary || "")}</p><ol class="project-checklist">${steps.map((step) => `<li class="${step.status === "missed" ? "is-missed" : ""}"><strong>${step.completed ? "✓" : step.status === "missed" ? "已错过 ·" : "○"} ${escape(step.label)}</strong>${step.detail ? `<p>${escape(step.detail)}</p>` : ""}</li>`).join("")}</ol>${craft}${costs}${outcomeCopy ? `<p class="project-outcome">${escape(outcomeCopy)}</p>` : ""}${view.alternatives ? `<p>${escape(view.alternatives)}</p>` : ""}<p class="empty-note">工具从集市购买，本领靠生活行动练习；查看这份清单不会扣除资源。</p><button class="button button-secondary" data-scene-action="drawer-tab" data-drawer-tab="inventory">去集市看看工具</button>`;
  }

  function renderLedger(life) {
    const cash = life.cashflow || {};
    const ledger = life.ledger;
    $("#ledger-overview").innerHTML = `<dl><div><dt>手头现金</dt><dd>${Number(life.resources.money)} 元</dd></div><div><dt>实际收入</dt><dd>${Number(cash.income || 0)} 元</dd></div><div><dt>日常与消费</dt><dd>${Number(cash.expenses || 0)} 元</dd></div><div><dt>尚欠借款</dt><dd>${Number(cash.debt || 0)} 元</dd></div></dl>${life.migration ? '<p class="empty-note">旧版收支保留汇总；下方只列已有分类记录。</p>' : ""}`;
    const entries = Array.isArray(ledger?.entries) ? ledger.entries.slice().reverse() : [];
    const kinds = { wage: "工资", work: "工作", job: "工作", event: "人生事件", opportunity: "机会", purchase: "购买物品", item: "购买物品", bill: "生活费", living: "生活费", repay: "还款", loan: "借款", life: "生活安排" };
    const jobs = typeof ENGINE.getJobs === "function" ? ENGINE.getJobs(life) : CONTENT.jobs;
    const findLabel = (entry) => ENGINE.getLifeActions().concat(jobs, CONTENT.items, CONTENT.opportunities, CONTENT.rounds.flatMap((round) => round.actions)).find((item) => item.id === entry.id)?.label || kinds[entry.kind] || "收支记录";
    $("#ledger-entries").innerHTML = entries.length ? `<table><caption>已有收支记录，最近的一笔在前</caption><thead><tr><th scope="col">年龄 / 事项</th><th scope="col">收支</th><th scope="col">余额</th></tr></thead><tbody>${entries.map((entry) => `<tr><td><span>${CONTENT.rounds[entry.round]?.age || "—"} 岁</span>${escape(findLabel(entry))}</td><td class="${entry.money >= 0 ? "is-positive" : ""}">${entry.money > 0 ? "+" : ""}${entry.money}</td><td>${entry.balance}</td></tr>`).join("")}</tbody></table>` : '<p class="empty-note">还没有新的分类收支。第一笔工资、消费或生活费会记在这里。</p>';
  }

  function renderTimeline(life, stage) {
    text("#timeline-stage-title", `${stage.label} · ${life.age} 岁`);
    $("#scene-timeline").innerHTML = CONTENT.stages.map((item) => `<div class="timeline-stage ${item.id === stage.id ? "is-current" : ""}"><span>${escape(item.label)}</span><div>${CONTENT.rounds.map((round, index) => round.stage === item.id ? `<button class="timeline-node ${index < life.round ? "is-past" : ""} ${index === life.round ? "is-current" : ""}" data-scene-action="timeline" data-round="${index}" ${index === life.round ? 'aria-current="step"' : ""} aria-label="${round.age} 岁，${escape(round.title)}${index < life.round ? '，查看经历' : index === life.round ? '，当前节点' : '，尚未到达'}"><span aria-hidden="true"></span><small>${round.age}</small></button>` : "").join("")}</div></div>`).join("");
  }

  function openDrawer(tab = "people", source = document.activeElement) {
    const dialog = $("#town-drawer");
    if (!dialog) return;
    drawerTab = TABS[tab] ? tab : "people";
    if (!dialog.open) {
      drawerSource = source instanceof HTMLElement ? source : null;
      drawerSourceKey = drawerSource ? { id: drawerSource.id, action: drawerSource.dataset.sceneAction, tab: drawerSource.dataset.drawerTab, round: drawerSource.dataset.round, hotspot: Boolean(drawerSource.closest("#scene-hotspots")) } : null;
      const feedback = $("#drawer-feedback");
      if (feedback) { feedback.textContent = ""; feedback.hidden = true; }
    }
    text("#drawer-title", TABS[drawerTab]);
    dialog.querySelectorAll("[data-drawer-panel]").forEach((panel) => { panel.hidden = panel.dataset.drawerPanel !== drawerTab; });
    dialog.querySelectorAll(".drawer-tabs button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.drawerTab === drawerTab)));
    const pane = $(`#drawer-${drawerTab}`);
    pane?.querySelectorAll("details").forEach((details) => { details.open = true; });
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(".drawer-close")?.focus({ preventScroll: true });
  }

  function closeDrawer() {
    const dialog = $("#town-drawer");
    if (dialog?.open) dialog.close();
  }

  function showTimelineRecord(index) {
    const life = ENGINE.getState().currentLife;
    if (!life) return;
    const round = CONTENT.rounds[index];
    if (!round) return;
    openDrawer("people");
    let record = $("#timeline-record");
    if (!record) { record = document.createElement("section"); record.id = "timeline-record"; $("#drawer-people").prepend(record); }
    const actions = (life.actions || []).filter((action) => action.age === round.age);
    const logs = (life.lifeLog || []).filter((entry) => entry.age === round.age);
    record.innerHTML = `<h3>${round.age} 岁 · ${escape(round.title)}</h3>${actions.map((action) => `<p><strong>${escape(action.label)}</strong> ${escape(action.result)}</p>`).join("")}${logs.map((entry) => `<p>${escape(entry.label)}：${escape(entry.result)}</p>`).join("")}${!actions.length && !logs.length ? `<p class="empty-note">${index > life.round ? "这一页还没有发生。时间线只供查看，不会跳过人生节点。" : "这一页还没有记录下已完成的安排。"}</p>` : ""}`;
    record.setAttribute("tabindex", "-1");
    record.focus({ preventScroll: true });
    $(".drawer-content").scrollTop = 0;
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener("click", (event) => {
      const control = event.target.closest("[data-scene-action]");
      if (!control) return;
      const action = control.dataset.sceneAction;
      if (action === "open-drawer" || action === "drawer-tab") openDrawer(control.dataset.drawerTab, control);
      if (action === "close-drawer") closeDrawer();
      if (action === "close-response") $("#npc-response").classList.add("is-hidden");
      if (action === "npc-response") {
        const life = ENGINE.getState().currentLife;
        if (!life) return;
        const speaker = currentSpeaker(life);
        text("#npc-response-name", `${speaker.label} · ${speaker.role}`);
        text("#npc-response-copy", replyFor(life));
        $("#npc-response").classList.remove("is-hidden");
      }
      if (action === "timeline") showTimelineRecord(Number(control.dataset.round));
      if (action === "customize") {
        global.EchoTownUI.dispatch({ type: "ENTER_TOWN" });
        $("#setup-profile").open = true;
        $("#setup-profile").scrollIntoView({ block: "start", behavior: "instant" });
        $("#setup-profile summary")?.focus();
      }
    });
    $("#town-drawer")?.addEventListener("close", () => {
      const canFocus = (element) => element?.isConnected && !element.closest("#town-drawer, .is-hidden, [hidden]");
      let target = canFocus(drawerSource) ? drawerSource : null;
      if (!target && drawerSourceKey) {
        if (drawerSourceKey.id) target = document.getElementById(drawerSourceKey.id);
        if (!canFocus(target)) target = Array.from(document.querySelectorAll("[data-scene-action]")).find((element) => canFocus(element) && element.dataset.sceneAction === drawerSourceKey.action && element.dataset.drawerTab === drawerSourceKey.tab && element.dataset.round === drawerSourceKey.round && Boolean(element.closest("#scene-hotspots")) === drawerSourceKey.hotspot);
      }
      if (canFocus(target)) target.focus({ preventScroll: true });
      drawerSource = null;
      drawerSourceKey = null;
    });
    $("#town-drawer")?.addEventListener("click", (event) => {
      if (event.target === $("#town-drawer")) {
        const rect = event.target.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDrawer();
      }
    });
  }

  function render(state = ENGINE.getState()) {
    document.body.dataset.screen = state.screen;
    const quick = $("#quick-start");
    const setup = ENGINE.getSetup();
    const routeLabel = state.introSeen ? ({ craft: "手艺", study: "学业", community: "关系" }[setup.routeId] || "手艺") : "手艺";
    if (quick) quick.textContent = state.currentLife?.status === "active" ? "继续这一世 →" : state.currentLife?.status === "complete" ? "完成遗产交接 →" : `从${routeLabel}人生开始 →`;
    if (state.screen !== "game" || !state.currentLife) { closeDrawer(); return; }
    const life = state.currentLife;
    const round = ENGINE.getRound(life);
    const stage = ENGINE.getStage(round.stage);
    const key = `${life.generation}:${life.round}`;
    if (key !== lastRoundKey) {
      lastRoundKey = key;
      $("#npc-response").classList.add("is-hidden");
      $("#operation-scroll").scrollTop = 0;
      closeDrawer();
    }
    text("#scene-stage-caption", `${stage.label} · ${life.age} 岁`);
    text("#scene-place-name", getScenePlace(round));
    text("#scene-current-title", round.title);
    text("#scene-current-copy", life.lastAction?.result || round.copy);
    text("#scene-current-label", life.lastAction ? "这一页已经发生" : "眼前的事情");
    text("#scene-npc-name", currentSpeaker(life).label);
    const alerts = [];
    if (life.resources.health <= 3) alerts.push(`身体 ${life.resources.health}/10`);
    if (life.resources.pressure >= 8) alerts.push(`压力 ${life.resources.pressure}/10`);
    text("#scene-notice", alerts.join(" · "));
    const image = $("#stage-art");
    if (image) image.loading = "eager";
    renderHotspots(life);
    renderProject(life);
    renderLedger(life);
    renderTimeline(life, stage);
    if (drawerTab === "project" && $("#town-drawer")?.open) text("#drawer-title", TABS.project);
  }

  global.EchoTownScene = { bind, render, openDrawer, closeDrawer, getScenePlace };
})(window);
