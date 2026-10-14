# MB-001 root局部收口 — 主按钮键盘

状态：PUSHED_SCOPED / UI_VERIFIED_PRIMARY_KEYBOARD_DELTA_H5，提交`70ad42f41c844708400ca18ec1a87c95976649f1`已推origin/dev-redesign且随后远程SHA与HEAD一致。当前raw源码SHA-256为`1d347967146a38723ab0bf3ae0b1accca3b519ae6515e7c14f12297be1b80e19`。root已逐行检查Git差量：只为正式登录主按钮添加Enter/Space局部keydown prevent/stop和keyup调用既有submit，未改字段验证、样式、session或共享键盘模块。

原da5实际Enter首错跳password的FAIL保留。独立[17项报告](review.md)与summary逐项接受：空/单字段首错与ARIA、hold/repeat到keyup才提交、有效单请求、busy禁止重复与离页、快速清空/替换时最新blur同步值、Space短视口不滚动，以及原输入confirm链和mouse form流程。浏览器pageerror/非预期console均0，运行前后源码hash一致。作者5项仅为补充，不替代独立验收。

本修稿无CSS/布局/文案变更，原登录设计与26视觉矩阵仍只覆盖原具名范围；当前17项不重签未重跑矩阵。H5实际动态行为已验，最新typecheck单列日志，不以构建证明浏览器通过。真实IAM成功、原生设备、物理键盘/读屏及secure storage仍NOT_RUN。

Git按.gitattributes进行CRLF→LF规范化，提交前另核对工作区raw与index规范化等值，历史raw hash不改写。
