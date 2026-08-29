# 发布工程入口

当前D2 MVP可由任意静态服务器直接提供 `development/game/`，入口为 [`index.html`](../game/index.html)。manifest 和 service worker 已就位，可在支持的浏览器中安装为本地PWA。

当前实验发行说明见 [`D2-experimental-release.md`](D2-experimental-release.md)，可分发包名为 `echo-town-d2-experimental-20260828.zip`，生成后位于 `output/releases/`。

交付完成度逐项审计见 [`D2-delivery-audit.md`](D2-delivery-audit.md)。

正式发布前仍需G8存档迁移、G9发布标准、版本号和回滚方案；本轮不接入账号、联网服务或付费系统。
