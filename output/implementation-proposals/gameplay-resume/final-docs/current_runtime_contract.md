# 回声镇当前运行时契约

- 适用版本：D6 经营策略版，内容 6.0.0，存档 v8，save contract schema 4.0.0。
- 更新时间：2026-10-15。
- 产品形态：全中文、单机、离线、无构建链网页/PWA；玩法不依赖账号、联网后端或运行时 AI。
- 稳定入口：项目根目录 `index.html`，跳转到唯一源码入口 `development/game/index.html`。

## 事实基线

一世从 6 岁到 75 岁，包含 5 个阶段、23 个节点、每节点 2 点生活行动。流程为“机会 → 生活安排 → 人生事件 → 结果”。机会可以跳过，生活安排可以提前结束，每节点都有无前置、零成本的保守事件选项。

三路线为手艺谋生、学业职业、关系共建，共 15 项阶段目标，在 11、17、28、49、75 岁结算。路线是追踪重点，可兼修和转向；后阶段不要求完成前阶段。已结算目标不追授、不因转线重复发奖，目标本身不额外发放现金、技能或行动点。

当前内容包含 5 种身份、8 个基础天赋及 10 个额外天赋候选、6 个愿望、18 张机会牌、7 种生活安排、6 种工作、6 件物品、16 件遗产、16 项成就、11 条彩蛋、12 段人生片段、12 项兴趣、8 位命名角色。`content.js` 的 69 个基础事件选项与 `strategy.js` 的保守选项、事件链、遗产和晚年交接选项共同组成 107 个事件选项。

普通生活行动和购买一般消耗 1 AP；六种工作全部消耗 2 AP。每节点至多工作一次，第二次工作须拒绝，不能重复增加工资、账本或成果证据。新节点自然恢复 3 点精力；首次休息基础恢复 2 点、第二次 1 点，实际效果包含已有机会和物品修正。刷新、导入和重新展示界面不得恢复资源。

主动行动检查门槛和实际资源成本，预览与执行共用规则。现金不会被旧版 100 上限截断。工资、事件收支、消费、生活费、借款和还款通过分类账本记录；借款增加债务，不计入收入，还款不占 AP，当前无利息。生活费未付部分记录为欠款。

通常技能增长上限按阶段为 4／6／8／10／10。天赋与遗产先完整兑现，已超过阶段上限的已有数值不因继续增长而降低。外在影响表达、体谅与开作坊检定，智识影响学识检定，体魄影响精力上限，家境影响初始现金。天赋对体魄、家境等属性的增益先兑现，再按最终属性计算收益；初始精力上限为 `10 + floor(最终体魄 / 4) + 显式遗产上限加成`，不再以固定 12 截断。

事件检定使用行动基础效果结算前的同一时点计算预览与实际结果；成功证据只在真实成功时产生。三条事件链记录稳定 ID 的实际后果，重复记录或刷新不重复结算。六个愿望依据实际经历与状态判断，旧的 `goalPoints` 不再直接决定完成。

单局 10—20 分钟是体验目标，不能作为已完成的实际耗时或趣味性验证结论。

## 模块边界

| 文件 | 责任 | 依赖与约束 |
| --- | --- | --- |
| `content.js` | 静态内容、资源索引、基础规则数据 | 无 DOM 或存储副作用 |
| `strategy.js` | 路线、阶段目标、真实证据、事件链、愿望与路线结局；追加对应静态选项 | content；不写存储、不渲染界面 |
| `save.js` | v7/v8 解析、迁移、结构与容量校验、备份及原子提交 | 可注入 storage；不执行玩法结算 |
| `engine.js` | 确定性规则、命令分发、人生生命周期、预览及当前阶段迁移可达性证明 | content、strategy、save；不得依赖 DOM、存储实例或音频 |
| `audio.js` | 本地 Web Audio 配乐、反馈、音量与试听 | 用户主动开启；失败不阻断玩法 |
| `ui.js` | DOM 渲染、交互、导入导出和浏览器反馈 | engine、save、audio；通过命令修改规则状态 |
| `game.js` | 装配 `window.EchoTown`、启动恢复、PWA 更新协调 | 各运行时模块 |
| `sw.js` | 静态应用壳和可选媒体缓存 | 只处理本游戏缓存命名空间 |

加载顺序固定为：

```text
content.js → strategy.js → save.js → engine.js → audio.js → ui.js → game.js
```

