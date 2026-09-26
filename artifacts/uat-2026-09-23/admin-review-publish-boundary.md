# 管理端双审与发布边界实测（2026-09-23）

结论：`PAGE-P1-ADMIN-REVIEW` 与 `PAGE-P1-ADMIN-PUBLISH-ROLLBACK` 仅有**负向边界的运行证据**，完整功能仍为 **BLOCKED**。23 项本地检查全部通过；没有完成合法内容从双审到发布、下线、回滚及四端投影的正向验收。测试始终使用一条未发布、版权为 `PENDING` 的全新合成草稿，没有发布伪造或无授权内容。

## 运行证据

执行 [复现脚本](admin-review-publish-boundary.mjs)；完整的 23 项状态、owner 数据和清理结果见 [结构化证据](admin-review-publish-boundary/evidence.json)。脚本只连接 `127.0.0.1` 本地 Gateway、Admin Web、content owner 和本地 MySQL；密码、JWT 未写入证据。

| 验证点 | 本地观察 |
|---|---|
| 未登录读取内容管理 | Gateway `401`。 |
| 学习者读取内容管理 | Gateway `403 CONTENT_ADMIN_REQUIRED`。 |
| 学习者伪造 `X-Role`/`X-B5-Role` 发布**现存**草稿 | Gateway `403 CONTENT_PUBLISHER_REQUIRED`；owner 草稿未变。 |
| 作者审核自己的版本 | `409 FOUR_EYES_REQUIRED`。 |
| 另一审核员跳过一审直接二审 | `409 CONTENT_STATE_INVALID`。 |
| 草稿未双审即发布 | `409 CONTENT_STATE_INVALID`。 |
| 没有当前发布版本即回滚 | `409 ROLLBACK_SOURCE_MISSING`。 |
| `/content` UI 草稿态 | 发布和回滚按钮禁用；[1280px 编辑页](admin-review-publish-boundary/content-draft-1280.png)、[390px 回滚页](admin-review-publish-boundary/content-rollback-390.png) 均无页面横向溢出，浏览器 Page Error 为 0。 |
| `/release` UI | 实际为 B6 **代码层质量基线**，页面已写明不代表当前环境上线通过；无内容发布、下线、回滚操作。[390px 截图](admin-review-publish-boundary/release-quality-390.png)无横向溢出。 |

content owner 前后事实相同：唯一版本 `DRAFT`，版权 `PENDING`，`rights_allows_learning=0`，无授权证据、审核者、发布者或当前发布指针；公开投影、outbox、排期任务、评测与学习引用均为 0。测试结束删除这条草稿及其唯一版本和 3 条专属幂等回执；两名 `.invalid` 合成账号已禁用、权限清空，会话、设备和角色活动数均为 0，内容残留为 0。

## P0：正向功能缺口

1. **版权激活与发布链未闭合。** [B9 草稿写入口](../../services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java) 的 `rights()` 固定创建 `PENDING`、`allowsLearning=false`、无证据的版权事实；当前 `/content` UI 只有来源编码和版权编码输入，没有经权利核验后变为 `ACTIVE/VALID` 的操作。即使代码允许两名独立审核员，仍没有本轮可核验的、合法授权的可发布候选。`PUBLISH` 针对未审核草稿的 409 只证明**状态**拦截，不能当作版权 Gate 实测。
2. **提交审核过早开放。** [AdminContentView](../../apps/admin-web/src/views/AdminContentView.vue) 在该 `PENDING` 合成草稿上显示“提交双审”为可点击；[owner `SUBMIT_REVIEW`](../../services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java) 调用的 [版本状态转换](../../services/content-service/src/main/java/com/englishflow/content/domain/ContentVersion.java)只要求作者与 `DRAFT`，未先强制 PASS validation report、VALID rights 和媒体 `READY/CLEAN`。设计要求这些事实在一审提交和发布前收束。为避免生成一条无合法授权的审核事件，本次没有点击提交，也没有据此推断审核正向链可用。
3. **`/release` 不是内容发布工作台。** 该路由为 [AdminB6ReleaseView](../../apps/admin-web/src/views/AdminB6ReleaseView.vue) 的静态代码质量摘要；内容发布控制位于 `/content`。不能以 `/release` 页面可访问证明内容发布、排期、下线或回滚可操作。首次 390px 检查发现英文 `No Data` 和 `READY_FOR_TEST_STAGE`；文案问题已在下面的独立复测中关闭。

## 额外安全边界

首次运行时，学习者带伪造角色头对**不存在**的内容编码调用 `PUBLISH` 返回 `404 CONTENT_NOT_FOUND`，对现存草稿却返回 `403 CONTENT_PUBLISHER_REQUIRED`，暴露了资源存在性。第九批已将五个审核/发布命令的权限检查前移并换入本地 JAR；脚本将该断言收紧为精确 403 后重新运行 **23/23 通过**，临时草稿和两账号再次精确清理。匿名请求仍为 401，完整正向发布仍未验。

修复后 content-service 的 35 个 suite、222 项测试（0 failure/error，2 skipped）通过；[第九批运行记录](batch9-runtime.md)列明旧/新 JAR SHA、16/16 健康和 Gateway 重测边界。第九批 content Docker 镜像也包含修复，但尚无容器内授权发布链证据。

## UI 修复边界与待复测

本次检查期间，主 Agent 修正了 `AdminContentView` 的双审通过判断：content owner 在 L2 完成后只投影 `FINAL_APPROVED`，原 UI 却要求同时存在 `FIRST_APPROVED` 与 `FINAL_APPROVED`，会永久禁用发布按钮。主 Agent 已完成该局部前端修正和类型检查；本次只在 `DRAFT` 状态验证禁用行为，**没有**获得合法 `APPROVED` 候选来做发布按钮及端到端回归。

后续正向验收需真实可核验的内容来源和版权、完整 validation/media 事实、作者/L1/L2/发布者四个独立主体，以及发布前后 owner、Gateway、官方站、学习端、排期/下线/回滚和审计水位证据。没有这些事实时应继续保持未发布与明确的空态。

## `/release` 文案修复后复测

主 Agent 修改 `AdminB6ReleaseView` 后，我用新的只读合成 staff 在 390px 浏览器重新进入该页。[复测截图](admin-review-publish-boundary/release-quality-postfix-390.png)可见空表为“暂无平台记录”、状态为“待实际验收”；页面不再出现 `No Data` 或 `READY_FOR_TEST_STAGE`。页面宽度 390px、文档宽度 390px，无横向溢出；Page Error 0、Console Error 0，内容写命令 0。账号已禁用，活动会话、设备和角色均为 0。[复测数据](admin-review-publish-boundary/release-quality-postfix.json)与[复现脚本](admin-release-postfix-ui.mjs)单独保存；前述 23 项检查仍是修复前后的原有负向边界证据，不能据此提升内容发布验收状态。
