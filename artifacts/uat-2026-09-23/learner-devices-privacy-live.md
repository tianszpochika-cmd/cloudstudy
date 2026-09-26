# 学习 Web 设备会话与隐私设置实测

2026-09-23，本地 Gateway 18070、学习 Web 18180、IAM owner 与 MySQL。可复跑脚本：`node tests/uat/learner-devices-live.e2e.mjs`。脚本创建唯一合成成人账号，通过本地成人 Gate 和三项同意，另开两个设备，再从 390px 浏览器登录；结束时精确禁用该账号并撤销全部活跃会话。没有记录密码或 Token。

| 链路 | 实测结果 |
| --- | --- |
| 注册、成人 Gate、TERMS/PRIVACY/ADULT_LEARNING 同意、另一设备登录 | 201、200、200/200/200、200 |
| Web 设备列表 | IAM 实际返回 3 台；当前设备 1 台，其他活跃设备 2 台；页面脚本错误 0 |
| 320px 布局 | 页面宽度未溢出；[操作前截图](screenshots/learner/devices-live/devices-before-320.png) |
| 退出其他设备 | UI 活跃其他设备从 2 变 0；IAM 表中活跃设备 1、撤销设备 2、活跃会话 1；[操作后截图](screenshots/learner/devices-live/devices-after-390.png) |
| 隐私页 | 关闭了将显示偏好冒充隐私设置的保存按钮，以及没有可交付导出工作流的申请按钮；页面明确说明暂不可用；[截图](screenshots/learner/devices-live/privacy-390.png) |
| 清理 | 合成账号 `DISABLED`，活跃会话 0 |

修正了客户端把 IAM `data.devices` 误读为 `data.items`、用浏览器时间/位置伪造当前设备、失败后继续显示缓存设备，以及踢设备时乐观移除但未重读 owner 的行为。设备区现在区分加载、失败、空与真实列表；失败时不提供踢出操作。

`PAGE-P1-DEVICES` 仍为 **PARTIAL**：本轮核对了 Gateway→IAM→持久化的列表与退出动作，但未覆盖另一设备重新鉴权、Token 到期和多平台设备联动。`PAGE-P1-PRIVACY` 仍为 **NOT_TESTED**：关闭误导性操作不等于同意撤回、本人导出、删除及音频保留链路已经实现。IAM 同意撤回的旧 Access Token 至到期仍可能读 owner，另见[成人同意 owner 矩阵](adult-consent-owner-http-matrix.md)与 ADR-0017 的令牌冻结约束。
