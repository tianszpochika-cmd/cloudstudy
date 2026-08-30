# 当前跨电脑交接（dev）

更新时间：2026-08-30（Asia/Shanghai）。本文件只说明如何恢复当前开发检查点，不替代任务台账或 Evidence manifest。

M0 canonical Evidence 的实现源提交：`0f8b60ae4e83d0f31d891eed8d9383c007485130`。交接提交在其后，只增加任务状态、manifest、Gate 摘要与交接记录。

M1-001 canonical API 基座的原实现源提交：`96e1b541cdda8e9e5ad02bc79ea0c5b9032064c4`；共享制品最新在 `cd92378bd8ba0c57c920fc6e79db52de717b0b05` 完成 current-source revalidation，验收状态与摘要以 `evidence/p1r/m1/P1R-M1-001/manifest.json` 为准。

M1-002 自有 IAM 认证生命周期契约已接受：原最终实现源 `25705c4caab46449cfaa577db08bd13c8ad13fba`，共享 B8/canonical/generated 制品最新在 `cd92378bd8ba0c57c920fc6e79db52de717b0b05` 完成 current-source revalidation；canonical manifest 为 `evidence/p1r/m1/P1R-M1-002/manifest.json`。

M1-003 IAM 权限、成人 Gate、consent、tenant、admin policy 与 PEP/PDP D2 契约已接受：原最终实现源 `82b27f4108cfb976a274c2ac0cc34b1c9460a7a7`，共享制品最新在 `cd92378bd8ba0c57c920fc6e79db52de717b0b05` 完成 current-source revalidation；canonical manifest 为 `evidence/p1r/m1/P1R-M1-003/manifest.json`。

M1-004 Gateway 边界与浏览器安全 D2 契约已接受：原实现源 `e4618b324e5a93926da0750a8100fc9377ac97ec`，共享制品最新在 `cd92378bd8ba0c57c920fc6e79db52de717b0b05` 完成 current-source revalidation；canonical manifest 为 `evidence/p1r/m1/P1R-M1-004/manifest.json`。现有 Java Gateway 仍只是 M2-001 的候选实现，不能据此声明真实运行验收。

M1-005 数据所有权与迁移政策 D2 已接受：原最终实现源 `21cdd3a94d0c721c96f5257d26efbb0c1b9354fb`，共享制品最新在 `cd92378bd8ba0c57c920fc6e79db52de717b0b05` 完成 current-source revalidation；canonical manifest 为 `evidence/p1r/m1/P1R-M1-005/manifest.json`。现有 `config/b25-data.json`、历史 `core-api.*` Redis owner 和 migration 目录均只作为候选输入；真实 schema/grants、TenantScope、Redis rebuild 与 rollback 仍由 M2-004 验收。

M1-006 Kafka 事件目录与 AsyncAPI 治理 D2 已接受：原最终实现源 `3e4ba856742f28ba9d3fc4a3264c4b24c1cafc5a`，共享制品最新在 `cd92378bd8ba0c57c920fc6e79db52de717b0b05` 完成 current-source revalidation。其双不可变基线、154 条事件分类、AsyncAPI 投影和 B26 静态绑定只证明 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`，不代表 Kafka、Outbox、ACL 或 consumer runtime PASS。

M1-010 更新了共享 OpenAPI、生成类型、兼容工具、审计与测试制品；`P1R-M1-001` 至 `P1R-M1-009` 的 canonical manifest 已统一绑定 `cd92378bd8ba0c57c920fc6e79db52de717b0b05` 完成 current-source revalidation。各 manifest 的 `provenance` 继续保留原始实现源、完成时间、reviewer、兼容基线和历次复核链，没有把旧任务改写成 M1-010 的实现成果。

M1-007 事件可靠性与人工恢复 D2 契约已接受：原最终源码 `6ce98a95b75e7efca05cc511f5f773dbf2be08a4`，独立终验 `agent:m1_007_independent_review:gpt-5.6-luna:max` 与另一位 Luna Max 交叉复核均接受，canonical manifest 为 `evidence/p1r/m1/P1R-M1-007/manifest.json`；共享制品已在 `cd92378` 完成 current-source revalidation。结论仍是 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；B26 继续是 `static-only` / `runtimeStatus=pending` / `defaultDecision=NO-GO`。

M1-008 内容后台 command、双审、排期发布与投影 D2 契约已接受：原最终源码 `e05c774b02ece081a5c05145b623f39d1ecd39e1`，主评审 `agent:m1_008_independent_review:gpt-5.6-luna:max` 与两条 Luna Max 交叉复核绑定同一 SHA 一致 `ACCEPT`，P1/P2 为 `0/0`；canonical manifest 为 `evidence/p1r/m1/P1R-M1-008/manifest.json`，共享制品最新在 `cd92378` 完成 current-source revalidation。tooling `27/27`、lifecycle `6/6`、当时 P1R `296/296`、typecheck `7/7` 以及 contracts、event、Gateway、B26 static 与固定 compatibility 均 PASS。结论只覆盖 D2 静态契约，真实内容数据/Outbox、Kafka、排期/Saga、投影与 E2E 没有晋升为完成。

M1-009 媒体与录音 D2 契约已接受：原最终源码 `2e7304a12c297d4c7bcad22b41cdb373b6030033`，独立终验 `agent:m1_009_contract_audit:gpt-5.6-luna:max` 判定 `ACCEPT`，P1/P2 为 `0/0`；共享制品最新在 `cd92378` 完成 current-source revalidation，canonical manifest 为 `evidence/p1r/m1/P1R-M1-009/manifest.json`。

`P1R-M1-010` 已接受：不可变来源检查点 `760621e45b9adc95a6aa40fb1678a8d3ebc87797`，最终源码 `cd92378bd8ba0c57c920fc6e79db52de717b0b05`；首轮 `3bfc63d` 经独立 Luna Max 评审返回 `REWORK`，raw-answer 脱敏和终态时间 nullability 已在最终源码闭合，复审 `ACCEPT`、P1/P2 为 `0/0`。当前台账计数为 `17 ACCEPTED / 1 BLOCKED / 0 IN_PROGRESS / 90 PLANNED`（共 108 项）；接手者必须以远程 `dev`、状态轨迹和 Evidence Gate 为准，不从聊天记录推断完成状态。

## 1. 获取检查点

```powershell
git switch dev
git fetch origin dev
git pull --ff-only origin dev
git merge-base --is-ancestor cd92378bd8ba0c57c920fc6e79db52de717b0b05 origin/dev
git status --short
```

预期：`cd92378bd8ba0c57c920fc6e79db52de717b0b05` 是 `origin/dev` 的祖先，M1-010 canonical manifest、M1-001 至 M1-009 current-source revalidation、台账与状态轨迹均随关闭集成提交同步，工作树干净。任一条件不满足都先停止后续任务；实现源和任务状态只从 Evidence、台账和 Git 读取。

## 2. 选择 Java 25（只影响当前终端）

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-25'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
java -version
mvn -version
```

