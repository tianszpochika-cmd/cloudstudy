/* 原创拟真数据；不含真实用户、凭据或远程接口。 */
const DEMO_FIXTURES = {
BANK: [
  { s: "Choose the word closest in meaning to 'happy'.", o: ["glad", "angry", "tired"], a: 0, dim: "词汇", why: "glad＝高兴，是近义；angry 生气、tired 累，都不对" },
  { s: "She ___ to school every day.", o: ["go", "goes", "going"], a: 1, dim: "语法", why: "she 三单＋every day 一般现在时，用 goes" },
  { s: "There ___ two books on the desk.", o: ["is", "are", "am"], a: 1, dim: "语法", why: "two books 复数，there be 用 are" },
  { s: "Li Lei gets up at six thirty. What time does he get up?", o: ["six thirty", "seven", "eight"], a: 0, dim: "阅读", why: "短文原句 six thirty，照着找就行" },
  { s: "It was sunny today. After school, they played football. What did they do after school?", o: ["swim", "play football", "read"], a: 1, dim: "阅读", why: "文字材料明确写出 After school, they played football，放学后踢了足球。此题没有音频，不测听力。" },
],
SRSQ: [
  { w: "abandon", zh: "抛弃", stage: 2, show: false },
  { w: "accumulate", zh: "积累", stage: 1, show: false },
  { w: "persistence", zh: "坚持", stage: 3, show: false },
  { w: "clarify", zh: "澄清", stage: 1, show: false },
],
WD_CHEST: [
  { id: "c1", t: "路径宝箱", d: "定级完成解锁 · 宝石 + 增益（演示）", st: "open" },
  { id: "c2", t: "组队宝箱", d: "组队 5 天全满开启（演示 0/5）", st: "lock" },
  { id: "c3", t: "联赛宝箱", d: "周日结算前 3 开启（演示）", st: "lock" },
],
WD_ACH: [
  { id: "a1", t: "初来乍到", d: "完成注册与身份确认", st: "got" },
  { id: "a2", t: "一战定级", d: "完成一次定级出报告", st: "got" },
  { id: "a3", t: "坚持 3 天", d: "连续学习 3 天（演示 1/3）", st: "lock", p: "1/3" },
  { id: "a4", t: "坚持 7 天", d: "连续学习 7 天（演示 1/7）", st: "lock", p: "1/7" },
  { id: "a5", t: "错题清道夫", d: "变式销账 5 道（演示 0/5）", st: "lock", p: "0/5" },
  { id: "a6", t: "词汇 40", d: "刷完 40 词一轮（演示）", st: "lock", p: "0/40" },
  { id: "a9", t: "限时快手", d: "限时挑战对 8 个（演示，去刷）", st: "lock", p: "0/8" },
  { id: "a10", t: "听力入门", d: "听完 3 篇（演示，去听）", st: "lock", p: "0/3" },
  { id: "a11", t: "跟读首秀", d: "完成 1 次跟读（演示，去语音）", st: "lock", p: "0/1" },
  { id: "a12", t: "打卡分享", d: "分享一次学习报告（演示）", st: "lock", p: "0/1" },
  { id: "a13", t: "联赛新秀", d: "进一次周联赛榜（演示）", st: "lock", p: "0/1" },
  { id: "a14", t: "赛季参与", d: "赛季规则公布后参赛", st: "closed" },
  { id: "a15", t: "宝箱猎人", d: "开 1 个宝箱（演示）", st: "lock", p: "0/1" },
  { id: "a16", t: "组队之星", d: "完成一次 5 天组队（演示）", st: "lock", p: "0/1" },
  { id: "a7", t: "赛季冠军", d: "赛季结算第一", st: "closed" },
  { id: "a8", t: "自习达人", d: "房间专注 10 次", st: "closed" },
],
MSGS: [
  { id: "m1", cat: "学习", t: "今日任务已生成", d: "语法 2 道，预计 10 分钟", time: "08:00", read: false, go: "#/today" },
  { id: "m2", cat: "学习", t: "欢迎来到语学星", d: "先定级，3 分钟出报告", time: "昨天", read: false, go: "#/placement" },
  { id: "m3", cat: "系统", t: "条款更新了", d: "看一眼再继续，一键重签", time: "周一", read: true, go: "#/cupgrade" },
  { id: "m4", cat: "互动", t: "有人给你点赞", d: "你的打卡被 3 人点赞（演示）", time: "周一", read: true },
  { id: "m5", cat: "互动", t: "好友本周学了 120 分钟", d: "演示伙伴晨读阿甘 · 去联赛看看（演示数据）", time: "周二", read: false, go: "#/league" },
  { id: "m6", cat: "互动", t: "组队缺 1 天", d: "组队 5 天差 1 天，宝箱等你（演示）", time: "今天", read: false, go: "#/world" },
],
GOODS: [
  { id: "g1", cat: "会员", t: "月度会员", d: "本机会员购买流程样例；AI 伴学在 Phase 2 开放", price: 19, oprice: 29, tag: "热卖" },
  { id: "g2", cat: "会员", t: "年度会员", d: "月均 ¥9 · 最划算", price: 108, oprice: 228, tag: "省一半" },
  { id: "g3", cat: "课程", t: "四级冲刺包", d: "原创题目、模拟练习与解析样例", price: 49, oprice: 99, tag: "" },
  { id: "g4", cat: "课程", t: "雅思 6.5 全程", d: "听说读写四科", price: 299, oprice: 599, tag: "名师" },
  { id: "g5", cat: "周边", t: "单词卡片盒", d: "500 高频词实物卡", price: 39, oprice: 59, tag: "" },
  { id: "g6", cat: "周边", t: "学习帆布包", d: "装下你的坚持", price: 59, oprice: 79, tag: "新品" },
],
RF_ORDERS: [
  { id: "tk1", t: "月度会员", price: 19, pay: "已支付（沙盒）", right: "有效", rf: "L1 已过·等 L2", step: 1, inv: "未申请" },
  { id: "tk2", t: "四级冲刺包", price: 49, pay: "已支付（沙盒）", right: "有效", rf: "无", step: -1, inv: "电子收据可看" },
  { id: "tk3", t: "年度会员", price: 108, pay: "已退款（沙盒）", right: "已按政策撤销（演示）", rf: "已到账（沙盒）", step: 4, inv: "商店收据可看·本地发票待渠道确认" },
],
VOWELS: [["iː", "sheep"], ["ɪ", "ship"], ["e", "bed"], ["æ", "cat"], ["ɑː", "car"], ["ɒ", "hot"], ["ɔː", "door"], ["ʊ", "book"], ["uː", "food"], ["ʌ", "cup"], ["ɜː", "bird"], ["ə", "about"], ["eɪ", "day"], ["aɪ", "my"], ["ɔɪ", "boy"], ["əʊ", "go"], ["aʊ", "how"], ["ɪə", "here"], ["eə", "there"], ["ʊə", "tour"]],
CONSS: [["p", "pen"], ["b", "book"], ["t", "tea"], ["d", "dog"], ["k", "key"], ["g", "go"], ["f", "fish"], ["v", "van"], ["θ", "think"], ["ð", "this"], ["s", "sun"], ["z", "zoo"], ["ʃ", "ship"], ["ʒ", "vision"], ["h", "hat"], ["m", "man"], ["n", "no"], ["ŋ", "sing"], ["l", "look"], ["r", "red"], ["j", "yes"], ["w", "we"], ["tʃ", "chair"], ["dʒ", "jump"], ["tr", "tree"], ["dr", "dog"], ["ts", "cats"], ["dz", "beds"]],
PHQ: [["sip", "zip"], ["ship", "sheep"], ["cat", "cut"], ["pen", "pan"]],
ABC: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
BOOKS: [
  { id: "b1", title: "四级词汇红宝书", author: "语学星原创样例", year: "原型", purpose: "四级词汇练习", tags: ["四级", "词汇", "B1"], dir: "每天 30 词 → 练题 → 复习", intro: "原创词汇片段与例句，用于打磨学习交互；章名数字为目录样例，不表示已提供完整词库。", toc: ["第一章 高频 500", "第二章 核心 1500", "第三章 冲刺 1000"], sents: [["Abandon bad habits.", "A1", "抛掉坏习惯。"], ["Knowledge changes life.", "A2", "知识改变生活。"], ["Persistence pays off.", "B1", "坚持终有回报。"]] },
  { id: "b2", title: "零基础英语", author: "语学星原创样例", year: "原型", purpose: "开口不害怕", tags: ["零基础", "口语", "A1"], dir: "字母→音标→短句→对话", intro: "原创字母、问候与日常短句样例，配系统语音朗读。", toc: ["第一单元 字母音标", "第二单元 问候告别", "第三单元 吃穿住行"], sents: [["Good morning.", "A0", "早上好。"], ["How are you?", "A0", "你好吗？"], ["See you.", "A0", "再见。"]] },
  { id: "b3", title: "六级长难句", author: "语学星原创样例", year: "原型", purpose: "阅读拆句练习", tags: ["六级", "阅读", "B2"], dir: "拆句→精读→复述", intro: "原创长难句片段，练习辨认主谓宾与从句；不提供历年真题全集。", toc: ["第一章 定语从句", "第二章 状语从句", "第三章 综合实战"], sents: [["The man who lives next door is a doctor.", "B1", "住隔壁的男人是医生。"], ["Hardly had I arrived when it rained.", "B2", "我刚到就下雨了。"], ["What matters is not what you say.", "B2", "重要的不是你说什么。"]] },
  { id: "b4", title: "商务口语 100 句", author: "语学星原创样例", year: "原型", purpose: "开会能张嘴", tags: ["商务", "口语", "B1"], dir: "跟读→角色扮演→实战", intro: "原创会议、邮件和谈判短句样例；书名为课程主题，不表示已收录 100 句。", toc: ["第一章 会议", "第二章 邮件", "第三章 谈判"], sents: [["Let us get started.", "A1", "我们开始吧。"], ["Could you clarify?", "B1", "能再说清楚点吗？"], ["Win-win matters.", "B1", "双赢很重要。"]] },
  { id: "b5", title: "雅思备考", author: "语学星原创样例", year: "原型", purpose: "雅思 6.5", tags: ["雅思", "备考", "B2"], dir: "听说读写四科并进", intro: "原创听说读写学习提示与片段，不代表完整备考课程，不承诺考试成绩。", toc: ["听力篇", "阅读篇", "写作篇", "口语篇"], sents: [["Time management is key.", "B1", "时间管理是关键。"], ["Cohesion improves writing.", "B2", "衔接提升写作。"]] },
  { id: "b6", title: "生活英语", author: "语学星原创样例", year: "原型", purpose: "出国不抓瞎", tags: ["生活", "口语", "A2"], dir: "场景闯关，一天一关", intro: "原创机场、酒店与求助短句样例。", toc: ["机场篇", "酒店篇", "医院篇"], sents: [["Where is the exit?", "A1", "出口在哪？"], ["Check in, please.", "A1", "请办理入住。"]] },
],
CHAP: {
  b1: ["# 第一章 高频 500\n\n本节以 **abandon（抛弃）** 为原创词汇学习样例。\n\n> 记忆提示：把单词放进自己的句子中，再通过练习检验。\n\n- abandon bad habits.\n- 抛掉坏习惯。\n\n**文字词卡**：abandon → 抛弃 → Abandon bad habits.\n\n## 怎样练习\n\n读出例句，再用 abandon 写一句话。本节没有引用已核验的真题频次。", "# 第二章 核心 1500\n\n从 **ability（能力）** 到 **accuse（指控）**，先抓动词再抓名词。\n\n> 方法：每天 30 词，读三遍：第一遍看形，第二遍听音，第三遍造句。\n\n## 1. 先拿下 5 个动词\n\n- **abandon** 抛弃：Abandon bad habits. 抛掉坏习惯。\n- **absorb** 吸收：Plants absorb sunlight. 植物吸收阳光。\n- **abuse** 滥用：Do not abuse drugs. 别滥用药物。\n- **accelerate** 加速：The car accelerated. 车加速了。\n- **accompany** 陪伴：She accompanies her son. 她陪着儿子。\n\n## 2. 再记 5 个名词\n\n- **ability** 能力：to the best of my ability. 尽我所能。\n- **academy** 学院：a music academy. 音乐学院。\n- **account** 账户：an email account. 电子邮箱。\n- **abundance** 丰富：in abundance. 充足。\n- **accusation** 指控：a false accusation. 虚假指控。\n\n## 3. 小测两道\n\n1. She ___ to school every day.（go/goes）\n2. There ___ two books.（is/are）\n\n> 答案：1 goes（三单），2 are（复数）。这两题供阅读自查，不会自动写入错题本；可到练习页完成客观题。", "# 第三章 冲刺 1000\n\n复习词义与例句，记录仍不熟悉的词。本节为原创练习提示，完成不代表已达到 `B1`。\n\n> 冲刺不熬夜，复习看错题本。"],
  b2: ["# 第一单元 字母音标\n\n**A a** 苹果 apple，**B b** 书 book。\n\n- 跟读三遍\n- 指认大小写\n\n**文字提示**：A/a、B/b 对照大小写，结合 apple、book 读出字母。", "# 第二单元 问候告别\n\n**Good morning.** 早上好。\n\n> 见面先笑，再开口。", "# 第三单元 吃穿住行\n\n点餐、问路、买单三件套。"],
  b3: ["# 第一章 定语从句\n\n**who/which/that** 三兄弟，修饰名词不含糊。\n\n- The man *who* lives next door.\n- 住隔壁的男人。", "# 第二章 状语从句\n\n时间地点原因让步，一网打尽。", "# 第三章 综合实战\n\n原创拆句样例：The learner who reviews every day remembers more words. 找出主语、谓语和定语从句。"],
  b4: ["# 第一章 会议\n\n**Let's get started.** 我们开始吧。\n\n> 开会三件套：开场、转折、收尾。", "# 第二章 邮件\n\n附件用语：Please find attached.", "# 第三章 谈判\n\nWin-win matters. 双赢很重要。"],
  b5: ["# 听力篇\n\n先抓关键词，再听细节。", "# 阅读篇\n\n略读 + 精读两遍法。", "# 写作篇\n\n开头结尾模板背下来。", "# 口语篇\n\nPart 1 流利度优先。"],
  b6: ["# 机场篇\n\n**Where is the exit?** 出口在哪？\n\n**场景词卡**：exit（出口）、boarding pass（登机牌）。", "# 酒店篇\n\n**Check in, please.** 请办理入住。", "# 医院篇\n\n**I need help.** 我需要帮助。"],
},
WB4: [["abandon", "/əˈbændən/", "抛弃"], ["ability", "/əˈbɪləti/", "能力"], ["absent", "/ˈæbsənt/", "缺席的"], ["absolute", "/ˈæbsəluːt/", "绝对的"], ["absorb", "/əbˈsɔːb/", "吸收"], ["abstract", "/ˈæbstrækt/", "抽象的"], ["abundant", "/əˈbʌndənt/", "丰富的"], ["abuse", "/əˈbjuːz/", "滥用"], ["academy", "/əˈkædəmi/", "学院"], ["accelerate", "/əkˈseləreɪt/", "加速"], ["accent", "/ˈæksənt/", "口音"], ["accept", "/əkˈsept/", "接受"], ["access", "/ˈækses/", "进入"], ["accommodate", "/əˈkɒmədeɪt/", "容纳"], ["accompany", "/əˈkʌmpəni/", "陪伴"], ["accomplish", "/əˈkɒmplɪʃ/", "完成"], ["account", "/əˈkaʊnt/", "账户"], ["accumulate", "/əˈkjuːmjəleɪt/", "积累"], ["accuracy", "/ˈækjərəsi/", "准确"], ["accuse", "/əˈkjuːz/", "指控"]],
WB6: [["abolish", "/əˈbɒlɪʃ/", "废除"], ["absurd", "/əbˈsɜːd/", "荒谬的"], ["abundance", "/əˈbʌndəns/", "丰富"], ["acclaim", "/əˈkleɪm/", "赞誉"], ["acquaint", "/əˈkweɪnt/", "使熟悉"], ["adhere", "/ədˈhɪə/", "坚持"], ["adjacent", "/əˈdʒeɪsənt/", "邻近的"], ["adjoin", "/əˈdʒɔɪn/", "毗连"], ["administer", "/ədˈmɪnɪstə/", "管理"], ["admirable", "/ˈædmərəbl/", "令人钦佩的"], ["admission", "/ədˈmɪʃən/", "入学许可"], ["adolescent", "/ˌædəˈlesənt/", "青少年"], ["adore", "/əˈdɔː/", "热爱"], ["adorn", "/əˈdɔːn/", "装饰"], ["adverse", "/ˈædvɜːs/", "不利的"], ["advertise", "/ˈædvətaɪz/", "做广告"], ["advocate", "/ˈædvəkeɪt/", "提倡"], ["aesthetic", "/iːsˈθetɪk/", "美学的"], ["affiliate", "/əˈfɪlieɪt/", "附属"], ["affirm", "/əˈfɜːm/", "断言"]],
GROUPS: {
  g1: { title: "语法 · There be 句型", kind: "grammar", items: [
    { s: "There ___ two books on the desk.", o: ["is", "are", "am"], a: 1, why: "two books 是复数，there be 用 are" },
    { s: "She ___ to school every day.", o: ["go", "goes", "going"], a: 1, why: "she 三单＋every day，用 goes" },
    { s: "There ___ a cat under the chair.", o: ["is", "are", "am"], a: 0, why: "a cat 单数，用 is" },
  ] },
  r1: { title: "阅读 · 图书馆的一天", kind: "reading", passage: "Li Lei gets up at six thirty. He goes to the library at eight. The library opens at eight thirty. He reads books there.", items: [
    { s: "What time does Li Lei get up?", o: ["six thirty", "seven", "eight"], a: 0, why: "第一句 six thirty，照着找" },
    { s: "Where does he go at eight?", o: ["school", "library", "park"], a: 1, why: "第二句 the library" },
  ] },
}
};
const DEMO_PERSONAS = [
{id:"new",name:"林一",description:"刚注册，准备建立学习计划",gate:"PENDING",agreed:false},
{id:"active",name:"陈晓",description:"大三 · 四级备考 · 每天 15 分钟",gate:"PASS",agreed:true},
{id:"remedial",name:"周宁",description:"工作两年 · 语法错题较多 · 补救练习",gate:"PASS",agreed:true},
{id:"withdrawn",name:"许安",description:"已撤回学习同意，账号设置仍可用",gate:"PASS",agreed:false}
];

