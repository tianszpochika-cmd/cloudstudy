# IT-1 / IT-2 独立终审

审查日期：2026-10-10。审查基线：`dev-redesign` / `69bea68b44b2c8c6c6dbdcdb38c0b955a458aaf1`。审查人：Luna max。范围：IT-1（R1-001…017）与 IT-2（R1-018…029）。本次只读复核证据、当前源文件摘要、截图、清理记录与既有卡报告；没有启动服务、浏览器、Docker、SQL 或测试，没有修改业务代码或提交。

## 判定

**IT-1：REJECT / FAIL。** 当前 Web 与 Mobile H5 的密码认证请求都由 Gateway API 客户端发出，真实浏览器捕获到的注册、登录、重置目标是 `http://127.0.0.1:18070/api/v1/auth/*`。这违反 `AGENTS.md`“账号密码只能直接提交至 IAM 的 TLS 认证入口”的边界。该错误目标在发送前被 Playwright 路由保护拦截，因此页面中的失败提示不是 IAM/Gateway 的真实拒绝，也没有凭据被送到 Gateway；不影响目标路径本身已经构成 FAIL。

**IT-2：BLOCKED，未开站、未执行动态验收。** dev-plan-R1 的正式门禁要求 IT-1 全卡通过并签收后才能进入 IT-2。已知卡级缺陷仍需按缺陷记录，不以门禁 BLOCKED 抹掉：公开重测返回 404、Web/Mobile 的重测按钮仍 disabled；B25 `submit-step` 与 `skip` 旧写口仍可用，P1 页面路径尚未改成对应新写口；R1-027 没有真实网络中断恢复证据。

R1-001 仅对本轮明确覆盖的当前官网范围记录为通过候选：11 个页面、两个视口、22/22 HTTP 200、无横向溢出与 pageerror；主页和课程空态 CTA 各有双视口真实点击记录。它不签收完整 R1-001，也不恢复原 114 卡墙或原 R1-001 完整验收原件；两者继续 OPEN。价格页因未启动 commerce 而显示诚实降级状态，不扩展为 commerce 验收。

## 证据核验

- `it1/manifest.json` 列出 81 个证据文件。我按记录路径重新核对每个文件的字节数与 SHA-256，81/81 一致，无缺失或摘要不匹配。
- `it1/source-binding.json` 的 24 个源码与脚本摘要均与当前工作区文件一致；绑定的 HEAD 与审查基线一致。Web 与 Mobile 的认证 adapter、Gateway base URL、IAM 安全配置和观测脚本都在绑定列表内。
- 本地 `iam-service`、`api-gateway`、`content-service` 三个 target JAR 的 SHA-256 与 `environment.json` 一致。但本轮没有新的 Maven 构建回执，摘要只证明执行的 JAR 与记录的本地 target artifact 一致，**不能证明 JVM 字节码由该 HEAD 重新构建**。因此 IAM/CORS 运行探针只作为该 artifact 的运行证据；源码 CORS 结论另由当前绑定源码支撑。此限制不影响 Web/H5 真实 DOM 目标与当前前端源码一致的 FAIL 判定。
- `browser-auth-result.json` 记录四次真实注册表单尝试，均命中 `http://127.0.0.1:18070/api/v1/auth/register`；`auth-pages-result.json` 记录八次登录/重置表单尝试，目标分别为 Gateway 登录和重置 request。两份观测脚本均在请求发送前 abort，且没有读取、保存请求正文。错误提示只能说明保护拦截后的 UI 表现，不能当作后端业务拒绝。
- 同一 browser-auth 证据还记录了对 `https://127.0.0.1:18087/api/v1/auth/register` 的真实 TLS OPTIONS 探针：Web、H5 两个 origin 均返回 HTTP 200，但 `Access-Control-Allow-Origin`、`Access-Control-Allow-Credentials` 与 `Access-Control-Allow-Methods` 均缺失。当前 `IamSecurityConfiguration` 没有 CORS 配置，IAM 源码目录也没有其他 CORS 配置入口。由于运行探针使用的 JAR 没有本轮 fresh-build 绑定，这一项是已观察 artifact 的 CORS 缺口与源码配置缺口，不能升级为当前 HEAD 新构建产物的端到端证明。
- 我检查了 Web/H5 注册失败图、官网课程空态图与课程 CTA 跳转图。账号与密码区域已遮盖；画面与 DOM/JSON 记录对应。官网结果记录了 22 条页面结果全为 200、溢出 0、页面错误 0；`official-course-cta.json` 与其观测脚本记录了桌面和手机各一次点击课程空态 CTA、到达 Web 注册表单且未提交。该点击链属于 R1-001 的局部真实证据，不代表后续注册链已通过。
- `database-verification.json` 记录两套本轮新建 schema/user：IAM 与 content 分别迁移 17、28 项，账号数 0、公开 facet 数 0，grant 分别仅限各自 schema。没有新建 learner 或 assessment schema/服务；认证链失败后没有尝试将后续 R1-010 等卡写成通过。`privacy-scan.json` 报告对 12 个文本文件的检查通过；其结果没有列明逐文件清单，所以仅认可报告所述范围。敏感输入截图遮盖，证据没有记录 Token、Cookie、密码或私钥；秘密材料权限清单为目录 0700、文件 0600。
- `cleanup-verification.json` 记录 supervisor exit 0、owned children 0、固定 HTTP 端口监听 0，schema/user 保留。独立只读 `lsof` 检查 18070、18087、18088、18089、18091、18180、18182、18183 无监听；`ps` 检查记录的 6 个 PID 均无进程。没有清理或删除保留的测试 schema/user。

## IT-2 卡级证据边界

我复核了 R1-018、019、023、024、025、027、028 与 029 的报告和对应当前路由/界面代码。R1-029 的三个领域服务是在**同一个隔离测试 schema** 中依次迁移，并重命名 Flyway history 表以避免冲突；它不是 content、learner、assessment 三个独立 owner schema/user。该回放可作为对应领域数据/API 子集的候选行为证据，不能作为服务数据隔离或 IT-2 owner 架构签收。R1-025 则另有其自身的独立 content schema `r1_025_cnt_20261010_6e7dace4`，该种子证据不能与 R1-029 同库回放混同。

R1-029 记录 IAM 未启动、使用临时 JWKS，学习同意复检由本地 loop stub 提供，且完整浏览器链未执行；它的 26 PASS、3 NOT_RUN 不能作为 IT-2 全绿。其公开重测步骤记录的实际 404 是缺路由的已确认缺陷，不应保留为单纯 NOT_RUN。R1-024 只实现 assessment 内部重测；当前 Gateway 没有公开转发该路由，Web/Mobile 的按钮仍 disabled。R1-023 与 R1-019 也明确当前学习端跳过/逐题提交仍通过 B25 旧写口。R1-027 报告没有真实断网恢复，源码测试不能替代网络中断旅程。

## 后续门槛

先修复并重新验收 Web 与 Mobile 的直达 IAM TLS 认证传输，以及 IAM 对固定学习端 origin 的正确 CORS；随后由真实浏览器完成注册、成人门、必要同意、画像写入/读回和定级入口的连续链路，并逐步关联真实 IAM/learner owner 数据。IT-1 独立签收前不得开 IT-2。IT-2 还需使用真实 IAM 签发的 RS256 身份、独立服务 schema/user、默认开启的同意复检、可用公开重测入口，并以真实网络中断证明 checkpoint 恢复；契约差异与仍外露的旧写口也须关闭。此处只列验收门槛，不是产品实现或额外全平台全绿要求。
