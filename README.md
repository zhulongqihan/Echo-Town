# 《回声镇：一生一局》

一款全中文、单机、离线可玩的网页/PWA文字人生游戏：你只有这一生，但小镇会记住你留下的东西。

## 直接体验

- 根目录唯一试玩入口：[`index.html`](index.html)；打开后会自动进入游戏本体
- 游戏源码入口：[`development/game/index.html`](development/game/index.html)（仅作为单一源码，不作为日常交付入口）
- 可分发可玩包：[`output/releases/echo-town-playable-20260828.zip`](output/releases/echo-town-playable-20260828.zip)
- 在项目目录中直接双击根目录`index.html`即可试玩；发行包解压后也直接打开包根目录的`index.html`。
- 若要启用PWA安装和应用壳缓存，再用任意静态服务器提供项目目录；游戏规则和存档仍保持本地运行。

## 当前可玩内容

- 5个成长阶段、23个生命节点、每节点3个选择，共69个行动；
- 5种身份、8种天赋、6个愿望，资源/技能/关系/小镇基础经营；
- 16件遗产（结算最多选3件）、12项成就、8条彩蛋和历世镇志；
- v5本地存档导入/导出、刷新恢复、异常存档保护、PWA应用壳、电脑/手机响应式布局；
- 不需要账号、网络服务、付费系统或运行时AI。

## 验收与状态

- [D2浏览器验收](development/tests/d2-browser-acceptance.md)
- [D2存档完整性验收](development/tests/d2-save-integrity.md)
- [D2实验发行说明](development/release/D2-experimental-release.md)
- [D2交付完成度审计](development/release/D2-delivery-audit.md)
- [当前可玩构建审计](development/release/playable-build-audit-20260828.md)

当前根目录入口指向已通过内部结构、可达性和浏览器长流程验收的 D3 丰富版切片；用户试玩仍需复核第一眼理解、实际耗时和第二世重玩意愿。旧版发行包与规则继续保留为回退基线。详见[`丰富版验收表`](development/tests/rich-loop-acceptance-20260829.md)、[`审阅报告`](planning/reviews/REVIEW_20260829_025-richness-audit.md)和[`最新交接`](planning/handoffs/20260829_026-richness-loop.md)。

## 后续交付约定

所有后续可试玩版本都必须在项目根目录提供`index.html`作为稳定入口；游戏源码只保留在`development/game/`，根入口不复制游戏代码，避免入口和源码分叉。
