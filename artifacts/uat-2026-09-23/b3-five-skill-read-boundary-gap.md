# B3 五技能只读入口审计：保持 UNAVAILABLE

审计日期：2026-09-23。本记录覆盖 grammar、listening、reading、writing、phonetics 的学习者只读入口。结论是**暂不将 Gateway 的五个 prefix 改指 content-service**。当前 404/UNAVAILABLE 如实反映尚无可发布的读投影；把现有内部 GET 直通会返回无有效版本 pin、未核实权利的合成内容，并且响应格式不符合公开契约。未修改路由、契约、服务、数据库或运行容器。

## 边界与实际调用

- `AGENTS.md` 的领域边界：`content-service` 拥有内容、题目、答案规则版本；`assessment-service` 拥有 attempt、判分、报告；`learning-service` 拥有计划、SRS、进度、掌握度。B3 的读投影可由 content 提供，但提交/尝试及学习事实仍按原 owner；不能把整个 prefix 改路由。
- `packages/contracts/fragments/p1r-gateway-boundary.openapi.json` 当前把五个完整 prefix 标为 assessment-service、priority 100，execution plan 为 UNAVAILABLE。`services/api-gateway` 的 route policy/execution policy 同样没有对应读投影。Web 与移动客户端的 B3 API 模块确实调用这五类公开 GET，因而用户可见 404 不是前端路径拼写错误。
- `B3ContentJdbcController` 已有 `/internal/v1/content/learner/...` 部分 GET：语法点/练习/句子，写作 prompts/templates/materials/proofreading，听力 materials/clips，阅读 articles/story/dictionary/questions，音标 catalog/minimal-pairs。公开 B3 契约还含未实现的读入口，例如语法 traps、练习详情/定向包，写作 history/translation，听力 timeline/offline 详情等。不能按 prefix 宣称全面可用。
- 现有控制器对学习者 JWT、成人准入、同意状态及 `content.read` 做入口检查；单条资源查询只以 `b3_content_experience.availability='PUBLISHED'` 过滤，没有执行当前发布版本、内容权利和子资源继承权利校验。

## 阻断证据

| 检查项 | 当前事实 | 影响 |
| --- | --- | --- |
| 内容版本 pin | 本地 113 条 `PUBLISHED` B3 experience 全部使用 `content_version_id=301`；`content_version` 中 301 的匹配行数为 0 | 无法证明任何一条属于当前发布且有权展示的内容版本 |
| 权利与媒体 | 113 条中仅 2 条 JSON 有 `rightsStatus`，2 条有 `mediaRef.availability`；V8 migration 对本地 JSON 文本执行 `NOT_READY`→`READY` 替换 | 字段出现和 READY 字符串均不能替代 owner 的版权、媒体清洁扫描和发布证明 |
| 返回契约 | 内部 GET 返回顶层 `{source:'mysql',data:...}`，列表使用固定版本 301，缺少公开 `ApiSuccessEnvelope` / `ApiCursorPageEnvelope` 必需的 `meta`、`hasMore`、`pageSize` 等 | Gateway 仅改写路径，不会补充合法 envelope 或真实分页 |
| 静态/空读 | grammar tree 返回空依赖边、mastery 固定空列表，listening offline 固定空且 NOT_READY | 200 空结果会伪装成功能力和真实教学内容 |
| 内容拟真 | V7 只有 15 条早期 B3 样例，包括短音频和简短文章；本地其余发布数据主要是 85 条 PHONEME 与 13 条 MINIMAL_PAIR | 行数不能作为可验收的教学素材、权利或媒体可用性证明 |
| 冻结契约 | `p1r-gateway-contract-check` 当前在无本次 B3 改动的情况下因既有规则/操作数、execution plan 与 digest 漂移失败 | 本批不能擅改共享冻结边界以消除 404 |