`window.EchoTown` 暴露 `content`、`strategy`、`engine`、`save`、`audio`、`ui`。引擎自身没有网络请求或随机外部服务；确定性结果来自保存的种子与规则。

## 状态与只读接口

```js
EchoTown.engine.getState()
EchoTown.engine.getSetup()
EchoTown.engine.createPreviewLife(profileId, talentId, goalId, setup)
EchoTown.engine.previewAction({ type, id })
EchoTown.engine.getLifePhase(state)
EchoTown.engine.getStageGoals(life)
EchoTown.engine.getAllStageGoals(life)
EchoTown.engine.getWishStatus(life)
EchoTown.engine.getConsequences(life)
EchoTown.engine.getAvailableEventActions(life)
```

`getState()` 和 `getSetup()` 返回副本。`previewAction()` 不扣资源、不写证据、不推进节点，返回可用性、原因、中文成本、变化列表、执行后余额及检定范围：

```js
{
  available, reason, cost,
  changes: [],
  remaining: { money, energy, actionPoints },
  test: null // 或 { label, minimum, maximum, difficulty, attributeBonus }
}
```

候选事件接口保留不可用选项供 UI 展示原因，不代表所有返回项都能执行；必须结合 `previewAction()`。

操作阶段从人生状态、机会处理状态、剩余 AP 和事件反馈推导，值为 `start`、`opportunity`、`management`、`event`、`feedback`、`ending`。不额外保存一份操作阶段状态。`state.screen` 仍使用 `start`、`game`、`ending`、`archive`。

阶段目标的持久状态为 `achieved`、`missed`、`legacy-settled`；只读展示还会推导 `pending`、`ready`、`future`。证据按节点、种类与内容 ID 去重；后果采用稳定 ID，每条事件链最多保存一个实际结局。当前与已结束人生的策略记录使用紧凑结构，展示文案从静态定义重建。

## 命令接口

```js
EchoTown.engine.dispatch({ type, ...payload })
```

成功返回 `{ ok: true, state, events }`；规则拒绝、未知命令或异常返回 `{ ok: false, state, events, error }`，保留调用前规则状态。事件由 UI 或组装层消费；引擎发送 `persist` 事件不会自行写磁盘。

| 命令 | 参数 | 用途 |
| --- | --- | --- |
| `UPDATE_SETUP` | `patch` | 修改身份、天赋、属性、愿望与开局路线 |
| `SET_PRESET` | `routeId` | 应用可继续编辑的路线推荐开局 |
| `ENTER_TOWN`、`START_LIFE`、`CONTINUE_LIFE` | 无 | 进入、开始或继续人生 |
| `SET_ROUTE` | `routeId` | 切换当前追踪路线 |
| `OPPORTUNITY`、`SKIP_OPPORTUNITY` | 选择时传 `id` | 处理本节点已抽出的机会 |
| `LIFE_ACTION` | `id` | 生活安排或工作 |
| `BUY_ITEM` | `id` | 购买物品，检查价格、AP 和库存 |
| `REPAY_DEBT` | 可选 `amount` | 还款；省略时偿还现金可覆盖的部分 |
| `END_LIFE_ACTIONS` | 无 | 放弃本节点剩余生活 AP |
| `EVENT_ACTION` | `id` | 处理当前人生事件 |
| `ADVANCE_ROUND` | 无 | 确认事件反馈，推进或完成一世 |
| `INSPECT_SCENE` | `roundId`、`clueId` | 检查当前节点未访问的有效场景线索 |
| `TOGGLE_LEGACY`、`CONFIRM_LEGACIES` | 切换时传 `id` | 结局中选择与确认遗产 |
| `HOME`、`VIEW_ARCHIVE` | 无 | 首页与镇志 |
| `TOGGLE_FONT` | 无 | 切换大字模式 |
| `SET_SOUND` | `enabled` | 配乐开关 |
| `SET_VOLUME` | `value`，范围 0–1 | 设置音量 |

`normalizeState()`、`replaceState()` 和 `resetState()` 用于组装与恢复，不是 UI 绕过规则的替代入口。导入成功写入主档后，才调用 `replaceState()`；损坏档保护通过 `setRecoveryRequired()` 阻止覆盖性推进。

## 存档与迁移

