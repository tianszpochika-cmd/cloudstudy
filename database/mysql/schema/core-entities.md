# 核心数据实体

- User：账号和基础状态。
- UserProfile：目标、水平、可用时间和偏好。
- Assessment：测评实例、题目版本和结果。
- Course / Unit / Lesson：课程发布结构。
- Exercise / Attempt：练习和每次作答。
- Feedback：规则或 AI 反馈，带 provider 与 prompt version。
- ReviewItem / ReviewAttempt：复习项和复习历史。
- Subscription / Entitlement：订阅和权益。
- MediaAsset：音频、图片、转写和版权元数据。
- AuditLog：后台、内容、数据导出和安全操作。

历史学习记录要引用当时的内容版本，避免内容更新后无法解释旧结果。
