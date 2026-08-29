---
document_id: ROOT-PLAYABLE-ENTRY-ACCEPTANCE-20260829
title: 根目录网页版试玩入口验收
status: 已通过
version: 1.0.0
as_of: 2026-08-29T17:49:29+08:00
canonical: false
source: A00真实浏览器验收
pending: []
supersedes: []
---

# 验收结论

根目录`index.html`已通过真实浏览器访问。用户从项目根目录进入后，会自动到达当前游戏本体并可以开始第一世。

## 验收记录

| 项目 | 结果 |
| --- | --- |
| 根目录地址 | `http://127.0.0.1:4179/` |
| 实际游戏页 | `/development/game/index.html` |
| 页面标题 | `回声镇：一生一局` |
| 首屏 | 可看到“开始第一世”和三种今生方向 |
| 开始流程 | 点击“开始第一世”后进入7岁第一个人生节点 |
| 本地应用壳 | Service Worker已接管 |
| 控制台 | 0 errors，0 warnings |
| 请求范围 | 根页及`development/game/`下本地资源，无外部地址 |

## 结论边界

本记录证明根目录入口和首屏启动可用，不替代完整人生、五结局、存档迁移、断网和用户主观体验等已有/待用户回填的独立验收。
