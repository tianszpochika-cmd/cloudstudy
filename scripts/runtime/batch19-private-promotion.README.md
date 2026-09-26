# Batch19 私有 UAT 发布助手

此助手只面向 `cloudstudy-uat-isolated-3c94b27160` 私有 Compose 项目。候选范围固定为 content-service、iam-service、notification-service、learner-web、mobile-h5，标签固定为 `583ab627-uat-batch19-20260925`。官网继续使用 Batch18 镜像；IAM 在内容与通知迁移时继续使用 V17 镜像；共享项目 `yuxuexing-local` 不会被选择。

## 执行顺序

```powershell
$statePath = '<私有临时目录>\state.json'
node scripts/runtime/batch19-private-promotion.mjs dry-run $statePath
node scripts/runtime/batch19-private-promotion.mjs preflight $statePath
node scripts/runtime/batch19-private-promotion.mjs quiesce $statePath
node scripts/runtime/batch19-private-promotion.mjs begin-migrations $statePath
```

`preflight` 要求私有临时目录中已有 `batch19-full-backup.json` 和完整 SQL dump。备份收据必须包含项目名、state.json 绝对路径、ISO `createdAt`、14 个配置 owner schema、私有 temp dump 绝对路径/字节数/SHA-256，以及 content / IAM / notification 七张目标表的行数、身份 SHA-256、schema、迁移版本和 SQL source SHA-256。dump 必须大于 1 KiB、时间不超过两小时，文件长度和哈希会在 preflight/quiesce 前复核。

备份由一致性快照生成。`quiesce` 会停止私有 Gateway 与 13 个外部 owner 服务，并在停止后重新读取七张目标表，将数量和身份摘要与备份收据核对；`begin-migrations` 再核对一次，任何差异都阻止迁移。这样锁定了完整 dump 的 `createdAt` 时间边界，也阻止本批目标数据在备份与停机之间发生漂移。

## 执行私有 owner 迁移

仅在 `begin-migrations` 成功后运行迁移器。Compose 命令必须使用私有环境文件、core/full Compose 文件、私有基础 override、Batch18 override、Batch19 promotion override 和 Batch19 migrator override。它们分别位于仓库 `infra/docker/clyunedev/` 与私有 temp 目录。

```powershell
docker compose -p cloudstudy-uat-isolated-3c94b27160 `
  --env-file '<私有临时目录>\uat.env' `
  -f infra/docker/clyunedev/docker-compose.core.yml `
  -f infra/docker/clyunedev/docker-compose.full.yml `
  -f '<私有临时目录>\docker-compose.isolated.yml' `
  -f '<私有临时目录>\docker-compose.batch18-promotion.yml' `
  -f '<私有临时目录>\docker-compose.batch19-promotion.yml' `
  -f '<私有临时目录>\docker-compose.batch19-migrator.yml' `
  run --no-deps --rm --pull never `
  -e P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED=true `
  -e P1R_EXTERNAL_MIGRATION_BACKUP_READY=true `
  mysql-migrate --apply
```

迁移器镜像固定为 `cloudstudy-clyunedev/owner-migrator:583ab627-uat-batch19-20260925`，preflight 会记录并在迁移前再次核对不可变 image ID。迁移命令只运行一次性 `mysql-migrate` 服务，不启动或重建依赖项。`run-owner-migrations.mjs` 必须通过 13 个外部 owner 的全量 preflight，然后写入 content V23 与 notification V8 历史及数据；IAM V18 由 IAM Batch19 容器启动时执行。

```powershell
node scripts/runtime/batch19-private-promotion.mjs record-verified-migrations $statePath
node scripts/runtime/batch19-private-promotion.mjs restore-migrator-dependencies $statePath
node scripts/runtime/batch19-private-promotion.mjs promote $statePath
node scripts/runtime/batch19-private-promotion.mjs refresh-proxy $statePath
node scripts/runtime/batch19-private-promotion.mjs readiness $statePath
node scripts/runtime/batch19-private-promotion.mjs verify $statePath
```

迁移验证会直接查询 V23/V8 history checksum、内容 UNPUBLISHED 状态、V8 legacy 身份和空 canonical preference 表。只有验证通过后，helper 才恢复 11 个非候选 owner 与 Gateway 的原 container ID/image ID，并逐个检查 readiness；content/notification 保持停机直到 Batch19 镜像替换。五个候选全部替换后，receipt 会清空 `quiescedServices`。`verify` 会再次运行全部 19 个私有 HTTP readiness 探测，并将结果写入 promotion receipt。浏览器业务链路仍需单独验收，HTTP/readiness 不能替代业务验收。

## 恢复与重入

各阶段都逐个记录容器状态，重新运行当前阶段命令可从 receipt 继续。`rollback` 仅允许在 `begin-migrations` 之前执行，会恢复所有已停机的原容器并检查健康状态。一旦记录了迁移尝试，即使迁移器中断或 history 不完整，helper 也会拒绝自动回滚；需先从完整 dump 做受控数据库恢复与人工核验。

preflight 或纯测试失败时不要跳过门禁。不得对共享项目执行 `compose up/down/stop`；不得使用仅含旧基础 override 的 Compose 命令。

## 备份身份摘要接口

`batch19TargetRows()` 读取与 helper 一致的七张目标表行集合；`batch19IdentityColumns(service, table)` 返回每表参与身份摘要的列；`batch19IdentitySha256(rows, columns)` 计算排序后 JSON tuple 的 SHA-256。备份脚本应复用这三个导出，避免自行实现不同的身份规则。

```powershell
node --test tests/uat/batch19-private-promotion.test.mjs
node --check scripts/runtime/batch19-private-promotion.mjs
```
