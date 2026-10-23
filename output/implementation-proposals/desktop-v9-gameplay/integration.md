# 青年手艺项目接入提案

本目录只提供模块与测试，正式源码由主智能体统一集成。项目名称为“建立固定客源”，表示从19岁到28岁逐步获得独立接活能力；每次帮工仍在当前节点付薪，不表示同一订单跨数年交付。

## 最小规则与实际预算

| 年龄／0-based round | 原有操作 | 项目记录 | 原有成本与收益 |
|---|---|---|---|
| 19／7 | 生活安排前接受项目；修理铺帮工 `shop-shift` | `firstWork` | 接受0AP；工作2AP、精力−2、工资+7、压力+1、基础手艺+1／修理铺+1 |
| 21／8 | `routine-repair` 或 `BUY_ITEM toolkit` | `preparation`，二选一且只计一次 | 练习1AP、精力−2；购工具1AP、现金−12。剩余1AP自由安排 |
| 24／9 | 修理铺帮工 `shop-shift` | `returnWork` | 工作2AP、精力−2、工资+7；其他效果照常 |
| 28／10 | 正常安排2AP，处理任一个现有人生事件 | 事件后期限结算 | 3步完成且当时手艺≥5则成功。没有额外工资、技能、行动点和强制事件 |

青年共8AP，项目必要步骤占5AP；21岁余1AP、28岁余2AP。接受、退出及结算均无经济副作用。错过或退出不退款、不追回工资、不罚款，正常工作和人生推进仍然可用。项目与原阶段目标并行：手艺青年目标仍需要对应阶段实际工作两次、手艺≥5和下一笔生活费储备；项目不能替代这份原目标证据。

成功解锁工作 `project-craft-shift`（固定客户维修），minAge30，对应实际第一个节点32岁：2AP、现金+14、精力−4、压力+2，不损失身体，基础不增加技能或小镇数值。普通修理铺帮工继续保留。独立接活相对帮工每次多收入7元，但额外消耗2精力、多1压力并放弃帮工的基础成长。相对小镇项目收入11／精力−2／压力+1，新工作多3元、额外耗2精力、多1压力，并放弃体谅和公共建设成长；相对夜班收入13／精力−3／身体−2，新工作多1元、不损身体，但额外耗1精力且需要完成青年准备。趁手工具照常增加这份修理工作的手艺1，文案使用“基础”避免误称完全没有技能收益。14／−4／+2已由正式引擎验证为可行的首版基线，尚未证明平衡或好玩。

练习准备相对21岁继续帮工，放弃当期工资7元；购工具路径另支付12元，总现金差19元。回报应与真实可用的工作比较，不能只用低收入帮工宣称“几次回本”：同一自然开局、全部原中年事件和五阶段手艺目标下，不准备者做5次小镇项目+1次帮工，75岁现金52；练习者做4次独立接活+2次小镇项目，现金61；购工具者相同安排，现金49，仍比不准备少3元。工具提供持续修理成长、购买当时不耗精力，但不保证现金回本。

混合策略在32／36／40／49岁接独立工作，44／47岁改做小镇项目，49岁事件后精力恰为0。44岁若把起始4精力全用于接活，就无法再支付原事件所需1精力；49岁若要保留湿账页，需同时留出工作4与事件1。另一条实际可行安排在44岁休息两次，其余五个节点接活，75岁现金53。压力目前封顶10，达上限后不能再把标注压力当作持续经济代价；主要取舍来自实际精力、机会工资与成长。完整替代策略比较见balance-challenge.md。

## 接口

模块只读取内容定义和传入的生活状态，不修改DOM、存储、CONTENT或life。方法返回新对象，不允许UI通过快照改规则。

```js
const P = window.EchoTownProjects;
P.ID; // craft-customers-youth-v1
P.JOB_ID; // project-craft-shift
P.normalize(raw, life); // canonical copy；缺失时初始化，坏结构/坏证据抛异常
P.accept(life, P.ID); // {ok,changed,projects,message}
P.withdraw(life); // 同上
P.record(lifeAfterCommand, privateReceipt); // 同上，必须在成本和普通证据落地之后调用
P.settle(lifeAfterEvent); // 同上，28岁真实事件反馈后一次结算
P.isUnlocked(life, P.ID); // boolean，校验当前世真实记录
P.getJobDefinition(); // 新鲜工作定义对象，不注册、不改CONTENT
P.getView(life); // 脱离规则状态的快照，非相关节点且无项目返回null
```

`getView` 包含 `offer/accept:{available,reason}`、`withdraw:{available,reason}`、`definition`、`steps`、`remaining`、`status/statusLabel`、`outcome`、`unlock`、`progress`，并为现有UI保留 `canAccept/canWithdraw/next/costs`。`steps[].completed`是布尔值，`status`为completed/missed/pending；没有项目的19岁为available/unavailable。

