# 安全与隐私

- principal、tenant、subject、owner、rights、consent、quota、processing result 和 publish eligibility 都由服务端权威事实派生；客户端字段不能提升权限。
- upload/access grant 短时、单次或限定用途，并绑定 asset/version、subject、tenant、channel/range、expiry 与撤销版本；普通响应、事件、日志和审计不携带永久 URL、对象凭据或原始录音。
- 所有交付要求 malware=`CLEAN`；unknown、pending、infected 或 error 一律拒绝。
- 远端成人录音必须使用专用 consent purpose/version；撤回、重验证、麦克风拒绝和本地/远端分态均失败关闭。
- Phase 1 的 ASR、AI scoring、generative AI、digital human 和 RTC 全部 disabled；规则化 assessment 结果不能由媒体保存动作替代。
- delete/purge receipt 只有真实 `DELETED` 可返回，legal hold/revoke/cancel 优先；精确运行执行仍留给 M1-017/M2。
