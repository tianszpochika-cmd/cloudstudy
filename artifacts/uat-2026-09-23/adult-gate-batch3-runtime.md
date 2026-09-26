# 成人准入服务侧修复与第三次本地集中复测

2026-09-23 11:45 CST。只针对既有本地 `local-real` 运行栈；不是公网或容器内验收。先备份四个旧 JAR 到 `C:\Temp\cloudstudy-uat-runtime-backup-20260923-1145`，再一次性重启由 `run-v2-services.mjs --all` 管理的 16 个 Java 服务；没有逐项修复后反复打包。

| 服务 | 修复的学习边界 | 独立完整测试 | 当前运行 JAR SHA-256 |
| --- | --- | --- | --- |
| learner `18088` | B25 JDBC 学员资料以外的学习入口按成人 Gate、IAM 同意和端点权限拒绝 | 69 项，0 失败，1 跳过 | `A027A49E7A7305AE5BABD1CD547E9ED1996E3B73F2F470D976247ABE058BDBF2` |
| content `18089` | 学习者目录与内容读取要求 `content.read`、Gate PASSED、同意 GRANTED；公开目录不变 | 204 项，0 失败，2 跳过 | `AC02022581B917FDD658AA2594F1E5B613763E7B0B60E0D4BA33DF1C75ECD133` |
| learning `18090` | B25/B3/V2 学习入口要求 Gate、同意、阶段、账户状态和相应读写权限 | 161 项，0 失败，3 跳过 | `81A7D4914BBE4DF25E3EB459C1438D68B4B63EE4AA088229C709A461C77B82E3` |
| assessment `18091` | B25/B10 的 14 个方法在 JDBC 前要求 Gate、同意和 session 读写权限；会创建会话的 GET `daily-stream` 要求写权限 | 76 项，0 失败，2 跳过 | `DDDCCD4C51A216FABBC1AA32B536CB4FC7B5896BF22F5C146E6967A45D44CC46` |

本次启动日志 `C:\Temp\cloudstudy-uat-v2-batch3-20260923.out.log` 逐一显示 16 个服务 `healthy`，runner PID `30304` 有 16 个 Java 子进程；独立 HTTP 检查中 16/16 服务健康入口和四端本地首页均返回 200。运行路径下四个 JAR 的散列与隔离构建产物相同。前端还取消了 Web/Mobile 入学页从旧 learner 画像预勾选年龄与同意项、取消旧出生年预填；移动个人页改读 IAM `adultGate`。两端学习路由现在同时看 Gate 与 IAM 签发的学习权限，Web 同意后通过 session 刷新令牌与权限快照，防止 Gate 已过但同意未完成时跳入学习页。两端类型检查、生产构建、完整 Node 套件（Web 52/52、Mobile 50/50）通过。独立浏览器夹具验证两端 Gate PASSED 且无同意时回入学页、具有学习权限时到首页，4/4；移动 H5 155 个页面/视口/主题夹具渲染无错误。浏览器夹具只验证 UI 分流，不能当作真实 IAM 同意或实际学习接口证据。

这些检查证明已换上修复字节码且服务可启动，不证明携不同新旧 JWT 的全链授权通过；专用合成账号的 Gate 前、同意撤回、会话撤销、跨主体 HTTP 矩阵仍待取证。当前契约与 IAM 权限命名漂移（B1/B2/B10、learning SRS/today/report）正分批核对，不能因 owner PEP 单测通过就将页面判为 PASS。Docker 应用镜像仍是这批修复前的版本，待其他相关改动稳定后集中增量重建。
