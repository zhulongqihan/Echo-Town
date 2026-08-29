(function () {
  "use strict";

  const STORAGE_KEY = "echo-town-save";
  const SAVE_VERSION = 3;
  const MAX_STAGES = 12;
  const MAX_SAVE_BYTES = 512 * 1024;
  const MAX_HISTORY = 20;
  const MAX_TEXT_LENGTH = 240;
  const MAX_STAT = { health: 3, coins: 6, courage: 5, bond: 6, craft: 6, insight: 6 };

  const TOWN_LABELS = {
    bridge: { label: "河桥", values: ["桥板缺了三块", "有人开始补桥", "桥面重新亮灯", "两岸重新相认"] },
    river: { label: "河水", values: ["浑浊，带着铁锈味", "水闸有人照看", "清亮得能看见石头", "河床终于有了名字"] },
    trust: { label: "邻里", values: ["各自关门", "开始互相留灯", "愿意替彼此守夜", "遇到暴雨会先敲门"] },
    archive: { label: "镇志", values: ["旧账本无人翻", "多了一页手写记录", "终于有了自己的名字", "每个名字都有来处"] },
    workshop: { label: "手艺", values: ["工具散在灰尘里", "有人重新学会修理", "修理铺收下学徒", "一双手能教会下一双手"] },
    light: { label: "灯火", values: ["入夜后很少亮灯", "桥头有一盏孤灯", "沿街开始互相照看", "整座镇子知道为谁点灯"] }
  };

  const PEOPLE_LABELS = {
    ahe: { label: "阿禾", values: ["只在旧故事里出现", "还记得你的名字", "愿意和你并肩", "把灯交给下一代"] },
    qishu: { label: "祁叔", values: ["工具柜锁着", "肯教你一件手艺", "把修理铺交给你", "看着你教会别人"] },
    lin: { label: "林老师", values: ["只剩一串钥匙", "愿意替你读一页", "把镇志交给你", "和你一起守住来处"] },
    children: { label: "孩子们", values: ["只会从远处看桥", "有人跟着你学", "开始替邻居跑腿", "知道该把什么交下去"] }
  };

  const LIFE_PLANS = {
    repair: { label: "让一条路重新可走", short: "修路的人", detail: "从手边的工具和桥开始。", bonus: { craft: 1, coins: 1 } },
    witness: { label: "让名字不被删掉", short: "记事的人", detail: "先听见，再把来处写下来。", bonus: { insight: 1, bond: 1 } },
    lantern: { label: "为某个人留一盏灯", short: "守灯的人", detail: "关系会比答案更早抵达下一世。", bonus: { courage: 1, bond: 1 } }
  };

  const DEFAULT_STATE = {
    version: SAVE_VERSION,
    world: {
      completedLives: 0,
      bridge: 0,
      river: 0,
      trust: 0,
      archive: 0,
      workshop: 0,
      light: 0,
      relics: [],
      echoes: [],
      history: [],
      people: { ahe: 0, qishu: 0, lin: 0, children: 0 },
      discoveries: [],
      lastEcho: "河水从镇子中间穿过去，谁也没有想过它会记得什么。"
    },
    settings: { fontScale: "normal" },
    currentLife: null,
    screen: "start"
  };

  let state = loadState();
  let toastTimer = null;

  const $ = (selector) => document.querySelector(selector);

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function safeText(value, limit = MAX_TEXT_LENGTH) {
    return typeof value === "string" ? value.slice(0, limit) : "";
  }

  function safeStringList(value, limit) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item) => typeof item === "string").map((item) => safeText(item)))].slice(-limit);
  }

  function clampInteger(value, min, max, fallback = min) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(parsed)));
  }

  function makeLifeSeed(generation, historyLength = 0) {
    let hash = 2166136261;
    const source = `echo-town:${generation}:${historyLength}`;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function escapeHtml(value) {
    return safeText(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function isSavePayload(value) {
    return isRecord(value)
      && [1, 2, SAVE_VERSION].includes(Number(value.version))
      && isRecord(value.world)
      && (value.currentLife == null || isRecord(value.currentLife));
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => {
      if (!isRecord(entry)) return null;
      const town = Array.isArray(entry.town) ? entry.town.filter(isRecord).slice(0, 8).map((item) => ({
        key: safeText(item.key, 40),
        label: safeText(item.label, 40),
        value: safeText(item.value, 80),
        changed: Boolean(item.changed)
      })) : [];
      return {
        generation: clampInteger(entry.generation, 1, 9999, 1),
        choices: safeStringList(entry.choices, MAX_STAGES),
        echoes: safeStringList(entry.echoes, MAX_STAGES),
        relics: safeStringList(entry.relics, 20),
        discoveries: safeStringList(entry.discoveries, 20),
        endingKey: safeText(entry.endingKey, 40),
        endingTitle: safeText(entry.endingTitle, 80),
        planKey: Object.prototype.hasOwnProperty.call(LIFE_PLANS, entry.planKey) ? entry.planKey : "",
        planLabel: safeText(entry.planLabel, 80),
        people: isRecord(entry.people) ? Object.fromEntries(Object.keys(PEOPLE_LABELS).map((key) => [key, clampInteger(entry.people[key], 0, 3, 0)])) : {},
        town,
        verdict: safeText(entry.verdict) || "小镇从那里继续。"
      };
    }).filter(Boolean).slice(-MAX_HISTORY);
  }

  function cloneDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("echo-town-mvp-v1");
      const saved = raw ? JSON.parse(raw) : null;
      if (!isSavePayload(saved)) return cloneDefault();
      return normalizeState(saved);
    } catch (error) {
      return cloneDefault();
    }
  }

  function normalizeState(saved) {
    const fresh = cloneDefault();
    const savedWorld = isRecord(saved.world) ? saved.world : {};
    const world = { ...fresh.world, ...savedWorld };
    world.completedLives = clampInteger(savedWorld.completedLives, 0, 9999, 0);
    ["bridge", "river", "trust", "archive"].forEach((key) => {
      world[key] = clampInteger(savedWorld[key], 0, TOWN_LABELS[key].values.length - 1, 0);
    });
    ["workshop", "light"].forEach((key) => {
      world[key] = clampInteger(savedWorld[key], 0, TOWN_LABELS[key].values.length - 1, 0);
    });
    world.relics = safeStringList(savedWorld.relics, 20);
    world.echoes = safeStringList(savedWorld.echoes, 120);
    world.history = normalizeHistory(savedWorld.history);
    world.discoveries = safeStringList(savedWorld.discoveries, 40);
    world.people = isRecord(savedWorld.people)
      ? Object.fromEntries(Object.keys(PEOPLE_LABELS).map((key) => [key, clampInteger(savedWorld.people[key], 0, 3, 0)]))
      : { ...fresh.world.people };
    world.lastEcho = safeText(savedWorld.lastEcho) || fresh.world.lastEcho;
    const savedLife = isRecord(saved.currentLife) ? saved.currentLife : null;
    const savedStats = savedLife && isRecord(savedLife.stats) ? savedLife.stats : {};
    const currentLife = savedLife ? {
      generation: clampInteger(savedLife.generation, 1, 9999, world.completedLives + 1),
      stage: clampInteger(savedLife.stage, 0, MAX_STAGES - 1, 0),
      seed: clampInteger(savedLife.seed, 0, 4294967295, makeLifeSeed(savedLife.generation, world.history.length)),
        stats: {
        health: clampInteger(savedStats.health, 0, MAX_STAT.health, 3),
        coins: clampInteger(savedStats.coins, 0, MAX_STAT.coins, 2),
        courage: clampInteger(savedStats.courage, 0, MAX_STAT.courage, 1),
          bond: clampInteger(savedStats.bond, 0, MAX_STAT.bond, 0),
          craft: clampInteger(savedStats.craft, 0, MAX_STAT.craft, 0),
          insight: clampInteger(savedStats.insight, 0, MAX_STAT.insight, 0)
        },
      planKey: Object.prototype.hasOwnProperty.call(LIFE_PLANS, savedLife.planKey) ? savedLife.planKey : "",
      intent: safeText(savedLife.intent, 80),
      choices: safeStringList(savedLife.choices, MAX_STAGES),
      choiceLabels: safeStringList(savedLife.choiceLabels, MAX_STAGES),
      echoes: safeStringList(savedLife.echoes, MAX_STAGES),
      relics: safeStringList(savedLife.relics, 20),
      discoveries: safeStringList(savedLife.discoveries, 20),
      status: savedLife.status === "complete" ? "complete" : "active",
      lastFeedback: safeText(savedLife.lastFeedback)
    } : null;
    let screen = ["start", "game", "ending", "archive"].includes(saved.screen) ? saved.screen : "start";
    if ((screen === "game" || screen === "ending") && !currentLife) screen = "start";
    if (screen === "archive" && !world.history.length) screen = "start";
    return { ...fresh, ...saved, version: SAVE_VERSION, screen, world, settings: { ...fresh.settings, ...(saved.settings || {}) }, currentLife };
  }

  function persist(message) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("#save-status").textContent = "已保存到本地";
      if (message) showToast(message);
      return true;
    } catch (error) {
      $("#save-status").textContent = "仅保留在当前页面";
      showToast("本地存档暂不可用，当前页面仍可继续");
      return false;
    }
  }

  function clearStoredSaves() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("echo-town-mvp-v1");
      return true;
    } catch (error) {
      return false;
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }

  function exportSave() {
    try {
      const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "echo-town-save.json";
      link.click();
      URL.revokeObjectURL(url);
      showToast("存档已导出");
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
        if (!isSavePayload(imported)) throw new Error("invalid save");
        const nextState = normalizeState(imported);
        state = nextState;
        persist("存档已导入");
        render();
      } catch (error) {
        showToast("存档格式不正确，未做修改");
      }
    };
    reader.onerror = () => showToast("存档读取失败，未做修改");
    reader.readAsText(file);
  }

  function createLife(planKey = "witness") {
    const plan = LIFE_PLANS[planKey] || LIFE_PLANS.witness;
    const generation = state.world.completedLives + 1;
    return {
      generation,
      stage: 0,
      seed: makeLifeSeed(generation, state.world.history.length),
      stats: { health: 3, coins: 2, courage: 1, bond: 0, craft: 0, insight: 0, ...plan.bonus },
      planKey,
      intent: plan.label,
      choices: [],
      choiceLabels: [],
      echoes: [],
      relics: [],
      discoveries: [],
      status: "active"
    };
  }

  function getTownText(key) {
    const town = TOWN_LABELS[key];
    return town.values[Math.max(0, Math.min(town.values.length - 1, Number(state.world[key]) || 0))];
  }

  function townSnapshot() {
    return Object.keys(TOWN_LABELS).map((key) => ({
      key,
      label: TOWN_LABELS[key].label,
      value: getTownText(key),
      changed: Number(state.world[key]) > 0
    }));
  }

  function peopleSnapshot() {
    return Object.keys(PEOPLE_LABELS).map((key) => ({
      key,
      label: PEOPLE_LABELS[key].label,
      value: PEOPLE_LABELS[key].values[Math.max(0, Math.min(3, Number(state.world.people?.[key]) || 0))],
      changed: Number(state.world.people?.[key]) > 0
    }));
  }

  function choice(id, label, detail, impact, apply, feedback) {
    return { id, label, detail, impact, apply, feedback };
  }

  function addWorld(key, amount = 1) {
    if (!(key in TOWN_LABELS)) return;
    state.world[key] = clampInteger((state.world[key] || 0) + amount, 0, TOWN_LABELS[key].values.length - 1, 0);
  }

  function addPerson(key, amount = 1) {
    if (!(key in PEOPLE_LABELS)) return;
    state.world.people[key] = clampInteger((state.world.people[key] || 0) + amount, 0, 3, 0);
  }

  function addRelic(life, relic) {
    if (!life.relics.includes(relic)) life.relics.push(relic);
    if (!state.world.relics.includes(relic)) state.world.relics.push(relic);
  }

  function addDiscovery(life, discovery) {
    if (!life.discoveries.includes(discovery)) life.discoveries.push(discovery);
    if (!state.world.discoveries.includes(discovery)) state.world.discoveries.push(discovery);
  }

  function trackChoice(life, selected) {
    const people = {
      "kite-share": ["ahe", 1], "secret-keep": ["ahe", 1], "flood-people": ["children", 1],
      "school-read": ["lin", 1], "shop-teach": ["qishu", 1], "shop-record": ["lin", 1],
      "radio-teach": ["children", 1], "mail-answer": ["ahe", 1], "window-teach": ["children", 1],
      "last-hand": ["children", 1]
    };
    const record = people[selected.id];
    if (record) addPerson(record[0], record[1]);
    if (["school-read", "secret-report", "bridge-map", "flood-ledger", "ledger-open", "radio-archive", "window-catalogue", "last-book"].includes(selected.id)) {
      life.stats.insight += 1;
    }
    if (["bridge-fund", "bridge-shop", "shop-teach", "radio-teach", "window-teach", "last-hand"].includes(selected.id)) {
      life.stats.craft += 1;
    }
  }

  function getEvents() {
    const bridgeOpen = state.world.bridge > 0;
    const riverWatched = state.world.river > 0;
    const hasKey = state.world.relics.includes("铜钥匙");

    return [
      {
        age: "7岁",
        place: "南岸·河边",
        chapter: "第一章 · 风筝",
        title: "河对岸有个孩子，捡到了你的风筝。",
        copy: bridgeOpen
          ? "桥面还留着上一代人补过的钉子。那孩子站在对岸，手里攥着风筝线，喊你的名字——你明明从没见过他。"
          : "桥板缺了一角。河水把风筝线拖得笔直，另一个孩子站在对岸，等你决定要不要过去。",
        choices: [
          choice("kite-share", "把风筝线分给他一半", "你们得一起拉住它。", "+牵挂  +信任", (life) => { life.stats.bond += 1; state.world.trust += 1; life.echoes.push("有人记住了你愿意分一半风筝线。"); }, "你们把风筝收回来时，线已经缠成一团。那个孩子说，他叫阿禾。后来他总会替你留一盏灯。"),
          choice("kite-sell", "把风筝卖给杂货铺", "有钱就能买新的，也能买一顿热饭。", "+积蓄  +1", (life) => { life.stats.coins += 1; life.echoes.push("杂货铺的铜铃记住了你的第一笔买卖。"); }, "杂货铺多了一枚铜铃。你拿到钱，却发现阿禾已经一个人把风筝捡回来了。"),
          choice("kite-cross", "踩着剩下的桥板过去", "桥在晃，河水在涨。", "−身体  +胆量", (life) => { life.stats.health -= 1; life.stats.courage += 1; state.world.bridge += 1; life.echoes.push("你踩过了那块没人敢踩的桥板。"); }, "你在水里摔了一跤，还是把风筝递了过去。阿禾没有道谢，只是把你拉上岸。")
        ]
      },
      {
        age: "12岁",
        place: "北街·空教室",
        chapter: "第二章 · 借来的书",
        title: "停课的那天，老师把镇志的钥匙交给了你。",
        copy: state.world.archive > 0
          ? "你已经知道镇志不是一本书，而是一种把人留在原地的办法。老师说，北街的孩子们需要有人读给他们听。"
          : "窗外有人在搬走课桌。老师把一把旧钥匙放进你手里，说里面的名字比课本更容易被忘掉。",
        choices: [
          choice("school-read", "把镇志读给留下的孩子听", "一页不一定能改变什么，但能让一个名字多活一天。", "+镇志  +牵挂", (life) => { state.world.archive += 1; life.stats.bond += 1; life.echoes.push("空教室里有人听完了一页镇志。"); }, "你读得很慢。读到最后，孩子们已经记住了那条被涂黑的支流。"),
          choice("school-leave", "用钥匙打开后门，去外地读书", "你想知道镇外的河是不是也这样记事。", "+胆量  −牵挂", (life) => { life.stats.courage += 1; life.stats.bond -= 1; life.echoes.push("一把钥匙换来了一张离镇的车票。"); }, "你确实去了外地。多年后回来时，镇上的人还记得你借走的那本书。"),
          choice("school-sell", "把钥匙卖给收废品的人", "家里缺煤，明天也要吃饭。", "+积蓄  −镇志", (life) => { life.stats.coins += 1; state.world.trust += 1; life.echoes.push("旧钥匙没有进镇志，进了收废站。"); }, "钥匙的价钱只够买几天煤。你没有后悔，只是后来再也没人打开那扇门。")
        ]
      },
      {
        age: "16岁",
        place: "桥脚·旧仓房",
        chapter: "第二章 · 秘密",
        title: "阿禾说，桥墩里藏着一页不该消失的账。",
        copy: riverWatched
          ? "巡河的人已经把水位线刻在石头上。阿禾把一张发潮的纸塞给你：上面写着有人把上游的闸门卖过一次。"
          : "水位线比去年高了一掌。纸页发潮，墨水像被人用手指抹过，只有一个日期还认得出来。",
        choices: [
          choice("secret-keep", "先替阿禾把账藏好", "信任不是证据，但能让证据活得久一点。", "+牵挂  +胆量", (life) => { life.stats.bond += 1; life.stats.courage += 1; state.world.archive += 1; life.echoes.push("一页湿账被藏在砖缝里。"); }, "你把账藏进桥墩，和阿禾约好十年后再看。秘密没有消失，只是多等了一会儿。"),
          choice("secret-report", "把账交给巡河队", "让大人们先知道水闸的事。", "+镇志  −牵挂", (life) => { state.world.river += 1; state.world.archive += 1; life.stats.bond -= 1; life.echoes.push("巡河队第一次认真看了上游的水闸。"); }, "巡河队封了闸，却没有问账从哪里来。阿禾从那天起不再叫你的名字。"),
          choice("secret-burn", "烧掉它，劝阿禾离开镇子", "有些证据只会让留下的人更危险。", "+胆量  −积蓄", (life) => { life.stats.courage += 1; life.stats.coins -= 1; state.world.trust += 1; life.echoes.push("一页账化成灰，换来一张去外地的车票。"); }, "纸烧得很快。阿禾走了，镇上的人开始在夜里互相留灯——没人说原因。")
        ]
      },
      {
        age: "28岁",
        place: "东街·修理铺",
        chapter: "第三章 · 钉子",
        title: "雨季又到了，镇上需要有人把桥修好。",
        copy: hasKey
          ? "你从上一世留下的旧盒子里摸到一把铜钥匙。它打开修理铺后门，也打开祁叔留下的工具柜。"
          : "祁叔把一串生锈的工具放在桌上，说修桥不难，难的是修好以后还要有人愿意走过去。",
        choices: [
          choice("bridge-fund", "拿出积蓄，先把桥面补起来", "今天少吃一顿，明天就多一条路。", "−积蓄  +河桥", (life) => { life.stats.coins -= 2; state.world.bridge += 1; state.world.trust += 1; life.echoes.push("桥面多了三块新木板。"); }, "新木板有松木的气味。第一位过桥的人不是镇长，是一个拎着菜篮子的老人。"),
          choice("bridge-shop", "开一间修理铺，慢慢攒钱", "留下来的人，先要有地方修好自己的东西。", "+积蓄  +镇志", (life) => { life.stats.coins += 1; state.world.archive += 1; if (!state.world.relics.includes("铜钥匙")) state.world.relics.push("铜钥匙"); life.echoes.push("修理铺的门口挂上了铜钥匙。"); }, "你没有立刻修桥，但东街开始有了一个会亮灯的窗口。人们拿坏掉的钟来，也拿没说完的话来。"),
          choice("bridge-map", "把旧地图交给镇公所", "先搞清楚谁在桥下、谁在上游。", "+胆量  +河水", (life) => { life.stats.courage += 1; state.world.river += 1; state.world.archive += 1; life.echoes.push("一张旧地图被钉进镇公所的墙。"); }, "地图上有一条被涂黑的支流。镇公所第一次承认，水不是从天上凭空来的。")
        ]
      },
      {
        age: "36岁",
        place: "东街·修理铺",
        chapter: "第五章 · 接手",
        title: "修理铺的灯每天比你早醒。",
        copy: state.world.trust > 1
          ? "来找你的人越来越多。他们不只带来坏掉的钟，也带来关于上游和桥的不同说法。"
          : "你把门推开，灰尘落在柜台上。祁叔留下的工具还能用，只是没有人告诉你该修什么。",
        choices: [
          choice("shop-teach", "把工具交给一个年轻人", "会修东西的人不该只有一个。", "+信任  +牵挂", (life) => { state.world.trust += 1; life.stats.bond += 1; life.echoes.push("修理铺有了第二双会用工具的手。"); }, "他学会了先问清楚再动手。很多年后，他会把这句话写进给孩子的作业本。"),
          choice("shop-river", "关门三天，去上游看水位", "修理铺可以晚开，河水不会等人。", "−积蓄  +河水", (life) => { life.stats.coins -= 1; state.world.river += 1; life.echoes.push("修理铺熄灯三天，河水多了一条记录。"); }, "你在上游看见闸门上的新锁。回来时，门口有人等着修一只停住的钟。"),
          choice("shop-record", "把每一件来修的东西记进镇志", "物件比传闻更会说实话。", "+镇志  −积蓄", (life) => { state.world.archive += 1; life.stats.coins -= 1; life.echoes.push("修理铺的物件开始有了编号。"); }, "你给每一件东西编号，给每一个来的人留一行空白。镇志因此变得越来越像一个家。")
        ]
      },
      {
        age: "45岁",
        place: "南岸·暴雨夜",
        chapter: "第四章 · 水位",
        title: "暴雨把仓房的门顶住了，里面还有人。",
        copy: bridgeOpen
          ? "桥面在雨里发白。你听见对岸有人敲门，镇上的人已经在广场集合，却没人知道该先救谁。"
          : "水漫过第一块石阶。你手里只有一盏灯，身后是挤在一起的邻居，前面是越来越响的河。",
        choices: [
          choice("flood-ledger", "先救出仓房里的账本", "一页页纸，记着许多人的名字。", "−身体  +镇志", (life) => { life.stats.health -= 1; state.world.archive += 1; life.echoes.push("被水泡软的账本保住了名字。"); }, "你抱着账本游回来。有人嫌你傻，但第二天每一户人家都来问：我的名字还在吗？"),
          choice("flood-people", "挨家挨户敲门，先把人带到高处", "今晚的记录可以没有，活人不能没有。", "−身体  +信任", (life) => { life.stats.health -= 1; state.world.trust += 2; life.echoes.push("那一夜，镇上每扇门都被敲响。"); }, "你敲到最后一扇门时，阿禾的后人把灯递给你。那盏灯一直亮到天亮。"),
          choice("flood-gate", hasKey ? "用铜钥匙打开旧水闸" : "沿着地图去找旧水闸", hasKey ? "钥匙转动时，整座镇子都在听。" : "也许地图没有骗你。", "−胆量  +河水", (life) => { life.stats.courage -= 1; state.world.river += 1; state.world.bridge += 1; life.echoes.push("旧水闸被重新打开，河水终于退了。"); }, hasKey ? "铜钥匙卡了一下，闸门还是开了。河水退去时，桥下露出一行刻字：别把名字忘了。" : "你没有找到钥匙，只找到了开闸的办法。河水退去一些，镇上的人第一次看见桥墩底下的刻字。")
        ]
      },
      {
        age: "52岁",
        place: "镇公所·后室",
        chapter: "第六章 · 账页",
        title: "雨季过后，账本在水痕里翻到最后一页。",
        copy: state.world.archive > 1
          ? "名字、日期、闸门和桥都已经有了记录。没有人愿意承认自己在旧账里，但所有人都来问下一页写什么。"
          : "账本的边角粘在一起。你辨认出一个熟悉的日期，也辨认出有人把它撕掉了一半。",
        choices: [
          choice("ledger-open", "把账页贴回去，公开念完", "让镇上的人听见自己的名字。", "+镇志  +信任", (life) => { state.world.archive += 1; state.world.trust += 1; life.echoes.push("最后一页账被贴回了镇志。"); }, "有人中途离开，有人留下来听。念完以后，镇公所的窗第一次没有关上。"),
          choice("ledger-protect", "把最危险的名字留在自己手里", "有些真相需要一个人先替它活着。", "+胆量  +遗物", (life) => { life.stats.courage += 1; if (!state.world.relics.includes("湿账页")) state.world.relics.push("湿账页"); life.echoes.push("一张湿账页被你收进旧盒子。"); }, "你没有公开那几个名字。旧盒子被放在修理铺最里面，等下一双手判断该不该打开。"),
          choice("ledger-trade", "拿账页换一批修桥木料", "如果路能走通，迟早会有人问起路从哪里来。", "+河桥  −镇志", (life) => { state.world.bridge += 1; life.stats.coins += 1; life.echoes.push("一页账换来一车桥木。"); }, "木料先到了。那一页账没有消失，只是被你藏进了桥下更干燥的地方。")
        ]
      },
      {
        age: "67岁",
        place: "广场·晚钟",
        chapter: "第五章 · 名字",
        title: "钟响了。你终于知道该把哪一件事交给下一世。",
        copy: state.world.archive > 1
          ? "镇志已经摞到窗边。有人把你小时候的风筝画在最后一页，墨迹旁边写着阿禾的名字。"
          : "广场的钟慢了半拍。镇上的人等着你说点什么，但这一生真正重要的事，从来没有一句合适的总结。",
        choices: [
          choice("bell-name", "在广场讲出那年的名字", "让一件事从秘密变成共同记忆。", "+镇志  +牵挂", (life) => { state.world.archive += 1; life.stats.bond += 1; state.world.trust += 1; life.echoes.push("阿禾的名字被写进晚钟声里。"); }, "你只说了一个名字：阿禾。镇上的人没有鼓掌，但第二天，桥边多了一块新的木牌。"),
          choice("bell-key", "把铜钥匙交给一个孩子", "工具总要有下一双手来接。", "+河桥  +遗物", (life) => { if (!state.world.relics.includes("铜钥匙")) state.world.relics.push("铜钥匙"); state.world.bridge += 1; life.echoes.push("铜钥匙交到一个孩子手里。"); }, "孩子问它能开什么。你说，先拿去开一扇卡住的门。至于门后是什么，等他自己长大。"),
          choice("bell-walk", "独自再走一次桥", "不解释，也不回头。", "+胆量  +河桥", (life) => { life.stats.courage += 1; state.world.bridge += 1; life.echoes.push("你最后一次走过了桥。"); }, "桥还是会晃，但每一块木板都认得你的脚。你走到对岸时，河水正好把月亮还给了镇子。")
        ]
      },
      {
        age: "60岁",
        place: "北街·广播室",
        chapter: "第七章 · 声音",
        title: "停电以后，镇上只剩一台还能说话的收音机。",
        copy: state.world.archive > 1
          ? "你把镇志里那些没有被念完的名字抄到纸带上。广播室的窗外，越来越多的人停下来听。"
          : "收音机里只有沙沙声。林老师说，如果有人把镇上的事情讲清楚，远处的人也许会愿意听见。",
        choices: [
          choice("radio-archive", "把镇上的名字录进纸带", "让声音替纸页走得更远。", "+洞察  +镇志  +灯火", (life) => { life.stats.insight += 1; addWorld("archive"); addWorld("light"); addPerson("lin"); addDiscovery(life, "未被抹去的名字"); life.echoes.push("一卷纸带替镇上的名字越过了夜色。"); }, "你没有讲大道理，只读名字、日期和一条河的去向。第二天，镇外有人寄来一封问桥的信。"),
          choice("radio-river", "把水位和闸门的变化播出去", "事实先于传说，听见的人才能做决定。", "+胆量  +河水  +信任", (life) => { life.stats.courage += 1; addWorld("river"); addWorld("trust"); addDiscovery(life, "上游水位图"); life.echoes.push("水位第一次在广播里被准确说出。"); }, "广播没有让雨停下来，却让每一户人家知道该把什么搬到高处。"),
          choice("radio-teach", "拆开收音机，教孩子们修好它", "会发声的东西，也应该能被下一双手修好。", "+手艺  +手艺传承  +遗物", (life) => { life.stats.craft += 1; addWorld("workshop"); addPerson("children"); addRelic(life, "短波收音机"); life.echoes.push("短波收音机被交给了孩子们。"); }, "第一台收音机没能立刻说话。孩子们把零件排成一行，终于听见自己的笑声从喇叭里回来。")
        ]
      },
      {
        age: "74岁",
        place: "南岸·邮筒旁",
        chapter: "第九章 · 来信",
        title: "阿禾从镇外寄来一封信，问你桥边还亮不亮。",
        copy: state.world.people.ahe > 1
          ? "信纸上没有近况，只有一句：如果桥还在，我就知道自己不是白走。"
          : "邮差把信放下就走了。你认出那种把句子写得很短的口气，像小时候的阿禾。",
        choices: [
          choice("mail-answer", "把镇上的近况一件件写回去", "让离开的人知道，留下也不是一场沉默。", "+牵挂  +灯火", (life) => { life.stats.bond += 1; addWorld("light"); addPerson("ahe"); addDiscovery(life, "阿禾的来信"); life.echoes.push("你给阿禾写回了桥、雨和一盏灯。"); }, "你写了很久，写到最后只剩一句：桥还在，名字也还在。"),
          choice("mail-invite", "请她回来，和镇上的人一起修桥", "有些路不能只靠一个人的记忆维持。", "+信任  +河桥  +牵挂", (life) => { addWorld("trust"); addWorld("bridge"); life.stats.bond += 1; addPerson("ahe"); life.echoes.push("一封回信把两岸重新放在同一张地图上。"); }, "阿禾没有立刻回来，但她寄来一张桥的旧图。图背面写着：我记得怎么走。"),
          choice("mail-fold", "把信夹进镇志，不再追问", "有些人离开，是为了让后来的人有更多选择。", "+镇志  +洞察", (life) => { addWorld("archive"); life.stats.insight += 1; addDiscovery(life, "没有寄出的答案"); life.echoes.push("那封信被夹进镇志最后一页。"); }, "你没有替阿禾决定要不要回来。你只把她的字留下，让下一代知道，离开也曾经是一种照看。")
        ]
      },
      {
        age: "82岁",
        place: "东街·失物窗口",
        chapter: "第十章 · 交接",
        title: "修理铺的窗台上，堆满了没人来认领的东西。",
        copy: state.world.workshop > 1
          ? "年轻人把每件物品擦干净、编号、拍下它原来的样子。他们等你决定：东西该回到谁手里。"
          : "一只坏钟、一把缺齿的钥匙和一盏没有灯芯的灯，被雨水推到了门口。",
        choices: [
          choice("window-teach", "把窗口交给年轻人管理", "你可以留下方法，不必留下位置。", "+手艺  +信任", (life) => { addWorld("workshop"); addWorld("trust"); addPerson("qishu"); addPerson("children"); life.stats.craft += 1; life.echoes.push("失物窗口有了新的值班表。"); }, "他们争论了很久，最后决定每件东西都要先问一句：你想把它交给谁？"),
          choice("window-catalogue", "把每件失物写进镇志", "物品的来处，也是一个人的来处。", "+洞察  +镇志", (life) => { addWorld("archive"); life.stats.insight += 1; addDiscovery(life, "失物清单"); life.echoes.push("失物清单成为镇志最厚的一页。"); }, "你写下钟的主人、钥匙的门和灯曾经照过的人。有人看完清单，终于认出自己丢掉的不是东西。"),
          choice("window-home", "把能修的东西带回家", "在最后的几年里，先把手边的灯点起来。", "+身体  +灯火  +牵挂", (life) => { life.stats.health -= 1; addWorld("light"); life.stats.bond += 1; life.echoes.push("你把三件失物修好，放回了三扇窗前。"); }, "那天晚上，三扇窗同时亮起。镇上没有庆祝，只是有人在门外放了一碗热汤。")
        ]
      },
      {
        age: "96岁",
        place: "河桥·最后一班船",
        chapter: "终章 · 交给下一世",
        title: "最后一班船等在桥下，而镇志还空着一页。",
        copy: state.world.trust > 2
          ? "桥两边站着许多人。没有人催你写结论，他们只想知道你准备把哪一件事交给下一双手。"
          : "河面很安静。你知道这一页写完以后，故事不会结束，只是不会再由你亲自解释。",
        choices: [
          choice("last-hand", "把工具和方法交给孩子们", "让下一世接到的不是答案，而是继续做事的能力。", "+手艺  +灯火  +交接", (life) => { life.stats.craft += 1; addWorld("workshop"); addWorld("light"); addPerson("children"); addRelic(life, "修桥工具箱"); life.echoes.push("修桥工具箱在孩子们手里重新响起来。"); }, "你把工具一件件放下，孩子们一件件接住。桥下的船没有等你解释，它只等下一双手。"),
          choice("last-book", "把最后一页写成一份完整镇志", "让后来的人少走一点弯路，也保留他们改写的余地。", "+洞察  +镇志  +河水", (life) => { life.stats.insight += 1; addWorld("archive"); addWorld("river"); addRelic(life, "完整镇志"); life.echoes.push("最后一页把桥、河和每个名字放在一起。"); }, "你没有写自己是对的。你只写下谁曾经做过什么，以及下一页可以从哪里开始。"),
          choice("last-boat", "坐上船，去看看镇外的河", "离开不是抹掉，而是把一座镇放进更大的水系。", "+胆量  +远方", (life) => { life.stats.courage += 1; addWorld("river"); addWorld("bridge"); addRelic(life, "船票"); life.echoes.push("一张旧船票把回声带到了镇外。"); }, "船离岸以后，你回头看见桥头的灯。它没有因为你离开而熄灭。")
        ]
      }
    ].sort((left, right) => Number.parseInt(left.age, 10) - Number.parseInt(right.age, 10));
  }

  function clamp(value, min, max) {
    return clampInteger(value, min, max, min);
  }

  function applyChoice(index) {
    const life = state.currentLife;
    const event = getEvents()[life.stage];
    const selected = event.choices[index];
    if (!selected || life.choices.length > life.stage) return;
    selected.apply(life);
    trackChoice(life, selected);
    life.stats.health = clamp(life.stats.health, 0, MAX_STAT.health);
    life.stats.coins = clamp(life.stats.coins, 0, MAX_STAT.coins);
    life.stats.courage = clamp(life.stats.courage, 0, MAX_STAT.courage);
    life.stats.bond = clamp(life.stats.bond, 0, MAX_STAT.bond);
    life.stats.craft = clamp(life.stats.craft, 0, MAX_STAT.craft);
    life.stats.insight = clamp(life.stats.insight, 0, MAX_STAT.insight);
    Object.keys(TOWN_LABELS).forEach((key) => {
      state.world[key] = clamp(state.world[key], 0, TOWN_LABELS[key].values.length - 1);
    });
    Object.keys(PEOPLE_LABELS).forEach((key) => {
      state.world.people[key] = clamp(state.world.people[key], 0, 3);
    });
    life.choices.push(selected.id);
    life.choiceLabels.push(selected.label);
    life.lastFeedback = selected.feedback;
    persist("这一页已保存");
    renderGame(true);
    setTimeout(() => $("[data-action='next-stage']")?.focus(), 30);
  }

  function startLife(planKey = "witness") {
    state.currentLife = createLife(planKey);
    state.screen = "game";
    persist("第一世开始了");
    render();
    setTimeout(() => $("[data-choice]")?.focus(), 30);
  }

  function goToNextStage() {
    const life = state.currentLife;
    if (!life || life.choices.length <= life.stage) return;
    if (life.stage >= MAX_STAGES - 1) {
      finishLife();
      return;
    }
    life.stage += 1;
    persist();
    renderGame(false);
    setTimeout(() => $("[data-choice]")?.focus(), 30);
  }

  function finishLife() {
    const life = state.currentLife;
    if (!life || life.status === "complete") return;
    life.status = "complete";
    state.world.completedLives += 1;
    const ending = getEnding(life);
    const finalEcho = life.echoes[life.echoes.length - 1] || "你没有留下物件，但留下了一个可以被重新问起的问题。";
    state.world.echoes = [...state.world.echoes, ...life.echoes].slice(-24);
    state.world.lastEcho = finalEcho;
    state.world.history = [...(state.world.history || []), {
      generation: life.generation,
      choices: [...(life.choiceLabels || [])],
      echoes: [...life.echoes].slice(-5),
      relics: [...new Set([...(state.world.relics || []), ...(life.relics || [])])],
      discoveries: [...new Set([...(life.discoveries || []), ...(state.world.discoveries || [])])].slice(-8),
      endingKey: ending.key,
      endingTitle: ending.title,
      planKey: life.planKey,
      planLabel: LIFE_PLANS[life.planKey]?.label || life.intent,
      people: { ...state.world.people },
      town: townSnapshot(),
      verdict: ending.verdict
    }].slice(-20);
    state.screen = "ending";
    persist("这一生已封存");
    render();
    setTimeout(() => $("[data-action='next-life']")?.focus(), 30);
  }

  function render() {
    document.body.classList.toggle("font-large", state.settings.fontScale === "large");
    const fontToggle = $("#font-toggle");
    if (fontToggle) {
      const large = state.settings.fontScale === "large";
      fontToggle.textContent = large ? "普通字号" : "大字模式";
      fontToggle.setAttribute("aria-pressed", String(large));
    }
    $("#screen-start").classList.toggle("is-hidden", state.screen !== "start");
    $("#screen-game").classList.toggle("is-hidden", state.screen !== "game");
    $("#screen-ending").classList.toggle("is-hidden", state.screen !== "ending");
    $("#screen-archive").classList.toggle("is-hidden", state.screen !== "archive");
    renderStart();
    if (state.screen === "game") renderGame(Boolean(state.currentLife && state.currentLife.choices.length > state.currentLife.stage));
    if (state.screen === "ending") renderEnding();
    if (state.screen === "archive") renderArchive();
  }

  function renderStart() {
    const hasActive = state.currentLife?.status === "active";
    $("[data-action='start-life']").textContent = state.world.completedLives ? "再开一世 →" : "开始第一世 →";
    $("[data-action='continue-life']").classList.toggle("is-hidden", !hasActive);
    $("#generation-label").textContent = state.world.completedLives ? `已经走过 ${state.world.completedLives} 世` : "还没有人写下第一行";
    $("#start-echo").textContent = state.world.lastEcho;
    $("#start-town").innerHTML = townSnapshot().slice(0, 3).map((item) => `<div class="town-mini-item"><span>${item.label}</span><strong>${item.value}</strong></div>`).join("");
    $("[data-action='view-archive']").classList.toggle("is-hidden", !(state.world.history || []).length);
  }

  function renderGame(hasFeedback) {
    const life = state.currentLife;
    const event = getEvents()[life.stage];
    const feedbackVisible = hasFeedback || life.choices.length > life.stage;
    $("#life-label").textContent = `第 ${life.generation} 世`;
    $("#stage-label").textContent = event.chapter;
    $("#event-age").textContent = event.age;
    $("#event-place").textContent = event.place;
    $("#event-title").textContent = event.title;
    $("#event-copy").textContent = event.copy;
    const progress = $("#life-progress");
    progress.setAttribute("aria-valuenow", String(life.stage + 1));
    progress.innerHTML = Array.from({ length: MAX_STAGES }, (_, index) => `<span class="${index < life.stage ? "is-done" : ""} ${index === life.stage ? "is-current" : ""}"></span>`).join("");
    const legacy = $("#legacy-banner");
    const hasLegacy = life.generation > 1;
    legacy.classList.toggle("is-hidden", !hasLegacy);
    if (hasLegacy) legacy.textContent = `上一世留下的东西正在这里起作用：${state.world.lastEcho}`;
    $("#choices").innerHTML = event.choices.map((item, index) => `<button class="choice" type="button" data-choice="${index}" aria-label="${item.label}。${item.detail}" ${feedbackVisible ? "disabled" : ""}><span class="choice-key">${index + 1}</span><span class="choice-copy"><span class="choice-label">${item.label}</span><span class="choice-detail">${item.detail}</span></span><span class="choice-impact">${item.impact}</span></button>`).join("");
    $("#feedback").classList.toggle("is-hidden", !feedbackVisible);
    if (feedbackVisible) {
      $("#feedback-copy").textContent = life.lastFeedback;
      $("#feedback-changes").innerHTML = life.echoes.slice(-2).map((echo) => `<span class="change-chip">${escapeHtml(echo)}</span>`).join("");
      $("[data-action='next-stage']").textContent = life.stage >= MAX_STAGES - 1 ? "封存这一生 →" : "翻到下一页 →";
    }
    const plan = LIFE_PLANS[life.planKey];
    $("#life-intent").textContent = plan
      ? `今生方向：${plan.label}。${life.choices.length ? `第一步从“${life.choiceLabels[0]}”开始。` : plan.detail}`
      : "这一世还没有决定要留下什么。";
    renderStats(life);
    renderTown();
    renderPeople();
    renderRelics(life);
  }

  function renderStats(life) {
    $("#stat-health").textContent = `${life.stats.health} / ${MAX_STAT.health}`;
    $("#stat-coins").textContent = String(life.stats.coins);
    $("#stat-courage").textContent = String(life.stats.courage);
    $("#stat-bond").textContent = String(life.stats.bond);
    $("#stat-craft").textContent = String(life.stats.craft);
    $("#stat-insight").textContent = String(life.stats.insight);
    $("#meter-health").style.transform = `scaleX(${life.stats.health / MAX_STAT.health})`;
    $("#meter-coins").style.transform = `scaleX(${life.stats.coins / MAX_STAT.coins})`;
    $("#meter-courage").style.transform = `scaleX(${life.stats.courage / MAX_STAT.courage})`;
    $("#meter-bond").style.transform = `scaleX(${life.stats.bond / MAX_STAT.bond})`;
    $("#meter-craft").style.transform = `scaleX(${life.stats.craft / MAX_STAT.craft})`;
    $("#meter-insight").style.transform = `scaleX(${life.stats.insight / MAX_STAT.insight})`;
    const meters = [
      ["#meter-health", life.stats.health, MAX_STAT.health],
      ["#meter-coins", life.stats.coins, MAX_STAT.coins],
      ["#meter-courage", life.stats.courage, MAX_STAT.courage],
      ["#meter-bond", life.stats.bond, MAX_STAT.bond],
      ["#meter-craft", life.stats.craft, MAX_STAT.craft],
      ["#meter-insight", life.stats.insight, MAX_STAT.insight]
    ];
    meters.forEach(([selector, value, maximum]) => {
      const meter = $(selector)?.parentElement;
      if (!meter) return;
      meter.setAttribute("aria-valuenow", String(value));
      meter.setAttribute("aria-valuemax", String(maximum));
    });
  }

  function renderTown() {
    $("#town-year").textContent = state.world.completedLives ? `第 ${state.world.completedLives} 世后` : "第一行还没写下";
    $("#town-state").innerHTML = townSnapshot().map((item) => `<div class="town-state-row"><span>${item.label}</span><strong class="${item.changed ? "is-changed" : ""}">${item.value}</strong></div>`).join("");
  }

  function renderPeople() {
    $("#people-state").innerHTML = peopleSnapshot().map((item) => `<div class="people-state-row"><span>${escapeHtml(item.label)}</span><strong class="${item.changed ? "is-changed" : ""}">${escapeHtml(item.value)}</strong></div>`).join("");
  }

  function renderRelics(life) {
    const relics = [...new Set([...(state.world.relics || []), ...(life.relics || [])])];
    $("#relic-count").textContent = `${relics.length} 件`;
    $("#relics").innerHTML = relics.length ? relics.map((relic) => `<span class="relic">${escapeHtml(relic)}</span>`).join("") : `<span class="relic-empty">这一世还没有可交给下一世的物件。</span>`;
  }

  function renderEnding() {
    const life = state.currentLife;
    const ending = getEnding(life);
    $("#ending-title").textContent = ending.title;
    $("#ending-copy").textContent = `这是你的第 ${life.generation} 世。你在 96 岁这天把最后一页交还给了回声镇，下一世会从这里开始。`;
    $("#ending-stats").innerHTML = `<div class="ending-stat"><strong>${life.stats.bond}</strong><span>牵挂</span></div><div class="ending-stat"><strong>${life.stats.courage}</strong><span>胆量</span></div><div class="ending-stat"><strong>${life.stats.insight}</strong><span>洞察</span></div><div class="ending-stat"><strong>${life.echoes.length}</strong><span>留下的回声</span></div>`;
    $("#ending-verdict").textContent = ending.verdict;
    const echoes = life.echoes.length ? life.echoes.slice(-5) : ["你没有留下物件，但留下了一个可以被重新问起的问题。"];
    $("#echo-list").innerHTML = echoes.map((echo) => `<div class="echo-item"><span class="echo-mark" aria-hidden="true">✦</span><span>${escapeHtml(echo)}</span></div>`).join("");
  }

  function getEnding(life) {
    const stats = life.stats;
    const world = state.world;
    if (world.bridge >= 3 && world.river >= 3 && world.trust >= 3) {
      return { key: "river-return", title: "河床归位", verdict: "你没有命令河水改变方向。你只是让足够多的人一起看见它，于是两岸重新有了来往。" };
    }
    if (world.archive >= 3 && world.people.lin >= 2 && stats.insight >= 4) {
      return { key: "names-remain", title: "名字留下", verdict: "你把容易被删掉的名字写回了镇志。后来的人不一定同意你，但他们知道自己从哪里来。" };
    }
    if (world.workshop >= 3 && world.people.children >= 2 && stats.craft >= 4) {
      return { key: "hands-continue", title: "手艺传下去", verdict: "你留下的不是一件完美的工具，而是一种愿意把工具交出去的习惯。" };
    }
    if (world.light >= 3 && world.people.ahe >= 2 && stats.bond >= 4) {
      return { key: "lights-answer", title: "灯火有回信", verdict: "你没有把所有人留在身边，却让离开和留下之间有了一盏可以辨认的灯。" };
    }
    return { key: "unfinished-page", title: "一页未完", verdict: "你这一生没有轰轰烈烈，却把一件小事做到最后。小镇会从那里继续。" };
  }

  function getVerdict(stats) {
    return getEnding({ stats }).verdict;
  }

  function renderArchive() {
    const history = [...(state.world.history || [])].reverse();
    $("#archive-life-count").textContent = `${state.world.completedLives} 世`;
    $("#archive-town").innerHTML = townSnapshot().map((item) => `<div class="town-state-row"><span>${item.label}</span><strong class="${item.changed ? "is-changed" : ""}">${item.value}</strong></div>`).join("");
    $("#archive-timeline").innerHTML = history.length ? history.map((entry) => {
      const choices = (entry.choices || []).slice(0, 4).map((item) => `<span class="archive-entry-tag">${escapeHtml(item)}</span>`).join("");
      const echo = escapeHtml((entry.echoes || ["这一世没有留下可复述的回声。"]).slice(-1)[0]);
      const verdict = escapeHtml(entry.verdict || "小镇从那里继续。");
      const title = escapeHtml(entry.endingTitle || echo);
      const discoveries = (entry.discoveries || []).slice(-2).map((item) => `<span class="archive-entry-tag">发现：${escapeHtml(item)}</span>`).join("");
      const plan = entry.planLabel ? `<span class="archive-entry-tag">方向：${escapeHtml(entry.planLabel)}</span>` : "";
      return `<article class="archive-entry"><div class="archive-entry-number">第 ${entry.generation} 世</div><div><h2>${title}</h2><p>${verdict}</p><p class="archive-entry-echo">${echo}</p></div><div class="archive-entry-tags">${plan}${choices}${discoveries}</div></article>`;
    }).join("") : `<p class="archive-empty">还没有完整的一生。先走到最后一页，镇志才会开始长出时间。</p>`;
  }

  function handleAction(action, element) {
    if (action === "start-life") {
      const hasActiveLife = state.currentLife?.status === "active";
      if (hasActiveLife && !window.confirm("当前人生还没有封存，开启新一世会放弃这一页进度。确定吗？")) return;
      startLife(element?.dataset.plan || "witness");
    }
    if (action === "continue-life") { state.screen = "game"; render(); }
    if (action === "next-stage") goToNextStage();
    if (action === "next-life") {
      state.screen = "start";
      persist();
      render();
      setTimeout(() => $(".plan-card")?.focus(), 30);
    }
    if (action === "home") { state.screen = "start"; persist(); render(); }
    if (action === "toggle-font") {
      state.settings.fontScale = state.settings.fontScale === "large" ? "normal" : "large";
      persist(state.settings.fontScale === "large" ? "已切换大字模式" : "已恢复普通字号");
      render();
    }
    if (action === "view-archive") { state.screen = "archive"; render(); }
    if (action === "export-save") exportSave();
    if (action === "erase-save") {
      if (window.confirm("确定清除所有人生和小镇记忆吗？此操作无法撤销。")) {
        const cleared = clearStoredSaves();
        state = cloneDefault();
        render();
        showToast(cleared ? "镇志已回到空白页" : "浏览器未允许清除本地存档");
      }
    }
  }

  document.addEventListener("click", (event) => {
    const actionElement = event.target.closest("[data-action]");
    if (actionElement) handleAction(actionElement.dataset.action, actionElement);
    const choiceElement = event.target.closest("[data-choice]");
    if (choiceElement) applyChoice(Number(choiceElement.dataset.choice));
  });

  document.addEventListener("keydown", (event) => {
    if (state.screen !== "game" || state.currentLife?.choices.length > state.currentLife?.stage) return;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < 3) applyChoice(index);
  });

  $("#import-input").addEventListener("change", (event) => {
    importSave(event.target.files[0]);
    event.target.value = "";
  });

  window.addEventListener("beforeunload", () => {
    if (state.currentLife?.status === "active") persist();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  render();
})();
