(function (global) {
  "use strict";
  // Draws only caller-provided, already-derived life records. No remote images,
  // fonts, requests, storage, state mutation or automatic download.
  const WIDTH = 1200;
  const PAD = 88;
  const INK = "#f0e7d2", MUTED = "#b7b3a1", GOLD = "#dfbd79", LINE = "#3a403a";
  const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
  const safe = value => typeof value === "string" ? value : "";
  const list = value => Array.isArray(value) ? value : [];
  function amount(value) { return Number.isFinite(value) ? String(value) : "未记录"; }
  function createCanvas(review, options = {}) {
    if (!review || !Array.isArray(review.choices)) throw new Error("当前没有可导出的人生回顾");
    const owner = options.document || global.document;
    if (!owner?.createElement) throw new Error("当前环境不支持人生卡");
    const canvas = owner.createElement("canvas");
    canvas.width = WIDTH; canvas.height = 2400;
    let ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器未提供画布，文字回顾仍可查看");
    const commands = [];
    let y = PAD;
    function line(copy, size = 30, color = INK, bold = false, x = PAD) {
      commands.push({ type: "text", text: safe(copy), size, color, bold, x, y });
      y += Math.round(size * 1.55);
    }
    function paragraph(copy, size = 30, color = INK, bold = false, indent = 0) {
      ctx.font = `${bold ? "600 " : "400 "}${size}px ${FONT}`;
      const width = WIDTH - PAD * 2 - indent;
      let current = "";
      for (const character of Array.from(safe(copy))) {
        if (character === "\n") { line(current, size, color, bold, PAD + indent); current = ""; continue; }
        if (current && ctx.measureText(current + character).width > width) { line(current, size, color, bold, PAD + indent); current = character; }
        else current += character;
      }
      if (current) line(current, size, color, bold, PAD + indent);
    }
    function divider() { y += 16; commands.push({ type: "line", y }); y += 34; }
    line("回声镇  /  一世留页", 26, GOLD, true);
    y += 18;
    paragraph(review.outcomeTitle || "这一世留下的事", 52, INK, true);
    paragraph(`第 ${amount(review.generation)} 世 · ${amount(review.age)} 岁`, 25, MUTED);
    if (review.challenge) paragraph(`固定起点：${safe(review.challenge.label)} · 规则 ${safe(review.challenge.rulesVersion)}`, 25, GOLD);
    y += 18; paragraph(review.title, 29, MUTED); divider();
    for (const choice of list(review.choices).slice(0, 3)) {
      line(`${amount(choice.age)} 岁`, 26, GOLD, true);
      paragraph(choice.label, 36, INK, true);
      paragraph(choice.result || choice.echo || "当时的选择仍保留在记录中。", 28, INK);
      const status = choice.success === true ? "这次结果已完成" : choice.success === false ? "这次检定未通过" : "旧制经历：不重判结果";
      const costs = list(choice.costs?.lines);
      paragraph(`${status} · ${costs.length ? costs.join("；") : "这次没有现金收支记录"}`, 24, MUTED);
      divider();
    }
    if (review.missing) paragraph(review.missing, 26, MUTED);
    line("结算时仍要承担的部分", 28, GOLD, true);
    const costs = review.costs || {};
    paragraph(`欠款 ${amount(costs.debt)} 元  ·  身体 ${amount(costs.health)}  ·  压力 ${amount(costs.pressure)}`, 30, INK);
    paragraph(`累计收入 ${amount(costs.income)} 元，累计支出 ${amount(costs.expenses)} 元。借款单独记账。`, 25, MUTED);
    if (review.project) {
      const project = review.project;
      paragraph(`接受过的项目：${safe(project.label)}。${project.status === "completed" ? "实际完成" : project.status === "incomplete" ? "期限已到，仍有缺项" : project.status === "withdrawn" ? "已经退出" : "尚未结算"}。`, 25, MUTED);
      paragraph(`已记录投入：${amount(project.costs?.actionPoints)} 行动点，${amount(project.costs?.moneySpent)} 元，${amount(project.costs?.energySpent)} 精力。`, 25, MUTED);
    }
    divider();
    const chosen = review.allowInheritance === false ? [] : list(review.legacies).filter(item => item.selected);
    line(review.allowInheritance === false ? "这场挑战已经留档" : chosen.length ? "准备交给下一世" : "遗产还没有选定", 28, GOLD, true);
    if (review.allowInheritance === false) paragraph("回看真实选择与代价，再决定下一场挑战的不同安排。", 25, MUTED);
    else if (chosen.length) for (const item of chosen) { paragraph(item.label, 30, INK, true); paragraph(item.copy, 25, MUTED); y += 10; }
    else paragraph("回到结算页选定遗产，再导出一张带有下一世选择的人生卡。", 25, MUTED);
    y += 32; commands.push({ type: "line", y }); y += 28;
    paragraph(review.allowInheritance === false ? "来自这场挑战已记录的选择与账本。保存在本机。" : "来自这一世已记录的选择、账本与交接。保存在本机。", 22, MUTED);
    canvas.height = Math.ceil(y + PAD);
    ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器无法完成画布，文字回顾仍可查看");
    ctx.fillStyle = "#101a19"; ctx.fillRect(0, 0, WIDTH, canvas.height);
    ctx.fillStyle = "#182522"; ctx.fillRect(0, 0, 18, canvas.height);
    ctx.fillStyle = GOLD; ctx.fillRect(PAD, 34, 90, 3);
    ctx.textBaseline = "top";
    for (const command of commands) {
      if (command.type === "line") { ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD, command.y); ctx.lineTo(WIDTH - PAD, command.y); ctx.stroke(); }
      else { ctx.font = `${command.bold ? "600 " : "400 "}${command.size}px ${FONT}`; ctx.fillStyle = command.color; ctx.fillText(command.text, command.x, command.y); }
    }
    canvas.setAttribute("aria-label", `第${amount(review.generation)}世人生卡`);
    return canvas;
  }
  function toBlob(canvas) {
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob !== "function") { reject(new Error("当前浏览器不支持 PNG 导出，文字回顾仍可查看")); return; }
      try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("人生卡生成失败，请保留文字回顾后重试")), "image/png"); }
      catch (_) { reject(new Error("人生卡生成失败，游戏进度未受影响")); }
    });
  }
  async function download(review, options = {}) {
    const owner = options.document || global.document;
    const blob = await toBlob(createCanvas(review, options));
    const url = global.URL.createObjectURL(blob);
    const link = owner.createElement("a");
    link.href = url; link.download = `回声镇-第${Number(review.generation) || 1}世-人生卡.png`;
    link.hidden = true; owner.body.appendChild(link); link.click(); link.remove();
    global.setTimeout(() => global.URL.revokeObjectURL(url), 1000);
    return { ok: true, filename: link.download, bytes: blob.size };
  }
  global.EchoTownJourneyCard = Object.freeze({ createCanvas, toBlob, download });
})(window);
