# 契约与治理结果

1. 冻结 14 个 canonical operation：media-service 负责上传、处理、资产、manifest、短时访问和录音资产；assessment-service 负责 Shadowing session/progress/complete。
2. 30 个 schema 全部闭合。`MediaUploadBinding` 只允许服务端绑定的 intent、asset/version、tenantRef、subjectRef 和 expiry；客户端 authority、对象凭据和永久 URL 失败关闭。
3. `MediaManifest` 只传元数据，必须恰好包含一条 TEXT 和一条 PRACTICE fallback；READY/CLEAN、rights、官方字幕/文本替代和 publish eligibility 形成一致的失败关闭 Gate。
4. 成人远端录音使用 IAM 派生的 `VOICE_RECORDING` 专用 purpose/version；麦克风只在用户主动操作后申请，拒绝时保留静音练习，本地草稿不伪造远端资产。
5. 播放能力冻结 `[0.5,2.0]` 连续速度、六个快捷档、保音高与毫秒时间轴；Shadowing 固定 500ms target gap。
6. M1-007 retry 预算被精确复用：只有 TRANSIENT 最多重试 5 次，指数 jitter 为 1–60 秒，未知失败关闭，耗尽进入 workflow DLQ/人工恢复。
7. B1/B3/B11 旧入口保留结构化 deprecated/replacement 或 converged-in-place；11 个媒体/录音历史事件不晋升 canonical Kafka。

兼容来源固定为 `ca282cd00dabeeb3fafbf6b4570054bd5b9f8549`，历史 CI baseline 为 `463c4b238caceb1592bff6c61327c00ab9bac922`，不可变治理 baseline 为 `868c2177f62b6d2cf613bed702686dddcfe6943f`；没有为消除差异移动引用。
