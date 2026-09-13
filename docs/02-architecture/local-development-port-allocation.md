# 本地开发固定端口约束

> 版本：v1.1
> 建立日期：2026-08-20  
> 机器可读事实源：config/local-ports.json
> v2 说明：当前表保留 v1 兼容开发端口，同时已为 Platform 0 的 `api-gateway` 登记 18070。新的领域服务进入实现前，仍必须先在本表与 `config/local-ports.json` 登记固定端口、协议、Phase、环境变量、启动脚本和 Docker 映射；在此之前不得让前端自行直连新服务。

## 1. 目的

所有 Agent 启动语学星本地服务时，必须使用本文件和 config/local-ports.json 中的固定端口。端口被占用时必须停止占用进程并报告，不得自动递增、随机选择或复用其他项目端口。

本机在 2026-08-20 核验时，下表端口均未处于监听状态；这不是永久保证。每次启动前执行：

    pnpm ports:check

## 2. 固定端口表

| 服务 | 固定端口 | 启动形态 | 备注 |
|---|---:|---|---|
| API Gateway | 18070 | Spring Cloud Gateway | v2 外部 API 统一入口；仅做路由、边界策略、请求上下文和观测，不承载领域写入 |
| IAM Service | 18087 | Spring Boot | 平台自有账号密码认证中心；Phase 1 签发短时 RS256 JWT、发布 RSA JWKS，管理 Refresh Token、设备、会话、权限和撤销；ES256 需后续 ADR 与契约/JWKS key schema、密钥管理和运行实现同步后才可引入 |
| Learner Service | 18088 | Spring Boot | v2 学习者档案、目标、偏好和 Onboarding read model；独立 schema |
| Content Service | 18089 | Spring Boot | v2 内容版本、版权、审核发布和公开读投影；独立 schema |
| Learning Service | 18090 | Spring Boot | v2 学习计划、SRS、进度、复习队列和掌握度投影；独立 schema |
| Assessment Service | 18091 | Spring Boot | v2 测评会话、作答、规则判分和报告快照；独立 schema |
| Media Service | 18092 | Spring Boot | v2 媒体元数据、manifest、rendition、版权撤回和短时签名 URL；独立 schema |
| Notification Service | 18093 | Spring Boot | v2 通知偏好、投递重试、离线同步、冲突和恢复；独立 schema |
| Gamification Service | 18094 | Spring Boot | v2 可信学习事件驱动的 XP、Streak、奖励账本和赛季事实；独立 schema |
| Social Service | 18095 | Spring Boot | v2 自习室、租约、排行榜投影、预设互动和举报治理；独立 schema |
| Commerce Service | 18096 | Spring Boot | v2 SKU、价格快照、订单、权益、支付 Gate、退款和对账；独立 schema |
| Admin Ops Service | 18097 | Spring Boot | v2 脱敏投影、审批命令、客服工单和审计关联；不拥有领域事实 |
  | Analytics Service | 18098 | Spring Boot | v2 脱敏事件 allowlist、指标投影和重算；独立 schema |
  | Audit Service | 18099 | Spring Boot | 平台 append-only 审计事实摄取与合规留存；独立 schema；仅服务边界验证 |
  | Workflow Service | 18071 | Spring Boot | Saga 状态、定时任务、补偿、DLQ 与人工恢复；不跨域写表（P1R-M2-006 登记） |
