---
document_id: RESEARCH-ROLES-20260828
title: 游戏开发角色研究与《回声镇》Agent裁剪
status: 已完成
version: 1.0.0
as_of: 2026-08-28T00:20:52+08:00
canonical: false
source: 行业资料与项目约束推导
---

# 游戏开发角色研究与《回声镇》Agent裁剪

## 研究问题

常规游戏开发需要哪些职能；哪些必须成为本项目的独立 Agent；怎样避免把大型工作室的组织成本搬进一款小体量中文文字游戏。

## 来源事实

1. ScreenSkills 将游戏岗位分为制作、设计、美术、动画、技术美术、音频、程序与质量保证等部门；这说明完整产品需要覆盖“方向与组织、玩法、内容表达、呈现、技术、验证”等能力，而不等于每个能力都必须由一名独立成员承担。
2. Unity 的制作周期课程明确指出，大型工作室会把职责分配给不同人员，而小型工作室或个人开发者通常需要一人承担多个角色。
3. 游戏制作人负责连接各学科、明确受众和差异、控制进度与资源；GDC 的制作与团队领导资料也把规划、优先级、排期、风险、跨学科协作和范围控制列为核心工作。
4. Gameplay Designer 负责核心游玩体验、结构与规则；Gameplay Programmer/技术角色负责把GDD中的互动与成长系统实现，并与设计、叙事和QA协作。
5. 游戏写作是互动式、跨学科且持续迭代的工作；玩家通过行动参与叙事，因此叙事不能被当作与玩法无关的小说文本。
6. UX负责玩家需要什么信息，UI负责怎样传达；ScreenSkills明确指出，小型工作室常将UX与UI合并。
7. QA不是泛泛“试玩”，而是针对明确目标重复测试、准确记录、修复后复测，并检查程序、文字、画面、声音与版权问题。

## 项目事实

- 本作是中文单机文字人生模拟游戏，首发网页/PWA。
- 首版无账号、联网、多人和游戏内付费，也无运行时AI。
- 规划完成前不制作代码、美术或原型。
- 成败高度依赖：核心循环、跨世系统、事件内容、世界一致性、文字质感、移动阅读体验与可验证的数据规则。

## 设计推断

- 不设置独立3D、美术、动画、网络、LiveOps、社区和商业化 Agent：它们不是当前规划阶段的持续主线。视觉方向与音频需求先并入UX角色，正式进入资产生产前再依据路线图拆分。
- 不把每份专题文档机械地对应一个 Agent：角色应按专业判断边界划分，否则会产生十余个只写一份文档的孤岛。
- 市场研究、产品边界与创意方向合并，因为小项目的受众、玩家承诺和范围必须由同一角色闭环。
- 系统设计与事件规则工程合并，但叙事角色只提交内容意图，不直接写数值规则，避免同一事件文档多头写入。
- 内容编辑与AI治理独立出来，用于守住“低AI感”、事实一致性和人工复核边界；它不能创造核心世界真相或数值。
- QA与制作合并为独立审查角色，但无权自行宣布门禁通过，避免“既当运动员又当裁判”。

## 推荐组织

采用“1个总控 + 7个未来专业 Agent”：

1. A00 主Agent／总控整合。
2. A01 产品、玩家与创意方向。
3. A02 核心系统与事件规则。
4. A03 世界观、人物与叙事。
5. A04 内容编辑与AI生产治理。
6. A05 UX/UI、无障碍与声音体验。
7. A06 技术与数据架构。
8. A07 制作、QA与风险审查。

这不是八人编制，也不是要求同时启动八个对话；它是八种不可丢失的责任视角。默认只有A00常驻，每次只启用当前阶段的一名主写角色，必要时再启用A07做独立审查。

## 参考资料

- ScreenSkills，Games career profiles：https://www.screenskills.com/job-profiles/browse/games/
- ScreenSkills，Games producer：https://www.screenskills.com/job-profiles/roles/games-producer-games/
- ScreenSkills，Gameplay designer：https://www.screenskills.com/job-profiles/roles/gameplay-designer/
- ScreenSkills，Games writer：https://www.screenskills.com/job-profiles/browse/games/design/writer-games/
- ScreenSkills，UX designer：https://www.screenskills.com/job-profiles/roles/user-experience-ux-designer/
- ScreenSkills，Games tester：https://www.screenskills.com/job-profiles/roles/games-tester/
- ScreenSkills，Gameplay programmer：https://www.screenskills.com/job-profiles/roles/gameplay-programmer/
- Unity Learn，Explore the production cycle：https://learn.unity.com/tutorial/explore-the-production-cycle?version=2022.3
- GDC，Production & Team Leadership：https://gdconf.com/production-team-leadership/
- IGDA，Game Crediting Guidelines 10.1：https://igda.org/wp-content/uploads/2021/11/IGDA-Game-Crediting-Guidelines-10.1-March-2023.pdf

检索日期：2026-08-28。以上来源用于识别行业职能，不用于照搬岗位数量。
