# 部署策略

> v2 目标：OCI 镜像 + Kubernetes + Helm/Kustomize + GitOps；当前 `core-api`/Worker 发布记录属于迁移兼容阶段，不能替代 Gateway/IAM/微服务运行验收。

## 环境

- local：开发和合成数据。
- dev：联调和自动化测试。
- staging：接近生产的灰度验证。
- production：真实用户和正式内容。

## 发布原则

- 数据库迁移向前兼容，先加后删。
- AI provider、prompt、课程版本和功能开关可独立回滚。
- 学习核心路径与高成本语音能力分开扩缩容。
- 任何生产发布都要有负责人、观察窗口和回滚步骤。
- 服务必须具备 startup/readiness/liveness probe、优雅停机、连接排空、超时/限流、SBOM、依赖扫描、镜像签名和灰度/回滚策略。
- 数据迁移遵循先加后删；跨服务状态使用 Outbox/Saga/补偿，不使用共享表和分布式两阶段提交。

## 需要补齐

- 云厂商和区域选择。
- 域名、证书、CDN、WAF 和平台审核配置。
- 备份、恢复演练和灾备目标。
- 供应商数据保留和跨境策略。
- Java/Spring/基础设施版本 BOM、SLO/错误预算、RPO/RTO、PITR 和定期恢复演练责任人。
