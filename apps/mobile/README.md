# mobile

uni-app 移动端（主线决策见 docs/10-decisions/0004-stack-switch-uniapp-springboot.md）。与 learner-web 共享同一套 uni-app 代码，条件编译输出 iOS/Android/iPad 原生包；先复用 API、领域逻辑、设计令牌和埋点，再通过原生插件/条件编译补充麦克风、通知、离线和震动等端能力。

ios/ 和 android/ 目录在真正初始化原生工程后再产生大量平台文件。
