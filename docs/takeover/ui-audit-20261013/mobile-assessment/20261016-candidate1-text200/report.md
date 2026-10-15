# MB006 candidate1 极窄文字200%检查

`FAIL / 2_STATES_ONLY`。组前官方五小时87%/周44%，ordinaryUsageAllowed=true；两态已完成，browser/context均关闭，无inflight。未追修、未重跑、未扩范围。

冻结页 `d1b501e33b313679bd5c90dd8fcda8e9a5a6b790856a444b01e915523827366a`、i18n `d55f74003bdbe9eae58858ab51bc52d806d2b07e5b06a05e68a183768291249d`；六源before/after稳定。真实18183正式H5与正常登录guard，全API strict合成拦截，未知路由0/pageerror0。未改正式源、共享、旧before/smoke、Git、服务。

环境仅en-US/dark、320×568。CSS200%方法：先快照页面每个节点的computed font-size，再把每个节点font-size设为原值2倍；没有修改文案，不是native/browser zoom。引导与真实点击开始后第一题选A各保存一张完整页图、真实DOMRange逐词rect与控件尺寸，见run.cjs/results.json及01/02 PNG；两图均已view_image核看。

实际FAIL：H1“Level assessment”的`assessment`在两态均断成两行。原28px变56px；该单词Range片段为 `(x20,y200.390625,w274.453125,h74)` 与 `(x20,y278.78125,w21.796875,h74)`，截图可见尾字母单独占行。Root可据此修整窄屏标题，但本子任务没有改源。

其余具名结果：两态没有水平溢出；H1以外已测按钮英文单词未在词内断行；所有操作目标宽高均至少44px。selected A仍`aria-pressed=true`且可见Selected；start=1/respond=0，未提交、未走十题、未开更多组合。按钮文字自然换行，页面变长可滚动。结果不覆盖键盘、指针、更多主题/宽度、原生缩放/native及真实业务链。

原FAIL保留，现有smoke的八项PASS范围未被重写；此失败意味着本候选的本项文字放大验收未过，不能以无溢出替代单词可读性。
