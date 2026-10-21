# C3 archive（2026-10-21）

本目录在 C4 修改前复制，保留 Root 已复核/C3 真实 H5 失败所对应的源码与报告，不作为任何 PASS。

| 文件 | 字节 | SHA256 (raw) |
|---|---|---|
| `home.vue` | 37294 | `cc5ff41770cbee776cdf1be293eb20ffb19337add9ea5f95cbc6baf511b7345b` |
| `mobile-experience.ts` | 39474 | `99ad89ffe73b8493500f97a94207f6dcda5dda1ac3456bdc56795275ad7aac63` |
| `learner-content.ts` | 30264 | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` |
| `uni-runtime.ts` | 8189 | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` |
| `C3-CANDIDATE.md` | 10245 | `21ec8fdbea12d677f471e58a3a896e77a0e2ab487b1ddfd2f04035bc5733691a` |

C3 真实 H5 结果由 Root 独立执行并明确未签：`qa/runs/qa-ready-20261021-053126`（ready 4 FAIL）、`qa-search-20261021-053126`（search 6 FAIL）；source/deps stable、closed=true。相关原始报告在 Root 的 QA 运行目录，本 archive 不复制、不改写、不据此声明修复。

C3 的 i18n 结构缺陷（`mobile.auth.home`）在 C4 修正；C4 四源哈希见 `../dsh-20261021-author/C4-CANDIDATE.md`。
