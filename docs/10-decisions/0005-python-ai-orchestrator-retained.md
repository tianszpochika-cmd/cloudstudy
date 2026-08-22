# ADR-0005：AI 编排层保留 Python FastAPI 独立服务

> **v2 绑定**：AI 服务通过 Gateway 后的领域服务和事件边界运行，不能直接依赖或暴露旧 `core-api`；Phase 2 Gate 之前仍不得启用。

## 状态

accepted

## 背景

ADR-0004 将前后端主线切换为 Vue3 + uni-app + Spring Boot 3 后，AI 能力层面临两个选择：Java (Spring Boot) 直接调用商用大模型 API，或保留原架构中的 Python (FastAPI + LangGraph + LiteLLM) 独立编排服务。团队当前无 Python 经验。

## 决策

保留 **Python 3.11+ (FastAPI + LangGraph + LiteLLM)** 作为独立 AI 编排服务，与 Gateway 后的领域服务通过 REST/gRPC/事件通信。理由：

- 依存句法分析、语音评测、写作升格等后续能力的模型与工具生态（spaCy/Stanza、评测脚本）集中在 Python；
- LiteLLM 多模型路由、LangGraph 流程编排与 prompt 版本治理在 Python 生态成熟度显著高于 Java；
- 服务边界独立：早期可用 FastAPI 薄封装（LiteLLM 直连商用模型 API + Pydantic 结构化校验 + 超时降级），学习曲线平缓，不必一上来就写复杂编排。

## 分阶段落地

1. **MVP**：FastAPI 最小服务 = LiteLLM 调用 + Pydantic Schema 校验 + 失败降级返回规则化练习；Java 侧不直接调模型。
2. **P1**：引入 prompt_version 治理、评测回放、成本限额。
3. **P2**：按需引入 LangGraph 复杂流程（读后续写三阶升格、句法分析管线）。

## 结果

- AI 能力演进不被 Java 生态限制。
- 团队需学习基础 Python/FastAPI（服务薄、范围小，成本可控）。
- 模型密钥仅存 AI 编排服务与受控服务端，客户端永不接触。
