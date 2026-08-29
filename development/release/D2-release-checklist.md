# D2 实验发行包清单

更新时间：2026-08-28

| 检查项 | 结果 | 依据 |
| --- | --- | --- |
| HTML/CSS/JS/manifest/favicon齐全 | 通过 | `development/game/`包目录 |
| Service Worker缓存版本 | 通过 | `echo-town-mvp-v9`，包含两枚安装图标 |
| 断网启动与恢复 | 通过 | 真实 Chromium 离线重载后应用壳和本地存档仍可恢复 |
| JavaScript语法 | 通过 | `node --check development/game/game.js`、`node --check development/game/sw.js` |
| 项目结构与开发边界 | 通过 | `python planning/tools/validate_project.py` |
| 首世8节点完整流程 | 通过 | 真实 Chromium：`completedLives=1`、`history.length=1` |
| 存档异常输入 | 通过 | 损坏、恶意、越界、空人生、本地写入失败回归 |
| 可分发包内容 | 通过 | `echo-town-d2-experimental-20260828.zip`已生成并核对压缩包目录，6个核心文件和游戏README全部存在 |
| 包内代码版本 | 通过 | 压缩包内`game.js`含反馈回声转义，`sw.js`含`echo-town-mvp-v9` |
| 包完整性摘要 | 通过 | SHA-256已写入`echo-town-d2-experimental-20260828.zip.sha256` |

本包是 D2 实验性发行物；正式发布仍需 G8/G9/G10 和用户批准的最终 GDD。
