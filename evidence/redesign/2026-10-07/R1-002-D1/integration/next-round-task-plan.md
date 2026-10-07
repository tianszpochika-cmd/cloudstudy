# D1后下一轮任务决策计划

2026-10-07。根审优先顺序已明确；此计划不授权实施或启动服务。D1已获 **ACCEPT_SCOPED_DELIVERY / SOURCE_SCOPED_PASS**，仅为 **SOURCE_SCOPED_PASS_NOT_WORKFLOW_ACCEPTANCE**；见[独立终审](../review/final-scope-review.md)。R1-002 PREPARATION_PARTIAL_NOT_READY；原114墙/原R1-001验收OPEN，不开R1-003～005/IT-2。

## 第一优先：Gateway public-key-only限定生产修复

问题已有实际生产加载类的离线证明：synthetic private RSA JWK被 `GatewayIamPublicJwkSource` 选择；harness public-only检查不能代替生产source拒绝。owner为Gateway/security，下一轮需先由根审具名授权以下最小候选范围：

- `services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayIamPublicJwkSource.java`。
- `services/api-gateway/src/test/java/com/englishflow/gateway/config/GatewayIamPublicJwkSourceTest.java`。
- 对应新轮公开证据目录与当轮CURRENT-PROGRESS/CHANGELOG；若probe/harness需要调整，先报告具体文件另签，不扩全局契约或依赖。

先定义并审核fail-closed语义：任何包含private材料的公开JWKS输入不得被选取/回传；优先显式拒绝，不以悄悄剥除字段制造生产拒绝证据。测试必须输入真实synthetic private-bearing RSA document，覆盖混合public/private、envelope/parser/kid与失败缓存行为，保留RS256、known/unknown kid、TTL/重新读取、malformed/文档上限与原安全不变量；不打印/持久化private JWK、不签JWT。是否整文档拒绝及错误分类由Gateway/security owner在task-spec具名确认。

本轮不得以旧target JAR代表新source。对具名源码快照执行当前Gateway构建/精确测试，记录命令退出、输入SHA、输出JAR SHA、实际加载生产class CodeSource及probe读回，重新签名/核验限定manifest。关闭的是本次public-key-only源级缺口与当前source→JAR绑定，不是业务注册或动态HTTPS。

## 后续：双HTTPS动态小范围另审

生产修复/当前构建绑定通过后，再提出具名动态文件清单和运行spec。必须分别观察SCG route client与独立JWKS JVM-trust client；TLS-01～08当前均NOT_EXECUTED，计划数不是PASS。固定18070/18087及127.0.0.1、同监督child handle、材料权限、source/artifact/ports绑定、可信窗口批准来源、退出/timeout/端口释放及恢复责任需先审。当前端口FREE/冷态不等于运行授权；不得借boolean flag、自带公钥或旧runner PID收养绕过。无注册/Token/DB/Flyway/Kafka，真实IAM新库运行另签。

原栈恢复owner、配置provider与有效artifact、IAM正常Flyway风险及15服务恢复验收另行确认。当前冷态不说明退出原因，也不证明原恢复bundle存在；不由harness擅自全栈启动/修复。

## D3：先身份决议，不实施

以[独立身份决策输入](../review/identity-next-decision.md)为来源，请IAM/learner/security/event/audit owner先决定：可信JWT `sub` 与 `owner_id`/alias claims优先及相等规则、两个learner resolver一致策略、legacy opaque `prn_`官方来源与持久owner分布的脱敏证明、alias/mapping版本及撤销、匿名注册actor含义和aggregate/payload关系。现冻结regex接受prn_+UUID仅是语法，不是语义或owner签收。

未定legacy事实保持UNKNOWN/OPEN，不根据当前source或synthetic fixture推断不存在。不改PrincipalId.toString/JWT/API/event/schema/owner数据，不开发codec/Outbox或迁移。需正式具名决议/ADR与兼容门禁，再另行授权实现。

追溯沿R1-002/BC-002/IC-052、FEAT-USR-001/PRD-ATOM-1044/V2-980-0359/0366、ARCH-GW/IAM/SEC/DATA/EVT/REL/OBS、ACT-P1-VISITOR/LEARNER/SYSTEM、JNY-P1-01、PAGE-P1-AUTH-*、07§3.1、INT-P1-001/002/017与E2E-INT-P1-001/002/017；这些为父链导航。下一轮须补具名RULE/PAGE/owner与当轮证据映射；准备PASS不签业务E2E。
