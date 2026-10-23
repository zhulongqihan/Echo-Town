# 正式桌面版独立浏览器审查（已冻结）

审查地址：`http://127.0.0.1:4175/development/game/index.html`。独立 Chrome 会话 `desktop-v9-audit`，正式源只读。

结论：本轮发现的四项问题均已完成修复或达到约定基线，正式复核通过。1366×768 下工作卡完整首屏可见；1093×614 下工作标题首屏可见，完整成本和执行后余额需向下轻滚约 63px，默认操作内容为 2.10 屏，主代理确认符合“约两屏”基线。

本轮直接加载正式 index / styles / scene / ui / engine / projects，没有临时脚本接线。项目六状态来自 `verify-project-views.cjs` 用真实引擎命令生成的快照；浏览器通过 `replaceState()` 装载这些合法快照后运行正式 UI。这是断点显示验收，不冒充六次从头到尾的手动试玩。快捷开局、接受项目、购买工具、还款、Escape 均另外进行了真实点击。

## 已验证

| CSS 视口 | 主场景 | 操作区可视高度 | 外层 scrollWidth / scrollHeight | 项目标记与三个热区相交 |
|---|---:|---:|---:|---|
| 1366×768 | 926×562 | 393.5 | 1366 / 768 | 全部为 0 |
| 1920×1080 | 1422×874 | 697.7 | 1920 / 1080 | 全部为 0 |
| 1093×614 | 697×441 | 315.2 | 1093 / 614 | 全部为 0 |
| 1536×864 | 1096×658 | 489.5 | 1536 / 864 | 全部为 0 |

后两项模拟 125% 缩放后的可用 CSS 空间；没有宣称操作系统或浏览器缩放参数被实际修改。

- available：只显示可用接受按钮；unavailable：接受按钮禁用；active：只显示退出按钮；completed / incomplete / withdrawn：不显示接受或退出按钮。
- 终态与真实结果相符：完成为 3/3，缺准备为 2/3 并标注 21 岁准备已错过，退出为 0/3。结果详情说明新工作或未解锁原因，没有再次显示“结算还需要”。六状态重复 scene.render 后引擎快照均相等。
- 购买：从场景市场热区打开背包，点工具后现金 27→15、行动点 2→1，dialog 保持打开，焦点为 `#drawer-feedback`，反馈显示真实购买与钱 −12。
- 还款：由真实 32 岁借款事件产生 20 元债务，36 岁在账本输入 5 元并点击还款，现金 58→53、债务 20→15、行动点仍为 2。焦点为 `#drawer-feedback`，Escape 关闭并回到账本源按钮。
- 再次打开抽屉时上次反馈已清空且隐藏。
- event 阶段打开项目抽屉，将焦点放在其内容中，按数字 1 后状态完全相同，没有执行背景事件。
- 浏览器 console：0 errors / 0 warnings。

## 发现的问题与闭环证据

1. **项目命令后焦点丢失 → 已修复**：原点击接受后焦点落到 BODY。清缓存后重新真实点击 `[data-action=accept-project]`，`document.activeElement.id` 为 `project-desk`；1366 下项目顶部 383.5，位于操作区 293.5—687 内，标题不再裁切。主代理同时修正了内部滚动容器的可见性判断。
2. **小高度操作区过长 → 达到约定基线**：原 19 岁 active 内容 961px，项目高 250.2px。修复后项目高 103.5px，内容 662px。1366 下可视 393px、1.68 屏，工作卡 567.5—671.8 完整位于操作区 293.5—687 中；1093 下可视 315px、2.10 屏，工作卡 504.8—609.2，操作区下沿 546，标题在首屏、剩余成本向下约 63px 可见。主代理确认接受此边界，不继续微调。完整步骤和成本仍可从项目详情读取，行动费用和余额未被删除。
3. **重绘后回到错误的等价入口 → 已修复**：来源增加场景热区容器标识。重新从场景市场热区打开背包并真实购买工具，再按 Escape，焦点文本为“街角集市 · 看看工具”，且 `document.activeElement.closest('#scene-hotspots')` 为真。购买后反馈依然聚焦 `drawer-feedback`，其顶部 99、底部 145.8，位于 614px 视口内。
4. **首页两列镇志粘连 → 已修复**：最终采用一列标签／状态行。1093 下 `#start-town` 仅一列，五行 top 分别为 624.1 / 656.1 / 688.1 / 720.1 / 752.1，相邻行间隔 32px，不再出现相邻列文字粘连；页面 scrollWidth 为 1093。

复核前对本独立测试上下文执行 CDP `Network.enable`、`Network.setCacheDisabled(true)`、`Network.setBypassServiceWorker(true)`，解除本游戏 scope 的 service worker、删除 echo-town 缓存后 reload。上述结果来自更新后的正式文件；没有用临时接线页替代正式页面。

## 截图

最终修复后：

- [1366 工作卡完整首屏可见](F:/selfplay/output/playwright/formal-v9-fixed-active-1366.png)
- [1093 默认约两屏与首屏工作标题](F:/selfplay/output/playwright/formal-v9-fixed-active-1093.png)
- [1093 首页单列镇志](F:/selfplay/output/playwright/formal-v9-fixed-home-1093.png)

以下为初轮审查证据，保留用于核对修复前状态：

- [1366 项目可接受状态](F:/selfplay/output/playwright/formal-v9-available-1366.png)
- [1920 项目进行中](F:/selfplay/output/playwright/formal-v9-active-1920.png)
- [1093 小高度操作区](F:/selfplay/output/playwright/formal-v9-active-1093.png)
- [1536 项目进行中](F:/selfplay/output/playwright/formal-v9-active-1536.png)
- [项目完成](F:/selfplay/output/playwright/formal-v9-completed-1093.png)
- [项目未完成](F:/selfplay/output/playwright/formal-v9-incomplete-1093.png)
- [抽屉购买反馈](F:/selfplay/output/playwright/formal-v9-purchase-feedback-1093.png)
- [抽屉还款反馈](F:/selfplay/output/playwright/formal-v9-repay-feedback-1093.png)
- [首页镇志两列](F:/selfplay/output/playwright/formal-v9-home-1366.png)

正式源未被本审查修改。未测试手机；本报告不覆盖离线、媒体听感、导入失败和完整人生试玩。
