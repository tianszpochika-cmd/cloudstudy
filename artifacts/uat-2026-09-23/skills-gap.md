# 跨端技能入口与 Gateway/owner 服务核查（2026-09-23）

## 判定与证据边界

学习 Web 和移动端的语法、写作、听力、阅读、音标入口仍请求 B3 `/api/v1/grammar|writing|listening|reading|phonetics`。本地 Gateway 对五个入口的无令牌 GET 请求均返回 **404**：`/grammar/points`、`/writing/prompts`、`/listening/materials`、`/reading/articles`、`/phonetics/catalog`。这验证路由不可用；没有使用账号/令牌，不能据此判定登录后的领域服务响应。内容服务的 `/internal/v1/content/learner/grammar/points` 和学习服务的 `/internal/v1/learning/experiences/grammar/mastery` 无令牌均为 **401**，说明现行服务有受认证保护的独立入口。

Gateway 的 `GatewayRoutePolicy.java:167-171` 把五类公开前缀指定给 `assessment-service`；`GatewayRouteExecutionPolicy.java:140-144` 明确标记当前 controller owner 冲突并 fail closed。`CanonicalRoutePolicyRouteLocatorIntegrationTest.java:271` 还断言语法提交入口不可用。内容读投影位于 content-service，互动写入位于 learning-service，assessment-service 没有这些 B3 controller。当前不能只补一条 Gateway 转发来宣称技能链路可用。

| 技能 | 两端现行调用 | 服务中已有能力 | 尚缺的正式链路 |
| --- | --- | --- | --- |
| 语法 | `/grammar/points`、`/exercises`、`/sentences/*`、`/practice/attempts`、`/mastery` | content-service `B3ContentJdbcController` 读取知识点、题目和句图；learning-service `B3LearningJdbcController` 有 `/grammar/attempts` 与本人掌握度 | 公开提交路径与学习服务路径不同；学习服务用答案是否包含 `has/good` 判正确并直接返回分数，未用已发布题目规则。正式 assessment session、规则评分和版本 pin 尚未连通 |
| 写作 | `/writing/prompts`、`/submissions`、`/corrections`、`/history` | content-service 有 prompt/template/material/proofreading 读投影；learning-service 有提交、改错和本人历史 | 当前提交只按答案非空给固定 80 分，改错只按非空给 100 分；没有与内容规则绑定的版本化评价和草稿/恢复闭环 |
| 听力 | `/listening/materials`、`/clips`、`/sessions`、`/dictation`、`/progress` | content-service 有材料/片段读投影；learning-service 能存会话/进度；media-service 有 `/media/assets/{assetId}/manifest` | 听写按答案是否含 `good` 和 `help` 判分；B11 媒体 manifest 是资产授权入口，不能替代材料目录或测评 session。媒体状态、版权、字幕/文本替代与判分仍需联通 |
| 阅读 | `/reading/articles`、`/questions`、`/attempts`、`/mining`、`/progress` | content-service 有文章、问题、查词读投影；learning-service 能存进度/挖掘/答题 | 阅读答题按固定 `A` 或 `small routines` 判正确，没有从版本化文章/问题规则取答案；提交不构成正式 assessment 结果 |
| 音标 | `/phonetics/catalog?setCode=EN_48_PHASE1`、`/minimal-pairs` | content-service 有英语/法语音素和最小对读投影 | Gateway policy 把整个 phonetics 前缀指定 assessment-service，当前没有同语义 assessment controller；内容 controller 接收 `setCode` 却没有按它过滤，现行英语目录包含 48 条基线和 10 条合成克隆；录音、自评与媒体/assessment owner 边界仍分散在兼容流程 |

前端路径见 `apps/learner-web/src/api/b3.ts`、`apps/mobile/src/api/b3.ts`。读投影见 `services/content-service/src/main/java/com/englishflow/content/web/B3ContentJdbcController.java:39-230`；写入与固定判分见 `services/learning-service/src/main/java/com/englishflow/learning/web/B3LearningJdbcController.java:48-282`。`services/core-api/src/main/java/com/englishflow/modules/learning/b3/B3Controller.java` 也保留旧 B3 路由，但 AGENTS.md 已把 core-api 限定为迁移兼容层，不能据此绕过 owner 约束。

## 数据质量

本地 `content_service.b3_content_experience` 的 `PUBLISHED` 行按 domain 统计：GRAMMAR 25、LISTENING 22、READING 33、WRITING 55、PHONETICS（英语）77、PHONETICS-FR 41；其中 key 为 `local-10x-%` 的分别为 20、20、30、50、20、0。英语音素条目为 58，法语音素为 37；这些是全局条目数量，不能证明学习者获得了完整音频、正确答案、版权许可或真实进度。内容服务目前按 `availability='PUBLISHED'` 和 key 排序返回最多 20 行，故开放旧目录时会把这些批量合成条目呈给用户。样本标题有 `Learning in small steps 1…10` 等编号复制内容；需独立审校教学质量。

## 运行门禁与修复顺序

`pnpm p1r:gateway-contract:check` 当前 FAIL：冻结基线预期 route rule 56/公开操作 365，当前为 63/393，并报告 admin recovery、IAM account deletion 等多项契约漂移。该失败与 B3 五类入口的 owner 冲突不同，仍需纳入总体 Gateway 验收结果。HTTP 404、源码中的 fail-closed 策略、owner controller 和 MySQL 存量是本次技能诊断的直接依据。

1. 按 Phase 1 页面登记册与现有架构，逐 operation 固定内容读取、媒体授权、assessment attempt/评分、learning 进度的 owner 与权限。当前 Gateway 的整个前缀统一指向 assessment-service，与已有 controller 分布冲突；调整属于契约/架构工作，应先同步正式契约与决策记录。
2. 内容 owner 核对题目/文章/音频、版权与版本；测评 owner 实现与已发布规则绑定的安全判分和 session；学习 owner 只根据已验证结果推进掌握度/计划，不从客户端答案或固定文本给分。
3. Gateway 对每个契约 operation 按准确方法/path 投影到对应 owner，保持服务侧 PEP、请求幂等和跨账号隔离；两端消费生成类型并处理加载、空态、失败、恢复和播放/输入设备差异。
4. 用真实账号分别验收五类入口的目录→内容→提交→反馈→进度/报告；包含错答、重复提交、版本变更、权限/版权撤销、无音频/无麦克风和断网恢复。合成数据条数与静态合同 PASS 不计作教学体验通过。

本次未修改 Gateway 或前端，未重启共享服务。现有读投影和互动写入的路径/owner/评分语义不满足“同接口可直接替代”的条件。
