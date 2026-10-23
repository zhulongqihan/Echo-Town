# D6 / v8 正式源独立审阅证据

日期：2026-10-15。审阅者：validation_resume 子智能体；最终批准人仍为 A00。未写正式源，未代签历史 A04，未重跑全部 Node suite 或 40 世测试。

结论：三项正式 Python 检查均通过其机械检查；本轮核实并协助修复了天赋属性收益与精力上限、已满足门槛的展示、四项遗产误导文案。三路线和迁移的结构与行为证据足以供 A00 审阅批准；收口前仍需处理下列三处可复现文案不一致。浏览器结果由 A00 提供，不能算作本子智能体亲测。

## 实际运行记录

```powershell
$reviewPython = 'C:/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
& $reviewPython -X utf8 development/tests/validate_save_contract.py
& $reviewPython -X utf8 development/tests/validate_runtime_boundaries.py
& $reviewPython -X utf8 development/content/validate_content.py --allow-pending-review
node output/implementation-proposals/validation-resume/legacy-handoff-review.cjs
node output/implementation-proposals/validation-resume/review-repro.cjs
```

结果：

- 存档契约：schema 4.0.0 / v8，接受 v7、v8；有效紧凑档 524,288 字节，输入 2,097,152 字节；其内置的 26 个事务/迁移测试全部通过。没有另外执行完整 Node suite。
- SW VM：仅清理本游戏缓存；十张媒体全部加载失败不阻断应用壳安装；非导航资源离线返回 503，导航允许 HTML 回退，均通过。
- 模块边界：规则模块无 DOM、localStorage、音频与网络依赖；脚本顺序、只读快照、原 `dispatch → {ok,state,events,error?}` 契约通过。
- 有效内容：真实 VM 顺序加载 content.js → strategy.js，107 行动、23 个无条件零成本保守选项、15 目标、3 条事件链、10 WebP / 1,603,758 字节通过。73 项审阅仍 pending，未将结构通过冒充最终批准。
- 额外实际交接：正常公开命令游玩 23 节点，49 岁保存湿账页。结算镇志为 1；选 wet-ledger 交接后 world 镇志为 2；第二世仍为 2。重复确认交接被拒绝，重复 START 与重新载入均仍为 2。

上述 Python 检查运行于本轮审阅开始；天赋与门槛修复后执行了后两条精简 VM 复现，结果如下。A00 的最终总回归另行归档。

## 已核实的修复与撤回项

| 项目 | 修复前实测 | 当前实测 / 代码证据 |
|---|---|---|
| 体魄天赋生效时点 | strong-back 后体魄 8，但上限仍 11 | 体魄 8 → 上限 12 |
| 家境天赋换算 | 基础家境 6 / 钱 17；good-family 后家境 9，却只得钱 21 | 家境 9 → 钱 27，额外属性与直接 +4 均兑现 |
| 精力上限继承 | 体魄 10 + steady-habit 仍为 12 | 当前上限 13 |
| 已满足门槛可见 | available 的作坊只显示钱 -10，不显示手艺门槛 | preview 返回 requirements：积蓄 10、手艺 4，均 met=true；UI 有对应渲染 |
| 未实现的额外入口承诺 | 菜谱宣称新家庭选项、湿账页提前调查、发条中年隐藏事件、明信片解锁离镇线 | 四项已改为实际数值收益或仍须满足条件的说明 |
| 小镇遗产效果 | 曾误将 createLife 中 includeTown=false 判断为漏效 | 已撤回：confirmLegacies → applyLegacyToWorld 在交接时执行；createLife 克隆 world.town，false 防重复。上面的完整交接回归证明正确 |

## 尚待 A00 收口的可复现点

1. **两项成就描述误称“结束时”才授予。** `content.js` 的 `balance-sheet` 描述“一世结束时”，实际条件只有 bought-item + first-wage；`kept-breath` 写“结束时保有 6 点身体”，实际为 inventory≥1 且当前 health≥6。`unlockAchievements()` 在生活行动和购买等途中调用，并无 complete 状态前置。建议保留当前规则，分别改为“领取过工资，并为生活购置过物品”“拥有至少一件物品，当前身体达到 6”，避免许诺不存在的结算限定。对应 `achievements_and_easter_eggs_have_feedback`。
2. **“还来得及”成就的说明比真实触发宽。** `second-chance` 目前写“在压力达到 8 后仍将心气恢复到 7”，但只有 `resolveAction` 中的一次人生事件将压力从≥8 降至≤6、且心气≥7 才写入旗标。单纯生活休息达到同样最终状态不会授予。建议文案明确“一次人生事件中将压力从至少 8 降到 6 以下，同时保有至少 7 点心气”，或 A00 若选择拓宽触发，应补相应行为回归。当前建议仅改文案。
3. **状态全满时休息预览会误称技能封顶。** 精力/身体/心气全满、压力/期待为 0、运动兴趣 10 且无额外物品收益时，`previewAction(routine-rest).changes=[]`。UI 随后用 `getLifeActionCopy()` 的兜底字符串“本阶段该能力已达增长上限”，其实该操作没有增长技能。已在 `review-repro.cjs` 精确复现。建议无变化兜底改成“当前状态没有新增收益；仍消耗 1 行动点”；技能封顶继续由 previewAction 的具体上限提示负责。对应 life_actions.routine-rest 与 resource_cost_preview_matches_execution。

