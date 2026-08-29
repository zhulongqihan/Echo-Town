# 《回声镇：一生一局》

一款全中文、单机、离线可玩的网页/PWA文字人生游戏：你只有这一生，但小镇会记住你留下的东西。

## 直接体验

- 根目录唯一试玩入口：[`index.html`](index.html)；打开后会自动进入游戏本体
- 游戏源码入口：[`development/game/index.html`](development/game/index.html)（仅作为单一源码，不作为日常交付入口）
- 可分发可玩包：[`output/releases/echo-town-playable-20260828.zip`](output/releases/echo-town-playable-20260828.zip)
- 在项目目录中直接双击根目录`index.html`即可试玩；发行包解压后也直接打开包根目录的`index.html`。
- 若要启用PWA安装和应用壳缓存，再用任意静态服务器提供项目目录；游戏规则和存档仍保持本地运行。

## 当前可玩内容

- 12个生命节点、每节点3个选择、6项本世资源、6条城镇状态和4组人物关系；
- 5个条件/默认结局、下一世继承、遗物、发现、回声和历世镇志；
- v3本地存档导入/导出（兼容v1/v2）、异常存档保护、PWA安装资源、电脑/手机响应式布局；
- 不需要账号、网络服务、付费系统或运行时AI。

## 验收与状态

- [D2浏览器验收](development/tests/d2-browser-acceptance.md)
- [D2存档完整性验收](development/tests/d2-save-integrity.md)
- [D2实验发行说明](development/release/D2-experimental-release.md)
- [D2交付完成度审计](development/release/D2-delivery-audit.md)
- [当前可玩构建审计](development/release/playable-build-audit-20260828.md)

当前发行物是已通过内部角色专项审计的旧版可玩回退构建。用户试玩已发现核心循环存在“可完成但不可理解、不可规划”的问题；当前正在进行G3核心循环重规划，详见[`核心循环重规划提案`](planning/replans/20260829_core-loop-replan-proposal.md)和[`变更申请`](planning/changes/CHANGE_20260829_006.md)。新方案通过垂直切片验收前，旧版仍保留为回退基线。

## 后续交付约定

所有后续可试玩版本都必须在项目根目录提供`index.html`作为稳定入口；游戏源码只保留在`development/game/`，根入口不复制游戏代码，避免入口和源码分叉。
