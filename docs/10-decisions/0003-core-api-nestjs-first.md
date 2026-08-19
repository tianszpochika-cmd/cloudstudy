# ADR-0003：Core API 主线采用 Node.js (NestJS)，Java Spring Boot 3 为备选

## 状态

superseded by ADR-0004（基于团队实际技能结构 Vue3 + Java，Core API 主线切换为 Java 17 / Spring Boot 3；本决策保留作为历史参考）

## 背景

core-api 需要承载用户鉴权、课程体系、答题评测流水、记忆调度、订单与订阅结算。候选方案为 Node.js (NestJS) 与 Java (Spring Boot 3)，两者能力均可胜任（详见 docs/02-architecture/stack-recommendation.md 方案 A/B 对比）。

## 决策

主线采用 **Node.js (NestJS 模块化单体)**，理由：

- 与前端共享 `packages/contracts` 的 TypeScript/Zod 类型，全链路契约零转换联调，是本 Monorepo 架构的核心工程红利；
- 异步任务使用 BullMQ（Redis-based），与数据层基础设施复用，同语言维护成本最低；
- P0 验证期迭代速度优先，团队全栈 TypeScript 单一语言心智负担最小。

## 备选触发条件

出现以下情况时重新评估 Java (Spring Boot 3) 路线并新增 ADR：

- 团队招聘与技能结构明显转向 Java 生态。
- 订单/支付/对账链路出现需要 Spring 生态金融级组件的强合规诉求。
- core-api 出现 Node.js 事件循环模型的明确性能瓶颈（CPU 密集型计算应先评估下沉到 Python/Worker，而非换语言）。

## 结果

- 前后端类型共享红利最大化，联调成本最低。
- Java 路线相关评估保留在 stack-recommendation.md 方案 B，切换需先过本 ADR 触发条件。
