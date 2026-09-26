# 社群房间隔离后授权空态复验

时间：2026-09-23；本地 Java 服务与移动 H5 开发服务。脚本：[复验脚本](../../scripts/runtime/uat-social-empty-after-quarantine.mjs)，原始结果：[JSON](social-empty-after-quarantine.json)。热更新后最终运行标识 `mudx6owz-3095ab`。此次只测试已隔离房间的读取和移动 H5 空态，不代表社群完整功能验收。

| 边界 | 实际结果 |
| --- | --- |
| 新合成成人 | `local.invalid` 账号注册 201、成人 Gate 200、三项同意各 200、再次登录 200；Token 仅用于内存请求，证据不含账号、口令或 Token。 |
| Owner 数据 | `social_service.soc_study_room` 在前后只读计数均为 `platform=0`、`local-social-fixture=100`；未触碰已隔离房间。 |
| Gateway 授权列表 | `GET /api/v1/social/rooms?limit=20` 返回 200，`data.items` 是实际空数组；social owner 同路径也返回 200/空数组。 |
| 移动 H5 | 在 320px 与 390px **分别重新登录**后进入社群页，各自浏览器请求房间列表 200/0；“暂时没有可加入的自习室。”可见、`.room-list .room` 为 0、没有 `bulk-10x` 等夹具名称。 |
| 布局/错误 | 两档的 `documentElement` 和 `body` 滚动宽度均等于视口宽度，无横向溢出；JS `pageerror=0`。热更新后目标检查 **35/35 PASS**。截图：[320px](screenshots/social-empty-mudx6owz-3095ab/mobile-social-empty-320.png)、[390px](screenshots/social-empty-mudx6owz-3095ab/mobile-social-empty-390.png)。 |
| 清理 | 本轮账号已停用；对应活跃 principal、session、device 均为 0。连同前面诊断回合创建的同前缀合成账号，最终只读复核共 5/5 停用、活跃 session/device 0。没有改动现有业务账号或社群房间。 |

## 同页发现：误导性的“网络不可用”

初次复测中，两档截图顶部误报“网络不可用 · 学习同步状态”，虽房间列表、通知、成长等已返回 200。单独的 `GET /api/v1/sync/offline-packages?limit=20` 经 Gateway 直接请求为 **404**；浏览器对此路径的预检因响应缺少 `Access-Control-Allow-Credentials: true` 被 CORS 拦截，随后为 `net::ERR_FAILED`。其余本页捕获的业务 GET 均返回 200，JS pageerror 仍为 0。原 `b4.loadWorld()` 把任一请求的网络失败汇总为 `online=false`，导致整页显示断网。

主 Agent 将局部成功状态改为保持在线后，本 Agent 以新账号重新走完 320/390 浏览器登录和页面链。最终截图顶部均为“**网络可用 · 学习同步状态**”，说明“**部分功能暂不可用，已显示可读取的内容。**”；房间仍为 200/空数组，35/35 检查通过。离线包 404、预检 CORS 失败及每档两条浏览器 Console error **仍存在**，所以这里只确认状态提示不再错误声称整页断网，未声称离线包可用或 Console 全清零。

因此，**房间数据隔离与可见空态通过本次窄范围复验；社群页整体保持 PARTIAL**。下一步应按契约澄清离线包 owner 路由/不可用返回，并让页面对局部功能失败作精确提示。当前没有真实可加入房间，加入/专注/互动无法凭此结果判定通过；本次也没有测试原生移动端。

## 后续界面收敛

主 Agent 复看 390px 真实截图后，将空房间时无对象的“举报原因”选择器隐藏，并将番茄专注空态中的 `session` 与“伪造计时”技术表述改为“加入房间后即可开始专注。”；没有房间时不再显示“预设互动”旁注。`320/390px` 新账号浏览器脚本重新执行 **35/35 PASS**，最新截图位于 `screenshots/social-empty-mudxpbc0-a8bcd0/`，测试账号已停用。画质档位的共享中英文标签随后进入源码，移动 TypeScript 检查通过；这些后续源码改动晚于第九批移动 Docker 镜像，须在下一次集中构建后再以镜像验收。
