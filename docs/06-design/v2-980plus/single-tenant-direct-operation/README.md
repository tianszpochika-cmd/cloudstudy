# 单租户直营方向：以租户身份全量管控（保留 SaaS 扩展）

> 状态：方向文档（`DESIGNED`），不是实现/运行证据。
> 生效前提：Phase 1 只面向 18 岁以上成人与大学生；AI（Phase 2）、K12（Phase 3）不进入默认路由。
> 基线：`AGENTS.md` v4.5、`docs/02-architecture/v2-microservices-architecture.md` v2.3、`docs/02-architecture/v2-platform-capability-matrix.md`、ADR-0009/0010/0012/0013/0014/0016、P1R 任务台账（81/108 ACCEPTED）。
> 配套审计：`requirements/backlog/v2-phase1-rebaseline/execution/COMPLETENESS-AUDIT-2026-09-20.md`（当前契约门禁 FAIL，不能判发布 GO）。

## 1. 一句话方向

**现在 = 单租户直营**：全平台只有一个租户，就是你自己（`platform` 租户，服务端派生）。
**以后 = SaaS 可扩展**：租户模型、隔离字段、权限结构全部保留，以后加租户开户/计费/隔离 UI 即可长出来，不推翻现在。
**管理端 = 租户总控台**：你以租户身份，对全部业务数据 + 全部学员数据有直接管理能力（单词/音标/播音等原子级 + 单学员 360° 干预），但永远走“读投影、发受控命令、留审计”的架构正道，不跨库直写。

## 2. 为什么这样定（取舍）

1. **你不是 SaaS，现在不要为不存在的租户做 UI**：租户开户、租户计费、多租户隔离运营 UI 全部冻结为 `PHASE-GATED`，不进 Phase 1 默认路由。
2. **但 SaaS 的“骨头”必须留着**：`tenant_id` 字段、`TenantScope` 服务端派生、跨租户拒绝测试、owner 矩阵、RBAC+ABAC（subject/tenant/role/permission/resource/action/owner/phase/rights/consent）一个都不能拆。否则以后加 SaaS 等于重写。
3. **直营 C 端要求“看得见、管得了、能审计”**：管理端现状是包级审批 + 聚合只读（见 §4 缺口表），必须补一层“主数据 MDM + 学员运营后台”，但禁区不变：不直改领域库、不伪造可信事件、不展明文答案/原始录音/支付原文。

## 3. 租户模型（现在 vs 以后）

| 项 | 现在（单租户直营） | 以后（SaaS，加什么即可） |
|---|---|---|
| 租户数量 | 1 个：`platform`（服务端从已验证 principal + `TenantScope` 派生，客户端提交的 tenant 无效） | 加 `tenant onboarding/billing/隔离运营` 三件套；现有 `tenant_id`、`TenantScope`、跨租户拒绝测试直接复用 |
| 数据隔离 | 共享 schema 内 `tenant_id` 常为 `platform`；唯一约束/索引继续带 `tenant_id`（为以后预留，不为现在省掉） | 新租户行级接入，无需改表结构；共享 Pod/集群可以，共享写模型不行 |
| 管理身份 | 你 = `platform` 租户的最高管理员（`platform-admin`），下设内容/运营/客服/财务/审计角色 | 加租户管理员角色 + 跨租户访问矩阵（默认拒绝，跨租户需显式授权+审计） |
| 客户端 | 学员端（web+app）只认 `platform`；官网公开投影无 Token | 各租户可配品牌/域名/内容包，内容权利按租户 + 版权双重 Gate |

## 4. 全量管控矩阵（你要的“所有功能、所有数据”）

### 4.1 内容原子（单词/音标/播音为代表）

