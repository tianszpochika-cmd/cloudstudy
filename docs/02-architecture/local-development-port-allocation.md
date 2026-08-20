# 本地开发固定端口约束

> 版本：v1.0  
> 建立日期：2026-08-20  
> 机器可读事实源：config/local-ports.json

## 1. 目的

所有 Agent 启动语学星本地服务时，必须使用本文件和 config/local-ports.json 中的固定端口。端口被占用时必须停止占用进程并报告，不得自动递增、随机选择或复用其他项目端口。

本机在 2026-08-20 核验时，下表端口均未处于监听状态；这不是永久保证。每次启动前执行：

    pnpm ports:check

## 2. 固定端口表

| 服务 | 固定端口 | 启动形态 | 备注 |
|---|---:|---|---|
| Core API | 18080 | Spring Boot | Phase 1 主后端 |
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
| RabbitMQ AMQP | 15689 | Docker host mapping | 容器内仍为 5672 |
| RabbitMQ management | 15690 | Docker host mapping | 容器内仍为 15672 |
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
6. 禁止使用 5173、3000、8080、3306、6379、9000、9001 作为语学星宿主机端口。
7. 端口变更必须同步 config/local-ports.json、.env.example、相关启动配置和本文件，并在 CHANGELOG 记录。

## 4. 常用地址

- Learner Web：http://127.0.0.1:18180
- Admin Web：http://127.0.0.1:18181
- Official Site：http://127.0.0.1:18182
- Core API：http://127.0.0.1:18080/api/v1
- MinIO Console：http://127.0.0.1:19001
