(function (global) {
  "use strict";

  // Coordinates saved candidates and the engine. Slot metadata belongs to Save;
  // a mode never becomes part of the life or a second stored gameplay phase.
  const ENGINE = global.EchoTownEngine;
  const SAVE = global.EchoTownSave;
  const defaults = ENGINE.getState();
  let activeSlot = "main";
  let recoveryRequired = false;
  const createTarget = id => ENGINE.createChallengeState(id);
  const normalize = candidate => ENGINE.normalizeState(candidate);
  function failure(error) { return { ok: false, message: error?.message || "无法安全切换进度，原进度已保留" }; }
  function apply(result) {
    if (!result.ok) return result;
    ENGINE.replaceState(result.state);
    activeSlot = result.slotId || activeSlot;
    ENGINE.setRuntimeMode(activeSlot);
    recoveryRequired = false;
    return result;
  }
  function boot() {
    let loaded;
    try {
      loaded = SAVE.loadActive({ defaultState: defaults, createTarget });
      if (!loaded.ok) throw new Error(loaded.message || "无法安全读取当前存档");
      if (loaded.state) loaded.state = normalize(loaded.state);
      const ready = SAVE.commitLoad(loaded);
      if (!ready.ok) throw new Error(ready.message || "存档未能写入，原档仍保留");
      return apply(ready);
    } catch (error) {
      const pointer = SAVE.getActiveSlot();
      const candidate = ENGINE.clone(defaults);
      candidate.notice = pointer.ok ? `${error.message}。请导入有效备份，或清除当前槽后重新开始。` : "存档模式索引无法安全读取，原始记录已保护。请保留浏览器数据；此时不会猜测槽位或覆盖原进度。";
      ENGINE.replaceState(candidate);
      ENGINE.setRecoveryRequired(true);
      recoveryRequired = true;
      if (pointer.ok) activeSlot = pointer.slotId;
      ENGINE.setRuntimeMode(activeSlot);
      return failure(error);
    }
  }
  function switchTo(slotId, options = {}) {
    try {
      return apply(SAVE.switchSlot(slotId, ENGINE.getState(), {
        expectedSourceSlotId: activeSlot, normalize, createTarget, defaultState: defaults, resetTarget: Boolean(options.resetTarget),
      }));
    } catch (error) { return failure(error); }
  }
  function persist(options = {}) { return SAVE.persistSlot(activeSlot, ENGINE.getState(), options); }
  function prepareImport(text) { return SAVE.prepareSlotImport(activeSlot, text); }
  function commitImport(prepared) {
    try { return apply(SAVE.commitSlotImport(activeSlot, prepared, ENGINE.getState(), { recovery: recoveryRequired })); }
    catch (error) { return failure(error); }
  }
  function remove() {
    try {
      const candidate = normalize(activeSlot === "main" ? defaults : createTarget(activeSlot));
      const result = SAVE.removeSlot(activeSlot);
      if (!result.ok) return result;
      return apply({ ...result, state: candidate, slotId: activeSlot });
    } catch (error) { return failure(error); }
  }
  function serialize() { return SAVE.serializeSlot(activeSlot, ENGINE.getState()); }
  function getView() {
    const definition = ENGINE.getChallengeDefinitions().find(item => item.id === activeSlot);
    return { slotId: activeSlot, challenge: Boolean(definition), label: definition?.label || "主人生", rulesVersion: definition?.rulesVersion || null };
  }
  global.EchoTownModes = Object.freeze({ boot, switchTo, persist, prepareImport, commitImport, remove, serialize, getView, getSlotId: () => activeSlot });
})(window);
