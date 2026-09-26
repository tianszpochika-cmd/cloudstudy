# Batch16 隔离环境复测（2026-09-25）

## 验收口径

本轮只操作私有 Compose 项目 `cloudstudy-uat-isolated-3c94b27160`，没有公开宿主机端口。运行快照确认共享项目指纹未变化。本记录是匿名/公开路径、健康和安全拒绝的证据，不是授权用户的业务闭环通过。56 个 PAGE-P1 家族仍按[首轮覆盖台账](../uat-2026-09-23/coverage-ledger.md)计为 **PASS 0 / PARTIAL 29 / BLOCKED 27**。

## 已验证

- Batch16 五个长运行候选（官网、学习 Web、管理 Web、移动 H5、admin-ops）已在私有项目替换；第六个候选 owner migrator 完成迁移预检、应用和只读核对。Admin audit V5 `(tenant_ref, sequence_id)` 索引及历史校验通过。迁移前备份在私有临时目录，未写入仓库。
- [运行探针](docker-isolated-stack-probe-batch16.json)中四端、Gateway、IAM 和 13 个 owner 共 **19/19** 健康接口为 200。[运行快照](docker-isolated-runtime-state-batch16.json)有 26 个 Compose 容器、23 个运行；`mysql-init` 和 `minio-init` 一次性任务以 0 退出。旧 `mysql-migrate` 一次性容器因恢复依赖时被额外启动而以 2 退出；随后通过候选 migrator 的只读 `--verify` 重验 13 个 owner，不能把旧容器记为成功。
- [浏览器矩阵](docker-isolated-browser-batch16/evidence.json)完成 11 项 HTTPS 检查，11 次 Gateway CORS 预检为 200，页面脚本错误为 0。官网、学习 Web、管理 Web 和移动 H5 的 390/1280px 截图保存在同目录。
- [官网课程/管理治理专项](docker-isolated-browser-batch16/batch16-public-governance.json)：中英文公开投影均经 Gateway 返回 200 和真实空课程（0 项）；官网课程页 390/1280px 无横向溢出或脚本错误。管理治理页匿名访问只显示登录页；举报队列 GET 拒绝匿名，处置 POST 的 Gateway 路由仍为 404。
- [移动端入口](docker-isolated-browser-batch16/mobile-journey-batch16.json)的登录、注册、重置、受保护深链回跳完成六步操作；页面脚本错误为 0。无效账号登录收到 IAM 503 并显示简短不可用提示。浏览器控制台的一条 503 资源错误与该预期 HTTP 失败对应。
- [管理内容匿名专项](docker-isolated-browser-batch16/admin-content-anonymous-batch16.json)、[治理/权限匿名专项](docker-isolated-browser-batch16/admin-governance-permissions-anonymous-batch14.json)和[学习 B11 匿名专项](docker-isolated-browser-batch16/learner-b11-anonymous-batch16.json)均安全转登录，没有暴露受保护操作；所测视口无横向溢出、页面异常。
- [B4 成长匿名接口](docker-isolated-b4-anonymous-batch14-batch16.json)14/14 服务及网关请求返回 401，无公开物品数据。[B3/B9 探针](docker-isolated-b3-b9-anonymous-batch13-batch16.json)确认 B9 管理内容读写匿名拒绝为 401；B3 五个内容读取在 content owner 为 401，但网关为 404，属于真实路由缺口。
- [注册负边界](docker-isolated-registration-boundary-batch16.json)三次请求均因缺 ACTIVE 同意文档返回 503，合成账号数 8→8、会话数 10→10，未发生半途写入。[数据库探针](docker-isolated-db-probe-batch16.json)确认 ACTIVE 同意文档仍为 0；不得伪造批准版本来绕过此 Gate。

## 尚未通过

1. **授权正向链路**：IAM 无有效、获批准且已运行核验的同意文档，无法取得新会话 Token。本轮不能验证四端授权浏览器操作、真实课程/计划/练习、后台审核或治理写链。
2. **技能网关**：`/api/v1/grammar/points`、`/listening/materials`、`/reading/articles`、`/writing/prompts`、`/phonetics/catalog` 返回 404。当前网关将技能域的 canonical owner 指向 assessment，而现有目录读取控制器在 content；需按 owner 边界处理，不能只改状态码。内容控制器的旧 B3 行还因缺少可验证的内容版本绑定而明确保持不可用；接通网关也不会形成真实课程。`p1r-gateway-withheld-routes.test.mjs` 的当前源码绊线以 **1/3 失败**暴露 33 个 API 模块调用与 withheld 规则的碰撞（还含 speaking、sync）；[9 月 13 日的“无调用者”判断已标注为过时](../../requirements/backlog/v2-phase1-rebaseline/execution/GATEWAY-WITHHELD-ROUTES.md)。
3. **公开事实**：两种语言的课程数仍为 0；没有经版权、审校、发布核验的课程和正式方案。官网静态学习方式卡片不构成可购买或可学习课程事实。
4. **原生与设备**：本轮移动浏览器是 H5，没有 App、iPad、小程序、真实麦克风及断网恢复的设备证据。

Batch16 源码/单测/构建与本文件的私有 Docker 运行证据分开计算。后续修复应合并成批，再构建候选并回归；新的 PAGE-P1 状态只有在 owner 事实及操作链条具备证据时才更新。
