(function () {
  "use strict";

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const supported = Boolean(AudioContextClass);
  const themes = {
    childhood: { root: 261.63, notes: [0, 4, 7, 4, 2], tempo: 1780, timbre: "triangle" },
    adolescence: { root: 293.66, notes: [0, 2, 5, 9, 5], tempo: 1500, timbre: "sine" },
    youth: { root: 329.63, notes: [0, 4, 7, 11, 7], tempo: 1320, timbre: "triangle" },
    middle: { root: 196.0, notes: [0, 3, 7, 10, 7], tempo: 1580, timbre: "sine" },
    later: { root: 220.0, notes: [0, 5, 9, 7, 4], tempo: 1920, timbre: "sine" },
  };
  const seasonOffsets = { spring: 0, summer: 2, autumn: -2, winter: -5 };
  let context = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let previewGain = null;
  let volume = 0.7;
  let enabled = false;
  let stageId = "childhood";
  let seasonId = "summer";
  let sceneId = "";
  let pressure = 0;
  let beat = 0;
  let timer = null;

  function ensureContext() {
    if (!supported) return false;
    if (context && context.state !== "closed") return true;
    try {
      context = new AudioContextClass();
      masterGain = context.createGain();
      musicGain = context.createGain();
      sfxGain = context.createGain();
      previewGain = context.createGain();
      previewGain.gain.value = volume * 0.82;
      previewGain.connect(context.destination);
      masterGain.gain.value = enabled ? volume * 0.82 : 0;
      musicGain.gain.value = 0.54;
      sfxGain.gain.value = 0.82;
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(context.destination);
      return true;
    } catch (error) {
      context = null;
      return false;
    }
  }

  function transpose(frequency, semitones) {
    return frequency * Math.pow(2, semitones / 12);
  }

  function currentTheme() {
    return themes[stageId] || themes.childhood;
  }

  function tone(frequency, duration, type, volume, destination, delay = 0) {
    if ((!enabled && destination !== previewGain) || !context || !destination) return;
    try {
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    } catch (error) {
      // 音效是可选层，浏览器拒绝播放时由文字反馈兜底。
    }
  }

  function scheduleTheme() {
    if (!enabled || document.hidden) return;
    const theme = currentTheme();
    const offset = seasonOffsets[seasonId] || 0;
    const degree = theme.notes[beat % theme.notes.length];
    const note = transpose(theme.root, degree + offset);
    tone(note, 1.22, theme.timbre, 0.065, musicGain);
    tone(transpose(theme.root, offset) / 2, 1.5, "sine", 0.018, musicGain, 0.04);
    if (beat % 2 === 1) tone(transpose(theme.root, theme.notes[(beat + 2) % theme.notes.length] + offset), 0.32, "triangle", 0.024, musicGain, 0.13);
    if (pressure >= 7) tone(transpose(theme.root, -7 + offset), 0.46, "sawtooth", 0.018, musicGain, 0.02);
    beat += 1;
    timer = window.setTimeout(scheduleTheme, Math.max(1080, theme.tempo - pressure * 38));
  }

  function stopTheme() {
    if (timer) window.clearTimeout(timer);
    timer = null;
  }

  function setEnabled(value) {
    if (!value) { enabled = false; stopTheme(); if (masterGain && context) masterGain.gain.setTargetAtTime(0, context.currentTime, 0.015); return true; }
    if (!supported || !ensureContext()) return false;
    enabled = true;
    masterGain.gain.setTargetAtTime(volume * 0.82, context.currentTime, 0.015);
    if (!enabled) {
      stopTheme();
      return true;
    }
    stopTheme();
    const start = () => {
      if (!enabled || !context || context.state !== "running") return;
      const root = currentTheme().root;
      tone(transpose(root, 12), 0.16, "triangle", 0.1, sfxGain);
      tone(transpose(root, 16), 0.24, "triangle", 0.075, sfxGain, 0.1);
      scheduleTheme();
    };
    if (context.state === "suspended") context.resume().then(start).catch(() => {
      enabled = false;
      stopTheme();
      window.dispatchEvent(new CustomEvent("echo-town-audio-error"));
    });
    else start();
    return true;
  }

  function setScene(nextStage, nextSeason = "summer", nextPressure = 0, nextScene = "") {
    stageId = themes[nextStage] ? nextStage : "childhood";
    seasonId = seasonOffsets[nextSeason] === undefined ? "summer" : nextSeason;
    sceneId = String(nextScene || "");
    pressure = Math.max(0, Math.min(10, Number(nextPressure) || 0));
  }

  function setStage(nextStage, nextPressure = 0) {
    setScene(nextStage, seasonId, nextPressure, sceneId);
  }

  function play(kind) {
    if (!enabled || !ensureContext()) return;
    const root = currentTheme().root;
    const offset = seasonOffsets[seasonId] || 0;
    const sounds = {
      click: [[transpose(root, 12 + offset), 0.08, "sine", 0.035]],
      success: [[transpose(root, 12 + offset), 0.12, "triangle", 0.055], [transpose(root, 16 + offset), 0.18, "triangle", 0.045, 0.1]],
      coin: [[transpose(root, 16 + offset), 0.08, "sine", 0.045], [transpose(root, 19 + offset), 0.15, "sine", 0.038, 0.09]],
      bill: [[transpose(root, offset), 0.16, "triangle", 0.04], [transpose(root, -5 + offset), 0.24, "triangle", 0.03, 0.12]],
      moment: [[transpose(root, 7 + offset), 0.12, "sine", 0.045], [transpose(root, 14 + offset), 0.22, "sine", 0.04, 0.12]],
      ending: [[transpose(root, offset), 0.2, "sine", 0.045], [transpose(root, 4 + offset), 0.26, "sine", 0.04, 0.18], [transpose(root, 7 + offset), 0.4, "sine", 0.035, 0.36]],
      error: [[transpose(root, -7 + offset), 0.16, "triangle", 0.035]],
    };
    (sounds[kind] || sounds.click).forEach(([frequency, duration, type, volume, delay]) => tone(frequency, duration, type, volume, sfxGain, delay || 0));
  }

  function setVolume(value) {
    const number = Number(value);
    volume = Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.7;
    if (context && masterGain) masterGain.gain.setTargetAtTime(enabled ? volume * 0.82 : 0, context.currentTime, 0.025);
    if (context && previewGain) previewGain.gain.setTargetAtTime(volume * 0.82, context.currentTime, 0.025);
    return volume;
  }

  function testSound() {
    if (!supported || !ensureContext()) return false;
    const playPreview = () => {
      const root = currentTheme().root;
      [0, 4, 7].forEach((degree, index) => tone(transpose(root, degree), 0.7, "sine", 0.09, previewGain, index * 0.4));
    };
    if (context.state === "suspended") context.resume().then(playPreview).catch(() => window.dispatchEvent(new CustomEvent("echo-town-audio-error")));
    else playPreview();
    return true;
  }

  document.addEventListener("visibilitychange", () => {
    stopTheme();
    if (document.hidden) {
      if (masterGain && context) masterGain.gain.setTargetAtTime(0, context.currentTime, 0.02);
    } else if (enabled && context?.state === "running") {
      masterGain.gain.setTargetAtTime(volume * 0.82, context.currentTime, 0.02);
      scheduleTheme();
    }
  });

  window.EchoTownAudio = {
    supported,
    setEnabled,
    setVolume,
    testSound,
    setStage,
    setScene,
    play,
    isEnabled: () => enabled,
    getStatus: () => ({ supported, enabled, volume, stage: stageId, season: seasonId, scene: sceneId, state: context?.state || "uninitialized" }),
  };
})();
