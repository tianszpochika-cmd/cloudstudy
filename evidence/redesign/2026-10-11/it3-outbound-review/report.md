# IT-3 出站自审

日期：2026-10-11。结论：PASS_WITH_GAPS。

`accepted` = false。`it3Outbound` = false。`lunaStamp` = false。本页不把任何卡升级为 Luna 签收，也不发布完成百分比。`station-acceptance/` 下的历史原件没有改写。

## 本轮证据

| 目录 | 结果 | 说明 |
|---|---|---|
| `evidence/redesign/2026-10-11/it3-browser` | PASS | 后缀 `d2012bf6`。Web 与 H5，1280 与 390。正式报告、首页横幅、今日任务、`plans:replan` 四条都走到。46 步全部 PASS。 |
| `evidence/redesign/2026-10-11/r3-support-gateway` | PASS | `support-real-gateway.e2e` 向 HTTPS IAM 注册，工单列表 200，清理后账号停用、活跃会话 0。 |

IAM 监听 `https://127.0.0.1:18087`，令牌签发者仍是 `http://127.0.0.1:18087`。Chrome 只放行本轮临时证书的 SPKI。没有调用 `security`，没有改系统钥匙串。六个 owner schema 前缀 `r3_it3_20261010_`，结束后已删除。admin-ops 工单留在内存。qida 容器没有操作。固定端口在结束后无监听。

重排请求是 `POST /api/v1/learning/plans:replan`，状态 200。H5 一例从 `planVersion` 2 变为 3，`rescheduledCount` 为 3。横幅句子是服务端的「根据目标「零基础」和每日 15 分钟，安排今天的练习。」

## 横向溢出

r2 报告里 learner-web 八个页面 `overflow=true`，本轮没有复现成文档滚动。未登录的 `/`、`/today`、`/courses`、`/login` 在 1280 和 390 上，`scrollWidth - clientWidth` 都是 0。登录后的首页和今日任务同样是 0。

390 宽首页仍有装饰节点超出自身盒子：`.study-artwork__desk` 多 24 像素，`.study-artwork` 与 `__orbit` 多 17 像素。`.home-hero` 已有 `overflow: hidden`，这些节点不产生页面横向滚动条。本轮没有给文档加 `overflow-x: clip`。

## 剩余 GAP

1. **GAP-LUNA**：没有 Luna 签字。IT-3 不能写成站级 ACCEPT。
2. **GAP-WALL-114**：全量 114 卡墙仍 OPEN。本轮定义停在 R1-059。IT-5～IT-7 未拆。
3. **GAP-IT4-REMAINING**：R1-043 服务端复用已单测。R1-044～059 仍未实现。本轮浏览器走查没有覆盖练错复。
4. **GAP-DECORATIVE-ARTWORK**：390 首页插画超出盒子，被英雄区裁剪。文档没有横向滚动。若以后要让插画完整落在视口内，需要改英雄区布局，而不是裁文档。
5. **GAP-LOCAL-GATES**：全量 `pnpm build`、mobile `build:h5` / `build:app`、`mvn -B -ntp -f pom.xml test`、`pnpm test:p1r` 本轮仍不在共享库上整跑。顶层 Node 串行在只开 H5 时为 301 项、300 通过、1 失败，失败文件仍是 `support-real-gateway.e2e` 的预检。该文件在证据栈里的专用库补跑是 PASS。