旧 `docs/10-decisions/0023-b3-read-api-gap.md` 记载“后端读类 0 个、无种子”。这两项诊断已经过时：内部控制器和种子现已存在；但它们未达到发布条件。待解决以下前提后，应以新 ADR 明确取代旧诊断，描述**精确 GET 读投影路由**与**写入 owner 不变**，再变更冻结契约。

## 发布数据只读审计与下线边界

可重跑 `node artifacts/uat-2026-09-23/audit-b3-published-readonly.mjs`；脚本只接受本地 `127.0.0.1:13306`，仅执行 SELECT，不打印学习者内容、联系方式或凭证。

- B3 experience：`PUBLISHED=113`，`UNPUBLISHED=140`。113 条发布记录均指向不存在的版本 301。已下线的 140 条本地 10x placeholder 无需重复操作。
- 已发布类型：PHONEME 85、MINIMAL_PAIR 13，其余 15 条分布于语法、听力、阅读、写作等 12 类。现有 `learning_service.b3_learning_interaction` 中有精确内容 ID 的既有事实，例如语法练习 3701、语法点 3103、句子 3201、听力材料 3401、阅读文章 3501/题 3950、写作 prompt 3301。不能视这些旧行无人使用。
- 初看未出现在该学习事实表的 3101、3702、3303 等 ID，仍出现在旧 core 代码、迁移或文档中。当前检查没有覆盖全部历史表、JSON 内嵌引用和外部发布，因此**没有能证明无人引用的精确子集**。本批不提出或执行任何 UPDATE/DELETE；后续若要下线，先逐 ID 做全 owner 引用清单、真实/夹具 provenance、回滚 SQL 与产品确认，再只处理经证实的行。

## 解除条件与验证顺序

1. 内容 owner 迁移或重建 B3 素材为真实发布版本：每个父子资源绑定存在且当前发布的 `content_version_id`，版权/权益、受众、locale、媒体清洁扫描与有效期可从 owner 事实验证。缺失或撤销时 fail closed。
2. 内部 GET 经统一 `ContentReadService` 或等效发布/权利 PEP，子资源继承父资源权利；移除固定 301 和字符串 READY 推断。为五类页面准备经教研审核的拟真数据，不能用仅能返回 200 的样例代替。
3. 补齐需要开放的 GET，输出公开 `data + meta` envelope、真实 cursor/pageSize/hasMore；明确空、无权、未发布、媒体不可用的不同结果。对 grammar tree/mastery、listening offline 等静态空实现继续保持不可用，直到其数据来源和语义真实。
4. 新 ADR 定义只读 content projection 与 assessment/learning 写 owner；只对逐项通过上述条件的**精确 GET** 增加高优先级路由，并同步 OpenAPI、冻结校验基线、`GatewayRoutePolicy`/`GatewayRouteExecutionPolicy` 及路由测试。POST/PUT 与其余 GET 必须维持既有 owner/UNAVAILABLE。
5. 统一部署后，以真实成人学习者在 Web/移动页执行正向读、撤权、未发布、跨租户、分页、空态、媒体失败和写入路由回归；逐页目视确认，不能把 404 消失计为 B3 PASS。

## 本批验证结果与限制

- `pnpm db:check:local-10x`：108 检查通过；`pnpm db:check:local-real-coverage`：35 检查通过。两者证明本地 fixture/覆盖计数，不证明 B3 内容拟真和合法发布。
- `node scripts/database/unpublish-local-placeholder-content.mjs` 默认 dry-run：候选 experience/chunk 均为 0，未写库。
- `pnpm p1r:gateway-contract:check`：失败，当前冻结基线期待 56 routes/365 public operations，实际 63/393，另有 execution plan/digest 漂移；本批未改共享文件。
- `pnpm test:b3`：16/17 通过；唯一失败为与 B3 无关的 admin recovery POST 幂等检查。因共享工作树同时有其他改动，这两项失败是本次审计快照，需在整合后复测。
- 本批没有 Docker 重建、服务重启或受保护页面运行时 PASS 证据；五技能读入口仍是明确 GAP。
