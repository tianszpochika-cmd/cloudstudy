# Phase 1 范围冻结与跨文档基线（v1 Historical / Superseded）

> 基线 ID：`P1-BASELINE-20260820`
>
> 生效日期：2026-08-20
>
> 适用任务：旧 `DEV-00-001` 与 B0~B6 下游任务的历史回放。v2 新任务仅可将本文件作为约束核对，业务需求、交互、阶段和验收必须以 `docs/06-design/v2-980plus/` 为准，并增加 `ARCH-*` 与服务 owner 映射。

> v2 绑定：Phase 1 的业务范围冻结仍然有效；后端不再以 Java 17 模块化单体作为新服务目标。Gateway、IAM/RBAC、服务数据 owner、事件和观测基线见 [ADR-0010](../../docs/10-decisions/0010-java25-microservices-gateway-iam.md) 与 [v2 微服务架构](../../docs/02-architecture/v2-microservices-architecture.md)。

本文件记录曾用于 v1 B0~B6 的冻结口径。它不替代需求、设计或任务状态事实源；与 v2 有冲突时，以 v2 和目标架构为准，不能把本文件当作新任务的执行基线。B7+ 的状态、负责人、证据和阻塞以 `v2-B7plus-代码重塑与交互测试任务基线.md` 的任务行记录为准。

## 1. 冻结清单

| 编号 | 主题 | 历史冻结口径（v2 冲突时不适用） | 直接影响 |
|---|---|---|---|
| P1-01 | 目标用户 | 18 岁以上成人与大学生，包含成人零基础、日常交流、CET-4/CET-6、听力/阅读/写作/口语自练目标 | `ONB`、`USR`、`COM`、营销 |
| P1-02 | 学习方法 | 规则化学习闭环：学习目标 → 练习 → 规则反馈 → 复习 → 掌握/报告 | 全部学习域 |
| P1-03 | 每日时长 | 枚举只允许 `5`、`15`、`30`、`45` 分钟；默认值由产品配置决定，不由客户端自由增加 | `FEAT-ONB-002`、Daily Stream、XP/Streak |
| P1-04 | 音标 manifest | `EN_48_PHASE1` 是唯一 manifest ID；必须包含 48 个不可重复条目：20 个元音、28 个辅音。每条至少有 `phonemeId`、IPA、分类、示例词、内容版本和媒体引用 | `FEAT-SPK-001..003`、CMS、媒体、种子 |
| P1-05 | 音频变速 | 支持 `0.5x~2.0x` 连续范围；默认快捷档可以是 0.5/0.75/1/1.25/1.5/2，但服务端和播放器状态机不能超出范围；音高保持 | `FEAT-LST-002`、媒体、埋点、弱网 |
| P1-06 | 口语分期 | Phase 1 提供规则化音标/口型、跟读、影子跟读、录音回放和预编情景会话；不启用 LLM、ASR、AI 发音评分、RTC 或实时 AI 对话 | `FEAT-SPK-*`、音频权限、隐私 |
| P1-07 | SRS 事实 | `lrn_srs_state` 为唯一用户学习对象 SRS 事实；`vocab_id`、`chunk_id`、`expression_id` 为 canonical 学习对象 ID | `VOC`、复习、报告、同步 |
| P1-08 | SRS 对外状态 | API 跨域只输出 `NEW`、`LEARNING`、`MASTERED`、`CONSOLIDATED`；内部细状态须通过 mapper，不能让各端自行解释 | `VOC`、`ASM`、Home、报告 |
| P1-09 | D+1/D+7 | 错题验证状态为 `PENDING_RETRY` → `DELAY_VERIFY_D1` → `DELAY_VERIFY_D7` → `MASTERED`；后续再次错误使用 `REOPENED` 并开启新 cycle。旧别名只做兼容映射 | `ASM`、SRS、通知、报告 |
| P1-10 | VOC/ASM 所有权 | VOC 维护学习对象、SRS、复习事件、算法与排程；ASM 维护题目/练习/作答/判分/错因/错题 cycle 和 D+1/D+7 证据；ASM 不复制 SRS 或 SM-2 | `DEV-04-*`、`DEV-05-*`、事件契约 |
| P1-11 | 商业化开关 | 权益、SKU、订单和激活码可以先建模；微信/支付宝/Apple IAP 的实际支付默认关闭，只有资质/沙盒/验签/退款/对账/回滚/审计证据齐全后才能打开 | `COM`、`ADM`、发布 Gate |
| P1-12 | Phase 隔离 | Phase 2 的 AI Tutor、LLM、RAG、ASR、发音评测、RTC、数字人；Phase 3 的未成年人/K12/教材同步/家长模式均不进入 Phase 1 UI、路由、注册、营销和默认数据 | `AI2`、`K12`、全端 |

