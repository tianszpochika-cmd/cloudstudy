# com.englishflow.modules.assessment

## 业务域职责
- 本目录为 `assessment` 独立业务领域模块。
- 严格遵循领域边界：禁止直接注入其他业务域的 Mapper，跨模块交互通过 Service 接口或内部事件解耦。
