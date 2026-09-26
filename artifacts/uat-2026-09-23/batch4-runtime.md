# 第四批本地集中部署与回归（2026-09-23）

本批涵盖 learner、content、assessment、admin-ops、analytics、audit、workflow 七个 Java owner；先完成各自定向测试，再一次性构建和重启本任务启动的 16 服务本地运行栈。构建最初因 Windows 锁住正在运行的 learner JAR，在 Spring Boot repackage 阶段失败；当时服务仍健康。先将旧 16 个 JAR 保存在 `C:\Temp\cloudstudy-uat-runtime-backup-20260923-batch4`，再停掉经父进程和完整路径确认的本任务 Java runner 与其 16 个子进程，整批重建七个服务均成功。此过程没有停止五个 Docker 基础设施容器或四个前端进程。

13:12 CST 新 runner PID 17232。运行清单中的 **16/16 Java readiness/health = HTTP 200**；四端固定本地端口 18180、18181、18182、18183 首页均为 200。七个可运行 JAR 的 SHA-256：

| 服务 | SHA-256 |
| --- | --- |
| learner | `37b5d08fbabb752202a43cd77efca2f035c95742e3cece141f1ed963313335f9` |
| content | `0159887568c5f5339d9c37edc28cc5a99a536c03e3af2e2ec4895e0240fe3f13` |
| assessment | `a856acddb0b5d4efac0c8469e3276b1ed8cc932f98e3000a63eb190bbbc43e2c` |
| admin-ops | `d466cd651ddcaabfc8b0869537023b75d997577af956a7badcb49cdf9547c87e` |
| analytics | `6b7e1a99cb0cb74d992984df687ef1394cd94bc2ccccd5e9f255f1c35246db56` |
| audit | `0a08db31885e183142ef71efcda2dba46d60779eb5c992556b079c095883ab72` |
| workflow | `b95773af8226d6571a90a2398eaece31e98c64de34cbf0f763b50c0cdc147888` |

合成成人对学习 Web 资料页做目标编辑，唯一写请求为 `PUT /api/v1/learner/targets` 200，后续 GET 读回 `WORKPLACE_DAILY/B2/45`，版本 2→3；无无效的资料 PATCH，页面只在读回后提示成功。两次独立账号均已清理；详见 [资料目标回归](learner-profile-settings.md)。

合成只读 staff 对管理工作台和订单页进行重测，旧运行时的指标 200/空已变成明确 503 `PROJECTION_READ_FAILED`；页面显示读失败提示、刷新可用、无页面异常，1280/390 无横向溢出；订单读 200/1 条，但该行是旧 `local-fixture`，不能作为真实订单。账号已精确停用，见 [批次浏览器证据](admin-two-pages-batch4/evidence.json)。损坏的老指标投影未被改写或伪造，真实指标恢复仍待修复。

本次只是本机运行栈；此前 19/19 Docker 应用镜像仍是旧源码，尚未在容器中重建并启动复测。服务健康和局部读写不代表完整业务验收。
