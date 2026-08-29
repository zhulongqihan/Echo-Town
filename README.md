# 《回声镇：一生一局》

一款全中文、单机、离线可玩的网页/PWA生活经营人生游戏：你只有这一生，但小镇会记住你留下的东西。

## 直接体验

- 根目录唯一试玩入口：[`index.html`](index.html)；打开后会自动进入游戏本体
- 游戏源码入口：[`development/game/index.html`](development/game/index.html)（仅作为单一源码，不作为日常交付入口）
- 可分发可玩包：[`output/releases/echo-town-playable-20260828.zip`](output/releases/echo-town-playable-20260828.zip)
- 在项目目录中直接双击根目录`index.html`即可试玩；发行包解压后也直接打开包根目录的`index.html`。
- 若要启用PWA安装和应用壳缓存，再用任意静态服务器提供项目目录；游戏规则和存档仍保持本地运行。

## 当前可玩内容

- 5个成长阶段、23个生命节点；每个节点先分配3点生活行动，再处理1个人生事件；
- 7种日常安排、6种工作、6件可购买物品：学习、休息、关系、账单、赚钱与消费互相牵制；
- 5种身份、8种天赋、6个愿望，资源/技能/关系/小镇基础经营；
- 16件遗产（结算最多选3件）、16项成就、10条彩蛋和包含工作履历/现金流的历世镇志；
- v6本地存档导入/导出、刷新恢复、异常存档保护、PWA应用壳、电脑/手机响应式布局；
- 不需要账号、网络服务、付费系统或运行时AI。

## 验收与状态

- [D2浏览器验收](development/tests/d2-browser-acceptance.md)
- [D2存档完整性验收](development/tests/d2-save-integrity.md)
- [D2实验发行说明](development/release/D2-experimental-release.md)
- [D2交付完成度审计](development/release/D2-delivery-audit.md)
- [当前可玩构建审计](development/release/playable-build-audit-20260828.md)

当前根目录入口指向已通过内部结构、经营长流程、跨世和移动端验收的 D4 生活经营沙盒切片；用户试玩仍需复核第一眼理解、实际耗时、经营决策感和第二世重玩意愿。D3与旧版发行包继续保留为回退基线。详见[`生活经营验收表`](development/tests/life-sim-acceptance-20260829.md)、[`审阅报告`](planning/reviews/REVIEW_20260829_026-life-sim.md)和[`最新交接`](planning/handoffs/20260829_027-life-sim.md)。

## 后续交付约定

所有后续可试玩版本都必须在项目根目录提供`index.html`作为稳定入口；游戏源码只保留在`development/game/`，根入口不复制游戏代码，避免入口和源码分叉。
