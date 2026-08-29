# 当前跨电脑交接（dev）

更新时间：2026-08-30（Asia/Shanghai）。本文件只说明如何恢复当前开发检查点，不替代任务台账或 Evidence manifest。

M0 canonical Evidence 的实现源提交：`0f8b60ae4e83d0f31d891eed8d9383c007485130`。交接提交在其后，只增加任务状态、manifest、Gate 摘要与交接记录。

M1-001 canonical API 基座的原实现源提交：`96e1b541cdda8e9e5ad02bc79ea0c5b9032064c4`；共享测试在 M1-003 接续后由 Luna Max 于 `82b27f4108cfb976a274c2ac0cc34b1c9460a7a7` 完成 current-source revalidation，验收状态与摘要以 `evidence/p1r/m1/P1R-M1-001/manifest.json` 为准。

M1-002 自有 IAM 认证生命周期契约已接受：原最终实现源 `25705c4caab46449cfaa577db08bd13c8ad13fba`，共享 B8/canonical/generated 产物于 `e4618b324e5a93926da0750a8100fc9377ac97ec` 完成 current-source revalidation；canonical manifest 为 `evidence/p1r/m1/P1R-M1-002/manifest.json`。

M1-003 IAM 权限、成人 Gate、consent、tenant、admin policy 与 PEP/PDP D2 契约已接受：原最终实现源 `82b27f4108cfb976a274c2ac0cc34b1c9460a7a7`，共享产物于 `e4618b324e5a93926da0750a8100fc9377ac97ec` 完成 current-source revalidation；canonical manifest 为 `evidence/p1r/m1/P1R-M1-003/manifest.json`，独立评审为 `m1_003_final_review`（Luna Max）。

M1-004 Gateway 边界与浏览器安全 D2 契约已接受：最终实现源 `e4618b324e5a93926da0750a8100fc9377ac97ec`，canonical manifest 为 `evidence/p1r/m1/P1R-M1-004/manifest.json`，独立终验为 `m1_003_final_review`（Luna Max，仅 D2）。现有 Java Gateway 仍只是 M2-001 的候选实现，不能据此声明真实运行验收。

## 1. 获取检查点

```powershell
git switch dev
git pull --ff-only origin dev
git status --short
```

预期：工作树干净。实现源提交和各任务状态从 `evidence/p1r/**/manifest.json` 与 `requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md` 读取，不从聊天记录推断。

## 2. 选择 Java 25（只影响当前终端）

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-25'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
java -version
mvn -version
```

若另一台电脑路径不同，只替换 `JAVA_HOME` 为真实 JDK 25 根目录，不要直接复制本机路径，也不要为了通过检查修改版本基线。

## 3. 最小恢复验证

```powershell
pnpm install --frozen-lockfile
pnpm p1r:toolchain:check
pnpm ports:check
pnpm plan:p1r:check
pnpm p1r:evidence:check
pnpm p1r:auth-contract:check
pnpm p1r:iam-policy-contract:check
pnpm p1r:gateway-contract:check
pnpm test:p1r
pnpm test:b7
pnpm test:b8
node --test tests/g/g1-contract-data.test.mjs
pnpm p1r:fixtures:validate
pnpm p1r:fixtures:audit
pnpm typecheck
pnpm build
mvn --batch-mode --no-transfer-progress -f pom.xml test
```

移动端最小回归：

```powershell
pnpm --dir apps/mobile test:b10
pnpm --dir apps/mobile test:b11
pnpm --dir apps/mobile test:b12
```

## 4. 当前状态

- M0 的 7 项治理/仓库/工具/夹具任务已接受；`P1R-M0-006` 保持 `BLOCKED`。
- 严格供应链命令 `pnpm p1r:supply-chain:check` 预期非零：当前应只有 `GHSA-fx2h-pf6j-xcff` 这 1 个 high、0 critical。若 high 数增多或出现 critical，先停止后续依赖升级并检查 lockfile diff。
- 不得为让 CI 变绿而加入漏洞豁免或强制把 mobile Vite 覆盖到 6.x。
- `P1R-M1-002` 已接受：Web/H5 Cookie 与原生 Keychain/Keystore 请求/响应已分离，RS256/RSA JWKS、轮换/重放/撤销/重置、错误/关联 ID 和生成联合类型具备当前提交 Evidence。它仍只是 D2 合同，不是 IAM 运行实现。
- `P1R-M1-003` 已接受：服务端权威 principal/tenant/owner、成人 Gate/consent、RBAC+ABAC、策略双人审批/撤销/缓存失效，以及本地 PEP/远程 PDP 边界具备当前提交 D2 Evidence；运行期 IAM/PEP、真实数据库和 Gateway 均未提前声明完成。
- `P1R-M1-004` 已接受：52 条有序 route rule 唯一覆盖 326/326 public operations，51/51 internal operations 外部拒绝；Origin/Cookie/CSRF、native transport、RS256/JWKS、限流、错误、关联 ID、审计和直连阻断 D2 合同已通过专项与兼容检查。
- M2-001 运行缺口仍开放：真实 WebFlux CORS/CSRF/Origin、public-path parity、Redis 限流及故障语义、持久审计、网络直连隔离、真实浏览器/JWKS/跨进程/网络 Evidence。
- `P1R-M1-001` 已接受：公共成功/错误 envelope、追踪/版本 headers、写幂等、统一 cursor 分页、只读 merge/generate 与真实 Git baseline compatibility 已有当前提交 Evidence。
- 完整 `pnpm test:g` 当前仍为 39/41：G0/G3 都引用已删除的同一句旧 source marker；独立评审确认它们早于 M1-002，M1-002 所需 G1 为 6/6。接手时不得把完整 G 写成全绿。

## 5. 推荐接手顺序

1. 确认上述恢复验证与本仓库 Evidence 一致。
2. 当前关键路径是 `P1R-M1-005`：冻结全量服务 data owner、独立 schema/Flyway、Redis namespace、tenant guard、retention 与迁移/回滚责任；现有 B25 清单和 Redis registry 只作为候选输入。
3. 每次修改公共 API、数据 owner 或迁移责任后，先从最近已接受 manifest 选择不可变 baseline；M1-005 从远程 `dev` 的最新接受检查点开始，不得回退到旧 B/DEV/G 快照。
4. 每个任务先改契约与政策，再更新生成物/测试，最后在当前源提交生成 canonical manifest；不要继承旧 B/DEV/G 的完成状态。
5. DCloud 发布官方 Vite 6.4.3+ 兼容编译器族后，单独恢复 `P1R-M0-006` 并重跑 H5/App/mp-weixin 与完整供应链 Gate。

## 6. 禁止误判

- `pnpm build` 当前只显示三个 Web workspace 任务，不代表 mobile 的 H5/App/mp-weixin 都已编译。
- 目录、静态清单或历史 PASS 不代表真实数据库、Kafka、浏览器、真机、staging 或发布 Gate 已完成。
- 任何本机端口、账号、secret、生产证书或真实用户数据都不能写入 Git。
