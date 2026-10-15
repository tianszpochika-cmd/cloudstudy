# MB004 最终作者组断点及失败分类

本次只读取既有结果、hash 和截图；未启动新测试、未修改源码。上轮三个作者进程均已退出：matrix-run2 exit0，text-run2/restoring-run2 exit1，无作者浏览器组在运行。

当前正式页 SHA256 `8540707509e844fc02f8bdf01435e6a7f2ad691c97dba576d1acbad96b4ac377`，onboarding i18n `5e0e045c0118226ef8e2f80b1fa1db072bdfdbd2d171c13a904075fe3c4f8743`，helper `9a0b104937e7f637c88f946232a0a614a0116452c79818a54429b96596d8d1f2`，执行测试 `007b4900d3442b401aba0ef7b3245e4a0a1f2508569318f860dfce52f619a18e`。执行字节保存在 execution-script-after.cjs；各结果含九源完整 hash，不继承早期 f56 的结论。

## 已有结果

- matrix-run2/results.json：128项合成 UI 显式断言 PASS，pageerror0，运行前后九源一致。覆盖四态、中文/英文、320/390/768/1280、light/dark/high-contrast/system，以及输入/未选目标/时长/真实 checkbox 可见边界对填充及页底色至少3:1。gate390中英四主题的8组另测 checked glyph 对填充至少3:1及真实Space/Enter一次切换，保留 checked 截图。自动几何与对比度 PASS 不等于200%目检通过。
- text-run2/results.json：整组 FAIL。前8个四态中英320×460、200%几何检查与旧中心click0通过，第10个click160在按住期间 snapshot=false。已保存 failure.png。真实 helper9a 在 pointerdown 过早忽略尚处 disabled 的主按钮，未保留即时blur启用过程的几何快照；需与新 helper 的 pointerup 仍 disabled 释放策略一起复验，不能删除释放/hold断言。
- restoring-run2/results.json：整组 FAIL，0项完成。已等待真实 refresh fixture进入，成功响应分支却最终停在登录，未到goal；failureState及failure.png已保存。没有证据将其改为PASS，也尚不能断定是产品或测试模拟问题。下一步记录非敏感session status、身份revision变更布尔、route、请求路径与时间序列，定位onShow有限刷新与实际hash导航复核是否交错。禁止读取或记录Token、请求体/头及存储。

## 已有200%实际目检

四态图片均实际位于 text-run2/：gate-320-en-US-200-short.png、consent-320-en-US-200-short.png、goal-320-en-US-200-short.png、assessment-320-en-US-200-short.png。

gate及goal原图已目检：三列进度导航把 Confirm 拆为 Confir/m、identity 拆为 identit/y、Current 拆为 Curre/nt；goal两列时长把 minutes 拆为 minute/s，阅读困难。gate出生年份示例仅显示“For example, 19”，可见字段标签仍完整。长截图里正文、按钮和底部入口未横向逃逸，这只能支持几何事实，不能抵消拆词可读性FAIL。先前只读视觉agent已目检四态同类问题，原结论保留。

## 下一步边界

Root协调helper/page修稿与新freeze；作者只改测试和本目录证据，等新hash后复验受影响pointer、320英文200%以及restoring定位。需覆盖禁用按钮释放、重新启用后单次提交、启用secondary旧中心点击，以及持续403零签署/owner/晚回调不回归。旧失败全部保留，旧矩阵不改标新helper/page的PASS。真实后台、原生端与独立签收仍未完成。
