# Batch22 私有镜像发布助手

此助手只操作 `cloudstudy-uat-isolated-3c94b27160` 私有 Compose 项目，只允许替换 `social-service`、`learner-web` 与 `mobile-h5`。候选标签固定为 `583ab627-uat-batch22-20260925`。`BATCH22_IMAGE_IDS` 锁定了三项已构建产物的 SHA256 image ID；标签或镜像发生漂移时，脚本会拒绝继续。

## 前置条件

私有临时目录必须包含已校验的 Batch18 至 Batch21 收据和 Compose overlay。Batch21 收据必须处于 `verified`，记录其固定发布标签、候选服务的精确镜像 ID、完整 verified snapshot 和 19/19 readiness 结果。执行时会逐项比较私有项目 26 个容器的容器 ID、镜像 ID、状态、网络与宿主机端口绑定，要求与 Batch21 verified snapshot 完全一致；同时要求共享 `yuxuexing-local` 容器和网络指纹保持不变。私有 Compose 服务不得绑定宿主机端口。

三个 Batch22 候选 image ID 必须与固定 tag 当前解析出的 ID 一致，并且都不能与对应 Batch21 基线 image ID 相同。脚本每次只重建一个获准服务，不构建或拉取镜像；缺失或漂移的 ID 都会在重建之前失败关闭。

## 执行顺序

确认三个候选镜像的测试与构建结果后，运行：

```powershell
$statePath = '<私有临时目录>\state.json'
node scripts/runtime/batch22-private-promotion.mjs dry-run $statePath
node scripts/runtime/batch22-private-promotion.mjs preflight $statePath
node scripts/runtime/batch22-private-promotion.mjs promote $statePath
node scripts/runtime/batch22-private-promotion.mjs refresh-proxy $statePath
node scripts/runtime/batch22-private-promotion.mjs readiness $statePath
node scripts/runtime/batch22-private-promotion.mjs verify $statePath
```

Overlay 顺序为 core、full、isolated、Batch18、Batch19、Batch20、Batch21、Batch22。`preflight` 锁定候选 image ID、验证 promotion/rollback Compose 展开，并从私有网络检查 19 个 readiness 页面。`promote` 按 `social-service`、`learner-web`、`mobile-h5` 顺序逐个重建，先替换 owner 服务，再替换客户端。其余 23 个服务身份必须持续与 Batch21 快照一致。刷新私有 HTTPS proxy 后，再执行 readiness 与 verify。

只有三个候选服务运行于准确 image ID、其余 23 个服务容器身份未变、私有 proxy 已刷新、共享指纹未变且 19/19 readiness 返回 200，收据才会进入 `verified`。

## 回滚

发布过程失败时助手会自动尝试回滚；也可显式运行：

```powershell
node scripts/runtime/batch22-private-promotion.mjs rollback $statePath
```

回滚按逆序（`mobile-h5`、`learner-web`、`social-service`）恢复 Batch21 verified snapshot 中三个目标服务的 image ID。每次重建前，助手先把目标服务写入持久化的 `rollbackInFlightServices` 收据，再执行 Compose。若进程在 Compose 恢复基线容器后、保存新容器 ID 前中断，重跑时只有在服务仍处于 `rolling-back`、存在对应持久化 intent、image ID 精确匹配基线且私有快照校验通过时，才会采纳该容器并补写回滚收据。完成记录写入后会清除 intent；`rolled-back` 阶段不接受未登记的替换容器。重建容器 ID 发生变化属于预期情况；助手要求其他 23 个服务保持原 ID。无法证明目标容器属于已记录的基线或带有持久化 intent 的恢复操作时，助手停止执行含糊回滚。

## 本次准备范围

三个候选镜像已构建，image ID 已锁定；完成 focused tests 后，按上述顺序只在私有项目中执行发布与复测。Batch22 私有发布结果以收据和验收报告为准。

## 检查

```powershell
node --check scripts/runtime/batch22-private-promotion.mjs
node --test tests/uat/batch22-private-promotion.test.mjs
```
