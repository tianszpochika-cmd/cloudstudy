# core-api

> v1 迁移兼容服务：Java 17 + Spring Boot 3。v2 新功能默认归属 Gateway 后的目标领域服务；本服务只作为旧路由、迁移反腐层和回滚边界，不代表 v2 微服务/Gateway/IAM/RBAC 已完成。

核心业务 API 的模块化单体。每个 modules 子目录拥有自己的 controller、application、domain、repository 和 tests 边界；模块之间通过应用服务或事件交互，避免直接读取彼此内部实现。

## B0 基线启动

```powershell
mvn spring-boot:run
```

默认监听 `127.0.0.1:18080`，健康契约为 `GET /api/v1/health`。B0 只提供健康探针；业务模块按开发任务依赖逐步接入，不在基线服务中伪造业务数据。

## B10 兼容边界

`com.englishflow.modules.learning.b10.B10CompatibilityAdapter` 仅承载 B2/B3 的只读 shadow、对账、渐进 route 和 rollback 状态机。它只记录 `cmp_b10_*` adapter ledger 事实，回滚只能改变读取路由，不能删除或重写 learning、assessment、content 的领域事实；目标服务仍通过 Gateway 和服务侧 PEP 负责真实读写。当前提供纯 Java smoke，Spring HTTP、持久化 adapter、跨进程双读和真实 Gateway 切换留待测试阶段。