const DEMO_CURRENT_PERSONA = (() => {try {return JSON.parse(localStorage.getItem('yxx-ui-v2-controls-'+(window.DEMO_SURFACE||'mobile'))||'{}').persona||'active';} catch {return 'active';}})();
function DEMO_PERSONA_STATE() {const p=DEMO_PERSONAS.find(x=>x.id===DEMO_CURRENT_PERSONA)||DEMO_PERSONAS[1];return {user:p.id==='new'?null:p.name,gate:p.gate,birthDate:null,consents:Object.fromEntries(['TERMS','PRIVACY','ADULT_LEARNING'].map(k=>[k,{agreed:p.agreed,version:'b30-consent-v1',source:'拟真档案'}]))};}
const DEMO_EXTRA_FIXTURES={devices:[{id:'current',name:'当前浏览器',type:'本机',active:true,current:true,last:'刚刚'},{id:'phone',name:'iPhone 15',type:'移动端',active:true,current:false,last:'今天 08:42'},{id:'tablet',name:'iPad Air',type:'平板',active:true,current:false,last:'昨天 20:15'}],offline:[{id:'basic',name:'生活英语 · 出行篇',size:'12.4 MB',version:'2026.10',scope:'3 篇原创短文 / 12 个词汇',status:'未下载',progress:0},{id:'cet4',name:'四级词汇 · 核心练习',size:'8.2 MB',version:'2026.10',scope:'20 个原创词卡 / 3 组练习',status:'未下载',progress:0}],gameWords:[['library','图书馆'],['journey','旅程'],['improve','提高'],['evidence','证据'],['focus','专注']],rooms:[{id:'r1',name:'四级阅读自习室',members:18,topic:'每天读一篇，分享一句总结'},{id:'r2',name:'职场口语小组',members:12,topic:'练习会议中的清楚表达'},{id:'r3',name:'零基础互助营',members:24,topic:'从简单句开始，坚持十分钟'}],consentDocs:[{id:'TERMS',title:'服务条款',copy:'本演示仅供成年人试用。练习、订单和管理操作均为本机模拟，不形成真实服务合同、支付或认证。'},{id:'PRIVACY',title:'隐私说明',copy:'仅保存合成学习档案和你输入的演示草稿。请勿输入真实姓名、密码或敏感资料。你可在演示控制中重置所有本机样例。'},{id:'ADULT_LEARNING',title:'成人学习说明',copy:'开放学习需要主动确认成年人身份及学习同意。撤回学习同意立即限制学习入口；设置、同意记录和客服仍可使用。'}]};
