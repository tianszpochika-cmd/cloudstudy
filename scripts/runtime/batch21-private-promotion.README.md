# Batch21 私有镜像发布助手

此助手只操作 `cloudstudy-uat-isolated-3c94b27160` 私有 Compose 项目，只允许替换 `admin-web` 与 `learner-web`。候选标签固定为 `583ab627-uat-batch21-20260925`。`BATCH21_IMAGE_IDS` 中两个服务都必须填入最终构建的 SHA256 image ID；任一 ID 为空或格式错误，脚本会在镜像检查与 promotion 前失败关闭。

## 前置条件

`state.json` 所在私有临时目录须包含并通过校验的 Batch18、Batch19、Batch20 收据与 Compose overlay。Batch20 收据必须为 `verified`，记录 19/19 readiness，并包含完整 `verifiedSnapshot`。助手逐项核对当前 26 个容器的容器 ID、镜像 ID、状态、网络与宿主机端口绑定，必须与 Batch20 verified snapshot 完全一致；共享 `yuxuexing-local` 容器和网络指纹也必须未变。私有容器必须没有宿主机端口绑定。

## 执行顺序

```powershell
$statePath = '<私有临时目录>\state.json'
node scripts/runtime/batch21-private-promotion.mjs dry-run $statePath
node scripts/runtime/batch21-private-promotion.mjs preflight $statePath
node scripts/runtime/batch21-private-promotion.mjs promote $statePath
node scripts/runtime/batch21-private-promotion.mjs refresh-proxy $statePath
node scripts/runtime/batch21-private-promotion.mjs readiness $statePath
node scripts/runtime/batch21-private-promotion.mjs verify $statePath
```

`dry-run` 只读 Docker、私有收据和 Compose 配置。`preflight` 锁定两个候选 SHA256 image ID，验证 Batch20 版本的完整 Compose 展开与回滚方案，再从私有网络实时检查 19 个 readiness 页面并记录结果。Compose 层级按 core、full、isolated、Batch18、Batch19、Batch20、Batch21 overlay 顺序应用。

`promote` 每次只重建一个获准服务，顺序为 `learner-web`、`admin-web`。promotion receipt 逐项记录目标容器，可从中断的 `promoting` 阶段继续。其他 24 个服务的容器 ID 和 image ID 必须持续与 Batch20 快照一致。共享项目指纹在操作前后核对。

`refresh-proxy` 只重启私有 HTTPS proxy，并确认其容器 ID 和 image ID 未变化。`readiness` 与 `verify` 再从私有 Compose 网络检查 19 个 readiness 页面；只有两个候选服务运行在精确 image ID、其他 24 个服务身份未变、proxy 已刷新且 19/19 返回 200，`verify` 才写入 `verified`。

## 回滚

promotion 过程失败时，助手会自动尝试回滚；也可以显式运行：

```powershell
node scripts/runtime/batch21-private-promotion.mjs rollback $statePath
```

回滚按逆序把两个目标服务恢复到 Batch20 verified snapshot 中记录的 image ID。重建后的容器 ID 会变化，这是预期行为；助手记录这些新容器 ID，并要求其他 24 个服务保持原 ID。无法证明目标容器属于已记录的 baseline 或候选 image ID 时，助手会停止，不执行模糊回滚。

候选镜像按 tag 和 image ID 锁定，不校验当前源码树 checksum。后续源码改动不会进入已构建镜像；需要重新构建并登记新的批次镜像 ID。

## 检查

```powershell
node --check scripts/runtime/batch21-private-promotion.mjs
node --test tests/uat/batch21-private-promotion.test.mjs
```