## 2. 已知冲突与解决（已裁决，不是待冻结事项）

本节的旧值仅作为被拒绝的历史冲突证据；“冻结处理”是当前裁决结果，不能按“待产品决定”或“待再次确认”解释。

| 冲突位置 | 旧/分散描述 | 冻结处理 | 证据 |
|---|---|---|---|
| PRD §3.1 | `5/10/20/30` 分钟 | **已裁决**：采用 `5/15/30/45`；旧值保留为历史冲突，不进入新契约 | `requirements/feature-matrix.md`、`requirements/backlog/开发实施总纲与功能链条任务分解.md` |
| PRD §8.1 | `0.75x/1.0x/1.25x/1.5x` | **已裁决**：采用 `0.5x~2.0x` 连续变速，固定快捷档为 `0.5/0.75/1/1.25/1.5/2`，音高保持 | `requirements/feature-matrix.md`、`docs/06-design/detailed-specs/04_听说读全模态精练系统详细设计.md` |
| PRD/设计历史别名 | `PENDING_DELAY_VERIFY_D1/D7`、`RESOLVED` | **已裁决**：新 API/表只使用 `DELAY_VERIFY_D1/D7`、`MASTERED`；迁移时记录 `legacy_status` 或映射证据 | `docs/06-design/detailed-specs/05_做题中心模考与掌握闭环详细设计.md` |
| 多域实现风险 | 词汇、练习、报告都可能自行维护 mastery | **已裁决**：VOC/ASM 所有权按 P1-10 执行；跨域只消费版本化事件/查询 | `docs/06-design/detailed-specs/09_全站详细设计一致性审计白皮书.md` |
| 商业化 | PRD 有会员/订单，但资质和渠道证据尚未完成 | **已裁决**：保留权益/激活码基础能力；支付 flag 默认 `false`，不做假支付成功 | `requirements/acceptance-criteria.md`、详细设计 08 |

## 3. Phase 1 禁止清单

- 不创建未成年人账号、家长模式、K12/教材同步或面向未成年人的营销/宣传文案。
- 不在 Phase 1 调用 LLM、RAG、ASR、AI 发音评分、RTC、AI 数字人或 AI 自动生成课程。
- 不把“参考 CEFR”写成官方认证，不把原创 CET 风格练习写成官方真题/官方评分。
- 不接入付费随机宝箱、现金兑换、陌生人私聊、开放评论区或自由文本社交。
- 不把支付私钥、Apple JWS 私钥、API Key、真实手机号/音频/生产凭证写入代码、文档、日志或测试夹具。
- 不把 B7+ 状态写入旧状态总报表；B7+ 更新对应新任务行，B0–B6 历史任务才更新旧状态总报表，且均由主编排器按证据统一登记。

## 4. 开工前引用模板

Agent 在任务说明、PR 或交付报告中复制以下内容并补齐任务信息：

```text
Scope Baseline: P1-BASELINE-20260820
Task: DEV-xx-xxx
Feature Ref: FEAT-...
Audience: 18+ adult/university only
Daily Duration: 5 | 15 | 30 | 45 minutes
Phoneme Manifest: EN_48_PHASE1
Audio Speed: 0.5x..2.0x, pitch-preserving
Phase-1 Speaking: rule-based self-practice; no LLM/ASR/RTC/AI score
SRS Source of Truth: lrn_srs_state
VOC Owner: learning object, SRS, review facts, schedule, algorithm version
ASM Owner: question/exercise/attempt/scoring/mistake/D+1/D+7 evidence
Payment Default: OFF; no fake success path
Phase Isolation: Phase 2/3 excluded unless approved by a new ADR
```

## 5. 解除冻结的条件

任何 Agent 发现基线无法支持业务时，先把任务标记为阻塞并提交变更提案，不得在代码中自行偏离。变更提案至少包含：

1. 冲突来源、受影响的 `FEAT-*`、API、表、事件、终端和历史数据规模。
2. 兼容方案、迁移脚本、回滚/补偿方案和旧客户端行为。
3. 测试矩阵、隐私/合规/版权影响和成本影响。
4. 新 ADR 或 superseding ADR 编号、批准人和生效日期。

没有批准记录的提案不改变本基线。