以上为本轮发现的剩余问题；不是未发现问题的绝对保证。未将极端存档溢出场景或未运行的浏览器动作写成通过。

## 73 项 pending 的批准依据与边界

| 审阅范围 | 已完成的独立审阅 | A00 批准前需要 |
|---|---|---|
| 23 个节点 assets | 69 旧事件的标签、详情、结果与后续文本；23 保守项、9 链行动、3 代表遗产入口、3 最终交接；总量与 ID / 年龄 / 阶段引用对应 | 可结合最终试玩批准；保守安排确为无前置/零成本且不授主要成果 |
| 7 生活行动 | actual effect 与统一预览调用链；精力成本、休息 2 / 1、兴趣副作用、物品叠加；生活操作使用规则预览，旧静态 goalPoints 不再计愿望 | 修复上文无收益休息文案后批准 |
| 6 工作 | 工资、行动点、精力/健康损耗、职业要求与 ledger 的 work 类别；固定工资按代码显示，使用 previewAction 实际增减 | 可批准；旧 authored preview 中未使用的固定分数字样不会驱动愿望 |
| 6 物品 | 工具→修理/修理工作；笔记→学习/记录/辅导；外套→休息及送货/夜班减损；手机→社交；急救包→照料/休息；相机→记录/探索/小镇工作镇志 | 当前实现映射与可见描述一致，可批准 |
| 12 人生片段 | trigger 引用存在，生活/工作/购买/账单/事件来源与玩家文案对应；collectMoments 去重，反馈和收藏入口保留 | 可批准；这些是片段收藏，不能冒充路线目标已完成 |
| strategy | 15 目标对照批准计划；证据按阶段、真实成功结果筛选；阶段末冻结 checks；后续成长不补早期成果；3 链跨 13/21/36、13/21/49、15/32/47，第三步各有成功和失败结果；75 岁交接不补前阶段 | 结合主 agent 三条自然路线完整回归批准 |
| 机会 / 兴趣 / 角色三组 | 18 机会的成本/门槛/作用；兴趣与八角色的有效引用；night-market 已是明确固定分成，summer-job 不再虚称职业次数，school-duty 不再虚称旧分数目标 | 可批准 |
| media | 十张 WebP 文件格式与体积、五阶段/五事件引用、本地 Web Audio、SW 可选媒体失败容错 | 图像视觉、音量试听与浏览器状态由 A00 的截图/实际记录补足 |
| 14 checks | 目标/行动/阶段结构、路线分歧、已满足门槛、统一检定、迁移、证据判定、遗产交接、结果反馈均有上述代码或机械证据 | 成就文案与无收益休息收口；mobile_keyboard_and_offline 采用 A00 实际浏览器记录，不引用本报告当亲测 |

文本审阅确认：叙事保持全中文生活语气；借款明确增加债务且不算收入；家庭分担与休息有正当选项；失败链说明未完成/证据不足，而不强行写成成功；没有把实现过程或审阅指令混入新增的玩家内容。此处可支持 `voice_and_sensitivity`、`ai_draft_deletion`，不代表测得“好玩”。

三条代表遗产的新增选择是可核对的真实入口：small-tool→8 岁拆装、study-notebook→13 岁整理方法并可接 21 岁试讲、friend-letter→32 岁共同照料。其他遗产不应被描述为有尚未实现的额外事件。

六愿望由实际工作/家庭分担/多阶段关系/公共项目/记录/自主选择与状态共同判断；旧 `goalPoints` 不再直接累加到完成。路线结局优先用阶段成果，技能满级本身不构成最高评价，代价保留债务、健康、压力。结局 UI 分开呈现成果、代价与遗产。

## 浏览器证据归属

A00 已报告完成手机桌面、键盘/焦点、音量、失败导入、保存失败阻止更新、缓存隔离/离线、根 file 入口和刷新、媒体全失败可玩、完整 craft 五成果及真实第二世工具入口、v7 启动迁移和坏 v8 保护。本子智能体未操作这些浏览器会话；最终审阅记录应链接 A00 的实际验收产物。

当前取证 SHA-256（后续主 agent 收口会改变内容或引擎 hash）：

- content.js：`C4C78B616E23DDF04571B053D008BD525F550C65CD1627FFC9704B357E7D5859`
- engine.js：`B2FEEFD14CD0DCA9D5A46246B952B8E8ED982731119A9F6C354ADF7FA1BF9990`
- strategy.js：`480DC84A4A288D8E49CF3E7305AD0D3ADFC6F013B2586B38AB7A3AD89AF98BFD`
- ui.js：`ADF2EDD833CD17DD9EA6088E3CC8C5B4EF658C4D88D156D0EC1ECB5106B7255B`

不要批量将历史 previous_reviews 重新签署；A00 在实际收口与验收后只更新当前 6.0.0 的 status / checks / reviewed_at。

## A00 整合后记（2026-10-15）
上文剩余三处文案已修复：两项成就时点、还来得及的真实触发条件、满状态休息无收益提示。最终77项行为测试、四项Python校验和浏览器验收通过；当前content-review 73项均经A00批准。具体见development/tests/strategy-v8-acceptance-20261015.md。原审阅正文保留取证时点。
