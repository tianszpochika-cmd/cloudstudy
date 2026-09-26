# Batch24 四端前端私有发布助手

此助手只操作固定私有 Compose 项目 `cloudstudy-uat-isolated-3c94b27160`，仅允许逐项替换 `official-site`、`learner-web`、`admin-web` 与 `mobile-h5`。固定候选标签为 `583ab627-uat-batch24-20260925`。IAM 和其他 22 个服务不在本批发布范围。

## 发布约束

- 唯一基线必须是 Batch23 `verified` 收据中的完整 26 容器快照；执行前还会要求当前私有容器快照逐字段完全一致。B23 收据链、私有 state 路径/ACL、镜像、共享项目指纹和固定 Compose 项目会由 B23 状态检查再次验证。
- `BATCH24_IMAGE_IDS` 已填入四个镜像构建后由 Docker inspect 核对的精确 SHA256 image ID。占位、格式不正确或镜像标签漂移时，dry-run、preflight、promote、proxy/readiness、verify 和 rollback 都会 fail closed。
- 候选标签当前解析出的镜像 ID 必须与四个锁定值逐一相等，且不得等于对应的 Batch23 基线 ID。rollback overlay 使用 B23 verified Compose 展开所得的原始镜像引用，并重新核对该引用解析到的 ID 与 B23 verified snapshot 完全一致。
- 每次仅对一个白名单服务执行 `up -d --no-deps --no-build --pull never --force-recreate`。每个服务更换后都会读取 26 个容器快照、验证镜像 ID/容器 ID/状态，并持久化收据后才继续。失败会按相反顺序恢复四个已记录基线；回滚每个服务前先落盘 intent，支持在 Compose 已恢复基线但进程中断时安全续跑。
- 如果发布进程中断时某个候选容器尚处于 `created` 或 `exited`，`status` 会显示四个目标服务的 image/container ID 与状态；它仍会逐项校验候选镜像、已记录容器身份、其余 22 个服务和共享指纹。此时重试 `promote` 会经过原有逐服务严格检查，并对仍未运行的候选启动受控回滚；若发现镜像、容器身份、其他服务或共享指纹漂移，命令会 fail closed，不会继续发布。
- 全程对比 `yuxuexing-local` 的共享容器与网络指纹；其他 22 个私有容器的 image、container、状态、网络和端口映射必须与 B23 快照完全相同。私有 Compose 服务和 HTTPS proxy 不得发布宿主机端口。
- 19/19 readiness 在私有 Docker 网络内执行。preflight 和发布后使用 Batch24 的 `official-site` 候选镜像运行 Node 探针；进入 `rolling-back` 或 `rolled-back` 后，探针必须使用收据记录且已核对 image ID 的 Batch23 `official-site` 基线镜像。B23 历史收据中的旧探针镜像不会用于 Batch24。

助手不构建、不拉取镜像，不写业务数据库，不运行共享项目 Compose 命令。`dry-run` 会只读检查固定候选镜像、私有快照和 Compose 展开。

## 发布顺序

四个最终镜像已完成一次构建、客户端检查与镜像 ID 锁定。发布前运行：

```powershell
$statePath = '<Batch23 私有临时目录>\state.json'
node scripts/runtime/batch24-private-promotion.mjs dry-run $statePath
node scripts/runtime/batch24-private-promotion.mjs preflight $statePath
node scripts/runtime/batch24-private-promotion.mjs promote $statePath
node scripts/runtime/batch24-private-promotion.mjs refresh-proxy $statePath
node scripts/runtime/batch24-private-promotion.mjs readiness $statePath
node scripts/runtime/batch24-private-promotion.mjs verify $statePath
```

Compose 覆盖顺序为 core、full、isolated、Batch18、Batch19、Batch20、Batch21、Batch22、Batch23、Batch24。preflight 锁定候选与基线 ID，检查候选/回滚 Compose 展开，并用新的 Batch24 官网候选镜像检查 19 条 readiness。promotion 顺序为官网、学习 Web、管理 Web、移动 H5；每次只重建一个服务。

只有四个候选服务运行在准确 image ID、其余 22 个容器身份及共享指纹不变、私有 proxy 已刷新且用 Batch24 官网候选镜像完成 19/19 readiness 后，收据才进入 `verified`。这组检查证明部署边界与 readiness，不等于业务功能验收完成。

## 回滚与恢复

promotion 的单服务替换发生错误时，助手会尝试自动回滚。也可显式运行：

```powershell
node scripts/runtime/batch24-private-promotion.mjs rollback $statePath
node scripts/runtime/batch24-private-promotion.mjs refresh-proxy $statePath
node scripts/runtime/batch24-private-promotion.mjs readiness $statePath
```

回滚按逆序（移动 H5、管理 Web、学习 Web、官网）恢复 Batch23 verified 快照所对应的四个准确基线镜像。rollback readiness 会用已记录的 Batch23 官网基线镜像，而不是 B23 更早的历史 readiness 镜像或 Batch24 官网候选。其他 22 个服务与共享项目指纹持续受保护。`status` 可查看当前收据阶段；如果回滚在某服务执行期间中断，重复运行 `rollback` 会先校验 durable intent、完整快照和精确镜像 ID 后再恢复。

## 纯逻辑检查

```powershell
node --check scripts/runtime/batch24-private-promotion.mjs
node --test tests/uat/batch24-private-promotion.test.mjs
```

测试用模拟 SHA256 值覆盖纯逻辑，并单独锁定本批实际镜像 ID；不代表私有镜像已发布或功能验收通过。
