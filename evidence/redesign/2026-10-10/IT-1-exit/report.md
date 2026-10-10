# IT-1 出站核对

日期：2026-10-10。分支：`dev-redesign`。范围只核注册 → 成人门 → 三条必要同意 → 画像 → 现有定级入口。没有改业务 Java/Vue，没有改 `CURRENT-PROGRESS.md`，没有 commit，没有 push。没有开始 R1-018 或任何 IT-2 卡。学习同意复检没有关：父进程环境没有 `LEARNER_CONSENT_RECHECK_ENABLED`，learner 运行配置写的是 `learner.consent-recheck.enabled=true`。

## 结论

同一轮干净专库上的 HTTP 链 **10/10 PASS**。已具备学习资格的主体访问现有定级读口是 **200**，不是 401/403。学习端路由里已有 `assessment` 页。浏览器只打开了注册页并截图，**不是**点击注册到定级的全链，浏览器全链不记 PASS。

这不是新的定级会话，也不是 IT-2。读口返回的是没有进行中会话的 `EMPTY`。

## 库与进程

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，compose project `yuxuexing-local`，service `mysql`，`127.0.0.1:13306`，healthy）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。

有效一轮专库（跑完已删）：

- `r1_it1_exit_20261010_iam_49bfbb89`
- `r1_it1_exit_20261010_lrn_49bfbb89`
- `r1_it1_exit_20261010_asm_49bfbb89`
- 用户 `r1_it1_exit_20261010_49bfbb89`

IAM `17,0`，learner `12,0`，assessment `8,0`。开跑时 `iam_account=0`。端口：IAM 18087（自签 TLS，只绑 127.0.0.1），learner 18088，assessment 18091，网关 18070，学习端 18180。网关用本项目 `local` 剖面，把 `GET /api/v1/assessment/placement/start` 转到 assessment 的现有 B25 读口。这些进程都是本轮启动的，结束后已停。结束后四个 Java 端口无监听，专库和用户计数都是 0，学习端 18180 也已停。

第一轮探针在服务健康之后、注册请求之前失败：Node `fetch` 没有信任本轮自签证书，注册没有打到 IAM。那一轮专库已删、进程已停，不记入产品 FAIL。下面的表是换了带 CA 的 HTTPS 客户端之后、新专库上的第二轮。

## HTTP

同一账号按顺序调用。同意签完后重新登录，是为了拿到 `consent_state=GRANTED` 的访问令牌；登记时的令牌仍然没有学习资格。

| 步骤 | 状态 | 结果 |
|---|---|---|
| 空库 Flyway | IAM 17/0，learner 12/0，assessment 8/0，账号 0 | PASS |
| 注册，令牌没有学习资格 | 201。`adult_gate=NOT_EVALUATED`，`consent_state=UNKNOWN`，4 项基础权限，学习权限 0 | PASS |
| 成人门 | 200 `PASSED` / `ELIGIBLE` | PASS |
| TERMS / PRIVACY / ADULT_LEARNING | 200 / 200 / 200，均为 `ACCEPTED` | PASS |
| 同意后再登录 | 200。`adult_gate=PASSED`，`consent_state=GRANTED`，含 `learner.target.write` 与 `assessment.session.read` | PASS |
| PUT `/api/v1/learner/targets` | 200。`goalCode=COLLEGE_CET`，30 分钟，`B1`，`stateVersion=1`，`targetVersion=1` | PASS |
| GET 读回 | 200。规范码 `COLLEGE_CET`，不是库内历史码 | PASS |
| 学习端路由 | `apps/learner-web/src/router/index.ts` 有 `path: '/assessment'`、`name: 'assessment'`、`AssessmentPage.vue` | PASS |
| 定级读口（服务直连） | `GET /internal/v1/assessment/placement/start` **200** `{"status":"EMPTY","contentLocale":"en-US"}` | PASS |
| 定级读口（学习端所走的网关） | `GET /api/v1/assessment/placement/start` **200**，正文同上，不是 401/403 | PASS |

结构化收据：`http-result.json`。失败列表长度 0。

定级入口按这次口径是可到达：路由在，合格主体打现有读口得到 200 而不是 401/403。`EMPTY` 表示还没有定级会话。没有创建 `POST /placement/sessions`，也没有把这写成定级已完成。

## 浏览器

学习端 dev server 在不改代码的情况下启动于 `http://127.0.0.1:18180`。本机 Google Chrome 无界面打开 `/register`，截图在 `evidence/redesign/2026-10-10/IT-1-exit/register.png`。页面上有「创建账号，开始学习」「注册并继续」「仅面向 18 岁以上成人与大学生；注册后需要确认年龄与必要说明。」没有用浏览器点完注册、成人门、同意、画像和定级。浏览器全链 **未验证**，不记 PASS。

## 未做

- 没有停掉 learner 再启动后做第二次画像读回。
- 没有改进度页，没有签收流程之外的独立终审记录。
- 没有开始 IT-2。
