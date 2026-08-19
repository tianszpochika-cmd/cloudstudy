# core-api

核心业务 API 的模块化单体。每个 modules 子目录拥有自己的 controller、application、domain、repository 和 tests 边界；模块之间通过应用服务或事件交互，避免直接读取彼此内部实现。
