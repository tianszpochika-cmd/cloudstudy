# R1-001 隔离验收环境准备包（BLOCKED revision 20，不 start、不交 delivery-7）

> 基线 `[读取]`：`reviewer-8-prep/review.md`——保持 BLOCKED revision 20；版本7断言已通过（11+15 MOCKED）；批准专用测试 schema；不批共享七行置空；自有 content 直启 jar；停启自有实例属验收授权。
> 状态 `[实测]`：revision 20 / BLOCKED；HEAD `3d11be33`；六端口 CLOSED；java 零残留；零后台启动。

## 1. 合法空课程输入（已建立，非方案）

- 专用 schema `[实测]`：`r1_001_empty_20261005_t9b`（`empty-schema-9.json` 8/8 PASS）——7 表结构 LIKE 复制、逐表 0 行、结构哈希 7 份、只读身份 `r1_001_reader_t9b`（`USAGE + SELECT ON 新schema.*`，读回 0 行）、共享 DEMO 6 行 untouched（只读 COUNT，未 UPDATE/DELETE）。
- 另建 `t9local` 为首次 DDL 调试残留（同结构空表），保留不删，终验仅用 `t9b`。
- 失败记录：本机无 `mysql` 客户端（ENOENT）→ 经 `docker exec yuxuexing-local-mysql-1` 同实例执行；`reader-select-only` 初版误判 USAGE → 已修正为“非 USAGE 仅新 schema SELECT”。凭据未落盘。
- 主审禁令遵守：无共享 UPDATE/下架/清库/改权限；无新端口/实例；写仅限新 schema+其只读身份。

## 2. 自有 content 启动器（静态预检，本阶段不启动）

- 新脚本 `work/r1-001-content-empty-9.cjs`：`--validate` `[实测]` PASS；`--start`（READY 后）直启 `content-service-0.1.0-SNAPSHOT.jar`（`63760208B feafab14…`），`--server.address=127.0.0.1 --server.port=18089 --spring.profiles.active=v2,local-real`。
- 子进程 env（白名单六项）：`CONTENT_PERSISTENCE_MODE=jdbc` + `CONTENT_JDBC_URL=jdbc:mysql://127.0.0.1:13306/r1_001_empty_20261005_t9b?...`（user `svc_content`，脱敏输出）+ `CONTENT_SERVICE_SCHEMA=<新schema>` + relay/consumer/schedule/Flyway/SPRING_Flyway 全 false + `P1R_DIAG=0`；密码仅 `--start` 时从调用方 `MYSQL_OWNER_PASSWORD` 读入子进程 env，不放命令行、不落盘。
- 接线依据 `[读取]`：runner `:293-297` 无条件绑定 owner（故绕开 runner 直启）；`ContentServiceConfiguration:121-160` jdbc 需 URL/用户/密码+驱动，Flyway `spring.flyway.enabled:false` 时仅校验不迁移；`application.yml:7/80/95` + `ContentServiceConfiguration:300` 默认全关。
- Gateway/commerce 沿用 `r1-001-safe-run-8.cjs` 安全包装器（六项 false 子进程 env），不重复启动 content；输出 `safe-run-8.json`（三 jar + 六端口）。

## 3. 空态场景断言（新版本，不覆盖固定证据）

- 新模块 `work/real-chain-assert-9.cjs`（复用 -8 的 Cookie/价格断言）：`assertNonemptyChain`（沿用成功态硬断言）、`assertEmptyChain`（三路 200 + 双数组 `[]` + BFF `ready|empty/gateway` + 课程 facet 合法非错且 `!stale && errorCode null`；**generatedAt 不跨请求逐字相等**，仅用当轮 BFF 自洽）、`assertEmptyCoursesDom`（0 卡 + 课程区域“内容准备中”可见）、`assertCommercePricing`（上游 plans 与 BFF planIds 一致、skus 0；未比较 projectionVersion/epoch，不声称已验证）。
- 新采集器 `work/real-upstream-9.cjs`（`R1_001_SCENARIO=empty|nonempty`，输出 `real-upstream-9-<scenario>.json` + `courses-<scenario>-*.png`）：保存页面实际使用的 BFF 响应（`log.bffTitles`，无二次未归档 fetch）；价格说明限定 `.page-body .container`；错误排除用当轮 facet + PublicStatus 可见重试语义（`PublicStatus.vue:38-44` 非 empty/loading 才有重试按钮），不用 `.facet-error` 不存在选择器。
- 负例 `[实测]`：`negative-chain-9.json` 15/15（空 valid/时间差通过/非空 facet-stale 失败/DOM/价格对应/Cookie），`negative-chain-8.json` 15/15，`negative-7.json` 11/11；四套件 38/38。

## 4. 可运行 TC01/02/03（READY 后，主审已授权停启自有实例）

1. 预检：`ports:check` + 三 jar 哈希 + 六端口 FREE/CLOSED；确认调用方 `MYSQL_OWNER_PASSWORD` 可用（缺项即报，不猜密码）。
2. 启动（仅当轮自有进程，固定端口）：`r1-001-content-empty-9.cjs --start`（18089 空 schema）+ safe-run 包装器起 gateway/commerce + `official-site dev`（18182）；记录 PID/jar/effective 六项白名单；`SELECT` 验证新 schema 0 行。
3. TC01：sweep-7 双视口 11 页 + `R1_001_SCENARIO=empty real-upstream-9`（空链/DOM 空文案/价格权威空/Cookie/Console）+ 同场景 nonempty 对照；BFF 缓存串场时仅停启**自己 BFF 进程**清理。
4. TC02：基线 200 → 停自有 content（记录 PID）→ Gateway 真实映射（503/504/502 如实）→ 恢复 → 页面点击重试 → BFF/DOM 重载比对；切场景时停自有 content 后切 schema + 清自己 BFF 缓存。
5. TC03：sweep-7 精确入口 + reviewer-3 两端证据（源码未变引用）+ Cookie 业务命中失败断言；注册写入属 R1-002 不执行。
6. 收尾：停当轮自有进程，六端口 CLOSED；保留新测试 schema/身份与全部证据待主审核查后安排清理。

## 5. 状态

- 新增：`prepare-empty-schema-9.mjs` + `empty-schema-9.json`、`r1-001-content-empty-9.cjs` + `content-empty-9.json`、`real-chain-assert-9.cjs`、`real-upstream-9.cjs`、`negative-chain-9.cjs` + 输出、本包 + `commands-9.log`。旧证据全保留；共享 dirty 未碰。
- 状态保持 **BLOCKED revision 20**；主审确认隔离输入与接线后签 READY，再集中终验出 delivery-7 REVIEW。