若另一台电脑路径不同，只替换 `JAVA_HOME` 为真实 JDK 25 根目录，不要直接复制本机路径，也不要为了通过检查修改版本基线。

## 3. 最小恢复验证

```powershell
pnpm install --frozen-lockfile
pnpm p1r:toolchain:check
pnpm ports:check
pnpm plan:p1r:check
pnpm p1r:evidence:check
pnpm p1r:auth-contract:check
pnpm p1r:iam-policy-contract:check
pnpm p1r:gateway-contract:check
pnpm p1r:media-contract:check
pnpm p1r:assessment-contract:check
pnpm test:p1r
pnpm test:b7
pnpm test:b8
node --test tests/g/g1-contract-data.test.mjs
pnpm p1r:fixtures:validate
pnpm p1r:fixtures:audit
pnpm typecheck
pnpm build
mvn --batch-mode --no-transfer-progress -f pom.xml test
```

移动端最小回归：

```powershell
pnpm --dir apps/mobile test:b10
pnpm --dir apps/mobile test:b11
pnpm --dir apps/mobile test:b12
```

## 4. 当前状态

- M0 的 7 项治理/仓库/工具/夹具任务已接受；`P1R-M0-006` 保持 `BLOCKED`。
- 严格供应链命令 `pnpm p1r:supply-chain:check` 预期非零：当前应只有 `GHSA-fx2h-pf6j-xcff` 这 1 个 high、0 critical。若 high 数增多或出现 critical，先停止后续依赖升级并检查 lockfile diff。
- 不得为让 CI 变绿而加入漏洞豁免或强制把 mobile Vite 覆盖到 6.x。
- `P1R-M1-002` 已接受：Web/H5 Cookie 与原生 Keychain/Keystore 请求/响应已分离，RS256/RSA JWKS、轮换/重放/撤销/重置、错误/关联 ID 和生成联合类型具备当前提交 Evidence。它仍只是 D2 合同，不是 IAM 运行实现。
- `P1R-M1-003` 已接受：服务端权威 principal/tenant/owner、成人 Gate/consent、RBAC+ABAC、策略双人审批/撤销/缓存失效，以及本地 PEP/远程 PDP 边界具备当前提交 D2 Evidence；运行期 IAM/PEP、真实数据库和 Gateway 均未提前声明完成。
- `P1R-M1-004` 已接受：当前 52 条有序 route rule 唯一覆盖 335/335 public operations，51/51 internal operations 外部拒绝；Origin/Cookie/CSRF、native transport、RS256/JWKS、限流、错误、关联 ID、审计和直连阻断 D2 合同已通过专项与兼容检查。
- `P1R-M1-005` 已接受：15 服务/14 owner、Gateway 无业务 schema/write、独立 schema/Flyway/Redis namespace/tenant/lifecycle/迁移责任候选矩阵通过静态失败关闭检查；专项 34/34、P1R 106/106。CLI 明确为 `static/D2 PASS` 且 `runtimeStatus=NOT_RUNTIME_VERIFIED`。
- `P1R-M1-006` 已接受：dual-baseline compatibility、fragment/payload 完整性、B26 workflow topic/group/ACL/partition 精确绑定和生成 `schemaVersion` 均为静态失败关闭结果；B26 仍为 `static-only`、`runtimeStatus=pending`、`defaultDecision=NO-GO`，不得将其写成 Kafka runtime Evidence。
- `P1R-M1-007` 已接受：Outbox/consumer、retry/DLQ/replay、ordering、Saga/补偿、双人审批、人工恢复与 receipt 的 D2 语义和失败关闭门禁已冻结。三轮 REWORK 依次关闭危险状态迁移与因果/错误/Schema 条件、G1 5↔13 schemas 与 compatibility 注入、完整 event governance 绕过与 `PUBLISHED attempt=0`；没有补造未持久化的中间评审时间。
- 运行边界继续开放：`P1R-M2-004` 负责真实 owner schema/grants、owner-local 事务/Outbox 存储/lease；`P1R-M2-005` 负责 Kafka broker/topic/ACL、Outbox→broker→consumer 投递及重复/乱序/宕机/DLQ/replay；`P1R-M2-006` 负责 Saga、补偿、定时任务、双人审批、人工恢复、closure receipt 与不可变审计运行闭环。
- `P1R-M1-008` 已接受：11 个 B9 command、双审身份/阶段集合、排期任务、content canonical 事件、public/learner allow-list、B10 pin/fallback、projectionVersion/contentEpoch 与下线/回滚语义已形成 D2 契约和失败关闭门禁；真实调度、发布、Kafka、投影和 E2E 仍未验证。
- `P1R-M1-009` 已接受：14 个 canonical media/recording 操作、30 个闭合 schema、upload binding、处理/retry、rendition/字幕、短时访问、服务端版权/同意、录音与跟读、Phase 1 禁用 ASR/AI/RTC 以及 `0.5x–2.0x` 保音高契约均已冻结；11 条既有媒体事件继续标记为历史候选，真实对象存储、转码/字幕 worker、数据库、Kafka、浏览器/真机与精确保留期限仍未验证。
- `P1R-M1-010` 已接受：5 个 canonical assessment route、8/4/4 的 session/attempt/report 状态、受保护六类答案、单调 checkpoint、幂等提交、确定性 outcome 与 learner-safe report 已冻结；精确审计脱敏和非空 `ASSESSED.assessedAt` 经 REWORK 后闭合。assessment `83/83`、CLI `77` cases、P1R `433/433`、tooling `35/35`、typecheck `7/7` 与固定 compatibility 均 PASS；真实 DB/Outbox/Kafka/workflow/browser/E2E 未验证。
- M2-001 运行缺口仍开放：真实 WebFlux CORS/CSRF/Origin、public-path parity、Redis 限流及故障语义、持久审计、网络直连隔离、真实浏览器/JWKS/跨进程/网络 Evidence。
- M2-004 运行缺口仍开放：真实 owner schema/grants、空库/存量库迁移、TenantScope/跨租户拒绝、Redis ACL/rebuild/restart、回滚/补偿和 retention/delete/legal-hold Evidence。
- `P1R-M1-001` 已接受：公共成功/错误 envelope、追踪/版本 headers、写幂等、统一 cursor 分页、只读 merge/generate 与真实 Git baseline compatibility 已有当前提交 Evidence。
- 完整 `pnpm test:g` 当前仍为 39/41：G0/G3 都引用已删除的同一句旧 source marker；独立评审确认它们早于 M1-002，M1-002 所需 G1 为 6/6。接手时不得把完整 G 写成全绿。

