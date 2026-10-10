# R1-025 BC-020 定级题库 10 行种子

日期：2026-10-10。分支：`dev-redesign`。Owner：content-service。依赖：无。
本卡只做题库种子和下发隔离。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。

## 范围

干净库重放 Flyway 后，`content_placement_item` 自动有 10 行，`bank_code` 固定 `P1_PLACEMENT_V1`，分布 3 VOCABULARY / 3 BASIC_GRAMMAR / 2 READING / 2 LISTENING。没有第二套题库表。行与 `scripts/database/seed-placement-bank.mjs` 是同一套 id 和题干；该脚本仍是本机修复用的 delete-then-insert，迁移用 `INSERT IGNORE`，已有这 10 个 id 时不会因重复插入失败。

`answer_rule_json` 留在表里。`GET /internal/v1/content/placement-bank/sealed` 只下发题干、选项、`itemId`/`itemCode`、`itemType`、`dimension`、`displayOrder`、`contentVersionId`，以及银行级版本钉（`bankCode`、`contentEpoch`、`contentStateVersion`、`snapshotId`、`snapshotHash`）。响应里没有 `answer`、`answer_rule_json`、`answerRule`、`correctOption`。判分口留给 R1-021。不足 10 行或答案规则对不上选项时整口 503，不返回半套题。

评估服务现有 `HttpPlacementBankPort` / `BankPracticeRuleProvider` 仍从 sealed 读 `answerRule` 和规则钉。本卡按边界没有改 assessment-service。它们要改到新下发形状，判分另接 R1-021。

## 改动

- `services/content-service/src/main/resources/db/migration/V28__seed_placement_item_bank.sql`
- `services/content-service/src/main/java/com/englishflow/content/web/PlacementBankSealedController.java`
- `services/content-service/src/test/java/com/englishflow/content/web/PlacementBankSealedJdbcTest.java`
- `scripts/database/seed-placement-bank.mjs`（注释：自动种子改走 V28）
- `packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json`
- `packages/contracts/openapi/v1/openapi.json`
- `packages/contracts/generated/openapi.ts`

没有改 `services/assessment-service/**`、`services/api-gateway/**`、`apps/**`、`packages/i18n/**`、`evidence/redesign/2026-10-10/IT-1-exit/**`。

## 单元测试

```text
mvn -f services/content-service/pom.xml -Dtest=PlacementBankSealedJdbcTest test
exit 0
Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
```

下发 10 题且序列化 JSON 不含 `answer`/`correctOption`，表内 `answer_rule_json` 仍在。缺一题、答案指不到选项、缺 content epoch 都是 503。未登录 401。

## 干净库

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，compose project `yuxuexing-local`，`127.0.0.1:13306`，healthy）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。content-service 端口 18089。没有占用 18087/18088。18199 只是本轮临时 JWKS，用来在不启动 IAM 的情况下签一张 learner JWT，跑完已关。

```text
node evidence/redesign/2026-10-10/R1-025/run.mjs
exit 0
```

专库 `r1_025_cnt_20261010_6e7dace4`。Flyway `1` 到 `28` 全部 `success=1`，其中 `28 | seed placement item bank | 1`。没有另跑 `seed-placement-bank.mjs`。

SQL：

```text
content_placement_item 行数 10
VOCABULARY 3
BASIC_GRAMMAR 3
READING 2
LISTENING 2
bank_code=P1_PLACEMENT_V1 10
answer_rule_json.correctOption 非空 10
content_version 266100 1
```

`GET /internal/v1/content/placement-bank/sealed` 200，3498 字节。下发 JSON 不含 `answer` / `correctOption`。维度同样是 3/3/2/2，`contentVersionId` 266100。无令牌 401。删掉 `266010` 后再取，503，正文没有题干。`plan-items` 200，也不含 answer。

跑完 `DROP DATABASE`。`schema_name LIKE 'r1_025_%'` 为 0。content-service 收到 SIGTERM（退出码 143）后已退出。18089、18199、18087、18088 都无监听。
