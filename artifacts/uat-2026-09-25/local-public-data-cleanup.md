# 本机公开站点占位事实清理（2026-09-25）

本机 MySQL 的只读预检命中 6 条旧占位记录：中英文各 2 条未经批准的合规声明仍为 `PUBLISHED`，中英文各 1 条 Web 下载渠道以 `http://127.0.0.1:18182/start` 却标为 `AVAILABLE`。

在执行定点更新前，已将这 6 条原始行保存为[恢复快照](local-placeholder-site-facets-before-cleanup.json)（SHA-256 `397dfdfe5f9a331fd8517a4c4d703d85929928f7687f1c701ebce1ace3cab689`）。更新只匹配固定 facet ID、locale、状态及原有标题/正文或 loopback URL：4 条合规声明改为 `UNPUBLISHED`，2 条 Web 渠道改为 `UNAVAILABLE` 并移除本机下载链接。执行结果 `changed=6, remaining=[]`；再次 dry-run 命中 0 条。

随后 `check-local-real-data-coverage.mjs` 的 37 项检查通过，其中 `content.public-site-web-unavailable=2`、`content.public-site-unapproved-facts=0`。这些数量只证明本机种子覆盖和占位事实已收束，不证明课程或法律内容获得正式批准。本机 Gateway `127.0.0.1:18070` 当前未运行，故没有清理后的在线公开投影复测；Batch16 私有 Docker 数据库未修改。
