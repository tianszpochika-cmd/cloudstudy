# 第十批本机与隔离 Docker 回归（2026-09-23）

## 批次范围

本批集中更换本机 Gateway、IAM 可执行 JAR；其他 14 个 Java 服务保持原运行包。四个 Docker 镜像（Gateway、IAM、学习 Web、移动 H5）集中构建，再只替换私有 Compose 项目中的对应容器。共享基础设施、四个本机前端服务和其他私有容器未因本批停止或重建。镜像标签为 `583ab627-uat-batch10-202609231841`；它对应当时未提交的工作树快照，不等同于可复现 Git 版本。

## 已实测结果

| 范围 | 结果 | 证据边界 |
| --- | --- | --- |
| 本机 Java | 固定端口的 16/16 服务健康入口返回 200；Gateway 与 IAM JAR 在停止本任务启动的 runner 后打包并重启。 | 进程就绪不代表领域链路通过。 |
| 本机离线包 GET | [38/38 Gateway/owner 实际请求](offline-package-gateway-live.md)通过：移动 Origin 的 GET 预检与实际响应 200，匿名 401、成人 Gate 前 403、两名受控成人 200/空列表；五条写路径继续拒绝。 | 99 个合成已发布包已精确隔离，真实下载/分片/断网恢复仍未验。 |
| 私有 Docker 栈 | [19/19 私网入口](docker-isolated-full-runtime.md)返回 200；第十批仅更换四个目标容器。Gateway 离线包匿名 404→401、移动预检 403→200。 | 无宿主机发布端口；正式 ACTIVE 同意文档为空，无法签发真实成人登录态。 |
| IAM 空库拒绝 | 私有 MySQL 中注册/登录五种尝试均返回策略 503、无 token；账号 9→9、设备 10→10、会话 10→10、幂等记录 11→11。[原子性证据](docker-isolated-iam-atomicity.json) | 证明失败没有遗留写入，不能证明正式法律版本发布后的正向注册。 |
| IAM refresh 回滚 | 私有真实 MySQL 的策略失败后 rotation 不变、旧 refresh 可重试、幂等 claim 为 0；再次重试可正常轮换。[回滚证据](docker-isolated-iam-refresh-rollback.json) | opt-in JDBC 场景；完整设备/浏览器会话生命周期仍需正向验收。 |
| 四端浏览器入口 | 私有 HTTPS Chromium 11/11 页面 HTTP 200、JWKS CORS 11/11 为 200、无水平溢出。官网、学习 Web、管理 Web 及移动登录页 0 pageerror/console error。[浏览器证据](docker-isolated-browser/evidence.json) | 移动根页在 1280/390px 各有 2 次自动加载异常：H5 全局 `uni` 缺 `navigateTo`。不能把移动首页判为通过。 |

移动异常经[只读运行时探针](docker-isolated-browser/mobile-runtime-types-batch10.json)确认：生产 H5 的全局 `uni` 对象存在，但导航、请求、存储等方法均未暴露。第九批仅修复了最先触发的同步存储错误；本批把后续导航缺口暴露出来。源码后续已改为在 H5 初始化时接入 uni-app 模块 API，并保留浏览器导航的受限防护；这一改动**晚于第十批镜像**，须由下一批独立镜像和浏览器复测确认。

## 发布判定

本批关闭了离线包只读入口、CORS 和 IAM 空库半提交三项局部问题；**56 个 PAGE-P1 页面族的全功能 PASS 仍为 0**。受保护正向业务受正式同意文档和真实内容/媒体事实阻断，管理写链、首日计划、技能练习、支付、隐私和原生端另有缺口。判定与后续依赖仍以[覆盖台账](coverage-ledger.md)和[总索引](README.md)为准。
