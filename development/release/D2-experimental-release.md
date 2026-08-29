# 《回声镇：一生一局》D2 实验发行说明

## 包内容

- 包名：[`echo-town-d2-experimental-20260828.zip`](../../output/releases/echo-town-d2-experimental-20260828.zip)
- SHA-256：[`echo-town-d2-experimental-20260828.zip.sha256`](../../output/releases/echo-town-d2-experimental-20260828.zip.sha256)，值为`4D6A373D3BB6115884C901135E90DF746B3A014D605A37ED58D0EE9B8BC47B3E`。
- 入口：解压后的`index.html`
- 运行方式：用任意静态服务器提供解压目录；也可直接用现代浏览器打开进行单机体验。
- 离线：首次在线打开并完成资源缓存后，可在断网状态下重载并继续本地存档。
- PWA安装资源：manifest声明192px与512px图标，图标与应用壳一同缓存，缓存版本为`echo-town-mvp-v9`。
- 运行时：不需要账号、网络服务、构建工具或模型。
- 存档：保存在当前浏览器的`localStorage`，可在游戏首页导出 JSON 备份。

## 当前内容

- 8 个生命节点：7、12、16、28、36、45、52、67 岁；
- 每个节点 3 个选择、属性变化、反馈回声和小镇后果；
- 封存结局、下一世继承、遗物、历世镇志；
- 响应式电脑/手机布局、键盘 1/2/3 操作和减少动画支持；
- 存档损坏/越界保护、导入文本转义和本地存储失败反馈。

## 版本边界

这是 D2 实验性垂直切片发行包，用于验证“一生一局”和“小镇会记住”的可玩闭环，不代表 G1-G10 已通过，也不代表正式版内容规模、商业模式或最终 GDD 已锁定。

## 验收依据

- [D2 浏览器验收](../tests/d2-browser-acceptance.md)
- [D2 存档完整性验收](../tests/d2-save-integrity.md)
- [D2 发布包清单](D2-release-checklist.md)
