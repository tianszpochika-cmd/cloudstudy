# MB004 暂停证据归档

仅保存既有运行结果、脚本和截图；未执行测试、未修改源码。原运行目录已经是 `../` 下具名子目录，无另外的私有运行路径。`copy-manifest.json` 保存逐份原路径、归档路径、字节数及 SHA256；`matrix-run1-original-manifest.json` 保留旧128矩阵的129个文件路径/hash，不重复复制全部图片。

最终候选合成 UI 检查：`recovery-run5-results.json` 7 PASS，`race-run6-results.json` 4 PASS。两份结果均含运行前后九源 hash。对应冻结执行脚本为 `ui-onboarding-final-execution.cjs`，SHA256 `8cdc9714ab8786733750770c0097f447ca9e021fdef1c46f674dc04f6e4c7a92`；仅归档，不从此目录运行。

已证实产品 FAIL：

- `recovery-before-refresh-results.json` / `old-claims-recovery-fail.png`：当前 IAM 同意已有效，重读后旧 session claims 仍未 ready。
- `recovery-run3-results.json` / `persistent403-continue-button-fail.png`：有限刷新后 target403 持续，consent 仍出现继续按钮；最终候选已在 run5 覆盖 blocked、一次刷新及零签署。
- `dark-boundary-before-review.json` / `dark-gate-boundary-before.png`、`dark-goal-boundary-before.png`：独立旧截图 review 已记录暗色控件边界对填充1.669、对页1.881，低于3。当前本页已消费 v2-mut，但修后实际数值未测，不标 PASS。
- 早期 `controls-run2-results.json` / `first-error-focus-fail.png`，以及 `controls-run4-results.json` / `busy-aria-disabled-fail.png` 保留原首错焦点及 busy 语义问题。旧文案插值 FAIL 原件见 `../interpolation-before.json` 及其原截图路径。

需要区分的测试 FAIL：race-run3/4 的导航拒绝注入没有生效，记录实际已进入 assessment；race-run5 是只读 uni 方法不可重新定义。它们没有证实产品导航提示 FAIL。页内导航分类调整后的 run6 使用当前测试 context 的 runtime 对象替换，真实一次拒绝、提示、解锁及留在 onboarding 均通过，作为独立正向证据。recovery-run4 的7检查已完成，但终末 console 过滤遗漏预期403导致整组 FAIL；run5 允许严格格式的预期 HTTP 失败日志后通过。

历史执行脚本局限：早期每次结果保存了当时 test SHA，但没有逐次保存脚本原字节。当前最终执行脚本可审计，旧结果不能仅凭当前脚本重标为当前源码 PASS。旧矩阵仍只归属当时 hash。

最终构建、视觉矩阵、暗色修后边界、200%短屏、旧中心指针、onShow restoring阶段刷新401及独立复审未完成。原生与真实后台验收仍是 GAP。
