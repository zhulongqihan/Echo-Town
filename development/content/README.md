# 内容工程入口

D3 垂直切片的静态内容位于 [`../game/content.js`](../game/content.js)，不是运行时生成文本。当前内容契约为 8 个固定回合、每回合 3 个行动、3 个起点、3 个目标和 11 个遗产。

- `content-manifest.json`：回合、行动、起点、目标、遗产 ID 与数量契约；
- `content-review.json`：内容责任人、审校人、固定基线和 AI 边界；
- `validate_content.py`：检查内容源、清单、审校记录和运行时边界是否一致。

每个行动应明确写出行动描述、代价或条件、预计方向、效果、目标推进、即时结果和后续影响。每个遗产应明确写出下一世的实际用途，并且用途必须和运行时效果一致。

验证：

```powershell
python development/content/validate_content.py
python development/tests/validate_save_contract.py
```

D3 内容用于验证核心循环，不等同于正式版全量内容；扩写正式版前仍需按 G3/G5/G6/G10 门禁复审。