私有凭证来自引擎在执行原命令前捕获的数据，不能接受UI提交数值：

```js
{ type: 'LIFE_ACTION' | 'BUY_ITEM', id, round,
  before: { actionPoints, sideActionsUsed, money, energy, hadToolkit } }
```

## 保存结构与证据

```js
life.projects = {
  version: 1,
  eligibleFromRound: 7, // 或null；已不适用不会再升级为7
  current: null // 或以下record
};
record = {
  id: 'craft-customers-youth-v1',
  status: 'active' | 'completed' | 'incomplete' | 'withdrawn',
  acceptedRound: 7,
  steps: { firstWork?, preparation?, returnWork? },
  settledRound?, resultId?, finalCraft?
};
step = {
  round: 7 | 8 | 9,
  type: 'LIFE_ACTION' | 'BUY_ITEM', actionId,
  slot: 1 | 2,
  receiptId: `craft-customers-youth-v1:${round}:${slot}:${type}:${actionId}`,
  ap: 1 | 2, moneySpent, energySpent
};
```

工作必须slot1、2AP；准备可slot1或2、1AP。三种来源分别限定步骤和节点，工作／练习精力实付2、钱实付0；购工具钱实付12、精力0。重复命令或重复调用只保留一个相同实际步骤。

同一当前节点已有项目凭证时，剩余AP不能高于 `2 - 已记录步骤AP总额 - 其他实际行动次数`，其他每次行动至少耗1AP；允许玩家主动结束安排使AP更少。因此已做2AP工作不能恢复成AP1/2，第二次行动才完成准备也不能仍保留1AP。错过必需节点，或当前剩余AP已不足以执行必需步骤时，getView会明确说明本世无法完成并允许退出，不再提示继续投入即可补救；该反馈不会自动退出、扣资源或阻止普通行动。

工作与练习还必须能在 `strategy.evidence` 找到同round、kind（job/life）、id及success=true。现行策略模块不记录purchase，因此购买准备必须有 `ledger.entries` 中 round8、kind=purchase、id=toolkit、money=−12，以及当前物品栏的工具。现有物品没有消耗/出售机制；若以后加入，购买持有检验需改为持久购买证据，不能靠无凭据flags替代。

active不能有结果字段；withdrawn的settledRound为7..10、resultId固定，不保存finalCraft；completed/incomplete固定settledRound10、保存当时finalCraft，严格要求完成状态与3步和手艺门槛一致。结算还要求28岁真实event evidence和 `life.actions`（该数组round为1-based，因此是round11、age28）；当前仍在28岁时lastAction须匹配。晚年技能提升不会重新判断终结结果。

history只保存摘要，不反向解锁：

```js
{ id, status, resultId, settledRound,
  stepsDone: 0..3,
  preparationActionId: null | 'routine-repair' | 'toolkit',
  finalCraft? }
```

无项目可省略字段；active不进入已经结束的人生history。摘要不是完整项目状态，不能传给完整normalize。导入不是防作弊密码签名：交叉校验负责拒绝内部矛盾或缺少必要证据的档案，不能声称能识别同时篡改所有历史的恶意备份。

## 引擎接入点

1. 加载顺序为content→projects→strategy→save→engine→scene/ui。新工作由 `getJobs()` 返回原CONTENT.jobs加 `P.getJobDefinition()`；`getJob`和UI读相同集合。CONTENT保持静态6份工作定义。
2. 新建人生与规范化时运行 `life.projects=P.normalize(life.projects,life)`。旧档缺失项目结构，仅active童年/少年，或19岁AP2、sideActionsUsed0、无lastAction时初始化eligible7，其余null；不从旧策略证据、flags、lifeLog或history补步骤。显式null/坏结构抛错。首次初始化后持久保存资格，不每次重算。
3. `ACCEPT_PROJECT`允许opportunity/management阶段，模块再次检验19岁未花AP；`WITHDRAW_PROJECT`只对active项目有效。两者只更新projects、反馈并保存，无AP和资源操作。重复提交返回原dispatch失败契约，不能显示成功。
4. `resolveLifeAction`与`buyItem`执行前抓私有before；在applyTransaction、正常recordEvidence、AP扣除和sideActionsUsed递增后调record。changed时保存projects并把message加入正常操作反馈；不要覆盖工资或阶段目标反馈。record失败属于接入错误，应由dispatch事务回滚，不能吞掉错误后显示项目进度。
5. `resolveAction`先完成原28岁事件检定、证据、lastAction和life.actions，再调用settle。项目结果附于原结果，不替换原事件。28岁的任何合法现有事件都可进入项目结算，无新增强制选项。advance前可做幂等兜底，但导入不得重跑事件。
6. `requirementMet`新增project类型，调用isUnlocked。strategy的job source和canonicalKind也需认识新定义，防止导入时删除新工作证据。手艺中年目标“开作坊后再工作”nextIds包含shop-shift及project-craft-shift；青年目标仍用原shop-shift。
7. toolkit修理加成和machinery兴趣映射纳入新工作；项目本身不直接发技能。新工作工资必须走原work分类账和jobHistory。新工作在晚年仍可继续进行，不能因中年6节点不足而人为返还投资。
8. save在提交候选档前调用normalize语义验证，不能把坏completed修成空项目继续提交。状态只有一份，操作阶段仍由原规则推导。

