(function () {
  "use strict";

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const supported = Boolean(AudioContextClass);
  const patterns = {
    childhood: [261.63, 329.63, 392.0, 329.63],
    adolescence: [293.66, 349.23, 440.0, 349.23],
    youth: [329.63, 392.0, 493.88, 392.0],
    middle: [196.0, 246.94, 293.66, 246.94],
    later: [220.0, 277.18, 329.63, 277.18],
  };
  let context = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let enabled = false;
  let stageId = "childhood";
  let pressure = 0;
  let beat = 0;
  let timer = null;

  function ensureContext() {
    if (!supported) return false;
    if (context) return true;
    try {
      context = new AudioContextClass();
      masterGain = context.createGain();
      musicGain = context.createGain();
      sfxGain = context.createGain();
      masterGain.gain.value = 0.7;
      musicGain.gain.value = 0.34;
      sfxGain.gain.value = 0.8;
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(context.destination);
      return true;
    } catch (error) {
      context = null;
      return false;
    }
  }

  function tone(frequency, duration, type, volume, destination, delay = 0) {
    if (!enabled || !context || !destination) return;
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
    if (!enabled) return;
    const pattern = patterns[stageId] || patterns.childhood;
    const note = pattern[beat % pattern.length];
    tone(note, 1.2, "sine", 0.035, musicGain);
    if (pressure >= 7) tone(note / 2, 0.4, "triangle", 0.022, musicGain, 0.02);
    beat += 1;
    timer = window.setTimeout(scheduleTheme, pressure >= 7 ? 1300 : 1700);
  }

  function stopTheme() {
    if (timer) window.clearTimeout(timer);
    timer = null;
  }

  function setEnabled(value) {
    if (!supported || !ensureContext()) return false;
    enabled = Boolean(value);
    if (!enabled) {
      stopTheme();
      return true;
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    stopTheme();
    scheduleTheme();
    return true;
  }

  function setStage(nextStage, nextPressure = 0) {
    stageId = patterns[nextStage] ? nextStage : "childhood";
    pressure = Math.max(0, Math.min(10, Number(nextPressure) || 0));
  }

  function play(kind) {
    if (!enabled || !ensureContext()) return;
    const sounds = {
      click: [[440, 0.08, "sine", 0.04]],
      success: [[523.25, 0.12, "triangle", 0.06], [659.25, 0.18, "triangle", 0.05, 0.1]],
      coin: [[659.25, 0.08, "sine", 0.05], [783.99, 0.15, "sine", 0.045, 0.09]],
      bill: [[220.0, 0.16, "triangle", 0.045], [174.61, 0.24, "triangle", 0.035, 0.12]],
      moment: [[392.0, 0.12, "sine", 0.05], [587.33, 0.22, "sine", 0.045, 0.12]],
      ending: [[261.63, 0.2, "sine", 0.05], [329.63, 0.26, "sine", 0.045, 0.18], [392.0, 0.4, "sine", 0.04, 0.36]],
      error: [[164.81, 0.16, "triangle", 0.04]],
    };
    (sounds[kind] || sounds.click).forEach(([frequency, duration, type, volume, delay]) => tone(frequency, duration, type, volume, sfxGain, delay || 0));
  }

  window.EchoTownAudio = {
    supported,
    setEnabled,
    setStage,
    play,
    isEnabled: () => enabled,
    getStatus: () => ({ supported, enabled, stage: stageId }),
  };
})();
