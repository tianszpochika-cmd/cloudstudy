# rv3 证据读法

日期：2026-10-11。后缀 `ea0d8dcd`。分支 `grok/cs-rv3-20261011`。`lunaStamp`、`accepted`、`fullChainOutbound`、`it7Outbound` 都是 false。本目录不是第 4 节 `SIGNED_PASS`。

入库的 `summary.json` 与各 `steps.json` 来自后缀 `ea0d8dcd` 的收口重跑，`failed=none`。同后缀更早一次只在 `qida-unchanged` 失败：外部容器名称从 44 变成 46，本轮没有 stop 或 start。那次目录未入库。更早失败目录 `rv3-dd545739` 与 `rv3-6f7e59d4` 不改写，也不作为收口证据入库。

## 全链与 IT-7

`full-chain/summary.json`：158 步 PASS，`failed` 为空。`it7/summary.json`：34 步 PASS。Web 与 H5，1280 与 390。链内 node 是 367 项、367 通过、0 失败。六个 `rv3_chain_` 库已删。共享 admin schema 前后都是 `0|0`。qida 名称计数前后都是 46。

## 残留

`artwork/steps.json`：8 步 PASS。站页扫描的文档横向溢出是 0，越界元素为空。

`h5-reload/steps.json`：12 步 PASS。撤回与未成年拒绝后只改哈希，Web 到 `/forbidden`，H5 到 `#/pages/forbidden/forbidden`。从未同意的新用户到引导页。

`it5/steps.json`：2 步 PASS。外层仍是 `PARTIAL` / `B25-LEGACY-UNVERIFIED-1`。本期对象 `NEVER_STUDIED`，`officialScore` 是 false。外层 PARTIAL 按证据门保留，不改写成 READY。

`rate-budget/steps.json`：2 步 PASS。证据 profile 与默认限额下的 node 套件都过。

`minio/steps.json`：Maven 里该测试 1 项、0 跳过。`wall/steps.json`：权威卡墙关闭记录。`scan/steps.json`：其余 OPEN 项里，能修的已修，外部项只记录。

`maven/summary.md`：2026-10-11T13:43:59+08 BUILD SUCCESS，1681 项、0 失败、0 跳过。

`pnpm typecheck` 为 7/7。`pnpm contracts:validate` 为 471 个操作。
