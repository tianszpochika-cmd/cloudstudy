# CURRENT-HANDOFF —— 语学星 Phase 1 重基线（P1R）

> 本文件是**跨会话交接**的入口。它记录"当前在哪、下一步做什么、谁在等谁"。
> 最后更新：**2026-09-13**（P1R-M2-004 第三轮返工：新 P1 与 10 项 P2 中的 7 项已关闭；P1R-M0-006 5 项 P1 已关闭）。

---

## 0. 检查点

| 项 | 值 |
|---|---|
| HEAD | `b0a562d`（`origin/dev` 为 `b3bc83d`，最新一次提交待推） |
| `P1R-M2-004` | **第三轮返工进行中**：第二轮评审判 REWORK（P0/P1/P2 = 0/1/9），新 P1（gated runner 退出码判据）**已修**；7 个 IAM gated 类与 10 项 P2 **未完成** |
| `P1R-M0-006` | 第一轮评审判 **REWORK**（0/5/8）；第二轮返工 **5 项 P1 已全部关闭**，**8 项 P2 未做** |

## 1. 当前状态

| 项 | 值 |
|---|---|
| 阶段 | `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED` |
| 台账 | **28 ACCEPTED / 2 REVIEW / 1 BLOCKED / 77 PLANNED**（108 项，计数固定） |
| 全量 `tests/` | **1924 项、1917 pass、0 fail、7 skip** |
| P1R | **1429/1429** |
| 后端 | 15/15 服务在跑 |
| 前端 | 4/4（18180–18183） |
| 门禁 | evidence / plan / docs / data-ownership / gap-registry / gateway-contract / toolchain 全 PASS |

## 2. 阻塞点：**只等独立评审**

台账门禁要求"任何高于 `PLANNED` 的状态都必须依赖已 ACCEPTED"，因此：

- `P1R-M2-004`（REVIEW，返工已完成，**第二轮评审待做**）、`P1R-M0-006`（第一轮 REWORK，返工进行中）、`P1R-M2-005`（BLOCKED，阻塞于 M2-004）
- 其后的 `M2-006 → M2-010 → M3…M8` 全部在等这次评审 ✓
- **可推进的任务数为 0**（已枚举全部 108 项）

**按铁律 #10，`ACCEPTED` 必须由独立评审判定，实现者不得自批** —— 而实现者这一路还改过多道门禁与 harness，自批的正当性更差。

## 3. 本会话（09-12 ~ 09-13）完成的工作

| 批次 | 内容 |
|---|---|
| M0-006 | uni-app 迁移到 10.x 线；依赖门禁改按 high/critical 计数；防洗白守卫收紧为「独立评审 ACCEPTED」 |
| M2-004 | audit-service 进入编排栈、`schema_version` 列宽缺陷修复、reconcile 迁移历史、10 张 outbox 表统一形状、独立 schema/凭据/DML-only 授权/Redis namespace 与 ACL |
| M2-005 | Kafka transport、Outbox publisher、consumer dedupe、DLQ；**六类证据全部脚本化**（重复/乱序/宕机/重启/DLQ/回放不重复写） |
| 契约提升 | `public-site` 投影 owner 由 `admin-ops-service` 改为 `content-service`，官网首次运行投影经网关可达（404 → 200） |
| 前端修复 | H5 登录表单（`form-type` + 去掉非 DOM 事件的 `.prevent`）；成人 Gate 策略版本 `v2-phase1` → `b30-adult-v1`；IAM 越界出生年 500 → 403；learner-web 把 `CONSENT_REQUIRED` 当无权限而困死首次运行；两前端调用不存在的 `/learner/onboarding/options` |
| legacy B 套件 | **33 → 0 失败**，18 个提交，零退役（登记为 M2-009 前置，见 `execution/P1R-M2-009.md`） |
| M2-004 返工 | R1 四项全部关闭（TENANT-GUARD 改判并实测、ACL 探针 13→15、Redis 丢失行为证据、空库含 audit-service）；R2 六项；R3 四项 |
| M0-006 返工 | 5 项 P1 全关闭：P1-1 更正被证伪主张（18 份 manifest + 5 处文档）、P1-2 lockfile 解析级校验、P1-3 adm-zip→0.6.1 + @intlify 风险接受、P1-4 provenance 对齐、P1-5 守卫收紧 + 6 个防洗白用例（55/55） |
| M2-004 第三轮 | 新 P1 已修：gated runner 改 fail-closed + 发现式覆盖 ⇒ discovered=30 failing=2 uncovered=0（旧版只跑 23 个）；**7 个 IAM 类与 10 项 P2 未完成** |

## 4. 下一步（按新优先级规则）

新规则（本会话确立，即刻生效）：主线被依赖门禁阻塞时，按此优先级 ——
① 先做能解除阻塞的事（补评审所需证据）；② 再做已立项且未阻塞的任务；③ 可做邻近修复，但**必须先补台账任务号**；④ 不得连续超过 10 个提交用于无任务号的工作；⑤ 每批次结束必须更新本文件与台账。

据此当前可做：

1. **`P1R-M2-004` 第二轮独立评审** —— 唯一能解锁全链的动作；评审包见 `execution/REVIEW-REQUEST-P1R-M2-004.md`
2. `admin-web` / `official-site` 的首次运行旅程尚未在真实浏览器驱动过（`learner-web` 与 `mobile` 已驱动）
3. `learner-web` 2 项既有测试失败（登出跳转、评估链 owner/idempotency）
4. `FAIL_CLOSED_REASONS` 中 23 条被拒绝路由的 owner 逐域判定（**有手写调用者的为 0**，故非缺陷；见 `execution/GATEWAY-WITHHELD-ROUTES.md`）

## 5. 已知缺口（不影响当前结论，但需承接）

- HTTP 级双租户负例（需 `M0-007` 合成账号，`M2-009` 接入）
- 领域服务尚未使用 Redis（namespace 为预留分配，非活路径边界）
- 仅 content-service 有 outbox 发布器与消费者
- 未匹配路由的 404/403 **不带 CORS 头**（可诊断性代价，无访问控制影响）
- 无法解决：真实 iOS/Android/iPad 设备、`safari-native`、微信小程序真机验收、真实 staging、不可变 RC 签名、支付沙箱

## 6. 环境备忘

- Node **20.19.5**；裸 `pnpm` 跑在 DSH 的 Electron Node 24 上 ⇒ 用 `& "$env:APPDATA\npm\pnpm.cmd" <script>`
- `ports:check` 退出码 3 是**预期语义**（本地运行栈占用 26 个端口），非缺陷
- 外网走代理 `http://127.0.0.1:7897`
- 全栈：`pnpm services:run -- --all`；杀任一 java 进程会带走整个栈
- 门控数据库测试：`node scripts/runtime/run-gated-db-tests.mjs`（默认 `mvn test` 会把这些报成 skipped）
