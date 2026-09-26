# Batch20 私有镜像发布助手

此助手只操作 `cloudstudy-uat-isolated-3c94b27160` 私有 Compose 项目，只允许替换 `api-gateway`、`admin-web`、`mobile-h5`。候选标签固定为 `583ab627-uat-batch20-20260925`，并以预先构建的三个不可变 Docker image ID 作校验。其他 23 个服务的容器 ID 与镜像 ID 必须保持 Batch19 verifiedSnapshot 中的值。不会执行数据库迁移。

## 执行顺序

```powershell
$statePath = '<私有临时目录>\state.json'
node scripts/runtime/batch20-private-promotion.mjs dry-run $statePath
node scripts/runtime/batch20-private-promotion.mjs preflight $statePath
node scripts/runtime/batch20-private-promotion.mjs promote $statePath
node scripts/runtime/batch20-private-promotion.mjs refresh-proxy $statePath
node scripts/runtime/batch20-private-promotion.mjs readiness $statePath
node scripts/runtime/batch20-private-promotion.mjs verify $statePath
```

`dry-run` 可在各阶段安全重跑；它只读取 Docker、私有收据和 Compose 展开结果。`preflight` 将 Batch20 overlay、回滚 overlay 和 promotion receipt 写入已存在的私有临时目录。它要求 Batch19 `verified`、19/19 readiness、26 个私有容器、零宿主机端口、三个目标容器 ID 与镜像 ID 全部匹配 Batch19 verifiedSnapshot，以及三张候选标签对应固定 image ID。

Compose 配置按 core、full、isolated、Batch18、Batch19、Batch20 overlay 顺序展开。每次变更都使用 `up -d --no-deps --no-build --pull never --force-recreate <one-service>`，只重建一个获准服务。Gateway 最后切换。Promotion receipt 逐项记录目标容器，命令可在 `promoting` 阶段继续执行。共享 `yuxuexing-local` 容器和网络指纹在操作前后核对。

`refresh-proxy` 只重启私有 HTTPS proxy，并确认容器 ID 和镜像 ID 未改变。`readiness` 与 `verify` 从私有 Compose 网络检查 19 个现有 readiness 页面；只有三个候选服务全为预期 image ID、其他 23 个服务身份完全未变、proxy 已刷新且 19/19 返回 200，`verify` 才写入 `verified`。

## 回滚

promotion 过程失败时，助手会自动尝试回滚；也可以显式运行：

```powershell
node scripts/runtime/batch20-private-promotion.mjs rollback $statePath
```

回滚使用记录的 Batch19 镜像标签与 image ID，逆序恢复三个目标服务，其他 23 个服务必须保持原 ID。重建后的容器 ID 会变化，这是预期行为；回滚确认的是原 baseline image ID 和运行状态。无法证明当前目标容器属于记录的 baseline 或固定候选 image ID 时，助手会停止，不执行模糊回滚。

候选镜像按 tag 和 image ID 锁定，不校验当前源码树 checksum。因此之后发生的源码修改不会进入这三张已构建镜像；需要另外构建并登记新的 Batch21 image ID 才会包含后续源码。

## 检查

```powershell
node --check scripts/runtime/batch20-private-promotion.mjs
node --test tests/uat/batch20-private-promotion.test.mjs
```
