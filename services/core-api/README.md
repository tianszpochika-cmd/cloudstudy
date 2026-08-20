# core-api

核心业务 API 的模块化单体。每个 modules 子目录拥有自己的 controller、application、domain、repository 和 tests 边界；模块之间通过应用服务或事件交互，避免直接读取彼此内部实现。

## B0 基线启动

```powershell
mvn spring-boot:run
```

默认监听 `127.0.0.1:18080`，健康契约为 `GET /api/v1/health`。B0 只提供健康探针；业务模块按开发任务依赖逐步接入，不在基线服务中伪造业务数据。
