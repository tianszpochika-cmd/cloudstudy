# 测试与终验证据

- 独立 Luna Max reviewer 已接受 Evidence C=`3ab5d50e5d22c02a8a8c1d1f92643e37528d85c1`，P1/P2=`0/0`；此前两轮 REWORK 暴露的旧执行文档和 canonical manifest 未同步均已收口。
- 首轮 `dea989a` 因总 Gate 的 180 秒固定超时进入 `REWORK`；新源将长检查显式限制为 600 秒、其他检查 180 秒，并对超时漂移和真超时失败关闭。
- M1-018 总 Gate 源码检查通过；专项 `48/48`，IAM compatibility `7/7`，全量 P1R `1408/1408`，G `41/41`，typecheck `7/7`。
- contracts merge/generate/validate、两组 fixed compatibility、event governance/reliability、Gateway/IAM/data/migration、B26 static、plan、CI 与 diff 检查通过。
- Evidence C 上的 final mode 总 Gate 已通过；D 阶段完成 M1-010 current-source 重绑后，全局 Evidence Gate 通过。
