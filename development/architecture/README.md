# 实现架构入口

当前D2 MVP采用原生 HTML/CSS/JavaScript，无构建步骤和外部运行时依赖。状态分为 `world`（跨世小镇、遗物、回声）与 `currentLife`（本世阶段、属性、选择、回声），统一序列化到浏览器 `localStorage`；service worker 只缓存本地应用壳。

正式版扩展前仍需通过G8，补齐版本迁移、损坏存档恢复、内容静态校验和更完整的数据契约。
