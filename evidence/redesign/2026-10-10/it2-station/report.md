# IT-2 定级缺陷复验

日期：2026-10-10。分支：`dev-redesign`。这是新证据，不改写 `R1-029` 的历史回放。
本脚本不签 IT-2 出站，也不签 IT-1。身份是临时 JWKS，三个领域服务共用这一张测试库。浏览器全链未跑。

总判：`PASS_WITH_NOT_RUN`。有 FAIL 时不把本卡写成全绿。专库 `it2_station_20261010_88c52892`。

## 步骤

- PASS `mysql-identity`: {"name":"/yuxuexing-local-mysql-1","image":"mysql:8.0","project":"yuxuexing-local","service":"mysql","status":"running","health":"healthy","port":[{"HostIp":"127.0.0.1","HostPort":"13306"}]}
- PASS `ports-free`: {"ports":[18070,18088,18089,18091,18199,18229],"occupied":[]}
- PASS `content-seed-10-3-3-2-2`: {"flyway":"28\t0","seeded":{"total":10,"vocab":3,"grammar":3,"reading":2,"listening":2,"bank":10,"answers":10}}
- PASS `sealed-200-no-correctOption`: {"status":200,"bytes":3498,"dims":{"VOCABULARY":3,"BASIC_GRAMMAR":3,"READING":2,"LISTENING":2},"leaks":false,"sampleKeys":["dimension","stem","contentVersionId","displayOrder","itemType","itemId","options","itemCode"]}
- PASS `sealed-under-10-is-503`: {"status":503,"total":9,"body":"{\"timestamp\":\"2026-10-10T07:05:03.265Z\",\"status\":503,\"error\":\"Service Unavailable\",\"path\":\"/internal/v1/content/placement-bank/sealed\"}","stemLeaked":false}
- PASS `sealed-restored-200`: {"status":200,"total":10}
- PASS `learner-active-goal`: {"status":200,"flyway":"12\t0","goal":{"status":"ACTIVE","targetId":1001,"goalCode":"FOUNDATION","stateVersion":1}}
- PASS `assessment-flyway`: {"assessmentFlyway":"1,2,3,4,5,6,7,8,9,10,11\t0"}
- PASS `gate-closed-403-no-session`: {"adult":403,"consent":403,"sessions":0,"adultBody":"{\"detail\":\"adult gate is required\",\"instance\":\"/internal/v1/assessment/placement/sessions\",\"status\":403,\"title\":\"Forbidden\"}","consentBody":"{\"detail\":\"learning consent is required\",\"instance\":\"/internal/v1/assessment/placement/sessions\",\"status\":403,\"title\":\"Forbidden\"}"}
- PASS `open-10-stems-no-correctOption`: {"status":201,"acceptedSequence":0,"stateVersion":1,"items":10,"leaks":false,"leakHits":[],"r1018RealDb":true,"targetRead":{"status":200,"goalStatus":"ACTIVE","targetId":1001,"stateVersion":1}}
- PASS `out-of-order-409-unchanged`: {"status":409,"acceptedSequence":0,"responses":0,"body":"{\"detail\":\"placement checkpoint is stale or out of order\",\"instance\":\"/internal/v1/assessment/placement/sessions/asess_f94c6a1545a4469a9620945c9d7a5d38/responses\",\"status\":409,\"title\":\"Conflict\"}"}
- PASS `correct-full-advances-no-correctOption`: {"status":200,"outcome":"FULL","acceptedSequence":1,"leaks":false}
- PASS `stale-or-behind-409-unchanged`: {"behind":409,"stale":409,"acceptedSequence":1,"responses":1}
- PASS `wrong-zero-no-correctOption`: {"status":200,"outcome":"ZERO","acceptedSequence":2,"leaks":false,"usedWrongOption":true}
- PASS `ten-items-report-digest`: {"acceptedSequence":10,"status":"COMPLETED","reportId":"rpt_1aff9597dd5f440283eb8795be3922d8","digest":"801f6bf9148715c07d6cfc80a428ace7fd3875f3d456d327ce79f3e03f9a880b","outcomes":["FULL","ZERO","FULL","ZERO","FULL","ZERO","FULL","ZERO","FULL","ZERO"]}
- PASS `report-reread-same-digest`: {"first":200,"second":200,"digest":"801f6bf9148715c07d6cfc80a428ace7fd3875f3d456d327ce79f3e03f9a880b","sameBody":true}
- PASS `retest-new-session-old-digest`: {"status":201,"newSession":"asess_46f1639f1ff94d25850e172c079ff963","acceptedSequence":0,"oldDigest":"801f6bf9148715c07d6cfc80a428ace7fd3875f3d456d327ce79f3e03f9a880b","via":"assessment-internal"}
- PASS `public-retest-201-keeps-report`: {"status":201,"newSession":"asess_cd96d189c2824a90b508f0ca10e8424a","acceptedSequence":0,"oldDigest":"801f6bf9148715c07d6cfc80a428ace7fd3875f3d456d327ce79f3e03f9a880b"}
- PASS `retired-write-404-submit-step`: {"status":404,"errorCode":"NOT_FOUND"}
- PASS `retired-write-404-skip`: {"status":404,"errorCode":"NOT_FOUND"}
- PASS `network-interrupt-checkpoint-restored`: {"dropped":"destroyed","restoredSequence":1,"restoredVersion":2,"resumeStatus":200}
- PASS `incomplete-retest-409`: {"status":409,"sessions":3,"body":"{\"detail\":\"placement retest requires a completed report\",\"instance\":\"/internal/v1/assessment/placement/sessions/asess_46f1639f1ff94d25850e172c079ff963/retest\",\"status\":409,\"title\":\"Conflict\"}"}
- PASS `skip-incomplete-skipped-no-report`: {"status":201,"bodyStatus":"SKIPPED","resultKind":"SKIPPED","hasReportId":false}
- PASS `skip-completed-409-digest-unchanged`: {"status":409,"digest":"801f6bf9148715c07d6cfc80a428ace7fd3875f3d456d327ce79f3e03f9a880b","storedDigest":"801f6bf9148715c07d6cfc80a428ace7fd3875f3d456d327ce79f3e03f9a880b","body":"{\"detail\":\"completed placement cannot be skipped\",\"instance\":\"/internal/v1/assessment/placement/baselines/skip\",\"status\":409,\"title\":\"Conflict\"}"}
- PASS `gateway-post-start-404`: {"status":404,"errorCode":"NOT_FOUND","b25":0,"body":"{\"error\":{\"errorCode\":\"NOT_FOUND\",\"message\":\"The API route is not available.\",\"retryable\":false},\"meta\":{\"requestId\":\"req-8d4fe09b0b984f1993fdc24a05f7ae06\",\"traceId\":\"deae84d917404c43b92ec6a63bdd2acb\",\"apiVersion\":\"v1\",\"schemaVersion\":\"1.0.0\",\"serverTime\":\"2026-10-10T07:05:20.357784Z\"}}"}
- PASS `gateway-get-start-forwarded`: {"status":200,"body":"{\"status\":\"EMPTY\",\"contentLocale\":\"en-US\"}"}
- PASS `gateway-post-sessions-not-404`: {"status":201,"sessionId":"asess_2e13ab91e6854466bbb1a8ab592a1115"}
- PASS `r1-018-real-db-open`: {"reason":"同一专库上，content 密封下发经 assessment 开题，网关 POST /placement/sessions 返回 10 道无 correctOption 的题干。"}
- PASS `learner-web-placement-resume`: {"exitCode":0,"tests":15,"pass":15,"fail":0,"rerun":"2026-10-10T15:06+08:00 current tests"}
- PASS `mobile-placement-resume`: {"exitCode":0,"tests":16,"pass":16,"fail":0,"rerun":"2026-10-10T15:06+08:00 current tests"}
- NOT_RUN `browser-full-chain`: {"reason":"这次没有开浏览器，也没有真机走查"}
- PASS `retest-button-enabled-in-source`: {"web":true,"mobile":true}

