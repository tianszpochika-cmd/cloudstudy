# 当前跨电脑交接（dev）

更新时间：2026-08-29（Asia/Shanghai）。本文件只说明如何恢复当前开发检查点，不替代任务台账或 Evidence manifest。

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
pnpm test:p1r
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
- M1 可从只依赖已接受 `P1R-M0-008` 的契约任务开始；M0 安全 Gate、生产支付、Phase 2/3 和发布动作仍关闭。

## 5. 推荐接手顺序

1. 确认上述恢复验证与本仓库 Evidence 一致。
2. 执行 `P1R-M1-001`：统一 envelope、错误、分页、幂等、requestId/traceId 与版本弃用规则。
3. 依次处理 `P1R-M1-002` 到 `P1R-M1-007` 的认证、权限、Gateway、数据 owner 和事件可靠性契约；共享 OpenAPI/AsyncAPI/Flyway 由单一 owner 合并。
4. 每个任务先改契约与政策，再更新生成物/测试，最后在当前源提交生成 canonical manifest；不要继承旧 B/DEV/G 的完成状态。
5. DCloud 发布官方 Vite 6.4.3+ 兼容编译器族后，单独恢复 `P1R-M0-006` 并重跑 H5/App/mp-weixin 与完整供应链 Gate。

## 6. 禁止误判

- `pnpm build` 当前只显示三个 Web workspace 任务，不代表 mobile 的 H5/App/mp-weixin 都已编译。
- 目录、静态清单或历史 PASS 不代表真实数据库、Kafka、浏览器、真机、staging 或发布 Gate 已完成。
- 任何本机端口、账号、secret、生产证书或真实用户数据都不能写入 Git。
