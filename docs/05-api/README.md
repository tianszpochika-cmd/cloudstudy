# API 约定

本目录保存 API 通用约定与历史兼容契约说明。**可执行的契约单一事实源在 [`packages/contracts/`](../../packages/contracts/)**，本目录只承载约定与解释，不替代机器可校验的 OpenAPI/事件定义。

## 文档清单

- [api-conventions.md](api-conventions.md)：API 通用约定（envelope、错误码、分页、幂等键、requestId/traceId、版本与弃用规则）。
- [b10-compatibility-adapter-contract.md](b10-compatibility-adapter-contract.md)：B10 兼容适配层契约（历史迁移参考）。
- [openapi/README.md](openapi/README.md)：OpenAPI 片段与生成流程说明。

## 须知

任何接口变动必须先在 `packages/contracts/` 定义 OpenAPI 单一事实源，再由 `openapi-generator` 产出 Java DTO 与前端 TS 类型；禁止在客户端手写未经校验的裸 `any`。