## 运行约束

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，`127.0.0.1:13306`）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。
端口来自 `config/local-ports.json`：网关 18070，learner 18088，content 18089，assessment 18091。18199 是本轮临时 JWKS，18229 是本轮学习同意复检回环桩，都不是 IAM。复检保持开启，但没有启动 iam-service。
三个服务的 Flyway 历史表在代码里都叫 `flyway_schema_history`。内容服务先在空库迁移，然后把历史表改名为 `content_flyway_schema_history`，再建一张空的同结构历史表给 learner；learner 迁完再改名为 `learner_flyway_schema_history`，assessment 用自己的空历史表迁移。这是回放隔离，不是产品改动。
判分用的服务令牌只放在 assessment 进程环境里，证据不收录令牌。选哪一个选项由库内 `answer_rule_json` 决定，learner 响应里不回写这个字段。

## 前端

页面源码里的重测按钮是否可点，看 `retest-button-enabled-in-source`。
learner-web 续答测试退出码 0，tests 15，pass 15，fail 0。
mobile 续答测试退出码 0，tests 16，pass 16，fail 0。

## 未验证

- 浏览器全链：NOT_RUN。
- 真实 IAM RS256 与三个独立 owner schema：本轮没有启动 iam-service，不能据此签出站。

## 清理

content-service=143 learner-service=143 assessment-service=143 api-gateway=143 schemaLeft=0 listenersLeft=none qidaUnchanged=true
