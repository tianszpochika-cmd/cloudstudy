# R1-029 L2 干净库重放

日期：2026-10-10。分支：`dev-redesign`。Owner：QA。依赖：R1-018…028。
**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有改业务 Java/Vue。没有补造 R1-030。

总判：`PASS_WITH_NOT_RUN`。有 FAIL 时不把本卡写成全绿。专库 `r1_029_20261010_bfb306e1`。

## 步骤

- PASS `mysql-identity`: {"name":"/yuxuexing-local-mysql-1","image":"mysql:8.0","project":"yuxuexing-local","service":"mysql","status":"running","health":"healthy","port":[{"HostIp":"127.0.0.1","HostPort":"13306"}]}
- PASS `ports-free`: {"ports":[18070,18088,18089,18091,18199,18229],"occupied":[]}
- PASS `content-seed-10-3-3-2-2`: {"flyway":"28\t0","seeded":{"total":10,"vocab":3,"grammar":3,"reading":2,"listening":2,"bank":10,"answers":10}}
- PASS `sealed-200-no-correctOption`: {"status":200,"bytes":3498,"dims":{"VOCABULARY":3,"BASIC_GRAMMAR":3,"READING":2,"LISTENING":2},"leaks":false,"sampleKeys":["dimension","itemCode","options","itemId","itemType","displayOrder","contentVersionId","stem"]}
- PASS `sealed-under-10-is-503`: {"status":503,"total":9,"body":"{\"timestamp\":\"2026-10-10T03:25:05.127Z\",\"status\":503,\"error\":\"Service Unavailable\",\"path\":\"/internal/v1/content/placement-bank/sealed\"}","stemLeaked":false}
- PASS `sealed-restored-200`: {"status":200,"total":10}
- PASS `learner-active-goal`: {"status":200,"flyway":"12\t0","goal":{"status":"ACTIVE","targetId":1001,"goalCode":"FOUNDATION","stateVersion":1}}
- PASS `assessment-flyway`: {"assessmentFlyway":"1,2,3,4,5,6,7,8,9,10,11\t0"}
- PASS `gate-closed-403-no-session`: {"adult":403,"consent":403,"sessions":0,"adultBody":"{\"detail\":\"adult gate is required\",\"instance\":\"/internal/v1/assessment/placement/sessions\",\"status\":403,\"title\":\"Forbidden\"}","consentBody":"{\"detail\":\"learning consent is required\",\"instance\":\"/internal/v1/assessment/placement/sessions\",\"status\":403,\"title\":\"Forbidden\"}"}
- PASS `open-10-stems-no-correctOption`: {"status":201,"acceptedSequence":0,"stateVersion":1,"items":10,"leaks":false,"leakHits":[],"r1018RealDb":true,"targetRead":{"status":200,"goalStatus":"ACTIVE","targetId":1001,"stateVersion":1}}
- PASS `out-of-order-409-unchanged`: {"status":409,"acceptedSequence":0,"responses":0,"body":"{\"detail\":\"placement checkpoint is stale or out of order\",\"instance\":\"/internal/v1/assessment/placement/sessions/asess_87505052697847d4a3787d85e92b57fa/responses\",\"status\":409,\"title\":\"Conflict\"}"}
- PASS `correct-full-advances-no-correctOption`: {"status":200,"outcome":"FULL","acceptedSequence":1,"leaks":false}
- PASS `stale-or-behind-409-unchanged`: {"behind":409,"stale":409,"acceptedSequence":1,"responses":1}
- PASS `wrong-zero-no-correctOption`: {"status":200,"outcome":"ZERO","acceptedSequence":2,"leaks":false,"usedWrongOption":true}
- PASS `ten-items-report-digest`: {"acceptedSequence":10,"status":"COMPLETED","reportId":"rpt_636d6731e5fa4e528d68c32c351bed3b","digest":"9e730a8f9e6c52aa2ac2d0c55061b9e3b75f3f605df630463f2098fd288f1d80","outcomes":["FULL","ZERO","FULL","ZERO","FULL","ZERO","FULL","ZERO","FULL","ZERO"]}
- PASS `report-reread-same-digest`: {"first":200,"second":200,"digest":"9e730a8f9e6c52aa2ac2d0c55061b9e3b75f3f605df630463f2098fd288f1d80","sameBody":true}
- PASS `retest-new-session-old-digest`: {"status":201,"newSession":"asess_9e99329ac1f74b449b29c712c3318d84","acceptedSequence":0,"oldDigest":"9e730a8f9e6c52aa2ac2d0c55061b9e3b75f3f605df630463f2098fd288f1d80","via":"assessment-internal"}
- NOT_RUN `public-retest-route-observation`: {"status":404,"body":"{\"error\":{\"errorCode\":\"NOT_FOUND\",\"message\":\"The API route is not available.\",\"retryable\":false},\"meta\":{\"requestId\":\"req-d2b352d40b6f4a8182a703a1de367709\",\"traceId\":\"5b83ad8927bc47a3b7ff71550528bd04\",\"apiVersion\":\"v1\",\"schemaVersion\":\"1.0.0\",\"serverTime\":\"2026-10-10T03:25:26.424760Z\"}}","reason":"R1-024 没有把重测接到网关。这里只记录现状，不用这个状态代替内部重测结果，也不把它写成按钮已接通。"}
- PASS `incomplete-retest-409`: {"status":409,"sessions":2,"body":"{\"detail\":\"placement retest requires a completed report\",\"instance\":\"/internal/v1/assessment/placement/sessions/asess_9e99329ac1f74b449b29c712c3318d84/retest\",\"status\":409,\"title\":\"Conflict\"}"}
- PASS `skip-incomplete-skipped-no-report`: {"status":201,"bodyStatus":"SKIPPED","resultKind":"SKIPPED","hasReportId":false}
- PASS `skip-completed-409-digest-unchanged`: {"status":409,"digest":"9e730a8f9e6c52aa2ac2d0c55061b9e3b75f3f605df630463f2098fd288f1d80","storedDigest":"9e730a8f9e6c52aa2ac2d0c55061b9e3b75f3f605df630463f2098fd288f1d80","body":"{\"detail\":\"completed placement cannot be skipped\",\"instance\":\"/internal/v1/assessment/placement/baselines/skip\",\"status\":409,\"title\":\"Conflict\"}"}
- PASS `gateway-post-start-404`: {"status":404,"errorCode":"NOT_FOUND","b25":0,"body":"{\"error\":{\"errorCode\":\"NOT_FOUND\",\"message\":\"The API route is not available.\",\"retryable\":false},\"meta\":{\"requestId\":\"req-ad55b4b480824fa4b86e56efc92fa370\",\"traceId\":\"9920f4a0a5a9464cb1c788aec816e0d3\",\"apiVersion\":\"v1\",\"schemaVersion\":\"1.0.0\",\"serverTime\":\"2026-10-10T03:25:26.814491Z\"}}"}
- PASS `gateway-get-start-forwarded`: {"status":200,"body":"{\"status\":\"EMPTY\",\"contentLocale\":\"en-US\"}"}
- PASS `gateway-post-sessions-not-404`: {"status":201,"sessionId":"asess_b109c8d203c448abb6067ca9b079c646"}
- PASS `r1-018-real-db-open`: {"reason":"同一专库上，content 密封下发经 assessment 开题，网关 POST /placement/sessions 返回 10 道无 correctOption 的题干。"}
- PASS `learner-web-placement-resume`: {"exitCode":0,"tests":15,"pass":15,"fail":0}
- PASS `mobile-placement-resume`: {"exitCode":0,"tests":16,"pass":16,"fail":0}
- NOT_RUN `browser-full-chain`: {"reason":"这次没有开浏览器，也没有真机走查"}
- NOT_RUN `retest-button-not-claimed-connected`: {"reason":"两端按钮仍是 disabled「重测尚未接通」。续答测试断言的是未接通，不是按钮已经能重测。"}

