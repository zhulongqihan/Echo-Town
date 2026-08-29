# 项目校验工具

`validate_project.py`是规划和开发入口的最小自动校验器，不负责修改文件。

运行：

```powershell
python planning/tools/validate_project.py
```

它会检查必需文件、前置状态、角色唯一性、任务租约、状态镜像、Markdown本地链接、开发禁令和项目契约。退出码为0才代表结构检查通过；通过不等于游戏设计门禁通过。
