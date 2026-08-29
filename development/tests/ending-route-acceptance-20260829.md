# 《回声镇：一生一局》五结局浏览器验收

日期：2026-08-29 00:36（Asia/Shanghai）  
环境：全新 Chromium 页面会话，发行候选包 v13，12 节点完整流程。

## 验收结果

以下每条路线都从清空的第一世开始，逐节点选择并点击下一页，在96岁封存后读取结局页和本地存档。结果不是直接注入状态所得。

| 结局 | 今生方向 | 12节点选择ID序列 | 结局页 | 关键阈值结果 |
| --- | --- | --- | --- | --- |
| 河床归位 | 记事的人 | `kite-cross → school-sell → secret-report → bridge-map → shop-teach → flood-people → ledger-trade → radio-river → bell-key → mail-invite → window-home → last-boat` | 河床归位 | bridge=3, river=3, trust=3 |
| 名字留下 | 记事的人 | `kite-share → school-read → secret-report → bridge-map → shop-record → flood-ledger → ledger-open → radio-archive → bell-name → mail-fold → window-catalogue → last-book` | 名字留下 | archive=3, lin=3, insight=6 |
| 手艺传下去 | 修路的人 | `kite-cross → school-sell → secret-burn → bridge-fund → shop-teach → flood-people → ledger-trade → radio-teach → bell-key → mail-invite → window-teach → last-hand` | 手艺传下去 | workshop=3, children=3, craft=6 |
| 灯火有回信 | 守灯的人 | `kite-share → school-read → secret-keep → bridge-shop → shop-teach → flood-people → ledger-protect → radio-archive → bell-name → mail-answer → window-home → last-hand` | 灯火有回信 | light=3, ahe=3, bond=6 |
| 一页未完 | 记事的人 | `kite-sell → school-leave → secret-report → bridge-shop → shop-river → flood-people → ledger-protect → radio-river → bell-key → mail-invite → window-catalogue → last-book` | 一页未完 | 未满足前四条优先级条件 |

## 共同结果

- 五次均显示`screen-ending`，每次`completedLives=1`、`history=1`、选择数=12。
- 结局优先级可复现：条件同时满足时按河床归位、名字留下、手艺传下去、灯火有回信、一页未完判断。
- 失败结局不是空白页：仍显示判词、统计、回声和下一世入口。
- 本记录只证明路线可达和规则可复现，不替代用户对文本吸引力、实际时长和重玩意愿的体验判断。
