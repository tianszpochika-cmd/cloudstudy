# R1-001 安全只读启动配置（解阻准备，不启动后台）

> 范围：仅 R1-001 公开只读验收。不得修改 `scripts/runtime/run-v2-services.mjs`
> 共享默认值；本文件给出显式覆盖值，由主审签 READY 后再用于启动。
> 不输出任何凭据；密码一律引用 `MYSQL_OWNER_PASSWORD` 占位，由启动环境注入。

## 1. 固定端口（config/local-ports.json 唯一事实源）

| 服务 | 端口 | 绑定 |
|---|---|---|
| api-gateway | 18070 | 127.0.0.1 |
| content-service | 18089 | 127.0.0.1 |
| commerce-service | 18096 | 127.0.0.1 |
| official-site-dev | 18182 | 127.0.0.1 |
| learner-web-dev | 18180 | 127.0.0.1 |
| mobile-h5-dev | 18183 | 127.0.0.1 |

MySQL 13306 / Redis 16379 / Kafka 19092 仅复用现有 infra 容器，不重建。

## 2. 本卡显式覆盖（关闭写后台任务与自动迁移/seed）

```sh
CONTENT_EVENT_RELAY_ENABLED=false
CONTENT_EVENT_CONSUMER_ENABLED=false
CONTENT_FLYWAY_ENABLED=false
COMMERCE_FLYWAY_ENABLED=false
# content 定时发布 relay（如存在 content.schedule.enabled 开关）保持默认关闭，
# 不显式置 true；commerce 支付/真实渠道保持默认关闭。
```

依据（只读核对，未改源码）：

- `services/content-service/src/main/resources/application.yml:7` Flyway `enabled: ${CONTENT_FLYWAY_ENABLED:false}`；
- `application.yml:80` relay `enabled: ${CONTENT_EVENT_RELAY_ENABLED:false}`；
- `application.yml:95` consumer `enabled: ${CONTENT_EVENT_CONSUMER_ENABLED:false}`；
- `ContentEventRelayConfiguration.java:37` relay 配置类 `@ConditionalOnProperty(... relay, enabled=true)`；
- `ContentInboundConsumerConfiguration.java:44` consumer 配置类同理；
- `ContentServiceConfiguration.java:300` 定时发布 relay `@ConditionalOnProperty(prefix="content.schedule", name="enabled", havingValue="true")`（默认关闭）；
- `services/commerce-service/src/main/resources/application.yaml:13` Flyway `enabled: ${COMMERCE_FLYWAY_ENABLED:false}`；
- commerce 公开 GET 路径为纯读（`CommerceController.java:52-54`），支付 `enabled: false`（`application.yaml:80`）、真实渠道 `false`（`:82`）；
- runner 默认会把 relay/consumer 置 true（`run-v2-services.mjs:197/202`），因此本卡启动必须显式覆盖为 false；这是对默认值的调用方覆盖，不是修改共享启动器。

## 3. 数据来源与 schema（只读，不清库、不迁移、不 seed）

- content schema `content_service` / jdbc 用户 `svc_content`；commerce `commerce_service` / `svc_commerce`（`config/b17-runtime-services.json:17/24`）。
- 运行身份为 DML-only owner 憑据占位；实际密码由环境注入，不记入证据。
- 本阶段仅发公开 GET（content 直连、Gateway 两条公开路由、commerce 公开 catalog、BFF 聚合）；不发任何写请求。
- 当前共享库已有 DEMO 7 课程事实（`projectionVersion=4, contentEpoch=4`）；合法空事实缺失，见解阻报告 §4。

## 4. READY 后预检命令（主审签 READY 后执行，本阶段不启动后台）

```sh
node scripts/check-fixed-ports.mjs
CONTENT_EVENT_RELAY_ENABLED=false CONTENT_EVENT_CONSUMER_ENABLED=false CONTENT_FLYWAY_ENABLED=false COMMERCE_FLYWAY_ENABLED=false pnpm services:run -- --service content-service,commerce-service,api-gateway --timeout-ms 180000
# 随后核对 /actuator/health/readiness 与公开 GET 200，再跑版本7采集器；结束即停。
```
