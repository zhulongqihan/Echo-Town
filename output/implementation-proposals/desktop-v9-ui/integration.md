# 桌面场景提案接入（已冻结）

复制本目录的 `index.html`、`styles.css`、`scene.js` 到 `development/game/`。首稿沿用全部 180 个既有 DOM ID，新增节点均有独立 ID；不替换现有 content、engine、save、audio 或 ui 模块。

## UI 接线

- `UI.bind()` 内调用一次 `global.EchoTownScene?.bind()`。
- `UI.render()` 最后调用 `global.EchoTownScene?.render(state)`，确保机会／生活／事件／结果及资源先由原 UI 完成渲染。`scene.js` 已放在 `ui.js` 之前加载。
- `quick-start`：若已有 active 或 complete 人生，走 `CONTINUE_LIFE`；否则先 `SET_PRESET { routeId: "craft" }`，成功后 `START_LIFE`。不要跳过旧档遗产交接。
- `accept-project` / `withdraw-project` 分别转交 `ACCEPT_PROJECT` / `WITHDRAW_PROJECT`；项目 ID 从 `element.dataset.projectId` 读取，是否需要确认由已有命令层处理。
- 新工作列表应来自 `engine.getJobs(life)`，其余工作点击继续复用 `LIFE_ACTION`。`project-craft-shift` 的预览须显示真实 **2 行动点、收入 +12、精力 −3、压力 +2**，与帮工 **+7／−2／+1** 区分。
- 抽屉内购买或还款后，保持抽屉打开并将焦点落在抽屉内可见反馈。已加入 `#drawer-feedback[role=status][tabindex=-1]`；UI 的 `focusResult` 应在模态打开时写入 title/copy/changes，设 `hidden=false` 并聚焦它。Scene 在每次首次打开抽屉时清空并隐藏该区域。关闭／Escape 会归还源按钮；源热区被重渲染时，会按 ID 或 data-scene-action/drawer-tab/round 找到抽屉外的等价按钮。
- 把 `scene.js` 加入 SW 核心缓存，更新缓存版本。新布局不是新存档来源，scene.js 不写规则状态或本地存储。
- 最终页面须加载正式 `projects.js`，顺序为 content → projects → strategy → save → engine → audio → scene → ui → game。

## 项目显示接口

`engine.getProjectView(life)` 不存在或返回 `null` 时隐藏项目区域，不生成占位进度。已与 gameplay agent 约定只读视图：

```js
{
  visible: true, id, title, status, statusLabel, summary,
  steps: [{ id, label, completed, detail, age, status, receipt }],
  progress: { current, total: 3 },
  accept: { available, reason }, withdraw: { available, reason },
  outcome: null /* 或 { id, status, label, detail } */,
  npcReply,
  unlock: { jobId: "project-craft-shift", unlocked, minAge: 30 }
}
```

`scene.js` 显示的进度、人物回应和收支均来自真实视图、evidence、inventory 或 ledger。查看热点、抽屉、时间线不 dispatch 游戏命令；练习／休息热点使用既有 `data-action="life-action"`，由 UI 命令层校验及扣费。

## 验收重点

- 1366×768、1920×1080，以及等效 125% 缩放的 1093×614、1536×864。游戏主窗口不纵向滚动；右侧操作区可以独立滚动，顶部四项资源与底部时间线保留。
- 截图机会、青年生活／委托、人生事件、结果四状态。主场景清楚可见，所有操作和详细资料仍可达。
- Tab／Enter／Escape 操作抽屉；关闭回到原按钮。展开已有 details 也不能使按钮被裁掉。
- 先读 state 快照，反复 `EchoTownScene.render(state)`、打开所有抽屉及查看过去／未来时间线，再读快照：内容应完全一致。
- 原始开局四项自定义、结算三件遗产、镇志和导入导出各走一遍。未接项目、旧档延迟接入、退出及项目完成均不得显示虚构进度。

## 提案验证与正式版边界

- `node verify-project-views.cjs` 已通过：真实引擎命令分别生成 available/unavailable/active/completed/incomplete/withdrawn 六状态，再验证 scene 投影中的按钮、结果和只读性。没有手写项目成功记录。
- completed/incomplete/withdrawn 不显示接受／退出按钮，不再提示“结算还需要”；incomplete 显示实际错过步骤。未解锁状态不虚构新工作。
- `node --check scene.js` 已通过。右上项目标记与左侧练习／休息热区分开；终态项目摘要折叠步骤列表。新增工作的账本名称来自 `engine.getJobs(life)`。
- `project-view-fixtures.json` 是上述真实命令生成的六个状态，仅供浏览器验收，不随游戏交付；`verify-project-views.cjs` 也不复制到游戏目录。
- 上轮临时预览验证过 1366×768、1920×1080、1093×614、1536×864 外层无溢出、Escape 归还焦点和只读渲染。**这些不是正式集成版验收**；此次项目标记位置与重渲染后的焦点恢复仍须在正式接线后重新检查。

项目成功与否、领取资格、工作解锁及扣费均以正式引擎实现为准。
