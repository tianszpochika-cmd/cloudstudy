# R1-003 / R1-004 / R1-005 交付物独立终审审查报告 (Independent Final Review)

> **审查员**：Luna（独立终审审查员，Independent Reviewer）  
> **审查日期**：2026-10-09  
> **源码分支**：`dev-redesign`  
> **工作区基线**：`/Users/Admin/Desktop/work/cloudstudy`  
> **终审判定结论**：**`ACCEPTED_CARD_SCOPE / R1_003_004_005_ACCEPTANCE_PASS`**  
> **状态标记**：**`SAFELY_PAUSED`**（卡级验收通过，子进程已安全退出，端口已释放，环境安全暂停）

---

## 一、 审查背景与任务范围

根据 `AGENTS.md`（§0、§2.2、§2.3、§3、§4 DoD）以及 `dev-plan-R1.md` 的计划约定，本审查对迭代 2（Redesign）中 L1 注册入门环的连续三张核心卡进行独立终审：

1. **R1-003（BC-003 / IC-002, IC-052）**：注册幂等回放（同键同结果，绝不建立第二账号，拒绝冲突并拒绝缺失键）。
2. **R1-004（BC-004 / IC-002, IC-053）**：登录 / 刷新 / 撤销全套生命周期（CAS 轮换、令牌族重放清理、登出全失效、Cookie 属性与禁止明文 Token 泄漏）。
3. **R1-005（BC-005 / IC-002, IC-008, IC-035）**：多设备列表识别与踢出（服务端令牌判定当前设备，客户端伪造防御，被踢设备令牌及 Refresh 全 401 失效，主调设备不受影响）。

---

## 二、 独立复核与执行验证事实

### 1. 真实运行收据审查（Clean DB Runtime Receipts）

审查员独立调阅了运行日志与收据文件：
- **最终全链路通过收据**：[`runtime-results-ff793b6aaaa9.json`](runtime-results-ff793b6aaaa9.json)
  - 专属隔离库：`r1_iam_lifecycle_20261009_ff793b6aaaa9`
  - 专属账号：`r1_iam_ff793b6aaaa9`
  - Flyway 迁移：17 项版本迁移成功，0 失败，最大版本 18。
  - 初始干净度验证：六类核心业务计数（`principals`, `accounts`, `sessions`, `devices`, `audits`, `completedIdempotency`）**全为 0**。
  - 执行结果：**`STATUS: PASS / exit 0`**，全部 40 项断言 100% 通过（R1-003: 12/12, R1-004: 14/14, R1-005: 14/14）。
- **保留的历史失败原件**：
  - 第一轮失败收据：[`runtime-results-1d060bf4f8e7.json`](runtime-results-1d060bf4f8e7.json)（登出与踢出后刷新误报 404）。
  - 第二轮失败收据：[`runtime-results-a90b07771211.json`](runtime-results-a90b07771211.json)（被踢设备刷新误报 404）。
  - 事实证明：研发团队如实保留排错原件，未掩盖缺陷，排错闭环链路清晰完整。
- **独立准备收据**：[`prepared-ff793b6aaaa9.json`](prepared-ff793b6aaaa9.json)
  - 绑定宿主目录模式 `0700`、私钥与密钥库模式 `0600`，UID 502 匹配，无软链接，自签名证书 SAN 严格绑定 `127.0.0.1` 与 `localhost`。

### 2. 基础设施与端口安全独立复查

审查员在 macOS 宿主机上独立执行了系统与网络检查：
1. **端口 18087 释放核验**：
   - 执行 `lsof -i :18087`，结果退出码为 1，无任何残留监听。
   - 收据标记 `cleanup.port18087Released: true` 与 `cleanup.iamStopped: true` 经独立系统命令核实为真实。
2. **Docker 容器隔离核验**：
   - 执行 `docker ps` 核查，本项目官方容器 `yuxuexing-local-mysql-1`（容器 ID: `db8739202039...`）健康运行 24 小时以上。
   - 宿主机上并存的其他项目第三方容器（`qida-dev-tsz-*` 30+ 容器，`qida-clm-*` 等）已连续运行 22 小时以上，状态保持一致健康，**未发生 Docker 重启、未执行 compose down/prune、未触碰任何第三方容器**。
