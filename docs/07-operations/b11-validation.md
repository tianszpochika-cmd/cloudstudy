# B11 代码层开发与逻辑测试交接

> 执行日期：2026-08-22  
> 范围：媒体服务、通知/离线同步、B3 兼容迁移、多模态学习端页面、性能降级、契约/迁移和逻辑测试；不等同于真实微服务运行态、生产迁移或浏览器/设备签收。

## 结论

B11 的 7 项任务已经形成可测试的代码层切片，可以进入第一轮测试阶段。媒体和通知已从 `core-api` 的目标边界中拆出独立 Java 25 服务；学习端已覆盖听力、阅读、音标、跟读、Shadowing、录音自评和离线恢复；B3 兼容层只记录 hash、版本、授权、对账和路由事实，不写回旧领域事实。Phase 1 不启用 AI/ASR/数字人评分。

不能据此宣称 Java 25/Maven/Spring Boot 完整构建、真实 Gateway→服务链路、OIDC/JWKS、RBAC/ABAC 运行态、MySQL/Kafka/Workflow、S3/CDN/KMS、浏览器麦克风、真机或生产迁移已经完成。

## 任务交付

| 任务 | 代码层交付 | 测试阶段剩余 |
|---|---|---|
| `V2-B11-MED-001` | `services/media-service`：元数据、版权引用、checksum/size、转码/rendition、manifest、Range、短时授权、过期和撤回；默认拒绝，事件/日志不携带媒体内容 | Java 25/Maven、Spring HTTP、MySQL、S3/CDN/KMS、跨进程权限和事件 |
| `V2-B11-INF-002` | `services/notification-service`：偏好、消息、投递 attempt、幂等、重试/DLQ、离线 change/cursor/向量冲突、空间不足和人工恢复端口 | 推送供应商、Kafka/Workflow durable worker、MySQL、真实设备弱网 |
| `V2-B11-FE-003` | learner-web/mobile：精听播放、字幕/时间轴、倍速、A-B、Language Clips、听写、分级阅读、进度/题目同步、离线/过期/撤回/权限状态 | 浏览器回放、真实媒体、iPad/小程序条件编译、键盘/触控/无障碍 |
| `V2-B11-FE-004` | learner-web/mobile：麦克风权限、录音 hash、本地加密恢复、重录、自评、Shadowing；提交结果显式 `aiScoringAvailable=false` | 浏览器麦克风、App Keychain/Keystore、真实授权和设备恢复 |
| `V2-B11-PERF-005` | `packages/performance` 与 B11 页面：四级性能策略、离线存储压力降档、手动关闭动效、波形/3D/动效静态或 2D 降级 | 真机帧率/内存/存储压力、视觉回归、对比度和动效可用性 |
| `V2-B11-MIG-006` | `B11MediaOfflineCompatibilityAdapter`：旧 manifest 对账、授权失败不可读、对象引用 hash 迁移、失败 fallback、撤回；`domainFactsUntouched=true` | 双读/target 运行态、持久化 adapter ledger、真实回滚演练 |
| `V2-B11-TEST-007` | `tests/b11`、learner-web/mobile 边界测试、media/notification/core-api 纯 Java smoke | 浏览器、跨进程、基础设施和设备矩阵 |

## 关键边界

- `media-service` 固定 `18092`，`notification-service` 固定 `18093`；客户端只访问 Gateway 相对路径，不能直连服务。
- 媒体只拥有 metadata、manifest、rendition、rights reference 和短时授权；对象 bytes、原始录音、对象存储内部定位信息不进入领域模型、HTTP 响应、事件或普通日志。
- 媒体授权绑定资产版本、主体、租户、内容版权、设备/同意和 Range；撤回会使已有授权失效，未授权/过期/撤回默认拒绝。
- 离线同步使用 `clientEventId`、设备序号、cursor 和版本向量去重/检测冲突；冲突必须解释并进入恢复，不静默覆盖服务端事实。
- 兼容迁移只操作不透明引用 hash 与 adapter ledger；legacy/target 读取可回退，不能重写 B3 的学习、录音或内容事实。
- UI `uiLocale` 与内容 `contentLocale` 分离；页面保留 loading、empty、error、permission、offline、expired、revoked、recovering 和性能降级状态。

## 已执行验证

| 命令/检查 | 结果 |
|---|---|
| `node --test tests/b11/*.test.mjs` | 4/4 通过：兼容边界、OpenAPI、AsyncAPI、V0019 |
| `node --test apps/learner-web/tests/*.test.mjs` | 8/8 通过，其中 B11 4/4 |
| `pnpm --dir apps/mobile test:b11` | 6/6 通过 |
| media `smoke.ps1` | `media-service MED-001 smoke: PASS` |
| notification pure-Java smoke | `notification-service B11-INF-002 smoke: PASS`；canonical/compatibility entry 均通过 |
| core-api B11 adapter smoke | `core-api B11 media/offline compatibility smoke: PASS`，Java 17 编译边界 |
| `pnpm --filter @englishflow/performance typecheck` | 通过 |
| `pnpm --filter @englishflow/learner-web typecheck` | 通过 |
| `pnpm --filter @englishflow/learner-web build` | 通过；仅 Vite 已知 dynamic-import 提示 |
| `pnpm --dir apps/mobile build:h5`、`build:app`、`build:mp-weixin` | 全部通过；仅 uni-app/Sass 更新提示 |
| `pnpm --filter @englishflow/api-client typecheck` | 通过；生成器已处理同名事件类型冲突 |
| `pnpm contracts:merge` / `contracts:validate` / `contracts:generate` | 通过；338 routes、365 operations、407 OpenAPI schemas、129 events、80 payload schemas、5 个生成文件 |
| `pnpm contracts:compatibility` | 通过，0 breaking change |
| `pnpm db:validate` | 通过，19 个迁移和 fixture 静态校验通过 |
| `pnpm ports:check` | 通过；18092/18093 及登记端口均空闲 |
| `pnpm test:b1`、`test:b3`、`test:b4`、`test:b5`、`test:b6`、`test:b7`、`test:b8`、`test:b9`、`test:b10`、`test:b11` | 全部无失败；B1 7/7、B3 17/17、B4 6/6、B5 4/4、B6 4/4、B7 28/28、B8 28/28、B9 6/6、B10 7/7、B11 4/4 |
| `pnpm test:b2` | 14 个通过、3 个既有运行态 TODO、无失败 |

## 测试阶段入口

1. 准备 JDK 25、Maven、测试 IdP/JWKS 和本地 MySQL/Redis/Kafka/Workflow；先执行 `pnpm ports:check`。
2. 以独立 schema/凭据启动 Gateway、media、notification、learning/assessment 和兼容适配边界，验证服务侧 PEP、tenant/owner、版权/同意、trace 和错误 envelope。
3. 对媒体授权执行 Range、过期、撤回、checksum、转码失败和 CDN 回退；对离线执行重复、乱序、断网、空间不足、冲突、DLQ replay 和人工恢复。
4. 执行 learner-web、Mobile H5、iPad/小程序条件编译和浏览器交互矩阵，覆盖键盘/触控、弱网、主题、国际化、录音权限和四级性能降级。

当前工作站只有 Java 24 且没有 Maven；浏览器冒烟因没有身份服务/登录会话被重定向到登录页，真实 Gateway、媒体、麦克风和设备联调留到测试阶段。B11 代码层达到交接条件，但不替代运行态验收。