## 已执行验证

命令：`node --test output/implementation-proposals/desktop-v9-gameplay/projects.test.js`。

当前19项通过。测试原样读取正式content、projects、strategy、save、engine，通过public dispatch执行接受／退出项目、工作、消费、休息、事件、转线与账单；没有修改源码字符串、替换规则或代写项目状态的兜底。路径通过祖先查找定位仓库，主智能体可直接把测试复制到development/tests，仍读取正式模块。自然预算路径不添加技能、现金、遗产或重抽机会；困境测试明确仅把精力设为0，其余现金与债务来自真实消费和账单。

同一自然开局、无继承和重抽，19岁入场现金27。19/24/28都帮工，21岁分别继续帮工、练习+休息、购工具+休息，同一青年事件链下28岁现金为48／41／29，三份旧手艺青年目标均正常结算；两个项目路径都在32岁可执行新工作，真实耗2AP／4精力、工资+14且账本只记录一次。

练习项目继续使用正式独立接活与原手艺事件，成功交付作坊订单，再在较晚节点工作，中年目标正常达成。采用4次独立工作+2次小镇项目，进入52岁时项目completed、原链后果craft-orders-delivered仅一次、现金81、债务0；刷新后新工作证据仍保留。另一条真实消费路径在21岁现金0并产生债务，精力0时买工具／工作被拒绝，退出不耗AP，仍能连续通过保守事件进入32岁。

项目成功、未完成和退出的自然路径已经完整走过23节点到75岁，五个原手艺阶段目标全部完成，19笔应付节点生活费各发生一次。练习／购工具的项目成功路径最后现金61／49，项目未完成／24岁主动退出路径最后现金32／25，均无债务。结算history保存各自真实项目摘要，没有把失败或退出改成成功。

完整结局经过正式persist→load→serialize→prepareImport→commitImport→新引擎恢复，life、结局、项目和history全部保持；两份成功结局紧凑导出为35140／35296字节。选择small-tool后保存重导入，再确认交接并开始第二世，历史项目摘要仍保留，新世项目为空且不继承独立工作解锁；工具正常继承，并已用实际命令执行新增遗产选项legacy-tool-practice。重复结束人生或确认交接不能重复写历史。

新增同事件、同五目标的正式对照：49岁练习混合／不准备小镇／不准备夜班混合分别为现金85／76／84、精力0／6／2、身体10／10／2；75岁现金61／52／60、身体10／10／8。夜班混合为32／36／44／49夜班、40帮工、47小镇。练习混合只得到河桥／学校各2，小镇基线各5；所有比较完整扣除青年准备机会工资，并保留家庭分担、作坊订单、伴侣谈话、讲述遗憾、原洪水选择和保存湿账页。没有用保守事件替换来隐藏新工作消耗。

已覆盖接受不发奖、重复凭证、当节点第二次工作拒绝、购买后再练习只计一次准备、退出不返成本并继续推进、错过准备不罚款／不晚年追补、迁移AP0/1/2与反馈边界、伪造成本／slot／缺失工作或购买证据／28事件拒绝、只读视图、新工作精力不足拒绝。另验证完整序列化后新VM恢复、active和completed时切换三条路线、重复接受／退出／事件／推进：项目记录、工资、账本、阶段成果及已结算反馈保持一次，32岁生活费只扣一次；退出后不能借刷新或转线重新接受。

自动化不等于真人认为好玩；学业与关系项目不扩为正式玩法，待青年切片真人验证“理解当前取舍、愿意继续、愿意再开”后决定。

## 试玩存档

fixtures目录已有3个通过正式v9导入校验的紧凑存档，全部从普通命令自然推进生成：youth-19-offer.json（19岁未接受项目、机会待处理，8822字节）、youth-28-feedback.json（28岁结果，14562字节）、middle-32-independent-work.json（32岁安排阶段，新工作可选，13665字节）。说明见fixtures/README.md。

可用 `node output/implementation-proposals/desktop-v9-gameplay/projects.test.js --write-fixtures` 在验证通过时重新生成；普通测试命令不写存档文件。