3. **安全与隐私防泄漏核验**：
   - 检查 `git status` 与 `git diff`，运行测试材料均存放于 Git 外部 `0700` 目录。
   - 收据中的私密目录路径均已被脱敏为 `<PRIVATE_MATERIAL_DIR>`，密码与原始 Token 均脱敏为 `<REDACTED_SECRET>`。
   - 执行仓库全局私钥标记扫描（`git grep "BEGIN PRIVATE KEY"` 等），除已有合规规则声明文件外，**无任何真实私钥、公私密钥对、密码或 JWT 令牌泄漏至 Git 仓库**。

### 3. 代码契约与跨端同步审查

1. **API 契约层（Contract-First）**：
   - `packages/contracts/fragments/b8/b8-auth-iam.openapi.json`：
     - `B8Device` schema 增补 `isCurrent: boolean`，标记为必填，描述明示：“服务端由已验证令牌判定，不接受客户端声明。”
   - `packages/contracts/openapi/v1/openapi.json`：全量 OpenAPI 契约已完成合并。
   - `packages/contracts/generated/openapi.ts`：跨端 TypeScript 类型已重新生成，`B8Device` 严格包含 `isCurrent: boolean`。
2. **服务端实现（`services/iam-service`）**：
   - `IamProviderBoundaryController.java`：
     - `deviceList` 端点使用已验证 JWT 中的 `device_id` claim（缺省降级按 `session_id` 查会话记录）计算各设备的 `isCurrent`，严格拒绝客户端篡改或客户端伪造参数。
     - `validateRefreshBinding` 修正：当会话状态非 `ACTIVE` 时，抛出 `SESSION_REVOKED`（401）而非历史误抛的 `DEVICE_NOT_FOUND`（404）。
     - `validateTrustedTransport` 修正：当设备已被标记为非活跃（`!registration.active()`）时，抛出 `DEVICE_REVOKED`（401）而非 `DEVICE_NOT_FOUND`（404）。
   - `IdempotencyService.java`：补齐 `DEVICE_REVOKED` 映射为 401。
   - 新增单元测试：`IamDeviceListCurrentControllerTest.java` 5 项测试，包括多设备当前标识判定、伪造 Header/参数防御、缺少 device claim 降级查表、孤儿设备全 false 兜底、踢出设备后旧令牌 401。
   - **独立运行测试**：审查员独立运行 `mvn test -Dtest=IamDeviceListCurrentControllerTest`，5/5 全部通过（0 Failures, 0 Errors, 0 Skipped）。全模块 `mvn test "-Dtest=Iam*Test"` 76 项测试构建成功（0 Failures, 0 Errors, 21 正常跳过的上下文测试）。
3. **前端实现（`apps/learner-web` & `apps/mobile`）**：
   - `apps/learner-web`：
     - `src/api/b1.ts`：`fetchDevices` 优先使用服务端的 `item.isCurrent`，并保留客户端会话比对作为兼容兜底。
     - `src/stores/b1.ts`：踢出逻辑放宽对客户端本地 `deviceId` 的硬限制，信任服务端返回。
     - 独立测试：运行 `node --test apps/learner-web/tests/device-settings.test.mjs`，3/3 测试全部通过。
   - `apps/mobile`：
     - `src/domain/devices.ts`：提供 `isCurrentMobileDevice` 与 `canRevokeMobileDevice`，优先以服务端的 `isCurrent` 进行当前设备判定与防踢自保。
     - `src/pages/devices/devices.vue`：UI 界面绑定 `isCurrentMobileDevice`，正确展示“当前设备”标签并屏蔽自身退出按钮。
     - 独立测试：运行 `node --test apps/mobile/tests/mobile-settings-devices.test.mjs`，8/8 测试全部通过。
4. **运行验证工具（`scripts/redesign/r1-iam-lifecycle/`）**：
   - 审查员独立运行脱机测试：`node --test scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.test.mjs`，12/12 测试全部通过。

---

## 三、 逐卡验收判定表

