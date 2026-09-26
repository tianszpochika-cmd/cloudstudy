# Batch22 学习 Web、移动 H5 与社交服务隔离复测（2026-09-25）

## 结论与环境

仅在私有 Compose 项目 `cloudstudy-uat-isolated-3c94b27160` 替换 `social-service`、`learner-web` 和 `mobile-h5`。发布标签为 `583ab627-uat-batch22-20260925`，三项镜像 ID 依次为 `sha256:dccc91fa27b458677dcaa01894c97e619e44e927b5a076a4ae6c928f3fa83e75`、`sha256:8e273afae78940b389333effb8175bc5b0a6ef7fda8d3c5a506c0b5c0d7c9780`、`sha256:b8319bd93823a07e6a8ed74e4564191205f5198001a46e2da8ff05cf1552d480`。

[发布助手](../../scripts/runtime/batch22-private-promotion.mjs)先核对 Batch21 `verified` 快照、三项固定镜像 ID、Compose 展开、私有网络和共享项目指纹；纯逻辑保护测试 15/15。只读预演和预检通过后，按服务 owner、学习 Web、移动 H5 的顺序集中替换。最终收据为 `verified`：19/19 就绪，其他 23 个服务容器身份和共享 `yuxuexing-local` 指纹未变化。私有项目没有绑定宿主机端口。

## 本批修复与局部验证

- 学习 Web 的登录回跳增加一次性内存后备，在 sessionStorage 禁用或写入失败时仍保留安全的当前回跳目标，并避免旧持久值盖过新目标。专项测试 7/7，类型检查、生产及 Docker 构建通过。
- 移动 B12 将通知“未读 0”与尚未读取区分；社交排行榜、通知数、举报回执均绑定当前账号、权限、视图版本，房间切换和迟到响应不能混写。举报不确定结果在相同主体、房间、座位和原因下复用原幂等键；只有服务明确标记 `idempotentReplay: true` 才接受原始回执事件号。B12 专项 36/36、类型检查及 Docker 构建通过。
- `social-service` 的 `local-real` 旧 B12 房间举报路径增加真实成员与可见席位校验、事务内持久幂等记录、同键异体冲突、原始举报事实回放与缺失事实时 503。局部 Java 测试 8/8。另以私有 MySQL 8.4 的两个随机临时 schema、实际 Flyway V1/V2 和 Spring 事务代理运行 [opt-in 集成用例](../../services/social-service/src/test/java/com/englishflow/social/web/SocialLocalRealReportMySqlTest.java)，**2/2 通过**：首写、同键回放与冲突、持久事实缺失、事务提交前不可见及并发唯一键胜者回放。测试结束后查询 `information_schema`，临时 schema 残留为 0。未写现有业务 schema。

Java 全量 social-service 测试首跑时，78 项通过、2 项原有 opt-in 跳过；既有 `SocialJwtDecoderNegativeTest` 在 Windows/JDK 25 的 `HttpServer` loopback 初始化阶段失败，JWT 断言尚未执行。随后仅将该测试的 JWKS 夹具改用已有内存注入点，保留 Nimbus 解码及生产 validator；专项 6/6。重跑全套 Surefire 汇总为 **86 项用例、82 项通过、4 项 opt-in 跳过、0 失败**。此修复没有改动服务运行时代码，也不能代替线上 JWKS 网络路径验收。

## 四端匿名浏览器复测

[逐项证据](docker-isolated-browser-batch22/evidence.json)与[汇总](docker-isolated-browser-batch22/summary.json)来自私有 HTTPS proxy 内的临时 Chromium 容器：官网、学习 Web、管理 Web、移动 H5 的双视口主入口、三页登录、官网登录交接和三个受保护深链共 **16/16 HTTP 200、16/16 JWKS CORS 200、2/2 官网交接、3/3 returnTo 保留**。失败请求、390px 横向溢出和已加载破图均为 0。人工查看官网、学习 Web、管理 Web 和移动登录的 390px 截图，未见明显裁切。

**仍有 1 个页面脚本错误**：移动 H5 从 `/#/pages/b4-social/b4-social` 匿名直达后已正确回登录页并保留回跳，但浏览器记录到 `pageErrors: ["Object"]`。该异常正在定位；本批浏览器回归不能记为零错误，修复后需重新构建移动镜像并复测。

## 验收边界

[举报契约冲突](batch22-social-report-contract-gap.md)仍在：active canonical `M1014ReportCommand/M1014Report` 使用 `targetType/targetRef`，而移动端及服务当前仍使用旧 B12 `targetSeatIndex/clientEventId` 形状。本批只增强旧路径的运行时真实性，不能声称满足冻结的 M1014 契约。私有库[只读数据核查](batch22-private-data-audit.md)仍显示 ACTIVE 正式同意文书 0、canonical 内容及学习事实 0；本批未伪造同意、课程、学习成绩或管理员授权会话。

因此 56 个 PAGE-P1 页面族仍为 **PASS 0 / PARTIAL 29 / BLOCKED 27 / NOT_TESTED 0**，严格整页完成度 **0%**。镜像就绪、匿名导航、单测和真实临时库测试分别只证明其具体边界；授权业务写入、四端正式学习闭环、原生移动端与最终视觉验收仍未完成。
