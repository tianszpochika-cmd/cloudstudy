# rv1 证据读法

`steps.json` 与 `report.md` 是脚本第一次跑完时原样写下的。本说明不把其中的 FAIL 改成 PASS。

注册响应里的 `accessToken` 已换成 `[REDACTED]`。调用记录仍保留方法、源站、路径和状态码。

## 发布台

`it6-simple-chain` 与 `it6-restart-fingerprint` 在 `steps.json` 里是 PASS。简审课文 `rv1-simple` 建稿 202、版权 200、报告 200、送审 202、发布 202、钉版 200、只读指纹 200。`it6_release_studio` 重启前后都是 `state_version` 6、JSON 长度 3737。`fingerprint-before.txt` 与 `fingerprint-after.txt` 相同，260 个字符。只重启了 content-service。

`it6-full-browser` 是 SKIP。原因写在 `steps.json`：本轮用简审短链和只读指纹对照关闭 F-IT6-01，没有重跑 IT-6 全量浏览器。

## 未成年年份

四次真实表单都提交了 2016。注册都是 `POST https://127.0.0.1:18087/api/v1/auth/register`，状态 201。成人门都是 `POST http://127.0.0.1:18070/api/v1/iam/adult-gate`，状态 200，响应体含 `"status":"REJECTED"`。Web 停在 `http://127.0.0.1:18180/forbidden`。H5 停在 `http://127.0.0.1:18183/#/pages/forbidden/forbidden`。「再试一次」和「改年份」按钮计数都是 0。

H5 两条在 `steps.json` 里是 PASS。Web 1280 与 390 被记成 FAIL，是因为当时已加载的脚本只接受成人门源站 `https://127.0.0.1:18087`。发现允许 IAM 或 Gateway。当场请求打到 Gateway。磁盘上的 `scripts/redesign/r3-local-https/run-rv1-evidence.mjs` 已改为接受这两个源站，并核对注册直打 IAM 且状态 201。这次进程没有用到改后的断言，所以 `steps.json` 仍是 FAIL。

## 撤回学习同意

Web 1280 停在 `http://127.0.0.1:18180/settings/privacy`。H5 390 停在 `http://127.0.0.1:18183/#/pages/settings/settings`。`calls-withdraw-web-1280.json` 与 `calls-withdraw-h5-390.json` 里，引导阶段先有 TERMS、ADULT_LEARNING、PRIVACY 的 ACCEPTED。最后一次 `PUT /api/v1/iam/consents` 是 `ADULT_LEARNING` 且 `decision` 为 `WITHDRAWN`，状态 200。其后最后一次 `GET /api/v1/learner/targets` 是 403，错误码 `CONSENT_REQUIRED`。

`steps.json` 把这两条记成 FAIL，是因为当时脚本取了第一次 `PUT /iam/consents`。那一次是 ACCEPTED，状态也是 200，响应里没有 WITHDRAWN。磁盘上的脚本已改为取最后一次同时带 `ADULT_LEARNING` 与 `WITHDRAWN` 的 PUT，以及最后一次 targets GET。这次进程没有用到改后的断言。

## 顶层 node

`node-suite` 在 `steps.json` 里是 FAIL：361 项、360 通过、1 失败。失败文件是 `apps/mobile/tests/support-real-gateway.e2e.mjs`。工单 GET 是 503，页面可见「工单暂不可用，请重试。」本轮栈没有启动 admin-ops。这不是 F-IT1-01、F-IT1-02、F-IT6-01 的回归。不把 361 记成全绿。

## 收口

`rv1_20261011_iam_a749da72`、`rv1_20261011_lrn_a749da72`、`rv1_20261011_cnt_a749da72` 已删除。qida 容器名称计数前后都是 50，没有对本轮以外的容器执行 stop、start 或 prune。`lunaStamp` 没有改。
