# Core API 模块模板

每个领域模块建议包含：

- api/：输入、输出、权限和路由。
- application/：用例编排。
- domain/：实体、值对象和领域规则。
- infrastructure/：数据库、缓存和第三方适配。
- tests/：单元、集成和契约测试。

模块之间不要直接依赖对方的基础设施实现。