## 运行约束

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，`127.0.0.1:13306`）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。
端口来自 `config/local-ports.json`：网关 18070，learner 18088，content 18089，assessment 18091。18199 是本轮临时 JWKS，18229 是本轮学习同意复检回环桩，都不是 IAM。复检保持开启，但没有启动 iam-service。
三个服务的 Flyway 历史表在代码里都叫 `flyway_schema_history`。内容服务先在空库迁移，然后把历史表改名为 `content_flyway_schema_history`，再建一张空的同结构历史表给 learner；learner 迁完再改名为 `learner_flyway_schema_history`，assessment 用自己的空历史表迁移。这是回放隔离，不是产品改动。
判分用的服务令牌只放在 assessment 进程环境里，证据不收录令牌。选哪一个选项由库内 `answer_rule_json` 决定，learner 响应里不回写这个字段。

## 前端

没有改页面。learner-web 与 mobile 只跑已有的 `tests/placement-checkpoint-resume.test.mjs`。
learner-web 退出码 0，tests 15，pass 15，fail 0。
mobile 退出码 0，tests 16，pass 16，fail 0。
这些测试仍然要求按钮是 `disabled>重测尚未接通`。不要把这句写成重测按钮已经接通。

## 未验证

- 浏览器全链：NOT_RUN。
- 重测按钮：客户端仍未接通。服务端内部重测是否通过，看上面的 `retest` 步骤，不代表页面按钮可用。

## 清理

content-service=143 learner-service=143 assessment-service=143 api-gateway=143 schemaLeft=0 listenersLeft=none qidaUnchanged=true
