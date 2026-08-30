# D5视觉声音与人生片段验收记录

- 验收编号：D5-MEDIA-LOOP-20260830
- 验收时间：2026-08-30T01:02:44+08:00
- 构建范围：`development/game/` 当前工作树，save v7，Service Worker `echo-town-generation-v10`
- 验收性质：A00整合自验；用户试玩与正式G3-G10门禁仍待完成

## 目标

验证D4生活经营循环在不改变行动点、工资、账单和跨世边界的前提下，新增阶段识别、声音反馈和可收集人生片段；同时保证图片缺失、音频静音/不支持、窄屏和刷新场景仍可完整游玩。

## 结果

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 五阶段场景图 | 通过 | 五个本地 PNG 均在 Chromium 中加载为 1672×941；事件卡按童年、少年、初入社会、成家立业、后半生绑定 |
| 阶段图文字回退 | 通过 | `img` 有阶段中文 alt/caption，加载失败会隐藏图片并显示“阶段画面暂时不可用，文字事件仍可继续” |
| 配乐与音效开关 | 通过 | 首次默认“打开配乐”；用户点击后 Chromium AudioContext 状态为 supported/enabled，按钮变为“关闭配乐”；不支持时保留文字提示 |
| 人生片段触发 | 通过 | 真实点击“学习 / 练习”后保存 `first-study`，生活反馈显示“人生片段：把一页读懂”；内容固定12条，分别绑定生活、工作、购买、账单、旗标与事件 |
| 片段回看 | 通过 | 当前世生活区、人生事件反馈、结算页和镇志册均有片段入口；镇志未解锁项显示占位说明，不泄露规则数值 |
| 工作履历 | 通过 | save v7增加`jobHistory`，每种工作只计一次；片段“换一条谋生的路”要求真实尝试两种工作 |
| 存档与刷新 | 通过 | 浏览器保存版本为7，声音偏好、片段、工作履历进入归一化边界；D4旧键保留，不混合规则 |
| 完整内容契约 | 通过 | `validate_content.py`通过：23节点、69事件行动、7生活行动、6工作、6物品、12片段、5阶段图 |
| 存档契约 | 通过 | `validate_save_contract.py`通过：schema 3.0.0、save v7、512 KiB上限、导入先解析/归一化再替换 |
| 响应式与无障碍 | 通过 | 390×844下`scrollWidth=390`、`innerWidth=390`；事件图和片段区不横向溢出；键盘选择与静音文字反馈保留 |
| 离线边界 | 通过 | 阶段图、`audio.js`、内容和应用壳均为本地资源；运行时代码无联网请求、`Math.random`或AI调用 |

## 内部检查命令

```powershell
python planning/tools/validate_project.py
python development/content/validate_content.py
python development/tests/validate_save_contract.py
node --check development/game/content.js
node --check development/game/audio.js
node --check development/game/game.js
node --check development/game/sw.js
git diff --check
```

## 未关闭项

- [ ] 用户真实试玩：阶段画面是否帮助理解，而不是成为信息负担；
- [ ] 用户真实试玩：配乐音色、音量和重复播放是否舒适；
- [ ] 用户真实试玩：12段片段是否带来收集与再开一世的动力；
- [ ] 正式角色A02至A07按各自门禁重开专项评审；
- [ ] 在用户证据前，不把D5媒体、经济参数和内容规模写成最终GDD规则。
