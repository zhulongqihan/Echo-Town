# 2026-10-22 18:31 断点续接与上下文摘要

## 当前目标与约束

- 用户持续目标：执行 `planning/replans/REPLAN_20261022_desktop-experience.md` 全部计划；最新消息要求检查断点和子智能体后继续实施。
- 只优化电脑体验，参考 https://cyberhiking.com/；保留五阶段、23节点、每节点2AP、全中文、离线/PWA和根目录双击入口。
- 完整目标不能缩减为青年切片。计划中青年切片之后的真人走查门槛仍有效：5名无提示试玩者，至少4人能解释下一步及代价，至少3人自发想继续；自动化和代理不能冒充真人证据。
- A00唯一写正式源码，代理仅写 `output/implementation-proposals/`。工作树大量既有未提交改动必须保留，不能回退HEAD或清理。
- durable goal `执行你上面的计划` 为 active，无预算。当前没有完成全目标，不能标为complete。

## 权威与基线

- `planning/00_master-index.md` MASTER3.43.0，D7实施，授权DEC-20261022-026，任务 `planning/agents/A00-main-integrator/TASK_20261022_016.md` 工作中。
- 旧版已验证D6：content6.0.0 / savev8 / cache echo-town-strategy-v8-4。77项Node行为测试、40世存档最大442291字节、10张WebP共1603758字节等是旧版记录，不能作为本次v9验收。
- `output/baselines/desktop-v8-20261022.zip` 已备份本轮开始时正式源与测试，25,067,986字节；创建时与已验证v8发行包运行时无差异。
- 新修改尚未整合完成；正式源是当前事实，提案和旧摘要都不能冒充已交付。

## 已写入正式源但未整体验证

- 新增 `development/game/projects.js`，最初复制自gameplay提案；需再次同步最新工资12版。
- engine.js：新增PROJECTS引用（可选兼容）、动态getJobs/getJob、项目requirement、创建/规范化项目、ACCEPT_PROJECT/WITHDRAW_PROJECT、执行前私有凭证和执行后record、28岁事件后settle；凭证round已补。
- engine仍SAVE_VERSION8/STORAGE_KEYv8；save/index/styles/scene/UI尚未整合v9提案。
- strategy.js job source认识新项目工作，尚缺中年修理证据；工具对新工作加成尚缺。
- 必须补：craft:middle的nextIds加入project-craft-shift；toolkit修理动作映射和machinery兴趣映射加入新工作；learn愿望实际工作证据；项目history紧凑摘要；28岁反馈导入后的advance幂等settle兜底。

## 三个代理与提案

### gameplay_resume

- `output/implementation-proposals/desktop-v9-gameplay/{projects.js,projects.test.js,integration.md}`。
- 19/21/24/28岁共8AP；19与24帮工各2AP、21练习或买工具1AP，必要5AP，剩3AP。
- 自然开局19现金27；稳定帮工/练习准备/购工具到28现金48/41/29，原青年阶段成果可完成。
- 新工作project-craft-shift：2AP、工资12、精力-3、压力+2，无基础技能/小镇增长，不损身体；工具仍应给修理技能+1。相对普通帮工+5现金/-1精力/+1压力并少基础成长。
- 相比小镇项目11元/2精力/1压力，只多1元而更耗资源；相比夜班13元少1元但保留身体。首版待真人验证，不能声称已平衡。
- 上次原样正式引擎9/11通过；两项失败正是中年证据与工具映射未接。
- 本次已followup恢复，等A00补正式源后跑原样引擎和幂等测试；仅写输出目录。

### ui_implementation

- `output/implementation-proposals/desktop-v9-ui/{index.html,styles.css,scene.js,integration.md}`，尚未复制正式源。
- 180旧DOM ID保留，主场景/右操作区/顶部HUD/23节点时间线/原生dialog信息抽屉。
- 临时bridge的Chrome1366x768、1920x1080、1093x614、1536x864无外层溢出；背包Esc归还焦点；重复render/查看不改变状态；console无错。这不是正式整合验证。
- 小高度项目标记与热点有重叠风险。本次followup恢复修提案，冻结后再由A00复制。
- A00接线：bind/render调用Scene；quick-start保留active或complete待遗产人生；项目命令；动态getJobs；新工作直接和稳定帮工并列；dialog内反馈焦点不能跳到被模态遮蔽的主页面；模态期间禁止数字快捷键执行背景操作。

### validation_resume

