(function (global) {
  "use strict";
  const engine = global.EchoTownEngine;
  const save = global.EchoTownSave;
  const audio = global.EchoTownAudio;
  const modes = global.EchoTownModes;
  modes.boot();
  audio?.setVolume(engine.getState().settings.volume);
  global.EchoTown = { content: global.EchoTownContent, strategy: global.EchoTownStrategy, projects: global.EchoTownProjects, journey: global.EchoTownJourney, engine, save, modes, audio, scene: global.EchoTownScene, ui: global.EchoTownUI };
  global.EchoTownUI.bind();
  global.EchoTownUI.render();
  if ("serviceWorker" in navigator && global.location.protocol !== "file:") {
    let waiting = null;
    let reloading = false;
    const announce = (registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        waiting = registration.waiting;
        global.dispatchEvent(new CustomEvent("echo-town-update-ready"));
      }
    };
    navigator.serviceWorker.register("sw.js").then((registration) => {
      announce(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed") announce(registration); });
      });
    }).catch(() => {});
    global.addEventListener("echo-town-apply-update", () => {
      if (!waiting) return;
      const saved = modes.persist();
      if (!saved.ok) { global.EchoTownUI.showToast("保存失败，请先导出备份，暂不更新"); return; }
      reloading = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading) global.location.reload(); });
  }
})(window);
