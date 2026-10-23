# 回声镇当前运行时契约

- 适用版本：D7完整电脑优化版，内容6.2.1，存档v9，save contract schema 5.1.0，缓存echo-town-desktop-v9-8。固定挑战数值规则仍为6.2.0，原挑战文件继续有效。
- 更新时间：2026-10-23。
- 产品形态：全中文、单机、离线、无构建链网页/PWA；玩法不依赖账号、联网后端或运行时 AI。
- 稳定入口：项目根目录 `index.html`，跳转到唯一源码入口 `development/game/index.html`。

## 事实基线

一世从 6 岁到 75 岁，包含 5 个阶段、23 个节点、每节点 2 点生活行动。流程为“机会 → 生活安排 → 人生事件 → 结果”。机会可以跳过，生活安排可以提前结束，每节点都有无前置、零成本的保守事件选项。

三路线为手艺谋生、学业职业、关系共建，共 15 项阶段目标，在 11、17、28、49、75 岁结算。路线是追踪重点，可兼修和转向；后阶段不要求完成前阶段。已结算目标不追授、不因转线重复发奖，目标本身不额外发放现金、技能或行动点。

当前内容包含5种身份、8个基础天赋及10个额外天赋候选、6个愿望、18张机会牌、7种常规生活安排及1种项目照料、6种常规工作及2种项目工作、6件物品、16件遗产、16项成就、11条彩蛋、12段人生片段、12项兴趣、8位命名角色。69个基础事件选项与策略扩展共同组成107个事件选项，另有3个由过去实际失败触发的条件版本，保留原事件ID。

普通生活行动和购买一般消耗1AP；六种常规工作与固定客户维修消耗2AP，专业咨询消耗1AP。咨询可在同节点做两次，分别扣成本与发工资，第三次拒绝；策略证据仍按节点/类型/ID去重，不能伪造两个不同节点。新节点自然恢复3精力，首次休息基础恢复2、再次1；实际效果包含物品与机会修正。刷新、导入和重绘不得恢复资源。

主动行动检查门槛和实际资源成本，预览与执行共用规则。现金不会被旧版 100 上限截断。工资、事件收支、消费、生活费、借款和还款通过分类账本记录；借款增加债务，不计入收入，还款不占 AP，当前无利息。生活费未付部分记录为欠款。

通常技能增长上限按阶段为 4／6／8／10／10。天赋与遗产先完整兑现，已超过阶段上限的已有数值不因继续增长而降低。外在影响表达、体谅与开作坊检定，智识影响学识检定，体魄影响精力上限，家境影响初始现金。天赋对体魄、家境等属性的增益先兑现，再按最终属性计算收益；初始精力上限为 `10 + floor(最终体魄 / 4) + 显式遗产上限加成`，不再以固定 12 截断。

事件检定使用行动基础效果结算前的同一时点计算预览与实际结果；成功证据只在真实成功时产生。三条事件链记录稳定 ID 的实际后果，重复记录或刷新不重复结算。六个愿望依据实际经历与状态判断，旧的 `goalPoints` 不再直接决定完成。

单局 10—20 分钟是体验目标，不能作为已完成的实际耗时或趣味性验证结论。

## 模块边界

| 文件 | 责任 | 依赖与约束 |
| --- | --- | --- |
| `content.js` | 静态内容、资源索引、基础规则数据 | 无 DOM 或存储副作用 |
| `strategy.js` | 路线、阶段目标、真实证据、事件链、愿望与路线结局；追加对应静态选项 | content；不写存储、不渲染界面 |
| `projects.js` | 青年项目、真实步骤、终态与新工作只读定义 | content；不改传入人生、不访问DOM/存储 |
| `journey.js` | 条件事件版本、五阶段决定、四人物回应、场景成果、真实回顾及遗产用途 | 纯只读投影，不反推旧事件版本，不发奖励 |
| `save.js` | v7/v8/v9 解析、迁移、结构与容量校验、备份及原子提交 | 可注入 storage；不执行玩法结算 |
| `engine.js` | 确定性规则、命令分发、人生生命周期、预览及当前阶段迁移可达性证明 | content、strategy、projects、save；不得依赖 DOM、存储实例或音频 |
| `modes.js` | 启动、当前槽、切换、导入恢复与引擎应用的协调 | engine/save；所有候选提交成功后才切内存，不直接访问存储 |
| `audio.js` | 本地 Web Audio 配乐、反馈、音量与试听 | 用户主动开启；失败不阻断玩法 |
| `scene.js` | 场景热点、时间线、项目投影、资料抽屉 | 只读规则状态，行动交给UI命令 |
| `journey-card.js`、`journey-ui.js` | 本地Canvas PNG及人物/场景/回顾展示 | 无远程图片、字体和自动上传；失败不阻断文字玩法 |
| `ui.js` | DOM 渲染、交互、导入导出和浏览器反馈 | engine、save、audio；通过命令修改规则状态 |
| `game.js` | 装配 `window.EchoTown`、启动恢复、PWA 更新协调 | 各运行时模块 |
| `sw.js` | 静态应用壳和可选媒体缓存 | 只处理本游戏缓存命名空间 |

