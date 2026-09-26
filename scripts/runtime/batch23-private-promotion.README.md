# Batch23 学习 Web 与移动 H5 私有镜像发布助手

此助手只操作 `cloudstudy-uat-isolated-3c94b27160` 私有 Compose 项目，只允许替换 `learner-web` 与 `mobile-h5`。候选标签固定为 `583ab627-uat-batch23-20260925`。最终构建的学习 Web image ID 为 `sha256:81eb110756edf6cdba48d517ae5de90c7a13952114836be087ceecf7770e0369`，移动 H5 为 `sha256:5205ac29584eec33fbeee69430472c6dba2320913de41d6202238477fadb30d9`；助手核对固定标签当前解析的 ID，不一致会失败关闭。

## 前置条件

私有临时目录必须包含完整的 Batch18 至 Batch22 收据与 Compose overlay。Batch22 收据必须处于 `verified`，固定标签、两个目标在内的三个精确 image ID、完整 `verifiedSnapshot`、私有 proxy 刷新记录和 19/19 readiness 都必须匹配。Batch22 的完整 26 容器快照将作为本批唯一基线；其余 24 个服务身份、共享 `yuxuexing-local` 容器与网络指纹必须保持不变。私有 Compose 服务和 HTTPS proxy 都不得绑定宿主机端口。

两个候选 image ID 必须与固定 tag 当前解析出的 ID 一致，且都必须不同于 Batch22 快照中的对应基线 image ID。助手不会构建或拉取镜像。执行时每次只重建一个获准服务；缺失或漂移的 ID、基线、私有指纹、容器状态或 Compose 展开都会在后续替换前失败关闭。

## 执行顺序

在两个最终镜像完成构建、测试并将 SHA256 image ID 锁定到 `BATCH23_IMAGE_IDS` 后，由主 Agent 按顺序运行：

```powershell
$statePath = '<私有临时目录>\state.json'
node scripts/runtime/batch23-private-promotion.mjs dry-run $statePath
node scripts/runtime/batch23-private-promotion.mjs preflight $statePath
node scripts/runtime/batch23-private-promotion.mjs promote $statePath
node scripts/runtime/batch23-private-promotion.mjs refresh-proxy $statePath
node scripts/runtime/batch23-private-promotion.mjs readiness $statePath
node scripts/runtime/batch23-private-promotion.mjs verify $statePath
```

Compose overlay 顺序为 core、full、isolated、Batch18、Batch19、Batch20、Batch21、Batch22、Batch23。`preflight` 锁定两个候选 image ID，验证 promotion/rollback Compose 展开，并在私有网络上检查 19 个 readiness 页面。`promote` 按 `learner-web`、`mobile-h5` 顺序逐个重建。其余 24 个服务身份与 Batch22 快照、共享指纹和无宿主机端口绑定约束持续核对。

只有两个候选服务运行于准确 image ID、其余 24 个服务容器身份未变、私有 proxy 已刷新、共享指纹未变且 19/19 readiness 返回 200，收据才会进入 `verified`。这些运行检查只证明部署和 readiness 边界，不单独代表完整学习业务验收。

## 回滚

发布失败时助手会自动尝试回滚；也可显式运行：

```powershell
node scripts/runtime/batch23-private-promotion.mjs rollback $statePath
```

回滚按逆序（`mobile-h5`、`learner-web`）恢复 Batch22 verified snapshot 中记录的两个目标 image ID。每次重建前，助手先把目标服务写入持久化 `rollbackInFlightServices` 收据，再执行 Compose。若进程在 Compose 恢复基线容器后、保存新容器 ID 前中断，重跑时只有在服务仍处于 `rolling-back`、存在对应持久化 intent、image ID 精确匹配基线且完整私有快照校验通过时，才会采纳该容器并补写回滚收据。无法证明目标容器属于已记录基线或带有持久化 intent 的恢复操作时，助手停止执行含糊回滚。

## 检查

```powershell
node --check scripts/runtime/batch23-private-promotion.mjs
node --test tests/uat/batch23-private-promotion.test.mjs
```
