# R1-002 current runtime proposal

日期 2026-10-08；候选待 root 具名批准，当前只读、0 listener/0 DB writes/0 signals。

来源：AGENTS §0/2.2/2.3/3/4；dev-plan-R1 R1-002（BC-002，201+会话，无学习能力）；business-chains BC-002（identifier+密码+设备 TLS 直达 IAM）。追溯 FEAT-USR-001/PRD-ATOM-1044/V2-980-0359/0366、ARCH-GW/IAM/SEC/DATA/REL/OBS、ACT-P1-VISITOR、JNY-P1-01、PAGE-P1-AUTH-REGISTER、IC-052、RULE 成人 Gate/必要同意前权限收回、INT/E2E 注册受限会话。

实际只读事实：本项目 yuxuexing-local-mysql-1/mysql:8.0、redis:7-alpine、kafka:3.9.2、minio 容器 healthy，loopback固定映射。18070/18087/18088 FREE。容器已 Up 18 分钟，不能把昨天 Up25h 或旧15服务记录当当前。其他项目 Docker 初始化进行中：不 restart Docker、不 compose down/prune、不 signal/stop任何既有container。

## 根审可批准最小具名 scope

1. `scripts/redesign/r1-002/business-runtime.mjs` 与 `business-runtime.test.mjs` 新增受控 IAM/Gateway/learner 三child监督；仅固定注册18087/18070/18088（若learner PEP纯token足以403，可不创建learnerDB、不启任何其他服务）。Node crypto 仅消费公开 JWKS 验RS256；mysql stdin仅操作本次 schema 的 create/read/count/rollback probe；不新增 Java helper。不改生产契约/source/身份/Outbox。
2. Git外本次独立0700父目录（新mkdtemp名含r1-002-20261008）与0600文件：TLS self-signed loopback材料、IAM signing key或显式local ephemeral、随机独立replay/fingerprint secrets、专属测试DB账号随机password、受保护Spring config与Java argfile；私值/密码/token/cookie/raw identifier不输出到Git证据。原Windows材料不读取/搬迁。
3. 仅本项目MySQL container内官方mysql CLI。使用已合法提供的container root config在container shell内引用已有MYSQL_ROOT_PASSWORD，stdout只返回SELECT1及版本，绝不dumpenv/argv/credential。先查本次随机schema/account不存在；CREATE DATABASE `r1_002_20261008_<random>`、CREATE USER本次`r1002_<random>`、只授该schema必要DDL/DML（IAM启动Flyway需要DDL），不给全局、其他schema或GRANT权。schema名与用户名只在外部config，不引用iam_service既有事实。通过docker exec stdin送随机SQL，不在argv放password。
4. IAM fresh current-Java25 build（需具名输入SHA/command exit/JAR SHA）；外部config import启用local、durable IAM persistence、schema/JDBC精确匹配、Flyway true、V13 writers-drained true（只针对此空库证明无旧writer，不用于既有iam_service切换）、Secure=true、原issuer `http://127.0.0.1:18087` 与TLS传输分开、ephemeral key local合法、稳定独立idempotency secret、非prod consent local-candidate（明确本地测试策略，不声称发布政策）。正常现有V1…V18迁移，不repair，不改旧DB。先SQL读Flyway success/版本及account/session=0。
5. 同监督真实child启动IAM 127.0.0.1:18087 HTTPS，健康检查+public JWKS检查（仅公钥）；直接HTTPS POST IAM `/api/v1/auth/register`，WEB_COOKIE+unique幂等键，合成identifier/随机password/device。必须201、Cache-Control no-store、HttpOnly/Secure/SameSite cookie、body refreshToken空、有效RS256 AccessToken。token仅内存；验RSA signature、iss/aud/expiry、eligibility、permissions无学习权限；SQL读回专属库1账号/主体/设备/session及注册审计，不归档PII/passwordhash/token。
6. 启Gateway 127.0.0.1:18070（当前受审newJAR receipt）回源HTTPS IAM；SCG route CA新前缀、独立JWKS WebClient JVM truststore分链验证：GET gateway public JWKS→200代表SCG HTTPS，GET gateway `/api/v1/iam/principal/me` with memory token→200受限资格代表真实独立JWKS HTTPS+验证。Gateway不接收registration password。启动learner固定18088独立PEP验证同一restrictedJWT后GETprofile→403；可选择现有内存领域adapter仅证明拒绝到adapter前，无持久学习事实验收。任何owner_id/prn_解析冲突如使401/500则具名报差量，不假称403、不迁移身份。
7. 如根审要求事务回滚证据，专用库only DROP/RECREATE审计故障trigger阻断synthetic第二注册，然后证明账号/session/设备/幂等success计数未增长，恢复仅该trigger；若既有测试已足够可先不做。Outbox/Kafka/下游学习画像不属R1-002卡明文验收；现注册source无跨服务publisher，保持后续OPEN，不新增跨服务事实。
8. 同监督child handle校验出生身份后graceful stop仅本次三个children；wait退出/端口释放。绝不kill端口或收养PID。安全暂停保留Git外专用schema/config（owner范围受限），日志已脱敏；可由root指定清理本次专属schema/account，但不自动Drop或触碰infra。若基础设施被其他agent重启或端口占用，停止依赖步骤并报告；不重启infra、不选替代端口、不扩大恢复15服务。

## 状态界限

当前注册/DB/TLS动态均 NOT_EXECUTED。ROOT approval是本轮scope/window审批，用户已要求继续002完成后文档更新安全暂停，无需重复询问human每阶段；历史D1的D2禁止只约束当轮旧入口，不是本轮永久阻塞。本spec不自签准入、不把healthy或portFREE当授权。root批准后先实施受控工具并独立审清单，再执行同一监督程序。执行证据在本目录，shared progress/CHANGELOG由root维护。

## 首轮执行后 JDBC 配置修正（root 已具名授权）

首轮 `runtime-results-51ca8300.json` 保存 FAILED 原样：注册201、零基线、持久关联、RSA3072、Cookie、回滚、Gateway双HTTPS与隔离信任负例通过；最后 learner 启动失败。脱敏错误为 `UnsatisfiedDependencyException`，`learnerHttpController → learnerTargetPinService` 缺 `org.springframework.jdbc.core.JdbcTemplate`。来源 `LearnerServiceConfiguration.learnerTargetPinService` 是无条件JDBC bean；`LearnerPersistenceConfiguration` 仅 jdbc 模式提供它，disabled/memory 不可替代。没有Docker故障/生命周期动作。

本次只修专项工具config：新 IAM clean schema 与独立 `r1_002_learner_20261008_<12hex>` 新 schema/`r1002l_<12hex>` 独立随机账号，只有其自身owner schema DDL/DML，无跨owner授权；learner正常V1～V12 Flyway迁移、无repair、无IAM或其他owner写入。私密 `learner-runtime.properties` 显式JDBC/schema/TLS JWKS配置，18088固定，最终只验直接服务侧403。首轮已注册IAM schema保留，不清空重装。所有读回是本服务schema逻辑关联，不声明数据库已存在物理FK约束。Nodecrypto/mysqlstdin实现，不新增Java helper。
