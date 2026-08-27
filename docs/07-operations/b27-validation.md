# B27 真机、专项质量、发布候选与测试交接验证

> 验证日期：2026-08-24  
> 范围：`V2-B27-DEV-001` 至 `V2-B27-HANDOFF-006`  
> 方式：代码实现、契约/配置静态校验、测试、四端构建和本地浏览器边界检查；真机、staging、RC、回滚和交接运行证据仍待验收

## 结论

B27 的代码与静态验收已完成。六项任务均已建立对应配置、fail-closed 运行校验器、测试和证据字段，覆盖 iOS/Android/iPad/移动 H5、PWA、微信小程序条件编译、安全/性能/无障碍、production-like staging、RC/回滚和测试交接。

这不等于 B27 的运行态完成，也不等于 Phase 1 可以上线。当前结论是：**B27 代码/静态完成；真机、PWA 安装更新、微信开发者工具、专项运行质量、staging、RC/回滚和多角色交接待验收；发布结论为 `NO-GO`。**

2026-08-24 本机里程碑调整后，Mobile H5/Web 和本地安全质量子集转入 B28–B36；iOS/Android/iPad、微信、远程真机、staging、RC 和生产交接运行项暂缓，未来发布前恢复。B27 的 `NO-GO` 不阻塞本机开发和 MCP 浏览器测试，但继续阻止生产发布。

所有运行校验器在缺少批准的运行证据时保持阻断，不安装设备工具、不部署 staging、不创建 RC、不执行切流，也不生成伪造的 Go 批准。

## 任务状态

| 任务 | 代码/静态状态 | 运行态剩余 |
|---|---|---|
| DEV-001 | 已完成平台矩阵、设备配置、登录边界、深链、安全区、方向、后台/网络/音频场景和证据契约 | 需要批准的 iOS/Android/iPad/移动 H5 实体或远程设备，执行注册登录和真实数据闭环 |
| DEV-002 | 已完成 learner-web PWA 所有者约束、apps/mobile H5/原生/小程序条件编译约束、登录边界和产物校验 | 需要 PWA 安装/更新/缓存失效/离线只读和微信开发者工具实际运行、分享返回证据 |
| QUAL-003 | 已完成安全、CORS、限流、JWKS、性能降级、无障碍、隐私脱敏和运行证据 schema | 需要真实浏览器/设备、弱网、读屏、性能采样和安全扫描结果 |
| STG-004 | 已完成 digest、secret、迁移、探针、网络策略、版本绑定、观测、备份和回滚点的静态门禁 | 需要 production-like Kubernetes/OCI staging 实际部署、迁移/恢复/回滚和观测证据 |
| RC-005 | 已完成不可变 RC、全量回归、风险、P0/P1、变更窗口、回滚和双人审批字段 | 需要真实 RC 构建物、回滚演练、风险接受和五角色独立 Go/No-Go 决策 |
| HANDOFF-006 | 已完成测试报告、证据索引、缺陷等级、Runbook、维护 owner 和交接决策契约 | 需要关闭/批准阻断项、完成独立交接签收和最终发布/不发布报告 |

## 静态验证证据

| 命令/检查 | 结果 |
|---|---|
| `pnpm test:b27` | PASS；24/24 |
| `pnpm b27:static` | PASS；B26、B22、G0–G4 静态前置和 B27 六项静态门禁全部通过 |
| B27 device validator | PASS；4 个构建目标、7 个设备 profile、8 个场景、6 个来源契约；`runtimeBlocked=true` |
| B27 quality validator | PASS；7 个静态检查、10 个运行检查，运行证据待补；`releaseDecision=NO-GO` |
| B27 handoff validator | PASS；17 项证据契约、11 项运行证据待补；`status=BLOCKED`、`releaseDecision=NO-GO` |
| G1/G3/B22 回归 | PASS；G1 18/18、B22 10/10；B27 bootstrap 暴露并修正了过期基线计数/来源标记 |
| 契约与基础设施静态检查 | PASS；427 operations、479 OpenAPI schemas、154 events、110 event payload schemas；固定端口、运行配置和基础设施检查通过 |

## 前端构建与本地浏览器边界检查

以下构建均退出码为 0：

- `@englishflow/learner-web`：生产构建通过；PWA manifest 和未登录登录边界已检查；
- `@englishflow/admin-web`：生产构建通过；
- `@englishflow/official-site`：生产构建通过，预渲染 16 个公开路由；
- `@englishflow/mobile` H5：构建通过；
- `@englishflow/mobile` 微信小程序条件编译：构建通过，产物可导入微信开发者工具。

本地浏览器检查只覆盖当前机器的本地壳和 fail-closed 边界：learner-web 的 PWA manifest/登录入口、Mobile H5 最终回到登录页、official-site 公开页面和登录深链均可检查。Mobile H5 在 Gateway 不可用时存在会话恢复等待后回到登录页的行为；这证明了登录门禁的拒绝边界，不能替代有效 JWT 下的真实业务数据测试。

Official Site 开发服务器出现过 `#app-manifest` pre-transform warning，但生产构建和公开页面检查通过；在 production-like staging 接受前仍须复核生产启动日志，不能把该 warning 静默视为已解决。

## 运行阻断项

1. 当前 Windows 环境没有发现 `adb`、`xcrun`、`idevice_id` 或 `scrcpy`，没有实体/批准远程真机证据。
2. B23–B26 的真实 OIDC/JWKS、有效 JWT、Gateway→服务→MySQL→API、Redis 重建、服务重启、Kafka/Outbox offset 和 DB/Kafka 对账仍未形成完整运行证据链。
3. PWA 的真实安装、更新、缓存失效、离线只读恢复和微信开发者工具中的登录/分享/返回尚未执行。
4. 尚无 production-like Kubernetes/OCI staging 的 digest、secret 注入、迁移、探针、NetworkPolicy、OTel、SBOM、备份恢复和回滚证据。
5. 尚无不可变 RC、P0/P1 关闭或批准记录、五角色独立 Go/No-Go、维护 owner 签收和最终测试交接报告。

## 下一步运行验收顺序

1. 先完成 B23–B26 的标准 OIDC、认证后真实数据和 Kafka/Outbox 运行闭环，生成统一 `runId/traceId` 的 Network、服务日志、MySQL 和 Kafka 对账证据。
2. 在批准的实体或远程真机上执行 DEV-001；在浏览器安装能力和微信开发者工具中执行 DEV-002。
3. 执行 QUAL-003 的真实安全、性能、弱网、读屏、对比度和隐私检查；修复或批准 P0/P1。
4. 部署 STG-004，完成迁移、备份恢复、探针、观测和回滚演练；随后生成 RC 并完成 RC-005 五角色独立决策。
5. 完成 HANDOFF-006 后，才能宣告 Phase 1 测试交接完成。当前不能宣告生产可上线。

## 关键文件

- [B28–B36 本机真实全栈与 MCP 浏览器任务基线](../../requirements/backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md)
- [B27 设备与平台配置](../../config/b27-device-platform.json)
- [B27 质量与发布配置](../../config/b27-quality-release.json)
- [B27 交接配置](../../config/b27-handoff.json)
- [B27 静态/运行引导](../../scripts/runtime/b27-bootstrap.mjs)
- [B27 设备验证器](../../scripts/runtime/validate-b27-device-platform.mjs)
- [B27 质量验证器](../../scripts/runtime/validate-b27-quality-release.mjs)
- [B27 交接验证器](../../scripts/runtime/validate-b27-handoff.mjs)
- [B27 测试目录](../../tests/b27/)
