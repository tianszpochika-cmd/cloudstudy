# B3 已发布内容读取门禁与正式恢复缺口

核查日期：2026-09-23。状态：**当前源码的失败关闭门禁已验证；正式 B3 内容发布和学习正向链未完成**。本轮没有改数据库、回填旧行、删除学习历史、启停服务或构建 Docker。

## 当前结果

- 本机来源复核识别出 `b3_content_experience` 的 113 条 `PUBLISHED/content_version_id=301` 旧种子行，canonical `content_version_id=301` 为 0。详见 [来源复核](b3-published-data-provenance-review.md)。这些行不能作为正式已发布内容。
- `B3ContentJdbcController` 的统一列表和单项读取路径现有显式失败关闭条件 `AND 1 = 0`。因此即使为旧行填入任意非 301 的已审 canonical 版本号，也不会把未绑定的投影暴露给学习端。列表为无可用项且不再回传伪造的 `contentVersionId=301`；单项返回 404。`grammarTree`、语法练习、听力、阅读、写作、音标都经过同一读取门禁。
- 这个门禁是临时的内容真实性保护，**不是 B3 功能验收通过**。恢复时必须以可验证的 owner 绑定替换失败关闭条件；不能单纯删去该条件或只用版本号联表。
- content-service 未写 `learning_service.b3_learning_interaction`。旧 233 条直接关联的学习历史仍由 learning owner 持有，不随内容隐藏而删除。

## 正向绑定无法安全补造的具体原因

1. [V6 表结构](../../services/content-service/src/main/resources/db/migration/V6__add_b3_learner_experience_content.sql) 只有 `experience_id`、域/类型/资源键、数值 `content_version_id` 与 `payload_json`，没有 canonical `content_id`、受审 payload 摘要或正式发布关联。填入另一个合法版本号仍可能引用完全无关的内容。
2. [B3 API 契约](../../packages/contracts/fragments/b3-multimodal.openapi.json) 的资源读取含 `contentVersionId`，但没有版本内资源 ID、`content_id`、受审资源摘要及绑定规则。[B9 草稿契约](../../packages/contracts/fragments/b9/b9-content.openapi.json) 只有泛型 `items`；[B9 共享类型](../../packages/contracts/fragments/b9/b9-shared.openapi.json) 的 item 类型也未覆盖完整 B3 听力、阅读、写作与音标资源。现有设计没有规定 B3 行如何成为同一受审 canonical payload 的一部分。
3. [B9 内容命令](../../services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java) 从草稿只保存 `summary/contentLocale/targetLevel/items` 为版本 payload；没有从正式发布版本产生 B3 投影绑定的 owner 写入。当前草稿 rights 固定为 `PENDING`、`allowsLearning=false`、无授权证据；[内容版本发布规则](../../services/content-service/src/main/java/com/englishflow/content/domain/ContentVersion.java) 要求有效的 `LEARNER` 与 `PUBLIC` 权利。尚无已定义的 B9 权利批准/激活命令能建立这条正式正向链。
4. `ContentPayloadHash` 对版本 payload 使用规范化 Map 摘要。旧 B3 行的原始 JSON/后续迁移修改与受审版本 payload 不存在可直接比较的同源摘要。仅新增一张可手工填 `content_id + hash` 的绑定表，仍无法证明资源实际属于获批快照。

## 正式恢复所需的设计和实施

1. 先冻结 B3 各资源类型在 canonical 内容版本中的类型化 manifest：稳定资源 ID、domain/type/key、owner `content_id`、`contentVersionId`、版本内资源摘要及摘要算法；明确听力/阅读/写作/音标、媒体引用和受保护答案规则如何从受审 payload 投影。更新 OpenAPI、权限与迁移设计。
2. 增加由 content owner 产生的版本化绑定写链。绑定只能从已经保存、校验、双审的同一版本 payload 派生，并在发布、下线、回滚、过期时与发布指针/权利一起生效或失效；不能信任客户端填写的版本、版权或摘要。补正式版权授权证据与激活链，不以 `rightsStatus=AUTHORIZED` 等旧 payload 字段代替。
3. 再建 owner schema 迁移与读取验证：逐项核对 `content_id + version + resource digest + 当前发布指针 + 审核 + 学习渠道/期限/授权证据`，并测试异内容借号、改 payload、撤权、过期、下线与回滚。**不自动回填或重新发布现有 113 行**；如需迁移，逐项复核原始内容、版权和已有学习历史后另行导入。
4. 学习/assessment 的直接写入口还需拒绝已下线或未绑定资源的新提交，同时保留已发生的历史记录；当前 content 读取门禁不能替代该跨服务验证。

## 验证范围

- 当前源码：`B3PublishedContentGateJdbcTest` 2/2、`B3PhoneticsDomainTest` 12/12，通过；覆盖旧 301、借用测试库中模拟完整审核/权利列的 302、语法/听力/阅读/写作/音标列表与单项读取。`git diff --check` 通过。
- 内容服务全量测试曾执行 219 项、失败 0、错误 1、跳过 2；唯一错误是 `ContentJwtDecoderNegativeTest` 在本机 Windows JDK 建立回环连接时 `Unable to establish loopback connection`，单独运行再次复现。排除此环境用例的回归命令退出 0（对应 218 项，其中 2 项既有跳过）。这两次较宽回归发生在最终统一失败关闭条件写入之前；最终条件之后仅重跑上述 14 项针对性测试。
- 未运行新镜像或受认证的浏览器正向学习链；当前证据不得写成运行验收或正式发布通过。
