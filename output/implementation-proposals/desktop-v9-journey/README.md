# 世界回应与人生回顾

运行提案已于 2026-10-22 冻结；四个运行文件为 `journey.js`、`journey-card.js`、`journey-ui.js`、`journey.css`。A00 负责复制与正式源修改。这个目录不覆盖正式游戏。

## 加载与 UI 接入

推荐顺序：`content → strategy → projects → journey → save → engine → modes → audio → scene → journey-card → journey-ui → ui → game`。Journey 只依赖 Content；Projects 在调用项目读模型时使用。

在页面现有样式之后加载 `journey.css`。无需手写新页面结构。

```js
// UI.bind()：放在 Scene.bind() 之后。
global.EchoTownScene?.bind();
global.EchoTownJourneyUI?.bind();

// UI.render()：各页面和 Scene 均渲染完后调用。
global.EchoTownScene?.render(state);
global.EchoTownJourneyUI?.render(state);
```

`JourneyUI.render(state, {mode, allowInheritance})` 可以显式传上下文。默认读取 `EchoTownModes.getView().challenge`；兼容 Save 的只读槽信息接口。挑战模式不显示下一世预填及遗产建议，导出的卡也不显示交接。它不读取 localStorage。

自动创建的内容及原入口：

| 宿主 | 新内容 | 行为 |
| --- | --- | --- |
| `#drawer-people` | `#journey-people` | 四位人物的真实回应，五阶段决定；折叠查看 |
| `#drawer-scene` | `#journey-world` | 已实际完成的场景留痕；没有证据时不出现完成物件 |
| `#scene-npc-button` | 原“聊两句”入口 | 使用真实项目或所选方向对应人物的最新回应 |
| `#npc-response-name/#npc-response-copy` | 原回应层 | 仅在有实际前事时替换回应 |
| `.scene-heading .scene-view-button` | 原场景按钮 | 以真实留痕数量更新按钮文字与强调色 |
| `[data-scene-action=timeline]` | 原时间线 | 代表决定节点增加下划线与具体 title |
| `#ending-summary` 后 | `#journey-review` | 三次真实选择、五阶段展开、遗产接续、PNG 下载 |

既有游戏操作区和主场景尺寸未改。人物回应不会扣资源。下一世推荐调用现有 UI.dispatch 的 `SET_PRESET`，只改变 setup，不开始新世、不确认遗产、不修改当前人生。按钮必须对应已经选中的代表遗产。

## 纯规则与读模型

`EchoTownJourney` 无 DOM、storage、dispatch、随机数、结算写入。返回的读模型是新对象。

| 接口 | 返回要点 |
| --- | --- |
| `resolveEventAction(life, action)` | action 副本；同 id 的确定性失败修复版本；保留 requires/strategy/tags |
| `getEventContext(life)` | 当前未结算事件的版本来源及真实成本；已有 lastAction 返回 null |
| `getStageDecisions(life)` | 五阶段，每阶段一个已实际选择的事件；未发生为 null |
| `getNpcTimeline(life, npcId)` | label/role/entries/current；每条含 sourceIds、proof、previousId、previousSourceIds |
| `getWorldView(life)` | markers/stages/currentStageId；只用明确成功 evidence 或真实已完成项目 |
| `getLegacyPaths(life, selectedIds?)` | 三代表遗产的真实条件选项、年龄、可选/选中/继承状态与 SET_PRESET 命令 |
| `getReview(life, options?)` | 3 个不同真实决定、5 阶段、账本代价、实际项目、遗产及下一世建议 |

`getReview` 输入是当前完整 life，不是 world.history 的压缩条目。`options` 支持 `mode:'challenge'`、`allowInheritance:false`、`legacyIds`。

事件证据以 `life.strategy.evidence` 的正确节点、`kind:'event'`、明确 success 为准。旧档的 `life.actions` 仍可展示原 label/result，但没有证据时不重判成功失败。过去 action 只有确实保存过 `journeyVariant` 才显示版本归属，不因新规则追溯改写旧反馈。

现金取 ledger 同节点同 action 的 base、`-success`、`-failure` 三种记录，分别显示总支出和总入账。不是只展示净额。未有独立现金记录时明确显示“这次没有现金收支记录”。旧记录没有逐事件精力实际差额，所以不把当前定义的名义精力消耗冒充历史实耗。项目成本则取已支付步骤 receipt 的 AP、moneySpent、energySpent。