| 数据 | owner | 现在 | 目标（租户总控） |
|---|---|---|---|
| 单词（拼写/词性/多义/例句/难度/CEFR/标签） | `content-service` | 整包 JSON 文本框 | 行级 CRUD + 搜索/筛选/分页 + 批量导入（CSV 模板+预览+行级报错+幂等重跑）+ 版本对比 |
| 音标（美/英 IPA、音节、重音） | `content-service` | 无字段 | 单词挂多音标行，行级编辑 + 校验（IPA 字符集） |
| 发音播音（美音/英音/慢速拼读，真人/TTS 区分） | `content-service` 语义 + `media-service` 资产 | 只到 asset 级 | 每单词/每音标挂 N 个发音资产；行内试听（0.5x–2.0x 保音高）+ 波形 + `READY/CLEAN/FAILED` 质检 + 单发音替换/下线 |
| 例句/语法点/阅读段落/题目/选项/答案规则 | `content-service` | 包级黑盒 | 拆 `example/sentence/grammar_point/passage/question_item` 强结构行；`validate/auto` 定位到行号；答案快照不可改，改规则发新版本并 pin |
| 版本/灰度/定时/阻断 | `content-service` + 投影 | 发布/回滚 | `contentCode/contentEpoch/projectionVersion` 版本墙 + 双版本 diff 高亮 + 定时排期日历 + 学员分群灰度 + 一键紧急阻断 |
| 版权/来源/授权期 | `content-service` | 有字段无运营 | 每行 `source/license/起止/rights_status`，到期预警 + 到期自动阻断 + 替代任务推荐 |

### 4.2 单学员 360°（web+app 全量）

| 数据 | owner | 目标能力（全部走受控命令+审计） |
|---|---|---|
| 检索与总览 | 聚合（admin-ops 只聚合） | 按 id/脱敏手机/昵称/注册时间/CEFR/状态检索；一人一页：画像/目标/计划/SRS/错题/attempt/订单/工单/设备/同意 |
| 画像/目标/偏好 | `learner-service` | 代改目标/每日 5/15/30/45/主题/locale，需 `reasonCode+二次确认+expectedVersion` |
| 计划/今日任务 | `learning-service` | 查 plan/today，重排/跳过/解锁/重建；失败任务恢复；带 `planning input pin/version/digest` |
| SRS/错题/掌握度 | `learning-service` + `assessment-service` | 查 due 队列/EF/interval、错题链 variant/reasonTrace、掌握度阶段（D7 前禁 MASTERED）；可 `reset/requeue/re-verify`，禁改分数 |
| 测评/attempt/报告 | `assessment-service` | 会话/checkpoint/判分摘要/watermark 脱敏审计（不展原始作答/答案规则）；异常 attempt 作废并经 Saga 重算；报告按周期幂等重建 |
| 账号状态 | `iam-service` | 锁定/解锁、密码重置（投递+审计）、设备全撤、删除 `168h` 冷静期发起/撤回/执行（`ANONYMIZED` 前对齐全部 owner receipt） |

### 4.3 媒体/游戏化/社交/商业/通知/客服/审计/恢复

| 域 | 目标能力 |
|---|---|
| 媒体资产 | 资产总览（时长/码率/rendition/权利/内容反查）+ rendition 明细与单 rendition 重试 + 字幕行级编辑 + 学员录音只读审计（默认不放音，审批后可放，fail-closed） |
| 游戏化 | 按学员查不可变账本（rootEventId 去重可验），异常经可信事件重放补记/冻结，不直改流水；游戏 catalog 行级开关（P0 仅 Sentence Train） |
| 社交 | 房间明细/座位/租约强制释放/封禁；榜单延迟与去标识规则配置；举报四命令保留 |
| 商业 | SKU 行级（价格快照/version）、激活码批量生成/过期/作废/兑换审计、权益强制发放/回收（commerce owner 命令+双审）；生产支付保持 OFF |
| 通知/同步 | 按学员重发/撤回；按 `clientSeq/baseVersion` 代决冲突（显式 `CONFLICT`，不静默覆盖） |
| 客服 | 已有双端同 ticket/version + 分派/SLA，继续沿用并接入学员 360° |
| 审计/恢复 | 全部写动作强制 `actionCode/resourceRef/reasonCode/双人审批/requestId→audit`；导出默认脱敏+水印；Saga/DLQ/人工恢复沿用 workflow，申请人不能自批 |

## 5. 权限模型（租户总控的分权）

