# M0 统一执行日志（2026-08-29）

## 组织方式

本轮保持最多三条互不冲突的执行轨道：

1. 治理轨道：当前资产、历史候选与初始 Evidence 结构。
2. DevEx/供应链轨道：工具链、真实 CI、跨平台命令、BOM、许可证、SBOM 与漏洞整改。
3. Repo/夹具轨道：受跟踪编译产物清理、miniapp 归档边界和脱敏合成夹具。

统筹 Agent 负责统一 diff 审查、Java 25 Reactor、状态规则、Evidence gate、任务记录和最终 Git 交接。漏洞整改是在前三条轨道结束后顺序执行，没有超过三条并行轨道。

## 已执行验证

| 检查 | 结果 |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm p1r:ci:check` | PASS |
| `pnpm p1r:toolchain:static` | PASS |
| Java 25 环境下 `pnpm p1r:toolchain:check` | PASS |
| `pnpm ports:check` | PASS，42 个端口无自动递增 |
| `pnpm plan:p1r:check` | PASS，108 项及范围/GAP 覆盖完整 |
| `pnpm test:p1r` | PASS，8/8（含 CRLF/LF 可移植摘要） |
| `pnpm p1r:fixtures:validate` / `audit` | PASS，6 类 13 条 |
| `pnpm typecheck` | PASS，7/7 |
| `pnpm build` | PASS，admin/learner/official 3/3；mobile 由独立脚本构建 |
| `pnpm --dir apps/mobile build:h5` | PASS，uni-app Vue3 compiler 4.87；保留 Sass/分包非阻断警告 |
| mobile `test:b10` / `test:b11` / `test:b12` | PASS，9/9、7/7、4/4 |
| `mvn --batch-mode --no-transfer-progress -f pom.xml test`（Java 25） | PASS，15/15 Reactor 模块 |
| `git diff --check` | PASS（仅行尾提示） |
| tracked `.class` / 临时编译根 | 0 / 0 |
| 依赖与许可证静态审计 | PASS/REVIEW，清单完整 |
| registry 漏洞 + Maven SBOM | BLOCKED：1 high、0 critical；SBOM/许可证 PASS |

独立验收轨道确认上述前端命令没有新增受跟踪或未跟踪构建产物。根 `pnpm build` 不包含 mobile 的 app/H5/mp-weixin 三个编译目标；这些目标仍须按对应里程碑和设备 Gate 单独留证，不能由三个 Web build 代替。

## 已知风险

- M0 里程碑不是全绿：`P1R-M0-006` 保持 `BLOCKED`。
- 本机系统 PATH 未全局切换到 Java 25；所有 Java 25 证据均使用任务局部环境变量，防止污染用户机器。
- Maven 测试出现 Mockito 动态 agent 与少量 deprecated/unchecked 编译警告，但没有测试失败；它们进入后续技术债而不是本轮静默删除。
- 历史 B/DEV/G Evidence 不得用于接受 P1R 任务。

## 恢复与回滚

- 仓库卫生改动可通过 Git 还原；被删除内容全部是已验证的受跟踪 `.class` 产物，没有删除源码或数据。
- 合成夹具 cleanup 受 ownership marker 和清单约束；不得对仓库根目录执行递归删除。
- 安全整改未引入漏洞豁免；若回滚 Vite/override，必须先比较 `pnpm audit --json`，不得把 high 数量回退到 10。