| 项目 | 契约 |
| --- | --- |
| 当前键 | `echo-town-generation-save-v8` |
| 原 v7 键 | `echo-town-generation-save`，保留原文 |
| 导入前有效进度备份 | `echo-town-generation-save-v8-before-import` |
| 导入 v7 原文备份前缀 | `echo-town-generation-save-v7-original-` |
| 接受版本 | v7、v8；更早键保留但不自动迁移 |
| 原文件输入上限 | 2 MiB／2,097,152 字节 |
| 紧凑有效存档上限 | 512 KiB／524,288 字节 |
| 导出格式 | 紧凑 JSON |
| 历世容量 | 沿用最多保留 40 世；迁移和导入不为通过大小检查而额外删除历史 |

导入顺序为 `prepareImport(text)` 解析与迁移、结构校验 → `engine.normalizeState()` 补齐规则侧迁移接入信息 → `commitImport(prepared, currentState)` 再校验与容量检查、备份最新有效内存、写候选主档 → 成功后 `replaceState()`。任何准备、备份或写入失败均不切换内存，不显示成功，不覆盖原有效主档。

`save.load()` 是只读操作，返回结果对象而非直接返回状态。启动迁移先确认 v8 不存在且原 v7 未变化，再写独立 v8。已有损坏 v8 不回退成旧 v7；原始内容被保护，用户可导入有效备份或明确清除。

v7 迁移保留节点、资源、AP、机会牌、已选事件、检定与结果反馈、遗产、世数、镇志和收藏；不重新抽牌、重做已有检定、补扣过去生活费或重算已有结局。新账本从迁移时的余额、欠款与累计收支起算，不能分类的过去收支保留为旧制汇总。

历史证据不足的已过阶段为 `legacy-settled`。当前阶段采用保守的充分条件证明：在克隆状态中，以现有规则试验有限条剩余普通操作路径；只接受能够实际完成目标的见证。不会利用旧 flags 冒充证据，不使用机会收益、购买或结果不确定的检定；未来检定只有预览最低得分已达到难度时才可作为证明。投影不触发存储或 UI 消费，完成后恢复引擎全部临时上下文。

迁移决定由 `migration.goalAccessVersion` 与当前阶段 `activeGoalIds` 固定。未获证明的目标保留旧制，从下一完整阶段接入；未声称这些目标在所有可能玩法下都绝对不可达。阶段末事件反馈不重做；75 岁最终反馈和已结算存档从下一世完整接入。旧结局原样展示，其中的旧制愿望完成结果也不按新版条件重新评价。

清除采用 v8 清除标记阻止保留的 v7 在下一次启动重新出现，存储写入成功后才清空内存。

## 媒体、离线与失败行为

运行时引用 10 张本地 WebP 图片，总量 1,603,758 字节，约 1.53 MiB。原 PNG 可作为源素材保留，交付运行时不依赖它们。配乐与音效采用本地 Web Audio 合成，默认关闭，支持音量与独立试听；播放失败保留全部文字操作。

根目录双击入口不依赖构建、服务器或 Service Worker。PWA 通过静态服务器使用；应用壳完整缓存为基础，媒体缓存失败不阻断安装或玩法。Service Worker 只清理 `echo-town-` 前缀的旧缓存，不删除其它应用缓存；非导航资源失败不回退成 HTML。

新 Worker 等待用户“保存并更新”。先持久化当前状态，成功后请求激活，并在控制器切换后刷新；保存失败不刷新。支持响应式布局、大字模式、键盘访问和系统减少动画偏好。

## 验证入口与结论边界

在项目根目录运行：

```powershell
python planning/tools/validate_project.py
python development/content/validate_content.py
python development/tests/validate_save_contract.py
python development/tests/validate_runtime_boundaries.py
node --test development/tests/*.test.js
node --check development/game/content.js
node --check development/game/strategy.js
node --check development/game/save.js
node --check development/game/engine.js
node --check development/game/audio.js
node --check development/game/ui.js
node --check development/game/game.js
node --check development/game/sw.js
```

规则回归包含自然三路线、真实成功与失败证据、转线、遗产、困境推进、工作 AP、经济账本、导入失败原子性、迁移断点和长期存档。浏览器验证须另外覆盖桌面、390×844 手机、键盘、静音、刷新恢复、离线、更新和双击入口；测试命令清单本身不构成这些检查已通过的证明。

自动化可证明状态与规则一致性，不能单独证明好玩。最终体验仍需玩家解释当前目标、下一步取舍、一次选择的后果，以及第二世想尝试的新策略；实际耗时与重玩意愿须分别记录。

本契约、`planning/technical/save-contract.json`、运行时内容与项目主索引共同描述当前版本。D5/v7 文档及旧发行包保留为历史记录，不再代表当前规则。
