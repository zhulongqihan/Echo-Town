# 游戏本体入口

《回声镇：一生一局》的 D3 核心循环垂直切片。最简单的试玩方式是解压发行包后双击 `index.html`；游戏本体不需要联网、账号、安装或运行时 AI。若希望启用 PWA 离线缓存，用任意本地静态服务器打开即可。

## 当前可玩范围

- 每一世固定 8 回合，每回合从 3 个行动中选择 1 个；行动会明确展示代价、即时结果、开放条件和对后面的影响；
- 开局选择 3 种人生起点之一，再选择 3 个可解释目标之一；目标进度贯穿整世并在结算时清晰反馈；
- 钱、精力、身体是本世资源；手艺、照料、胆量、洞察是本世能力；师傅、邻里、学徒是本世关系；
- 修理铺、河桥、邻里、旧账是跨世小镇基础；一世结束后从已达成的遗产候选中选择 1—2 件，下一世会把它们转成可见的起始优势；
- 结算页解释“这一世做到了什么 / 小镇变成什么 / 下一世能用什么”；镇志记录每一世的目标、行动、结果和交接遗产；
- localStorage v4 存档，旧版存档保留但不自动迁移；支持导出 JSON、导入 JSON 和清除当前世代；
- 全中文、本地单机、确定性 seed、响应式布局、键盘 1 / 2 / 3 选择、大字模式和基础 PWA 离线缓存。

## 设计边界

这不是最终规则锁定，而是用于验证核心循环是否“看得懂、做得出、接得上”的垂直切片。叙事可以继续扩展，规则暂时保持固定：每回合只做一件事，每个行动至少说明一项代价或条件，并在行动后说明下一步影响。运行时不依赖联网业务、多人、内购或 AI。

## 内容与代码

- `content.js`：本切片的静态内容、行动条件、效果、目标和遗产；
- `game.js`：存档、状态转移、结算、交接和渲染逻辑；
- `../content/content-manifest.json`：内容数量与 ID 契约；
- `../content/content-review.json`：内容审校状态与边界；
- `../tests/core-loop-mvp-acceptance.md`：垂直切片的人工与浏览器验收表。

## 验证

在项目根目录运行：

```powershell
python planning/tools/validate_project.py
python development/content/validate_content.py
python development/tests/validate_save_contract.py
node --check development/game/game.js
node --check development/game/content.js
node --check development/game/sw.js
```