三项目 ID：`craft-customers-youth-v1`、`study-practice-youth-v1`、`community-network-youth-v1`。项目身份来自实际 `projects.current.id`，不来自追踪路线。项目回应按最后真实步骤或 settledRound 排序，不能在晚年盖过后来的实际回应。项目具体完成效果使用 Projects.getView 的真实结果文案。

## 三条前事真正改变规则的分歧

正式 engine 必须统一 getAction、可选项、preview、availability 和 execute 到 resolver。UI 不能自己拼“看起来不同”的选项。稳定版本 ID 是字符串，写入 `lastAction.journeyVariant` 与 `actions[].journeyVariant`；Save 应校验限定三种 ID 并验证其来源。

| 后续行动 | 必须存在的明确失败前事 | 修复版成本/检定 | 实际成功收益 |
| --- | --- | --- | --- |
| 36 岁 `chain-craft-workshop` | 21 岁 `chain-craft-trial` | 钱 -6、精力 -2；手艺 6 | 钱 +3、手艺 +1、修理铺 +1 |
| 49 岁 `chain-study-report` | 21 岁 `chain-study-trial` | 精力 -3；学识 6 | 学识 +1、镇志 +1 |
| 47 岁 `chain-community-flood` | 32 岁 `chain-community-roster` | 精力 -3；体谅 6 | 邻里 +2、河桥 +1 |

版本分别为 `journey-craft-repair-v1`、`journey-study-recheck-v1`、`journey-community-replan-v1`。失败效果保持原来的压力 +2 / +1 / +2。原 requires 不变。前事成功或未知继续原版；旧反馈、结局不重算。修复用更小范围和更多精力降低难度，成功收益也缩小；不会奖励失败本身。

四位现有人物为祁叔、林老师、陈婶、阿禾。每人至多五段实际事件回应，另可有实际项目回应。每条后续回应明确提及上一条真实选择与年龄，只有相应选择发生才加入。回应不给关系、资源或额外成果。

## 离线人生卡

`EchoTownJourneyCard.createCanvas(review)` 创建 1200px 宽、自适应高度的画布；`toBlob(canvas)` 返回 PNG；`download(review)` 仅在玩家点击时发起本地下载。无远程图片、字体、网络请求或外部发送。普通文字回顾一直保留。画布不可用、toBlob 失败都通过原页面 status 说明，不修改存档。

提供 `life-card-community.png` 与 `ending-review-1366.png` 为实际浏览器输出；`state-fixture.json` / `review-fixture.json` 来自公开游戏命令完成的一世关系路线，未注入高技能或资源。

## 已验证与边界

运行：`node --test output/implementation-proposals/desktop-v9-journey/journey.test.js`。9 项通过。复制到 development/tests 后会读取正式 journey.js。

- 三个失败分歧由真实开局和公开命令造成，未人工改技能、余额或证据。失败分数分别 3、2、3；后续修复分数 8、8、6，难度均 6。预览与实际成本、结算、重复命令拒绝一致。
- 手艺修复现金实际支出 6、成功入账 3，回顾分别保留；不是误报仅花 3。
- 三条自然完整人生各有 5 阶段代表决定与 3 个不同真实回顾；四 NPC 各至少 3 次连续回应；旧证据不足不生成完成标记。
- 三项目真实完成、转线、后续回应排序、incomplete/withdrawn、实际步骤成本与世界标记通过。
- Deep-freeze 输入可读取，旧结局和反馈不被修改。挑战与禁止继承上下文不提供下一世建议。
- 临时挂载提案的真实 Chrome 检查：1366 / 1920 / 1093（125% 有效宽）均无横向溢出。1366 三列约 391px，1920 三列约 429px，1093 单列 951px。PNG 离线下载实际发生，中文长标题和正文换行已目检；模拟 canvas 不可用后按钮恢复，life 字节不变。下一世预填后 life 字节一致、screen 仍 ending。

`browser-load.js` 是临时提案挂载检查；不能冒称正式集成已通过。`browser-formal-load.js` 才只加载正式页面脚本。正式集成的中间态曾遇到 Modes 先接而 Save 尚未更新；该次启动不计最终通过或产品缺陷。正式 Save 完成后的复核另记。

冻结后的内容审查已给 A00 两处精确文案修正建议：publish-ledger 只代表公开材料，不应说已经查实；工具遗产应说“多一种拆装选择”，避免暗示额外行动点。正式版由 A00 统一修改，冻结稿未擅自覆盖。
