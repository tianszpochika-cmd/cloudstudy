# iam-service

`iam-service` 是语学星 v2 的独立 IAM 领域边界，目标运行时为 Java 25、Spring Boot 4.1.1 和 Spring Framework 7.x。当前实现是 B8 的 provider-neutral 代码层基础，不能被描述为生产级 IAM/RBAC 或已完成的登录系统。

## 本轮实现

- 独立 Maven 服务、Java 25 compiler/enforcer、固定 loopback 默认地址 `127.0.0.1:18087`、Actuator health/liveness/readiness、优雅停机和 W3C/OTel 配置。
- 标准 OIDC/OAuth 2.1 authorization-code + PKCE client port：服务端生成并保存 `state`、`nonce`、`code_verifier`，仅输出 `S256 code_challenge`；回调校验一次性 state、精确 redirect allowlist、PKCE 内部一致性、provider issuer 和已验证 identity nonce。
- `OidcProviderAdapter`、`JwksKeySetPort`、`ProviderSessionPort` 是 provider-neutral 端口。代码没有真实网络 adapter、client secret、供应商密钥、OAuth/OIDC Token Server 或自签 token 逻辑。
- external issuer + subject 到平台 `principalId` 的不可变映射；Phase 1 `platform` tenant 和 owner 由服务端从 principal 派生。请求中的 tenant、owner、role override 在设备、consent 和成人 Gate 边界被拒绝。
- 设备注册和 kick-out；会话只保存 refresh credential 的 SHA-256 digest，支持 provider 委托的 refresh rotation、撤销、并发锁和 replay fail-closed。IAM 不产生 provider access/refresh token。
- consent policy version、接受/撤回不可变快照和结构化审计 decision。审计属性禁止 token、secret、password、verifier、authorization-code、refresh 等敏感字段。
- Phase 1 成人 Gate：必须同时有服务端可信年龄证据（已验证 IdP claim 或独立可信服务 attestation）和明确成人确认；缺失、未成年、客户端年龄/生日或 authority 字段都拒绝。Gate 不拥有也不创建 child、guardian、K12 或 minor payment facts。

## 明确未完成的 Gate

- `G-IDP` 尚未通过：没有真实身份供应商连接、issuer 配置、JWKS endpoint、rotation 演练、部署 workload identity 或密钥管理。
- 未实现 OAuth/OIDC token server；未生成平台 access token、refresh token、JWT 或 client secret。
- 尚未声明 RBAC/ABAC 生产完成；B8-IAM-003 的 PDP/PEP、策略包、撤销缓存和服务联调仍待后续任务。
- 当前内存 adapter 仅用于领域测试和本地逻辑验证。生产环境必须替换为 IAM 独占 schema、加密/密钥托管、过期存储、审计 sink 和经 Gate 批准的 provider adapter；不得写入 `core-api` 或其他服务表。

## 本地运行

服务默认只绑定 loopback。`18087` 是本服务在 `config/local-ports.json` 登记的固定本地默认值；完整本地栈运行前必须显式确认没有冲突：

```powershell
$env:IAM_SERVICE_PORT = "18087"
$env:IAM_SERVER_ADDRESS = "127.0.0.1"
mvn -f services/iam-service/pom.xml -o validate test
mvn -f services/iam-service/pom.xml spring-boot:run
```

探针：

- `/actuator/health`
- `/actuator/health/liveness`
- `/actuator/health/readiness`

没有业务 controller 暴露登录、回调或 token endpoint；调用方应通过后续契约和 Gateway 接入，而不是直连内部领域对象。

## 验证说明

推荐在 Java 25 + Maven 环境执行：

```text
mvn -f services/iam-service/pom.xml -o validate test
node --test tests/b8/iam-service.test.mjs
```

Node 测试只验证源码契约和安全边界，不能冒充真实 IdP、JWKS rotation、浏览器回调、跨进程 session store 或部署身份运行态证据。如果当前机器没有 Java 25/Maven，应在交付记录中明确该缺口。
