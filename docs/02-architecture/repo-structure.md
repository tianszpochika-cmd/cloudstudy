# 仓库结构说明

## apps

平台入口和平台特定 UI。每个应用只负责展示、交互、路由、端能力和轻量状态。

## services

可部署的运行时服务。core-api 以领域模块组织，AI、语音和异步任务独立演进。

## packages

跨端共享的契约、类型、领域函数、设计令牌和观测 SDK。

## database

数据库 schema、迁移、种子、夹具和数据字典。

## content

课程内容和媒体，包含版本、审核状态和发布流程。

## ai

提示词、评测、策略和实验，不直接替代运行时服务。

## docs 与 requirements

docs 解释为什么和怎么做；requirements 定义要做什么以及如何验收。

## infra、scripts、tests

分别负责环境、自动化和质量保证。