## 5. 推荐接手顺序

1. 先确认 `origin/dev` 包含 M1-010 最终源码 `cd92378` 及其 Evidence/台账集成提交，并确认 `pnpm p1r:evidence:check` 与 `pnpm plan:p1r:check` 通过；不能只从聊天记录恢复。
2. 从台账选择依赖已满足的下一项 `PLANNED` 任务，先完成 Contract/Data/Security 边界；保持 `NOT_RUNTIME_VERIFIED`，不得把现有 B9/B11 候选实现或静态 B26 输入当运行证明。
3. 每次修改公共 API、事件、数据 owner 或迁移责任后，先从最近已接受 manifest 选择不可变 baseline；M1-006 的历史基线是 `463c4b2`，其首次引入的治理字段由固定 `868c217` 保护，不得回退到旧 B/DEV/G 快照或移动治理基线。
4. 每个任务先改契约与政策，再更新生成物/测试，最后在当前源提交生成 canonical manifest；不要继承旧 B/DEV/G 的完成状态。
5. DCloud 发布官方 Vite 6.4.3+ 兼容编译器族后，单独恢复 `P1R-M0-006` 并重跑 H5/App/mp-weixin 与完整供应链 Gate。

## 6. 禁止误判

- `pnpm build` 当前只显示三个 Web workspace 任务，不代表 mobile 的 H5/App/mp-weixin 都已编译。
- 目录、静态清单或历史 PASS 不代表真实数据库、Kafka、浏览器、真机、staging 或发布 Gate 已完成。
- 任何本机端口、账号、secret、生产证书或真实用户数据都不能写入 Git。
