# Batch19 内容事实、通知偏好与四端隔离复测（2026-09-25）

## 结论与范围

第 19 批只在私有 Compose 项目 `cloudstudy-uat-isolated-3c94b27160` 更新 content-service、iam-service、notification-service、learner-web、mobile-h5 五个镜像，标签均为 `583ab627-uat-batch19-20260925`。官网保留 Batch18 镜像；其余服务保留原镜像。项目仍为 26 个 Compose 容器、零宿主机端口映射；[发布助手](../../scripts/runtime/batch19-private-promotion.mjs)的最终阶段为 `verified`，五个候选服务均已替换、无服务仍停机，共享 `yuxuexing-local` 指纹在阶段核验中保持一致。

严格 PAGE-P1 业务验收仍为 **PASS 0 / PARTIAL 29 / BLOCKED 27（56 项）**。本批完成的是数据纠偏、通知偏好技术链及匿名边界复测；没有合法授权的登录后通知设置、正式课程与练习闭环运行证据。

## 数据与发布证据

- 更新前按私有项目完整导出 **14 个 owner schema、4,813,500 字节**，SHA-256 为 `f9f341cc1896fee9c9843a0cdd58876d2acbd7383bab8c51df8c7799c2b8b76f`。备份及收据保存在私有临时目录，未纳入 Git。停写 Gateway 与 13 个外部 owner 后，七张迁移目标表的数量和身份摘要再次与备份一致；外部迁移器 13 owner 只读预检通过，才开始写入。
- 外部迁移器只新增 content V23 和 notification V8，随后 13 owner 历史与授权复核通过。[内容 V23](../../services/content-service/src/main/resources/db/migration/V23__unpublish_unbound_legacy_content.sql)精准下线 113 条未绑定正式版本/权利的旧 B3 素材、1 条孤立 B25 词条和 1 条孤立 B2 片段；数据保留供核查。V23 history 一条，目标身份与状态按备份收据逐条复核。
- [通知 V8](../../services/notification-service/src/main/resources/db/migration/V8__canonicalize_m1016_notification_preferences.sql)把旧偏好表归档为 `notification_preference_legacy`，建立独立的 canonical 表，不把历史 enabled 值推断为同意。私有库两表均为 0 行，V8 history 一条。[IAM V18](../../services/iam-service/src/main/resources/db/migration/V18__grant_canonical_notification_preference_permissions.sql)由新 IAM 启动时成功执行；9 个活跃 learner 账号有 self 偏好读写 scope，但签发仍受服务端成人/有效同意门禁控制。
- 停写后恢复的 11 个非候选 owner 和 Gateway 使用原 container ID/image ID 并逐一探活。五个候选镜像的最终 image ID：content `sha256:afb3e27ddfa1181879c9ec61a1f384e72f77c0cb751ad41bf59406937cd9eafb`、IAM `sha256:09ae3a1ae30d578cd18cab11af45d267fd093767c91de115fb467e3427b5da9d`、notification `sha256:f0072aa43d05827907d83bcab4b592761ebbf5db59cf1311648cb05a1816be4c`、learner Web `sha256:a41480f6e3b6ad3cd20e593169f11079aed89b497251baa367e4b80fdb839f4c`、mobile H5 `sha256:bef93d2f00725d460e6219a8825775c256cf43e454f335b7c293f34cc143bdea`。
- 私有代理刷新后官网、四端入口、Gateway、IAM 与各 owner 就绪探针 **19/19 HTTP 200**；最终 `verify` 再跑一遍 19 项并核对三份迁移历史与数据状态。发布中各服务首启短暂未就绪导致 helper fail-closed，按收据重入完成；helper 已补 90 秒有界探活重试，专项测试 9/9 通过。发布结果未使用自动端口改派或绕过迁移门禁。

## 浏览器与权限边界

- [四端匿名浏览器证据](docker-isolated-browser-batch19/evidence.json)：11/11 页面样本 HTTP 200、11/11 Gateway JWKS CORS 200，页面错误、失败请求及横向溢出均为 0；官网、学习 Web、管理 Web、移动 H5 的 390/1280px 截图在同目录。人工查看四端 390px 样本未见明显截断，结论仅限匿名入口和登录页。
- [学习 B11 匿名深链](docker-isolated-browser-batch19/learner-b11-anonymous-batch19.json) 9/9 回登录并保留目标路由，无受保护内容泄露；[管理内容](docker-isolated-browser-batch19/admin-content-anonymous-batch19.json)桌面/手机 2/2 回登录；[管理治理和权限](docker-isolated-browser-batch19/admin-governance-permissions-anonymous-batch14.json) 4/4 回登录且无受保护视图/API 请求。最后一份脚本只接受 `batch14|batch15` 标签，故文件名带 `batch14`；实际运行于 Batch19 私有网络，证据保存在本目录。
- [移动 H5 运行时](docker-isolated-browser-batch19/mobile-runtime-types-batch19.json)的 root/login 2/2 HTTP 200，uni H5 基本 API 存在，页面及控制台错误为 0。匿名从 Gateway 和 notification owner 读取 `/api/v1/notifications/preferences?pageSize=1` 均得到 **401**，未泄露偏好事实。
- 已部署的 Web/移动设置页采用 canonical 分类、游标读取、expectedVersion/CAS、勿扰与失败恢复；源码回归、类型检查、H5/Web 构建和契约检查通过。移动端当前明确只管理 `IN_APP`，尚未提供 PUSH/EMAIL/SMS 的完整通道操作；偏好意图也不等于独立的投递同意或送达事实。

## 未闭环项

1. 私有 IAM 没有 ACTIVE 的正式同意文档。不能伪造批准版本来创建授权会话；因此 Web/移动通知设置的真实登录后视觉、保存、冲突、跨端读回及通道投递链仍未验收。
2. 公开课程与方案为空，正式版权/审校/双审/发布事实、十题定级、计划、五技能判分、SRS 和报告业务闭环未建立。旧素材下线消除了误发布状态，不生成正式学习内容。
3. 原生 App、iPad、小程序、真实麦克风/媒体字节、断网恢复与移动端完整通知通道仍缺运行证据。本轮浏览器检查均为 H5/匿名边界，不能替代这些端的验收。

验证补充：契约 merge/validate/generated check 全过；内容迁移专项 5/5、移动 B12 17/17、notification-service Linux Maven 119 测试 0 失败/错误（2 跳过）、发布助手 9/9。以上是相应源码或部署边界证据，不升级 PAGE-P1 状态。
