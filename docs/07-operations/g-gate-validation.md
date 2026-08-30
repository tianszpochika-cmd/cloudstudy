# G0–G4 治理门禁验证记录

> 本文记录 G0–G4 DoD Gate 的代码化实现与静态验证。G Gate 是横切治理层，不是新的业务章节，也不代表 Phase 1 已上线。

## 1. 范围

| Gate | 代码化范围 | 真实运行证据 |
|---|---|---|
| G0 | Phase 1 范围、Feature/PRD/设计/ADR/ARCH 追溯、冻结枚举和冲突治理 | 独立范围签收、冲突处理和审计证据 |
| G1 | OpenAPI/AsyncAPI/JSON Schema、生成物、迁移 owner、schema/租户/事件边界 | 真实 schema diff、迁移演练、跨服务数据库权限和事件回放 |
| G2 | 四端实现与交互状态、错误恢复、i18n/主题、性能降级和 owner 绑定 | 浏览器/真机/API 回放、Loading/Empty/Error/Permission/Recovery 证据 |
| G3 | 测试、安全、隐私、权限、幂等、弱网、观测和 Phase 1 AI 禁用 | 真实扫描、trace/audit、告警、设备和故障注入报告 |
| G4 | 发布、兼容窗口、artifact、恢复点、审批、迁移/回滚和维护交接 | staging/RC/生产审批、回滚演练、恢复报告和签字 |

## 2. 安全默认值

- 所有 G Gate 默认 `BLOCKED`/`NO-GO`；流量、迁移、生产 flag 和维护关闭。
- 静态 validator 只读取仓库源文件和配置，不启动服务、不连接数据库、不执行 Kubernetes/Docker/Helm、不改变生产状态。
- `--require-runtime` 必须先通过 B22 runtime 前置，并提供由批准 runner 生成的外部证据；缺失、合成、占位或环境不匹配时 fail closed。
- 目录存在、manifest 存在、合成 fixture、HTTP 200、截图或 Agent 描述都不能单独升级为运行态完成。

## 3. 执行命令

```text
pnpm test:g
pnpm g:static
pnpm g:bootstrap --require-runtime
```

静态通过后仍需分别收集 G0–G4 运行证据，并与源版本、环境、artifact digest、时间、requestId/traceId、审计记录和回滚 owner 绑定。任何运行 Gate 未通过都不得把 Phase 1 标记为已上线。

## 4. 当前结果

- `pnpm test:g`：PASS，41/41。
- G0 validator：PASS，5 个静态检查、3 个运行证据保持 pending，`BLOCKED`。
- G1 validator：PASS，6 个静态检查、6 个运行证据保持 pending，契约统计为 401 operations、646 OpenAPI schemas、158 events、108 event payload schemas、15 个 data owner。
- G2 validator：PASS，10 个静态检查、8 个运行检查，`PASS/NO-GO`，真实交互和设备证据保持 pending。
- G3 validator：PASS，12 个静态检查、12 个运行检查，`PASS/NO-GO`，真实扫描、观测和设备证据保持 pending/blocked。
- G4 validator：PASS，10 个静态检查、12 个运行检查、22 个证据索引，`BLOCKED/NO-GO`。
- `pnpm g:static`：PASS；DoD strict、B22 静态前置、G0–G4 测试/validator、固定端口、运行配置和 B7+ 任务基线均通过。
- `check-dod --strict`：PASS；5 项检查全部通过。扫描器对策略样例文本的误报已修复，真实凭证扫描自检仍通过。

G0–G4 的实现和静态 Gate 已完成，但不能据此宣告 Phase 1 上线。`pnpm g:bootstrap --require-runtime` 必须在 B22 runtime 前置和全部外部证据变量齐全后才可能继续；当前仍会 fail closed，不启动生产动作、不改变流量或数据。