| 卡号 | 对应链 | 验收项与断言依据 | 独立复核结果 | 判定 |
|---|---|---|---|---|
| **R1-003** | **BC-003** 注册幂等回放 | 1. 干净库初始为 0；<br>2. 首次注册 201 建立账号、主体、会话与设备；<br>3. 同键同请求体重放返回完全相同的 201、sessionId 与 deviceId；<br>4. 数据库读回账号数仍为 1，完成态幂等记录为 1（不建第二账号）；<br>5. 同键不同请求体返回 409 拒绝且不建第二账号；<br>6. 缺少幂等键返回 400。 | 12 项断言全部 PASS，单账号保证与冲突防御成立 | **PASS** |
| **R1-004** | **BC-004** 登录/刷新/撤销全套 | 1. 账号登录 200，下发 Access Token 与安全 Cookie（HttpOnly, Secure, SameSite=Lax, Path=/api/v1/auth）；<br>2. 响应体不含明文 refreshToken；<br>3. 携带 Cookie 刷新 200，新 refreshToken 与旧 token 不同（CAS 轮换成功）；<br>4. 重放旧 refreshToken 返回 401 并触发会话 REVOKED（令牌族撤销）；<br>5. 重新登录并登出 200，会话标记 REVOKED；<br>6. 登出后旧 Access Token 与 Refresh Token 再次请求均返回 401。 | 14 项断言全部 PASS，历史 404 缺陷已排查修复并保留原件 | **PASS** |
| **R1-005** | **BC-005** 设备列表与踢出 | 1. 同账号两台设备登录成功；<br>2. 设备 A 请求设备列表，仅设备 A 为 `isCurrent=true`；<br>3. 设备 B 请求设备列表，仅设备 B 为 `isCurrent=true`；<br>4. 客户端伪造 Header/参数无法篡改当前设备；<br>5. 设备 A 踢出设备 B 返回 200；<br>6. 设备 B 旧 Access Token 与 Refresh Token 均返回 401；<br>7. 主调设备 A 状态 ACTIVE 且保持有效（200）。 | 14 项断言全部 PASS，设备注销 401 语义与前后端同步已成立 | **PASS** |

---

## 四、 边界声明与未决事项（Guardrails & Non-Goals）

为恪守 `AGENTS.md` 规则，防止范围蔓延或虚假宣称，本终审明确作出如下边界限定：

1. **卡级范围限定（Card-Scope Only）**：
   - 本签收结论严格仅适用于 **R1-003、R1-004、R1-005** 三张业务卡。
   - **不代表全量 114 卡墙恢复**（GAP-WALL-114 仍保持 OPEN）。
   - **不代表原 R1-001 完整原件恢复**（官网当前源仍为 SCOPED 交付，原件缺口仍保持记录）。
2. **IT-1 站点尚未出站（Station IT-1 Not Exited）**：
   - 根据 `dev-plan-R1.md`，IT-1 入门站包含 L1 完整的 17 张卡（R1-001 ～ R1-017）。
   - 截至目前，后续核心卡（包括但不限于 **R1-006 成人门提交**、**R1-007 门未过等待态**、**R1-008 三同意动态版**、**R1-009 撤回回收**、**R1-010 画像保存**、**R1-011 向导进度**、**R1-014 L1 全链干净库重放** 等）尚未完成验收。
   - 只有当 L1 全 17 卡在干净库中全绿且获得独立签收后，IT-1 方可出站。
3. **严禁越站跳入 IT-2（No Station Skipping）**：
   - 尽管已有 L2（R1-018 ～ R1-029）的设计与计划，但在 IT-1 签收出站之前，**严禁开工 IT-2 定级环开发**。
4. **历史遗留审计与异步总线声明**：
   - 本地持久化注册审计已落地；历史 Event 审计映射、Kafka 兼容 Outbox 跨服务发布扩围以及 `prn_` legacy 身份迁移仍保留在架构演进清单中，不在此三卡中虚假宣称已全盘完成。
5. **基础设施无损保持**：
   - 测试数据库 `r1_iam_lifecycle_20261009_ff793b6aaaa9` 保留作为物理证据，未执行破坏性 DROP。后续环境维护可依据 `cleanup-plan` 脚本受控执行。

---

## 五、 终审结论与签字

**终审结论**：**`ACCEPTED_CARD_SCOPE / R1_003_004_005_ACCEPTANCE_PASS`**  
**后续步骤建议**：
1. 本轮工作区差量与证据提交入库；
2. 保持安全暂停状态（`SAFELY_PAUSED`），等待用户具名指令推进下一任务：**R1-006（BC-006 成人门提交落库审计）**。

*审查员签字：Luna（Independent Reviewer）*  
*日期：2026-10-09*