- `output/implementation-proposals/desktop-v9-save/{save.js,save.v9.test.js,README.md}`，24/24提案行为测试通过；尚未复制正式源。
- 本次followup请其补精确旧测试更新建议、独立review。
- v9独立key，previousStorageKey=v8，v7StorageKey=原echo-town-generation-save；v9最高优先坏档保护，v8/v9 tombstone阻止旧档复活。
- migrateV7ToV8保留输出8；migrateV8ToV9与migrateToCurrent输出9；不可盲目把旧测试所有8替换9。
- runtime.migration.test.js中按字符串`version: 8`回退旧提案的路径必须删除，只测正式源。
- 导入原文2MiB/有效紧凑512KiB，原子备份/候选保存/内存切换；原v8/v7原文保留，不重抽、重跑、补账。

## 项目结构与接口

- window.EchoTownProjects纯模块：normalize(raw,life), accept(life,id), withdraw(life), record(life,receipt), settle(life), isUnlocked(life,id), getView(life), getJobDefinition()。
- normalize返回脱离原life对象的新对象，undefined初始化，显式null坏档。UI不能修改规则状态。
- life.projects={version:1,eligibleFromRound:7|null,current:null|{id,status,acceptedRound:7,steps,settledRound?,resultId?,finalCraft?}}。
- 稳定项目ID craft-customers-youth-v1。步骤firstWork(7)、preparation(8)、returnWork(9)。工作shop-shift/2AP/-2精力/slot1；准备routine-repair/1AP/-2精力或toolkit/1AP/-12钱。
- receipt={type,id,round,before:{actionPoints,sideActionsUsed,money,energy,hadToolkit}}，只由引擎捕获，不信任UI资源值。
- 工作/练习与strategy.evidence相互核实；买工具与ledger.purchase同round/id/-12和inventory核实。
- 28岁真实事件后3步且手艺>=5成功，结果一次；接受/退出/结算不额外发钱技能AP。既有原阶段成果独立。
- 新人生/可合理接入的旧19岁未安排人生eligible7，晚于此的旧档null；不从老证据补造项目步骤。
- history.projects紧凑摘要：{id,status,resultId,settledRound,stepsDone:0..3,preparationActionId:null|routine-repair|toolkit,finalCraft?}；withdrawn省finalCraft，无项目省整字段；历史摘要不用于当前解锁。

## 后续执行顺序

1. 同步最新projects、补engine/strategy接点与项目摘要；原样规则行为测试通过。
2. 正式save.js迁移v9，更新engine版本、namespace、契约、测试夹具（保留显式v7→v8测试），拒绝老提案回退。
3. 复制冻结UI提案，接正式UI hooks、job入口、focus/keyboard。index顺序content→strategy→projects→save→engine→audio→scene→ui→game。
4. SW新cache echo-town-desktop-v9-1，shell包括projects/scene，只清本游戏cache，媒体失败无阻断。
5. 运行有意义的Node/Python校验，正式桌面浏览器全流程、键盘/dialog、刷新迁移/离线/双击/PWA更新。40世保留历史容量复核。
6. 可玩切片、完整可审查包、说明和真实验收记录就绪，再收5名真人反馈。真人门槛未过不得冒充完成，也不扩大量内容掩盖问题。
7. 达标后继续两路线双打法、五阶段标志决定、4人物3次相遇、个性结算/遗产、最后分享/固定挑战；全目标保留。

## 工具与会话

- Node F:\yangyang\nodejs\node.exe；Python C:\Users\yang\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -X utf8；默认WindowsApps python不可用。
- Playwright CLI C:\Users\yang\AppData\Local\npm-cache\_npx\31e32ef8478fbf80\node_modules\@playwright\cli\playwright-cli.js，PWTEST_DAEMON_SESSION_DIR=F:\selfplay\output\playwright\daemon。
- 旧主代理HTTP session59219在4175，desktop-v9-game浏览器原在v8首页；续接先查活性，不因观察超时重开。UI代理临时bridge浏览器/8546服务已关闭。
- 参考站截图output/playwright/cyberhiking-desktop-*.png；本日实站已浏览，网页正文抓取只有一句。动机因素属于设计推断，不是研究已证因果。
- using-superpowers/reconcile/impeccable/playwright已用过；不重复追问已明确范围。Pages技能禁用。不发布外网、不发他人消息、不擅自提交推送。

本文件是恢复线索，后续以源码、正式验收和最新用户纠正为准。
