# 本机 batch12 授权复测可行性（只读核对）

时间：2026-09-23。范围：本机固定端口上的学习 Web、移动 H5、Gateway、IAM；本次只读访问健康和两个前端首页，查阅当前启动脚本与同意策略源码。没有读取已有账号密码、浏览器存储、Cookie 或 JWT，没有注册账号、调用成人 Gate/同意写接口，也没有修改共享服务、数据库或私有 Docker 栈。

| 检查 | 结果 |
| --- | --- |
| Gateway `127.0.0.1:18070` readiness | HTTP 200 |
| IAM `127.0.0.1:18087` readiness | HTTP 200 |
| 学习 Web `127.0.0.1:18180/` | HTTP 200，首页 HTML 引用 `/@vite/client` 与 `/src/main.ts`，是本机开发服务入口 |
| 移动 H5 `127.0.0.1:18183/` | HTTP 200，首页 HTML 引用 `/@vite/client` 与 `/src/main.ts`，是本机开发服务入口 |

标准本机运行脚本 `scripts/runtime/run-v2-services.mjs` 为 IAM 增加 `local` profile；IAM `application.yaml` 的同意来源默认 `auto`，`IamRuntimeConfiguration.consentPolicyPort` 在 `local/test` 的 `auto` 分支使用 `StaticConsentPolicy.localCandidate(true)`。这份候选文档只是本地测试材料，不能证明已批准的正式法律全文与版本。当前本机 IAM 进程的实际同意来源没有经公开接口核验，亦没有可信的正式发布记录。因此即使能在本机用随机成人账号完成注册、成人 Gate 和勾选，也只能证明**本地候选策略下的功能路径**，不能作为正式法律版本上的授权验收。

本次没有制造或借用账号。batch12 移动 H5 登录后 `today` 深链跳回和学习 Web B11 的**合法账号授权空态/隐藏控件**仍未在本机实测。前端开发服务是否热载入当前源码可由 Vite 入口推断，但仅凭首页 HTML 不能证明 IAM Java 运行包与当前源码一致。下一次正向验收需有已批准且可核对的 ACTIVE 法律文档版本、可使用的合成成人账号，以及 IAM 与前端运行版本证明；测试完成后再精确清理该账号的全部 owner 事实。

可复核的独立 Docker 证据仍为 [第十二批隔离报告](docker-isolated-full-runtime.md)：移动根页/深链 0 pageerror，学习 Web B11 匿名 9/9 转登录；这些结果没有被提升为授权业务通过。
