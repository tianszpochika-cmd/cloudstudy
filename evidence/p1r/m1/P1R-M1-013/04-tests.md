# 测试与门禁

- learning-loop contract：67/67 PASS。
- contract tooling：50/50 PASS。
- P1R 全集：818/818 PASS。
- workspace typecheck：7/7 PASS。
- contracts merge/generate/validate：401 operations、646 OpenAPI schemas、158 events、108 event payload schemas、17 AsyncAPI channels、60 AsyncAPI operations、13 JSON Schemas，均 PASS。
- Gateway contract：350/350 PASS。
- event governance/reliability：17/141/43 PASS。
- B26 static：27/27 PASS，结果仍为 static-only/pending/NO-GO。
- 以 463c4b238caceb1592bff6c61327c00ab9bac922 和 a07a58a7d245295c54d39487a6669545d077c513 对比 868c2177f62b6d2cf613bed702686dddcfe6943f 的两条固定 compatibility 均为 0 breaking。

完整历史 test:g 是 39/41，标记为 NOT_APPLICABLE：两项 G0/G3 stale source-marker 失败是已知历史问题，不是本源码回归，也不构成运行证据。
