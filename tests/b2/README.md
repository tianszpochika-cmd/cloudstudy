# B2 独立测试

运行：

```text
node --test tests/b2/client-contract.test.mjs tests/b2/exercise-mastery.test.mjs tests/b2/integration-b2.test.mjs tests/b2/vocabulary-srs.test.mjs
```

夹具职责：

- `b2-vocabulary-srs.fixture.json`：词汇详情、SM-2 固定向量和 SRS 状态迁移。
- `b2-assessment.fixture.json`：八类题型、答案投影和规则化判分。
- `b2-learning-flow.fixture.json`：4:4:2 日流、D+1/D+7、幂等和隐私投影。

测试会读取真实的事件目录、生成后的 OpenAPI 和性能引擎；运行态依赖与当前结果见 [B2 验证说明](../../docs/07-operations/b2-validation.md)。
