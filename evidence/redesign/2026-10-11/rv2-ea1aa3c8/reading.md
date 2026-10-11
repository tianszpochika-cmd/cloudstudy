# rv2 证据读法

日期：2026-10-11。后缀 `ea1aa3c8`。分支 `grok/cs-rv2-20261011`。`lunaStamp`、`accepted`、`it6Outbound`、`it7Outbound`、`fullChainOutbound` 都是 false。本目录不是第 4 节 `SIGNED_PASS`。

`steps.json` 与各目录 `summary.json` 是脚本首跑原文。首跑即 PASS，没有改写失败记录。IT-1 的 `calls-*.json` 在首跑之后把 `accessToken` 收成 `[REDACTED]`，`steps.json` 没有改。

## it1

`evidence/redesign/2026-10-11/rv2-ea1aa3c8/it1/`。提交 `404f6c6f`。11 步全部 PASS。

未成年年份是 2016。Web 1280、Web 390、H5 1280、H5 390 都用表单提交。注册是 `POST https://127.0.0.1:18087/api/v1/auth/register`，状态 201。成人门是 `POST http://127.0.0.1:18070/api/v1/iam/adult-gate`，状态 200，响应含 `REJECTED`。页面进入无权限页。「再试一次」与「改年份」计数为 0。

撤回：Web 1280 与 H5 390 留在设置页。最后一次 `PUT /api/v1/iam/consents` 状态 200，正文含 `ADULT_LEARNING` 与 `WITHDRAWN`。随后 `GET /api/v1/learner/targets` 状态 403，正文含 `CONSENT_REQUIRED`。

`rv2_` 库已删。qida 名称计数前后都是 50。

## it6

`evidence/redesign/2026-10-11/rv2-ea1aa3c8/it6/`。提交 `3c33a9ed`。45 步全部 PASS。没有 SKIP。

流程覆盖建稿、冲突、双签与简审、发布、投影、下架与强制停止、回滚边界。Web 与 H5 都有 1280 和 390。发布台在 Flyway 表 `it6_release_studio`。全量链之后只重启 content-service，再读指纹，没有重放命令，也没有删内容库。重启前后指纹相同，都是 1803 字符。库行都是 `70 34410`。`replayedCommands` 是 false。

H5 390 的文档横向溢出是 0。装饰节点 `mobile-art-orbit` 多出 17px，空类名元素多出 10px。这是既有 RES-ARTWORK，步骤仍记 PASS。

`rv2_it6_` 库已删。qida 名称计数前后都是 50。

## node

`evidence/redesign/2026-10-11/rv2-ea1aa3c8/node/`。提交 `6f8670cb`。命令是 `node --test --test-concurrency=1 apps/mobile/tests/*.mjs apps/learner-web/tests/*.mjs`。结果 361 项、361 通过、0 失败。admin-ops 在这次栈里，工单列表不是 503。`*.log` 被仓库忽略，计数以 `steps.json` 为准。

`rv2_node_` 库已删。qida 名称计数前后都是 50。

## it7 与 full-chain

`it7/` 与 `full-chain/`。提交 `41acb289`。it7 是 34 步 PASS。全链是 58 步 PASS，覆盖 IT-1…IT-7 冒烟、收口浏览器（Web 与 H5，1280 与 390）和链内 node。链内 node 同样是 361 项、361 通过、0 失败。

收口台在 `it7_closure_desk`。重启后只读，指纹相同，`versionBefore` 是 45，没有重放收口命令。IT-6 冒烟的干净重放是全链里的 `smoke-it6-replay`，与上面 it6 目录的只读重启是两次不同运行。

六个 `rv2_chain_` 库已删。共享 admin schema 计数前后都是 `0|0`。qida 名称计数前后都是 50。本轮没有重跑已签收的 IT-2 三库阶段，因此没有 `it2/` 目录。

## maven

`maven/summary.md`。`mvn -B -ntp -f pom.xml test` 于 2026-10-11T11:35:14+08 BUILD SUCCESS，总时间 02:15 min（2 分 15 秒）。17 个模块合计 1680 项、0 失败、1 跳过。唯一跳过是 `MinioObjectStorePortReadOnlyIntegrationTest`，因为没有 `MEDIA_TEST_MINIO_*`。

隔离库是 `rv2_mvn_iam`、`rv2_mvn_workflow`、`rv2_mvn_learning` 和 `iam_v13_test_rv2round`。IAM schema 与 JDBC 库名同为 `rv2_mvn_iam`。workflow 允许 `rv2_` 前缀，提交 `87e2c1cb`。租户测试的管理员 URL 用 `jdbc:mysql://127.0.0.1:13306/`，库名接在末尾。这些库和用户已删。14 个共享 schema 的表数前后一致。两个保留库 `r1_it1_browser_20261010_iam_5d9f4b7e` 与 `r1_it1_browser_20261010_cnt_5d9f4b7e` 仍在。

## 本轮 SKIP

IT-1、IT-6 全量浏览器、顶层 node、IT-7 与全链都没有 SKIP。MinIO 假定跳过记在 Maven 摘要里，不作为站级 SKIP。RES-ARTWORK、RES-WALL-114、RES-RATE-BUDGET、RES-H5-RELOAD 仍是 P3。没有新的 P1 或 P2。
