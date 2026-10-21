# C5 archive（2026-10-21）

本目录在 C6 修改前复制，保留 Root C5 smoke 对应的源码与报告。不是 PASS。

| 文件 | 字节 | SHA256 (raw) |
|---|---|---|
| `home.vue` | 38140 | `920df081a81e96b940c286e72821a0ecbd7300ee97ddaa66d4cd5ef5651548d9` |
| `mobile-experience.ts` | 39476 | `278b9d030b02532a872c502b38f62561e41dc94ffdfb7abc35585c4496967ddc` |
| `learner-content.ts` | 30264 | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` |
| `uni-runtime.ts` | 8189 | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` |
| `C5-CANDIDATE.md` | 6305 | `a0dd10f9cca38a209770fe7542b5f140365dbaf27d8ec651baf0f08f2cf0f977` |

Root C5 实际结果：`matrix/runs/codex-20261021-c5-smoke-1`。zh-light390、zh-light1280 全 ok；en-dark390 唯一真实 FAIL 为 native placeholder；en320/200% 仅 normal-contrast 分类 NOT_MEASURED（另交脚本作者）；source/deps/evidence stable、closed=true。原件保留，不复制、不改写、不据此声称修复。

C6 仅把 native placeholder 规则目标改为 `.uni-input-input::placeholder`；C6 四源哈希见 `../dsh-20261021-author/C6-CANDIDATE.md`。
