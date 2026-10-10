# R1-026 BC-021 B3 练题绑定 5 行干题

日期：2026-10-10。分支：`dev-redesign`。Owner：content-service。依赖：R1-025。
本卡只做 5 道干题绑定和下发隔离。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。

## 范围

接到已有表，没有第二套绑定表。`content_b3_item_binding`（V25）钉 B3 身份到 `p1.placement.v1` / 版本 266100 / 题号；题干落在已有 `b3_content_experience`。干净库重放 Flyway V29 自动得到这 5 行，与 `scripts/database/seed-b3-bank-practice.mjs` 同一组键：3 条 `GRAMMAR_EXERCISE`（266004–266006）和 2 条 `READING_QUESTION`（266007–266008）。迁移用 `INSERT IGNORE`。没有另跑该脚本。

干题 payload 只有题干和选项。`answer_rule_json` 仍只在 `content_placement_item`。下发走已有 B3 读口，响应里没有 `answer`、`answerRule`、`answerRules`、`correctOption`。`practiceRef` 只有 `contentCode`、`contentVersionId`、`questionItemId`。

这 5 行不是 C9 内容覆盖门已开放。拥有版本的 `rights_permitted_channels` 仍是仅 `SEALED`，没有改成 `LEARNER`。学习目录 `GET /api/v1/content/learner/catalog` 是 0 条。按 LEARNER 通道读 `p1.placement.v1` 是 403 `CONTENT_RIGHTS_NOT_READY`。旧 `b3-%` 目录行仍是未发布。定级 10 行的分布没有改，sealed 口没有重新带上 `answerRule` 或 `correctOption`，不足 10 行仍是 503。

## 改动

- `services/content-service/src/main/resources/db/migration/V29__seed_b3_practice_bindings.sql`
- `scripts/database/seed-b3-bank-practice.mjs`（注释：自动种子改走 V29；脚本仍是本机 delete-then-insert）
- `evidence/redesign/2026-10-10/R1-026/`

没有改 `services/assessment-service/**`、`apps/**`、`services/api-gateway/**`、`evidence/redesign/2026-10-10/R1-018/**`、`evidence/redesign/2026-10-10/R1-025/**`。没有改 V28 的 10 行，也没有改 `PlacementBankSealedController`。

## 干净库

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，8.0.46，compose project `yuxuexing-local`，`127.0.0.1:13306`，healthy）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。content-service 端口 18089。没有占用 18087/18088。18226 只是本轮临时 JWKS，用来在不启动 IAM 的情况下签一张 learner JWT，跑完已关。专库名是 `r1_026_cnt_20261010_942a1b21`，没有使用 `r1_018` 或 `r1_025` 字样。

```text
node evidence/redesign/2026-10-10/R1-026/run.mjs
exit 0
```

Flyway `1` 到 `29` 全部 `success=1`，其中 `29 | seed b3 practice bindings | 1`。没有另跑种子脚本。

SQL（下发探针之前，也是删一行再原样插回之后的终态）：

```text
content_b3_item_binding 5
b3 干题 experience 5
content_placement_item 10
VOCABULARY 3
BASIC_GRAMMAR 3
READING 2
LISTENING 2
placement answer_rule_json.correctOption 非空 10
b3 payload 上的 answer/answerRule/correctOption 0
守卫行 r1-026-seed-guard 0
旧 b3-% 且 PUBLISHED 0
content_version 266100 仅 SEALED 1
```

下发：

- `GET /internal/v1/content/learner/grammar/exercises` 200，3 题，1251 字节。题干在，JSON 不含 `answer` / `answerRule` / `correctOption`。`practiceRef.questionItemId` 为 `266004`、`266005`、`266006`。
- `GET /internal/v1/content/learner/reading/questions` 200，2 题，996 字节。同样无答案键。`questionItemId` 为 `266007`、`266008`。
- 无令牌访问语法练习口 401。
- `GET /internal/v1/content/placement-bank/sealed` 200，10 题，3498 字节，不含 `answer` / `correctOption`。
- 学习目录 200，`items` 长度为 0。
- `GET /api/v1/content/learner/p1.placement.v1` 403，`CONTENT_RIGHTS_NOT_READY`。
- 临时删掉 `266010` 后再取 sealed：503，正文没有题干。原行插回后 placement 仍是 10，sealed 再次 200 且无答案键。

跑完 `DROP DATABASE`。`schema_name LIKE 'r1_026_%'` 为 0。content-service 收到 SIGTERM（进程退出码 143）后已退出。18089、18226、18087、18088 都无监听。
