# 三路线青年项目接入

本提案保持原手艺项目结构、ID、结果字段与14／−4／+2工作基线，扩展同一容器的静态registry。项目只决定额外选择；阶段目标、机会、生活费与原事件继续结算。19／21／24的真实行动留下步骤，28岁任意原人生事件完成后一次结算。接受、退出和完成本身都不发钱、技能或行动点。每世只能接受一个项目，退出后不能换项目；路线追踪可以自由切换，也不会抹掉或重发项目。

## 冻结的数据定义

`life.projects={version:1,eligibleFromRound:7|null,current:null|record}`。空结构、迁移起点和状态枚举沿用手艺v1，v9旧存档不更名也不重跑。不存在项目历史的旧档只能初始化空项目；19岁有2AP、sideActionsUsed为0且无人生反馈才能接入，之前的阶段也保留将来接入资格。

| 项目ID／路线 | firstWork：19岁round7 | preparation：21岁round8 | returnWork：24岁round9 | 28岁指标字段及门槛 |
|---|---|---|---|---|
| craft-customers-youth-v1／craft | shop-shift | routine-repair或购买toolkit | shop-shift | finalCraft≥5 |
| study-practice-youth-v1／study | tutor-shift | routine-study或购买study-notebook | tutor-shift | finalStudy≥5 |
| community-network-youth-v1／community | routine-care | routine-record | routine-social | finalEmpathy≥5 |

record字段仍为`id,status,acceptedRound,steps,settledRound?,resultId?,指标字段?`，只能出现本项目的指标字段。active和withdrawn均不能保存指标。completed/incomplete只能在round10结算，并有28岁真实人生事件、strategy event证据和life.actions；completed等价于三步骤齐全且指标达标，不因晚年增长重判。

step字段不变：`round,type,actionId,slot,receiptId,ap,moneySpent,energySpent`。receiptId为`${projectId}:${round}:${slot}:${type}:${actionId}`。2AP行动必须slot1；1AP可以slot1或2。所有来源限定在registry中，不允许仅用flags或history代替实际证据。当前节点记录的AP必须已扣，其他实际行动也至少扣1AP。

两份工作都为2AP／精力2／钱成本0；手艺与学业练习都是1AP／精力2；工具价格12、笔记本10、购买均1AP／精力0；关系三步骤均为1AP／精力1／钱成本0。购买必须有对应物品和同round8的purchase账本；其它步骤对应registry的kind及strategy.evidence。

history摘要保持`id,status,resultId,settledRound,stepsDone,preparationActionId,指标字段?`。preparationActionId各自只允许：手艺null/routine-repair/toolkit；学业null/routine-study/study-notebook；关系null/routine-record。history只回顾，不解锁；下一世项目清空。

## 纯API

- 原API保留：`ID`、`JOB_ID`仍为手艺，`getJobDefinition()`仍返回手艺工作；`accept/withdraw/record/settle/normalize/isUnlocked/getView`。
- `getDefinitions()`返回完整registry脱离状态的副本；`getDefinition(projectId)`返回一项副本或null。每项含id、routeId、title、skillKey、finalField、minimumSkill、steps、labels、details、summary、alternatives、completedLabel、activeLabel、unlockId、unlockKind、completed。steps各为choice数组；choice字段为type/actionId/kind/ap/moneySpent/energySpent。
- `getJobDefinitions()`返回手艺与学业两份工作；`getLifeActionDefinitions()`返回协作照料。模块不修改CONTENT。
- `getOffers(life)`在19岁未选项目时返回三份视图，其余为空；`getView(life,projectId?)`有项目时始终投影实际项目，无项目时默认当前追踪路线。
- `isUnlocked(life,projectId)`严格按项目ID判定，不能把任意completed当作所有路线都解锁。
- `summarize(record)`返回真实结果摘要，active/null返回null。

view保留原UI字段；新增routeId和`skill:{key,label,current,target}`，definition新增skillKey/minimumSkill。手艺额外保留minimumCraft和craft兼容字段。unlock包含kind、jobId或actionId、unlocked、minAge。新结果不假装工作，协作照料需呈现在生活安排入口。

## 引擎精确挂点

1. `getJobs()`使用`[...CONTENT.jobs,...PROJECTS.getJobDefinitions()]`；新增`getLifeActions()`合并CONTENT.lifeActions与getLifeActionDefinitions；getLifeAction、UI列表、可用性和预览都读该集合。
2. `requirementMet`的project类型改为`PROJECTS.isUnlocked(life,requirement.id)`，不能再强制requirement.id===PROJECTS.ID。
3. `captureProjectReceipt`增加`inventory:[...life.inventory]`，供购买笔记本验证购买前没有该物品；保留hadToolkit兼容旧调用。其他before字段不变，不能从UI payload读取。
4. `recordProjectAction`仍在真正扣AP、收付款和普通证据之后；反馈改为通用“青年项目向前推进”。`settleProject`原28岁事件后挂点不变。
5. `summarizeProject`调用`PROJECTS.summarize(project)`，同时覆盖finalStudy/finalEmpathy，保持原craft摘要原样。
6. strategy `canonicalKind/sourceFor`通过getJobDefinitions和getLifeActionDefinitions识别来源；不能只比较单个JOB_ID。1AP咨询可以同节点做两次：工资、成本、jobShifts与账本按两次实际行动执行，strategy evidence按现有round/kind/id去重。咨询不是tutor-shift，不伪造两个节点的辅导成果；原阶段目标继续由真实辅导、晋升和调查证据完成。
7. 物品与兴趣继续走共享getLifeActionEffect：笔记本可纳入专业咨询的额外学识1（与辅导一致）；相机无需给予咨询公共建设。协作照料可纳入急救包额外身体1，与亲自照料一致。它没有jobId，不增加jobShifts、劳动收入或工作愿望证据，−3元按原life消费账本记一次。新动作的兴趣映射由现有同类定义确定，不直接追加项目奖励。
8. save按registry语义独立校验，再调用normalize私有副本复核；坏记录拒绝，不修成空项目。原3份手艺体验档继续有效。

## 首版经营取舍

学业专业咨询为1AP、收入6、精力−2、压力+1，无基础技能／学校／晚辈成长；稳定辅导为2AP、收入8、精力−2、压力+1及学识／学校／晚辈成长。咨询一次后余1AP，可休息、记录或照料；连续两份收入12但耗4精力，不能把AP灵活性视为无代价。小镇工作收入11、仅耗2精力且有公共成长，是必须保留的替代项。21岁准备相对辅导少当期工资8，笔记本另花10，不承诺现金回本。

协作照料为1AP、现金−3、精力+2、压力−1、家人和晚辈各+1，无基础体谅成长。亲自照料为1AP、精力−1、体谅+1、家人+1且不花钱。网络给的是用现金分担负担并让晚辈参与的选项，不能免费无限恢复；同节点可用两次，但必须每次付3元与1AP。与免费休息相比，协作照料增加晚辈关系而不增加基础身体和心气；不能把精力或关系已满时的恢复与成长算作实际收益。最初只有家人+1的候选被否决：推荐关系开局在中年家人已满，使该行动被免费休息压过；晚辈收益必须在实际未满的自然状态下验证。

全部数值为代理内部多策略验证基线。完整23节点、五阶段成果、实际账单、结局重导入和遗产交接的预算见行为测试输出；内部验证不冒充真人试玩。
