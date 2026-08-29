# 内容工程入口

当前固定事件内容与规则位于 [`../game/game.js`](../game/game.js)，内容目录见[`content-manifest.json`](content-manifest.json)，共12个生命节点、每节点三个选项。所有文本和副作用均为本地静态数据与显式函数，不在运行时调用AI。

构建前可运行：

```powershell
python development/content/validate_content.py
python development/tests/validate_save_contract.py
```

内容目录记录节点、唯一选择、标签、结局和运行时边界；[`content-review.json`](content-review.json)记录事实来源、责任人和审校状态。任何新增或删除事件都必须同步更新目录、事件实现和审校记录。

这些内容是当前正式规则的第一批固定内容资产；更大内容扩写仍需通过G5/G6的事件模板、事实表和人工审校门禁。
