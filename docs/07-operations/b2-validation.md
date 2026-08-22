# B2 独立验证说明

> 历史执行记录：本验证基于 v1 Java 17/`core-api` 兼容实现。它只证明 B2 旧任务的代码/静态证据，不证明 v2 Gateway、IAM/RBAC 或微服务迁移已完成；v2 验收须另按 `ARCH-*` 能力和新任务证据执行。

本文档对应 `DEV-04-001~012`、`DEV-05-001~012` 和 `DEV-09-008` 的 B2 验收边界，记录静态实现、契约生成、迁移清单、客户端构建和运行态验证的区别。

## 运行命令

在仓库根目录执行：

```text
node --test tests/b2/client-contract.test.mjs tests/b2/exercise-mastery.test.mjs tests/b2/integration-b2.test.mjs tests/b2/vocabulary-srs.test.mjs
```

当前基线结果（2026-08-20）：

```text
tests 34
pass 31
fail 0
todo 3
exit code 0
```

当前静态门禁已通过。契约合并/生成/校验也已通过（114 operations、132 OpenAPI schemas、33 events）；三个 TODO 保留给必须依赖外部环境的运行态验收：

- OpenAPI 生成物已包含词汇/SRS、规则化练习、学习流兼容入口、错题验证、报告和通知读取路径；旧入口与详细设计中的 `/assessment/sessions`、`/exam`、`/mastery` 权威入口并存，统一映射到 B2 规则引擎。
- V0010/V0011 已登记到 migration manifest。V0011 采用 `asm_mastery_verification` 作为掌握验证所有权，另提供 `asm_attempt` 和 `notifications`；没有再创建重复的 `lrn_mastery_verification` 掌握表。
- Web `vue-tsc`/生产构建和 uni-app H5 构建已通过；Core API 完整 Maven 构建仍因本机没有 Maven/Spring 依赖未执行。

## 已验证项

测试使用 `tests/b2/fixtures/` 中的合成夹具，并通过独立规则回放检查：

- 词汇详情的 `vocabId`、`contentVersionId`、音标、释义、例句和授权状态。
- Core API `SM2_Q03_V1` 的质量边界、Ease Factor 1.30 下限、1/3/7/15/30/90 间隔锚点和 365 天上限；同一输入可重复得到同一输出，并通过真实 `SrsAlgorithm.java` 结构校验。
- SRS `NEW`、`LEARNING`、`MASTERED`、`CONSOLIDATED` 的允许恢复路径，拒绝直接跳级。
- 单选、多选、判断、匹配、排序、填空、听辨选择和口语自录八种判分行为；口语自录保持 `PENDING_REVIEW`，不伪造 Phase 1 的 AI 分数。
- 学习者题面投影不含答案；参考答案只属于提交后的 review 投影。
- 每日流的 4:4:2 配额、唯一性、优先级及调度原因。
- D+1/D+7 的日期计算、通过进入下一阶段、失败回到复习队列。
- 同一幂等键和相同请求摘要返回首次结果；相同键但请求摘要变化返回 `IDEMPOTENCY_CONFLICT`。
- 现有事件目录中的 SRS、判分、掌握、任务和通知事件，以及全量 payload 敏感字段禁用规则。
- 现有 `AdaptivePerformanceEngine` 的 Ultra / High / Medium / Performance 顺序、Performance 关闭 3D/波形/Rive/粒子、减少动效自动降级、持久化恢复和非法等级保护。
- 三组夹具均无手机号、邮箱、Token、密钥、原始答案、原始音频、录音字节或设备/IP 等敏感字段。

## 待外部环境验证

测试文件保留三个 TODO，不能用静态夹具替代真实运行态证据：

- MySQL + Redis：启动 Core API，真实回放逐题提交，验证幂等记录、SRS 原子更新、D+1/D+7 worker 和通知消费者。
- Docker：使用仓库固定端口配置启动 MySQL、Redis、MinIO、RabbitMQ，并执行健康检查与 migration。
- 浏览器：在 Learner Web/H5 验证主动回忆、揭示答案、键盘流、响应式布局、弱网恢复和四档视觉降级。

这些项完成后，应重新运行上面的 Node 测试，并补充运行日志、接口回放或截图到相应证据包；本次任务不创建或修改 `requirements/backlog/evidence/` 文件。

## 交付边界

本轮已交付 B2 的契约、事件、迁移、规则引擎、Web/uni-app 客户端、学习流兼容控制器和静态测试基线。词汇服务与练习引擎当前仍是内存实现，V0010/V0011 是可部署的持久化结构基线；真正接入 MySQL Repository、Redis 幂等锁、D+1/D+7 worker、通知消费者和浏览器/E2E 运行态后，才能把对应任务从“待验收”改为“已完成”。
