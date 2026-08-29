# D2存档完整性维护验收

本记录对应`TASK-20260828-A00-D2-MAINT-001`。它只覆盖D2稳定性维护，不改变节点、人物、终局或G1候选产品承诺。

## 边界

| 场景 | 预期 | 证据 |
| --- | --- | --- |
| 有效v1存档 | 可读取并迁移为当前v2内存结构 | `game.js`的`isSavePayload`与`normalizeState` |
| 有效v2存档 | 可导入并恢复世数、历史和当前人生 | 真实Chromium导入回归 |
| JSON损坏或缺少world | 拒绝导入，原状态不变 | `importSave`异常分支 |
| version不支持 | 拒绝导入，原状态不变 | `isSavePayload`版本检查 |
| 文件超过512 KiB | 拒绝导入，原状态不变 | `MAX_SAVE_BYTES`检查 |
| stage、属性、镇状态越界 | 归一化到可运行范围，不崩溃 | `normalizeState`字段夹取 |
| history/echo/choice包含HTML字符 | 档案与结局显示为文本，不执行标签 | `escapeHtml`输出保护 |
| 本地存储写入失败 | 页面继续可用，状态栏和toast提示暂存限制 | `persist`异常分支 |
| 清除存档失败 | 不让页面崩溃，提示浏览器未允许清除 | `clearStoredSaves`异常分支 |

## 不变约束

- 不引入账号、联网、多人、内购或运行时AI；
- 不增加生命节点、人物、路线和终局；
- 不把D2维护结果升级为G1或正式版锁定事实。

## 回归命令

```powershell
python planning/tools/validate_project.py
node --check development/game/game.js
node --check development/game/sw.js
```

## 本轮真实浏览器证据（2026-08-28）

- Chromium导入`malformed-save.json`后显示“存档格式不正确，未做修改”，此前的第1世存档仍在首页可见。
- Chromium导入`malicious-save.json`后进入镇志；`<img>`、`<script>`和`<b>`均以原文字样显示，页面没有插入图片或执行脚本。
- Chromium导入`out-of-range-save.json`后仍停留在可玩的第1世末页：`stage=7`、`health=3`、`coins=0`、`courage=5`、`bond=0`，无崩溃；遗物中的HTML也保持为文字。
- Chromium导入无当前人生但声明`screen=game`的存档后自动回到首页。
- Chromium导入带恶意`currentLife.echoes`的当前人生后，反馈区只显示原文字，未生成`img`元素、未执行脚本。
- 临时禁用`Storage.prototype.setItem`后开始第一世，页面仍可操作，状态栏显示“仅保留在当前页面”，toast显示“本地存档暂不可用，当前页面仍可继续”。
- 清除旧Service Worker注册和`echo-town-mvp-v8`缓存后，新版脚本重新加载；缓存键已升级为`echo-town-mvp-v9`。
- 新版脚本从首页重新完成8个节点并进入结算页，`history.length=1`。

测试夹具位于`development/tests/fixtures/`，仅用于上述本地回归。