| Core API | 18080 | Spring Boot | v1 兼容后端；Gateway 接入前的本地回滚入口 |
| AI Orchestrator | 18081 | FastAPI | Phase 2，Phase 1 禁用 |
| Content Worker | 18082 | Worker health | 可选 |
| Analytics Worker | 18083 | Worker health | 可选 |
| Job Runner | 18084 | Worker health | 可选 |
| Notification Worker | 18085 | Worker health | 可选 |
| Realtime Voice | 18086 | RTC signaling | Phase 2，Phase 1 禁用 |
| Learner Web dev | 18180 | Vite | 学员端 |
| Admin Web dev | 18181 | Vite | 管理后台 |
| Official Site dev | 18182 | Nuxt | 官网 |
| Mobile H5 dev | 18183 | uni-app | 移动端 H5 |
| Mobile App bundler | 18184 | uni-app | 原生调试需要时使用 |
| UI/UX mockups | 18185 | Python static server | 设计稿预览 |
| Learner Web preview | 18190 | Vite preview | 预览端口 |
| Admin Web preview | 18191 | Vite preview | 预览端口 |
| Official Site preview | 18192 | Nuxt preview | 预览端口 |
| Mobile H5 preview | 18193 | uni-app preview | 预览端口 |
| MySQL host | 13306 | Docker host mapping | 容器内仍为 3306 |
| Redis host | 16379 | Docker host mapping | 容器内仍为 6379 |
| Kafka-compatible broker | 19092 | Docker host mapping | v2 事件平台外部 listener；容器内 broker listener 为 9092 |
| RabbitMQ AMQP | 15689 | Docker host mapping | v1 兼容事件/任务依赖；容器内仍为 5672 |
| RabbitMQ management | 15690 | Docker host mapping | v1 兼容管理端；容器内仍为 15672 |
| MinIO API | 19000 | Docker host mapping | 容器内仍为 9000 |
| MinIO Console | 19001 | Docker host mapping | 容器内仍为 9001 |
| Mailpit SMTP | 18025 | Optional Docker service | 容器内通常为 1025 |
| Mailpit UI | 18026 | Optional Docker service | 容器内通常为 8025 |
| Prometheus | 19090 | Optional observability | |
| Grafana | 19091 | Optional observability | |
| Jaeger UI | 16689 | Optional observability | |

## 3. 强制规则

1. 所有本地 HTTP 服务只绑定 127.0.0.1；需要真机访问时必须走明确的设备调试配置，不得默默改成 0.0.0.0。
2. Vite、Nuxt 和 uni-app 启动脚本使用固定端口检查器与 strictPort；端口冲突直接失败。
3. Docker 只允许把宿主机端口映射到本表端口；容器内部端口可以继续使用 MySQL 3306、Redis 6379、MinIO 9000/9001 等标准端口。
4. 后端连接本机容器使用 127.0.0.1 和宿主机映射端口；容器内服务互连使用服务名和容器端口。
5. 新增服务必须先登记 service key、固定端口、协议、Phase 和容器映射，再修改启动脚本。
6. v2 Gateway 是外部入口；未登记 Gateway 固定端口前，不能把客户端配置切换到领域服务直连。Kafka 事件平台也必须先登记 broker、schema registry（如采用）和 UI 的固定端口。
7. 禁止使用 5173、3000、8080、3306、6379、9000、9001 作为语学星宿主机端口。
8. 端口变更必须同步 config/local-ports.json、.env.example、相关启动配置和本文件，并在 CHANGELOG 记录。

## 4. 常用地址

- Learner Web：http://127.0.0.1:18180
- Admin Web：http://127.0.0.1:18181
- Official Site：http://127.0.0.1:18182
- API Gateway：http://127.0.0.1:18070/api/v1
- Learner Service：http://127.0.0.1:18088/actuator/health（仅服务边界验证；客户端不得直连）
- Content Service：http://127.0.0.1:18089/actuator/health（仅服务边界验证；客户端不得直连）
- Learning Service：http://127.0.0.1:18090/actuator/health（仅服务边界验证；客户端不得直连）
- Assessment Service：http://127.0.0.1:18091/actuator/health（仅服务边界验证；客户端不得直连）
- Media Service：http://127.0.0.1:18092/actuator/health（仅服务边界验证；客户端不得直连）
- Notification Service：http://127.0.0.1:18093/actuator/health（仅服务边界验证；客户端不得直连）
- Gamification Service：http://127.0.0.1:18094/actuator/health（仅服务边界验证；客户端不得直连）
- Social Service：http://127.0.0.1:18095/actuator/health（仅服务边界验证；客户端不得直连）
- Commerce Service：http://127.0.0.1:18096/actuator/health（支付 Gate 默认关闭；仅服务边界验证；客户端不得直连）
- Admin Ops Service：http://127.0.0.1:18097/actuator/health（默认拒绝；仅服务边界验证；客户端不得直连）
  - Analytics Service：http://127.0.0.1:18098/actuator/health（只消费 allowlist 脱敏事件；客户端不得直连）
  - Audit Service：http://127.0.0.1:18099/actuator/health（append-only 审计摄取；客户端不得直连）
- Core API：http://127.0.0.1:18080/api/v1
- MinIO Console：http://127.0.0.1:19001
