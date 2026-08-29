---
document_id: HANDOFF-20260829-022
title: 根目录网页版试玩入口交付
status: 已交付，待用户试玩
as_of: 2026-08-29T17:49:29+08:00
owner: A00
---

# 交付结论

用户要求优先提供网页版，并把可以直接试玩的入口放在项目根目录，后续交付沿用该方式。已在根目录新增`index.html`，打开后自动进入当前游戏本体。

## 入口与源码

- 根目录试玩入口：[../../index.html](../../index.html)
- 唯一游戏源码：[../../development/game/index.html](../../development/game/index.html)
- 可分发包：[../../output/releases/echo-town-playable-20260828.zip](../../output/releases/echo-town-playable-20260828.zip)

根入口只做稳定跳转和无脚本降级链接，不复制游戏代码；这样后续只维护`development/game/`一份本体，避免工作区入口和游戏版本分叉。发行包解压后的根目录原已有可直接打开的游戏`index.html`，本次不改变发行包内容和SHA-256。

## 已同步规则

- `planning/contracts/project-manifest.json`声明`index.html`为授权试玩入口。
- `planning/tools/validate_project.py`允许且检查该入口存在，其他未授权代码仍继续拦截。
- 项目README、开发README、生产发布路线、最终GDD、事件日志和决策日志均已登记该长期交付约定。

## 验证要求

已完成真实浏览器访问：根目录地址自动跳转到游戏，标题为“回声镇：一生一局”，首屏可看到三种今生方向并点击“开始第一世”进入7岁节点；Service Worker已接管，控制台0 errors/0 warnings，请求仅命中本地资源。详细记录见[根目录入口验收](../../development/tests/root-playable-entry-acceptance-20260829.md)。项目、内容、存档、语法和发行包校验也已全部通过。

## 未关闭事项

G10仍等待用户真实试玩回填：首次选择理解、单局时长、跨世变化、重玩意愿、设备/离线/刷新/JSON备份体验。根入口交付不替代这些用户证据。