加载顺序固定为：

```text
content.js → strategy.js → projects.js → journey.js → save.js → engine.js → modes.js → audio.js → scene.js → journey-card.js → journey-ui.js → ui.js → game.js
```

`window.EchoTown` 暴露 `content`、`strategy`、`projects`、`journey`、`engine`、`save`、`modes`、`audio`、`scene`、`ui`。引擎自身没有网络请求或随机外部服务；确定性结果来自保存的种子与规则。

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
EchoTown.engine.getJobs()
EchoTown.engine.getLifeActions()
EchoTown.engine.getProjectView(life)
EchoTown.engine.getChallengeDefinitions()
EchoTown.engine.createChallengeState("craft-start-v1") // 纯候选，不改变主人生/模式，不发persist
```

`getState()` 和 `getSetup()` 返回副本。`previewAction()` 不扣资源、不写证据、不推进节点，返回可用性、原因、中文成本、变化列表、执行后余额及检定范围：

```js
{
  available, reason, cost,
  requirements: [{ label, met }],
  changes: [],
  remaining: { money, energy, actionPoints },
  test: null, // 或 { label, minimum, maximum, difficulty, attributeBonus }
  outcomes: null // 检定事件提供 success / failure 各自的 money、energy、actionPoints
}
```

检定事件的 `remaining` 仅为基础效果投影；UI 使用 `outcomes` 分支余额，避免把尚未结算的检定收益显示成最终余额。门槛无论满足与否均显示。候选事件接口保留不可用选项供 UI 展示原因，不代表所有返回项都能执行；必须结合 `previewAction()`。

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
| `ACCEPT_PROJECT`、`WITHDRAW_PROJECT` | 接受时可传`id` | 19岁尚未安排时接受；退出保留既有投入与工资，两者0AP |
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
| 当前键 | `echo-town-generation-save-v9` |
| 原v8键 | `echo-town-generation-save-v8`，保留原文 |
| 原 v7 键 | `echo-town-generation-save`，保留原文 |
| 导入前有效进度备份 | `echo-town-generation-save-v9-before-import` |
| 导入v8原文备份前缀 | `echo-town-generation-save-v8-original-` |
| 导入 v7 原文备份前缀 | `echo-town-generation-save-v7-original-` |
| 接受版本 | v7、v8、v9；更早键保留但不自动迁移 |
| 原文件输入上限 | 2 MiB／2,097,152 字节 |
| 紧凑有效存档上限 | 512 KiB／524,288 字节 |
| 导出格式 | 紧凑 JSON |
| 历世容量 | 沿用最多保留 40 世；迁移和导入不为通过大小检查而额外删除历史 |

导入顺序为 `prepareImport(text)` 解析与迁移、结构校验 → `engine.normalizeState()` 补齐规则侧迁移接入信息 → `commitImport(prepared, currentState)` 再校验与容量检查、备份最新有效内存、写候选主档 → 成功后 `replaceState()`。任何准备、备份或写入失败均不切换内存，不显示成功，不覆盖原有效主档。

`save.load()` 是只读操作，返回结果对象而非直接返回状态。启动按v9→v8→v7读取；迁移提交前重新确认较高版本键未出现、来源原文未变化，再只写一次v9。较新键损坏时不自动回退；原始内容被保护，用户可导入有效备份或明确清除。

v7 迁移保留节点、资源、AP、机会牌、已选事件、检定与结果反馈、遗产、世数、镇志和收藏；不重新抽牌、重做已有检定、补扣过去生活费或重算已有结局。新账本从迁移时的余额、欠款与累计收支起算，不能分类的过去收支保留为旧制汇总。

历史证据不足的已过阶段为 `legacy-settled`。当前阶段采用保守的充分条件证明：在克隆状态中，以现有规则试验有限条剩余普通操作路径；只接受能够实际完成目标的见证。不会利用旧 flags 冒充证据，不使用机会收益、购买或结果不确定的检定；未来检定只有预览最低得分已达到难度时才可作为证明。投影不触发存储或 UI 消费，完成后恢复引擎全部临时上下文。

迁移决定由 `migration.goalAccessVersion` 与当前阶段 `activeGoalIds` 固定。未获证明的目标保留旧制，从下一完整阶段接入；未声称这些目标在所有可能玩法下都绝对不可达。阶段末事件反馈不重做；75 岁最终反馈和已结算存档从下一世完整接入。旧结局原样展示，其中的旧制愿望完成结果也不按新版条件重新评价。

清除采用v9清除标记阻止保留的v8/v7在下一次启动重新出现；旧v8清除标记也阻断更老原文复活，存储写入成功后才清空内存。

## 青年项目与电脑界面

三项目共用19／21／24岁实际步骤、28岁真实事件后结算的规则。手艺与学业各需5AP，互助需3AP，青年共8AP。本世仅选一个，退出也不重领；转线只换追踪重点。手艺需两次修理帮工与练习/购工具，学业需两次辅导与学习/购笔记，互助需照料/记录/见面；对应能力至少5。项目本身不发工资、技能或AP，错过/退出保留既有投入并可继续人生。

新工作`project-craft-shift`从32岁节点起可用：2AP，收入14、精力−4、压力+2，无基础技能/小镇增长，不扣身体；工具照常增加手艺。它计入开作坊后继续修理的证据。对照小镇项目、夜班后调整了基线，尚未锁定正式平衡，也不保证购买工具在中年前实现现金回本。

`project-study-consult`为1AP、收入6、精力−2、压力+1，无基础技能/学校/晚辈增长；笔记本提供正常学识加成。`project-community-care`为1AP、现金−3、精力+2、压力−1、家人/晚辈各+1，无基础体谅；不是工资或工作证据，急救包正常加身体。其优势在真实的安排组合/照料对象，不能宣称比所有免费恢复与小镇工作更优。

`life.projects`仅保存资格、项目ID、实际步骤及稳定终态ID，不保存界面阶段。步骤凭证包含round/type/actionId/slot/receiptId/ap/moneySpent/energySpent，和策略证据或购买账目交叉核实；当前节点AP必须已实际扣除。已产生28岁反馈的外部存档不能仍为active项目。历史只保留紧凑终态摘要，不能反向解锁当前或下一世工作。

v8升级只追加空项目：19岁未用生活行动（含机会待选/已选/跳过）或更早时可接入；之后延期到下一世，永不从旧工作记录补造步骤。`migrateV7ToV8()`兼容保留输出8；`migrateV8ToV9()`与`migrateToCurrent()`输出9，旧v7阶段准入结果不重跑。

电脑主屏使用大场景、顶部四项资源、右侧当前步骤与23节点时间线；详细条件、人物、库存和账本按需打开。查看/重复渲染不改变规则状态。抽屉内操作反馈和焦点保留在模态内部，Escape返回来源；数字键不执行模态背后的事件。静音和媒体失败不阻断。

## 连贯经历、回顾与独立挑战

Journey按实际event证据与保存的actions产生人物回应和五阶段代表决定，不创造相遇/成功。21岁试修失败→36岁小单返修，21岁试讲失败→49岁补查，32岁分工失败→47岁重排；三种版本改变真实成本、门槛与成果。新actions和lastAction保存稳定字符串journeyVariant，并严格交叉验证前次失败。旧档缺此字段时不追溯标注、不重写反馈。小单返修可完成自己的链，但不冒充作坊开张；后果显示和中年条件一致。

结局回顾提炼三次真实选择、分类账本代价、实际遗产及下一世选项。预填只改setup，当前人生不变；确认遗产后，首页主入口保留有效配置。Canvas卡在本机生成，挑战卡标明固定挑战和规则版本，无继承承诺；无画布时保留文字回顾和进度。

固定挑战`craft-start-v1`，规则6.2.0，种子277191004；workshop-heir/learn/craft，slow-and-steady、good-memory、warm-heart，属性3/5/6/6。generation1、新世界、无继承，6—75岁后不进入第二世。运行时模式仅为协调上下文，不写进游戏state。

`Save.load()`始终读取主人生。启动经`loadActive → normalizeState → commitLoad`；模式内使用`persistSlot/prepareSlotImport/commitSlotImport/removeSlot/serializeSlot`。UI和PWA通过Modes协调这些接口，禁止漏用默认主档写入。

模式索引`echo-town-mode-selection-v1`包含activeSlotId及两槽不可变快照引用；切换须显式expectedSourceSlotId匹配磁盘。校验源/目标、准备快照、重核来源、单次索引setItem提交，成功后才replaceState。陈旧窗口、候选/容量/写入失败不切内存/有效引用。成功后仅清理本模块无引用快照，主v9/v8/v7原文和其他应用键保留。

挑战导出为`{format:"echo-town-challenge",version:1,challengeId,rulesVersion,state}`；与主档不能互相导入。原文件2MiB、紧凑含信封512KiB。正常导入备份最新有效内存；已知槽损坏的恢复将原始ref/raw写入独立recovery备份，不覆盖最后有效before-import，成功后仍保留原始来源。坏最高层索引拒绝猜槽、导入、清除和切换。

## 媒体、离线与失败行为

运行时引用 10 张本地 WebP 图片，总量 1,603,758 字节，约 1.53 MiB。原 PNG 可作为源素材保留，交付运行时不依赖它们。配乐与音效采用本地 Web Audio 合成，默认关闭，支持音量与独立试听；播放失败保留全部文字操作。

根目录双击入口不依赖构建、服务器或 Service Worker。PWA 通过静态服务器使用；应用壳完整缓存为基础，媒体缓存失败不阻断安装或玩法。Service Worker 只清理 `echo-town-` 前缀的旧缓存，不删除其它应用缓存；非导航资源失败不回退成 HTML。

新 Worker 等待用户“保存并更新”。先持久化当前状态，成功后请求激活，并在控制器切换后刷新；保存失败不刷新。当前只面向电脑端优化，验证1366×768、1920×1080及125%等效空间；支持大字、键盘和系统减少动画偏好。

## 验证入口与结论边界

6.2.1新增纯只读引导：`Engine.getNextPursuit(life)`从尚未关闭的真实事件中选择后续追求，未来事件也按已存在的Journey失败证据投影；不会发奖励、写入证据或补造过去成果。`Engine.getLifeRecommendations(life, pursuit?)`按实际收益和未完成的有效凭证排序。`previewAction`追加`benefits/growth/notices`，原成本、余额与成功失败分支保留。一次UI渲染复用追求结果。

阶段目标未满足时主提示仍优先说明缺失条件；满足后再显示后续追求。选择卡合并重复成本和数值，完整门槛与余额放在独立details。推进按钮在滚动区外，切换年龄归零滚动位置。字号使用统一变量，普通关键选项13px、大字16px；辅助文字至少12/15px。

`Content.getOpportunityCopy(item, life)`只认本世更早年龄的已接受机会记录；同节点接受后重绘仍使用同一文案。引擎只在新接受时保存label/result，旧反馈原文不改写。场景地点与实际事件/阶段图片共用映射。内容版本6.2.1不改变固定挑战6.2.0数值规则或信封身份。

在项目根目录运行：

```powershell
python planning/tools/validate_project.py
python development/content/validate_content.py
python development/tests/validate_save_contract.py
python development/tests/validate_runtime_boundaries.py
node --test development/tests/*.test.js
node --check development/game/content.js
node --check development/game/strategy.js
node --check development/game/projects.js
node --check development/game/journey.js
node --check development/game/save.js
node --check development/game/engine.js
node --check development/game/modes.js
node --check development/game/audio.js
node --check development/game/scene.js
node --check development/game/journey-card.js
node --check development/game/journey-ui.js
node --check development/game/ui.js
node --check development/game/game.js
node --check development/game/sw.js
```

规则回归包含自然三路线、真实成功与失败证据、转线、遗产、困境推进、工作 AP、经济账本、导入失败原子性、迁移断点和长期存档。浏览器验证须另外覆盖常见电脑窗口、125%等效空间、键盘、静音、刷新恢复、离线、更新和双击入口；测试命令清单本身不构成这些检查已通过的证明。

原D7的173项回归与完整交付记录保留在desktop-full-v9验收；6.2.1增加26项回归，共199项。改进证据见[吸引力改进验收](../development/tests/appeal-polish-acceptance-20261023.md)。EVENT-025取消5名真人作为继续实施前置；当前采用多策略、独立审查与浏览器验收。没有真人乐趣、首局耗时或市场留存数据，不把内部通过等同于这些结论。

本契约、`planning/technical/save-contract.json`、运行时内容与项目主索引共同描述当前版本。D5/v7 文档及旧发行包保留为历史记录，不再代表当前规则。