| 角色 | 能做什么 | 不能做什么 |
|---|---|---|
| `platform-admin`（你） | 一切 + 授角色 | 不能关审计、不能单人执行高危（退款/权益/删除/调听录音必须双人） |
| 内容编辑 / 一审 / 二审 / 发布 | 草稿→L1→L2→发布流水线 | 作者不能审自己；FINAL 依赖同版本/hash 的 FIRST APPROVED |
| 运营客服 | 学员 360° 查看 + 计划/SRS/通知/工单代操作 | 不能改分数/账本/权益，不能看明文答案/原始录音/支付原文 |
| 财务 | 退款/对账/激活码 | 仅 `FULL_ONLY` 退款，settled 后才撤销权益；`GRACE=0` |
| 审计员 | 只读一切 + 脱敏导出 | 不写业务 |
| 全部 | — | 客户端提交的 role/tenant/owner 一律无效；401/403 不伪装空列表；PDP/撤销异常 fail-closed |

PII 分级：列表页只显 hash/引用；详情解锁需 `reasonCode+审批` 并记审计。

## 6. 架构铁律（改造中任何一步都不能破）

1. Contract-first：先 OpenAPI（每个子资源）+ 生成 DTO/TS，再写实现；同步更新网关路由/owner URI/冻结基线（顺带收敛当前 22 条幂等/分页 + 18 条网关 FAIL）。
2. Owner 不动：`content/learning/assessment/media/commerce/...` 各写各表；admin-ops 只聚合+发命令；workflow 只编排恢复；audit 只留痕。
3. 跨服务一律事件化：发布→投影、支付→权益、判分→掌握、完成→奖励走 Outbox+Kafka+幂等+补偿，`requestId/traceId/eventId` 全链可查。
4. 四前端不动业务归属：`apps/mobile`（uni-app 学习端）、`apps/learner-web`（PC/PWA）、`apps/admin-web`（本改造主战场）、`apps/official-site`（公开投影）。

## 7. 分批改造（建议顺序，可调）

| 批 | 内容 | 产出 |
|---|---|---|
| B1 单词主数据 | A1+A2+A3：单词/音标/发音行级 + 行内试听质检 | 单词表 + 音标行 + 发音资产挂接 + 质检按钮 |
| B2 内容生产 | A4+A5+A6+E2：行级题目/版本 diff/排期日历/批量导入 | 教研可真正生产内容；`validate/auto` 行号定位 |
| B3 学员运营 | §4.2：学员 360° + 计划/SRS/报告干预 | C 端运营闭环；全部受控命令+审计 |
| B4 安全收敛 | 锁定/退款双审/角色细分 + `x-idempotency`/分页门禁全绿 | 契约/网关检查 PASS；独立复核后更新证据绑定 |

## 8. 验收（DoD 摘录）

每个子资源：OpenAPI lint/generate/compat PASS；owner migration + 独立 schema/凭据；行级 CRUD 真实 DB 测试；跨租户拒绝（即使现在单租户也要跑）；Gateway→owner 正负例；浏览器八态；审计可回放；回滚/补偿可演练。历史 ACCEPTED/DEV_DONE 状态不因本文自动变更。

## 9. 决议（2026-09-21，用户已确认）

1. 首批 B1，接着 B2、B3（本目录三份交付记录为准）。
2. 发音三档（美/英/慢速）+ 真人/TTS 区分，行级登记与质检。
3. 改目标/重建计划单人 + 审计；录音调听/退款/删除/权益双人（B4 落角色细分）。
4. 导入模板列按 §4.1/§4.2，B2 用 JSONL 承载（CSV 解析 B3 按需）。

## 10. 交付记录

| 批 | 文档 | 内容 |
|---|---|---|
| B1 | [B1-lexeme-master.md](B1-lexeme-master.md) | 单词/音标/发音行级总控（9 个 `LEXEME_*` 命令，网关零新增路径） |
| B2 | [B2-content-production.md](B2-content-production.md) | 行级条目、批量导入、定时排期、版本对比、行内试听 |
| B3 | [B3-learner-360.md](B3-learner-360.md) | 学员 360°、网关 7 路由翻转、包定时执行、灰度标签（含重冻包） |

三批均未做真实 DB/网关/浏览器运行验收，不改变任何 P1R 任务状态；测试方向见 B3 §2 重冻包与各交付文档 §验证。
