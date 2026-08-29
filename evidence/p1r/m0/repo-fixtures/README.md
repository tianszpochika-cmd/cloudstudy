# P1R M0 仓库与夹具 Evidence

本目录只承载 P1R-M0-004 与 P1R-M0-007 的可复核结果，不代表其他 M0 任务或整个里程碑已经验收。

## P1R-M0-004

- 从 Git 工作树移除 21 个经验证的临时 Java 编译根目录，共 1,397 个 `.class`、5,061,073 字节。
- 删除前逐根验证：目标位于仓库内、目录内容全部为 `.class`、磁盘文件数与 Git 跟踪数一致、所属服务存在 `src` 源码目录。
- `.gitignore` 已覆盖 `.class`、`.compile-*`、`.tmp-*compile*`，防止重新误提交。
- `apps/miniapp-wechat` 只保留 README 和机器可读归档边界；未来微信小程序唯一来源是 `apps/mobile` 条件编译。

## P1R-M0-007

- `config/p1r-fixtures.v1.json` 固定版本、类别、owner、策略和 seed/cleanup 范围。
- `fixtures/p1r/v1/` 提供 6 类 13 条脱敏合成记录。
- `scripts/fixtures/p1r-fixtures.mjs` 提供 `validate`、`seed`、`cleanup`、`audit`，仅使用 Node.js 内置模块。
- seed 输出被限制在被忽略的 `runtime/`；cleanup 必须校验 fixture set 与 ownership marker，只删除清单列出的两个文件。

复核命令：

```text
node --check scripts/fixtures/p1r-fixtures.mjs
node scripts/fixtures/p1r-fixtures.mjs validate
node scripts/fixtures/p1r-fixtures.mjs seed
node scripts/fixtures/p1r-fixtures.mjs cleanup
node scripts/fixtures/p1r-fixtures.mjs audit
```

结构化结果见 `fixture-validation.json`、`repository-audit.json`、`seed-cleanup-verification.json`、`tracked-artifact-removal.json` 和 `existing-fixture-audit.json`。
