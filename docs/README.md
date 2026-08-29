# 上下文摘要目录

仅在发生上下文压缩时，按全局协议创建 `context_summary_YYYYMMDD_HHMM.md`。项目运行期间的当前状态使用 `current_state_summary.md`，它是可重建的派生视图，不是权威来源。

上下文摘要和当前状态摘要是便于恢复的派生视图，不是项目规划的权威来源。恢复工作时先读取 `planning/00_master-index.md` 和最新规划交接；若发生冲突，以最新用户修正、决策日志和权威专题为准。

新A00窗口接班提示词：[A00-new-window-bootstrap-prompt.md](A00-new-window-bootstrap-prompt.md)。它是由当前权威状态生成的派生提示词，使用前仍必须以总入口和最新用户事件为准。
