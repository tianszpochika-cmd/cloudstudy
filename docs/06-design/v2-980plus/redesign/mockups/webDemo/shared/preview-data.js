/* Original synthetic preview facts; no requests, credentials or user records. */
(() => {
  'use strict';
  const clone = value => structuredClone(value);
  const roles = [
    { id: 'editor', name: '林知夏', label: '教研编辑', scopes: ['draft', 'media'] },
    { id: 'l1', name: '王芳', label: '内容初审', scopes: ['review1'] },
    { id: 'l2', name: '赵磊', label: '内容终审', scopes: ['review2'] },
    { id: 'publisher', name: '江蔚', label: '发布运营', scopes: ['publish', 'media'] },
    { id: 'ops', name: '陈晨', label: '运营负责人', scopes: ['governance', 'support', 'observe'] },
    { id: 'support', name: '吴晴', label: '二线客服', scopes: ['support'] },
    { id: 'finance1', name: '张三', label: '退款初审', scopes: ['finance1'] },
    { id: 'finance2', name: '刘敏', label: '退款终审', scopes: ['finance2'] }
  ];
  // One central seed for every entity used by these pages. Everything is synthetic.
  const SEED = {
    version: 1, serial: 100, revision: 0, actor: 'editor', authenticated: false,
    content: [
      { id: 'PX-C01', title: '校园阅读 · 图书馆的一天', type: '阅读', text: 'The library opens at eight. Adult students meet there to read and share ideas.', version: 1, status: '草稿', author: 'editor', rights: true, media: true, l1: null, l2: null, published: null, history: [], events: [], blocked: [] },
      { id: 'PX-C02', title: '语法 · 简单句的主语与谓语', type: '语法', text: 'A clear sentence needs a subject and a verb. We study together every evening.', version: 2, status: '待初审', author: 'editor', rights: true, media: true, l1: null, l2: null, published: null, history: [], events: [], blocked: [] },
      { id: 'PX-C03', title: '职场英语 · 清楚表达观点', type: '阅读', text: 'Please explain your idea and give one example. Clear evidence helps the team decide.', version: 2, status: '已发布', author: 'editor', rights: true, media: true, l1: 'l1', l2: 'l2', published: 2, history: [{ version: 1, title: '职场英语 · 给出一个例子', text: 'Please give one example.', l1: 'l1', l2: 'l2' }, { version: 2, title: '职场英语 · 清楚表达观点', text: 'Please explain your idea and give one example.', l1: 'l1', l2: 'l2' }], events: [], blocked: [] },
      { id: 'PX-C04', title: '词汇 · 城市交通', type: '词汇', text: 'A journey by train can save time. Look for the station sign.', version: 1, status: '待终审', author: 'editor', rights: true, media: true, l1: 'l1', l2: null, published: null, history: [], events: [], blocked: [] }
    ],
    tickets: [
      { id: 'PX-T01', learner: '陈晓', title: '阅读进度没有更新', category: '学习', status: '待接单', assignee: null, target: null, reason: '', version: 1, safe: true, messages: [{ who: '学员', text: '完成原创短文后，目录进度仍显示为零。请核对我的演示记录。' }], events: [] },
      { id: 'PX-T02', learner: '周宁', title: '申请取消下次续订', category: '订单', status: '处理中', assignee: 'support', target: null, reason: '', version: 1, safe: true, messages: [{ who: '学员', text: '希望保留本期权益，取消下次续订。' }], events: [] },
      { id: 'PX-T03', learner: '林一', title: '旧记录信息不足', category: '测评', status: '待接单', assignee: null, target: null, reason: '', version: 1, safe: false, messages: [], events: [] }
    ],
    risks: [{ id: 'PX-R01', title: '课程授权来源需复核', source: 'PX-J01', status: '待分诊', owner: null, target: null, reason: '', events: [] }],
    reports: [{ id: 'PX-J01', title: '材料来源可能有误', detail: '合成举报：请复核课程资料的授权范围。', status: '已建档', risk: 'PX-R01' }, { id: 'PX-J02', title: '小组出现站外引导', detail: '合成举报：讨论中出现与学习无关的推广。', status: '待分诊', risk: null }],
    media: [{ id: 'PX-M01', name: 'library-cover.png', type: 'image/png', bytes: 183400, status: '可用', content: 'PX-C01' }],
    orders: [{ id: 'PX-O01', title: '四级阅读训练包', amount: 69, payment: '已支付', entitlement: '有效', renewal: false, receipt: '未申请', refund: null }, { id: 'PX-O02', title: '月度学习会员', amount: 29, payment: '已支付', entitlement: '有效', renewal: true, receipt: '未申请', refund: null }],
    refunds: [], audit: [{ id: 'PX-A01', time: '2026-10-11 09:30', actor: '江蔚', role: '发布运营', action: '发布内容', subject: 'PX-C03/v2', reason: '不同审核人已完成两级审核', result: '本机拟真成功' }],
    jobs: [{ id: 'PX-JOB1', name: '内容目录投影', status: '正常', attempts: 1, reason: '', receipts: [] }, { id: 'PX-JOB2', name: '订单权益对账', status: '恢复待处理', attempts: 1, reason: '合成事件延迟', receipts: [] }],
    rewards: [{ id: 'PX-RW1', title: '完成一次原创练习', condition: '已有一条练习完成记录', points: 30, claimed: false }, { id: 'PX-RW2', title: '三日积累', condition: '三个不同日期都有学习记录', points: 60, claimed: false }],
    balance: 120, wallet: [{ id: 'PX-W01', amount: 120, reason: '初始拟真试用积分' }],
    clothes: [{ id: 'PX-CL1', name: '晴空蓝上衣', price: 40, color: '#275dad', owned: false }, { id: 'PX-CL2', name: '森林绿上衣', price: 60, color: '#23704e', owned: false }, { id: 'PX-CL3', name: '日落紫上衣', price: 90, color: '#693f97', owned: false }],
    equipped: null, tryOn: null,
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, index) => ({ letter, word: ['adult', 'book', 'cat', 'desk', 'evening', 'friend', 'goal', 'home', 'idea', 'journey', 'kind', 'library', 'morning', 'note', 'open', 'plan', 'question', 'read', 'study', 'train', 'use', 'voice', 'word', 'x-ray', 'year', 'zero'][index], learned: false })),
    letter: 'A', phonics: { index: 0, answers: [], completed: false },
    phonicsQuestions: [{ letters: 'c-a-t', options: ['cat', 'cut', 'coat'], answer: 0 }, { letters: 'b-o-o-k', options: ['back', 'book', 'bike'], answer: 1 }, { letters: 'r-e-a-d', options: ['road', 'red', 'read'], answer: 2 }],
    future: false,
    aiGate: { stage: true, adult: true, consent: false, budget: true },
    ai: { scene: '英文邮件', draft: '', phase: 'idle', messages: [], accepted: [], runs: [], current: null, failNext: false },
    voices: [], voice: { scene: '跟读', phase: 'idle', current: null },
    voiceSamples: [{ id: 'PX-V1', text: 'Could you explain your idea?', pronunciation: 82, fluency: 78, completeness: 90, suggestion: '示例建议：在 explain 前轻停顿，保持完整句尾。' }, { id: 'PX-V2', text: 'The library opens at eight.', pronunciation: 88, fluency: 84, completeness: 94, suggestion: '示例建议：连接 library opens，注意 eight 的尾音。' }],
    k12: { role: 'guardian', consent: false, teacherVerified: false, permission: false, limit: 20, used: 0, paused: false, assignment: null, completed: [], events: [], selectedCourse: 'PX-K1' },
    k12Courses: [{ id: 'PX-K1', title: '原创教材样例 · 问候', rights: true, text: 'Hello, Sam. Good morning. I am happy to see you.', questions: [{ question: 'How do we greet someone in the morning?', options: ['Good morning.', 'Good night.', 'Goodbye.'], answer: 0 }] }, { id: 'PX-K2', title: '原创教材样例 · 我的书', rights: true, text: 'This is my book. I read it every day.', questions: [{ question: 'What does the speaker read?', options: ['A map.', 'A book.', 'A ticket.'], answer: 1 }] }]
  };
  function scenarioSeed(mode, previous) {
    const next = clone(SEED);
    // Selecting a fixture never authenticates a manager or grants product staff privileges.
    next.actor = previous.actor; next.authenticated = previous.authenticated;
    next.future = previous.future; next.serial = 1000;
    const lists = ['content', 'tickets', 'risks', 'reports', 'media', 'orders', 'refunds', 'audit', 'jobs', 'rewards', 'wallet', 'voices'];
    if (mode === 'empty') {
      lists.forEach(name => next[name] = []); next.balance = 0;
      next.aiGate.consent = false; next.k12.assignment = null;
      return next;
    }
    const rows = fn => Array.from({ length: 30 }, (_, i) => fn(i + 1));
    next.content = rows(i => {
      const title = '原创密集样例 ' + i + ' · 图书馆与成人学习的观察、交流及证据复盘';
      const text = 'Adult learners share original ideas at the library. This synthetic passage ' + i + ' includes examples, evidence and a clear conclusion. It is not licensed material from a real learner.';
      const status = ['草稿', '待初审', '待终审', '可发布', '已发布'][i % 5];
      return { ...clone(SEED.content[0]), id: 'PX-FC' + i, title, text, version: 3, status, l1: i % 5 >= 2 ? 'l1' : null, l2: i % 5 >= 3 ? 'l2' : null, published: i % 5 === 4 ? 2 : null, history: [{ version: 1, title: title + ' · 初版', text: 'Original archived snapshot one. Adult learners read together.', l1: 'l1', l2: 'l2' }, { version: 2, title: title + ' · 已签发布快照', text: 'Original archived snapshot two. Evidence helps adult learners discuss clearly.', l1: 'l1', l2: 'l2' }], events: [{ time: '2026-10-11 09:30', text: '密集场景有完整版本历史，当前草稿不替代发布快照。' }] };
    });
    next.tickets = rows(i => ({ ...clone(SEED.tickets[0]), id: 'PX-FT' + i, learner: '合成学员 ' + i, title: '密集工单 ' + i + ' · 学习记录、订单回执及恢复状态需要逐项核对', status: i % 3 ? '待接单' : '处理中', assignee: i % 3 ? null : 'ops', messages: [{ who: '合成学员', text: '这是原创合成说明，请核对本机记录。不得读取或推断真实用户的学习数据、身份或订单。' }, { who: '合成客服', text: '已登记问题来源，后续交接必须指定接收人并填写处置原因。' }], events: [{ time: '2026-10-11 10:00', text: '合成工单建档，无真实消息发送' }] }));
    next.reports = rows(i => ({ id: 'PX-FJ' + i, title: '合成举报 ' + i + ' · 原创素材授权边界待核查', detail: '本记录用于演示安全分诊，完全没有真实举报者或外部内容。', status: '待分诊', risk: null }));
    next.risks = rows(i => ({ id: 'PX-FR' + i, title: '合成风险 ' + i + ' · 内容权利和供给版本核查', source: next.reports[i - 1].id, status: '待分诊', owner: null, target: null, reason: '', events: [] }));
    next.media = rows(i => ({ id: 'PX-FM' + i, name: 'original-synthetic-cover-' + i + '.png', type: 'image/png', bytes: 100000 + i * 2300, status: i % 4 ? '可用' : '失败', content: next.content[i - 1].id }));
    next.orders = rows(i => ({ ...clone(SEED.orders[0]), id: 'PX-FO' + i, title: '原创合成学习训练包 ' + i + ' · 已支付、权益与退款分开读回', amount: 29 + i, renewal: i % 2 === 0, refund: i % 3 === 0 ? 'PX-FRF' + i : null }));
    next.refunds = next.orders.filter(o => o.refund).map(o => ({ id: o.refund, order: o.id, applicant: 'support', reason: '合成退款：训练包不符合当前学习目标，请按规则核对。', status: '待初审', approvals: [] }));
    next.audit = rows(i => ({ ...clone(SEED.audit[0]), id: 'PX-FA' + i, time: '2026-10-11 10:' + String(i).padStart(2, '0'), action: '合成内容与资金事实核查 ' + i, subject: next.content[i - 1].id + '/v2', reason: '密集审计包含命名实体、不同审核人和具体合成原因，未调用真实后台。' }));
    next.jobs = rows(i => ({ id: 'PX-FJOB' + i, name: '合成投影与对账任务 ' + i, status: i % 3 ? '正常' : '恢复待处理', attempts: i % 5 + 1, reason: i % 3 ? '版本及来源一致' : '合成事件延迟，等待人工核对', receipts: [{ id: 'PX-FREC' + i, time: '2026-10-11 10:30', result: '合成来源版本对账通过' }] }));
    next.balance = 600; next.wallet = rows(i => ({ id: 'PX-FW' + i, amount: i % 4 ? 30 : -40, reason: '合成积分事实 ' + i + ' · 原创学习奖励或服装兑换' }));
    next.rewards.forEach(r => r.claimed = true); next.clothes.forEach(c => c.owned = true); next.equipped = next.clothes[0].id;
    next.alphabet.forEach(a => a.learned = true); next.phonics = { index: 3, answers: [true, true, true], completed: true };
    next.aiGate.consent = true;
    next.ai = { ...next.ai, draft: 'Please explain this original idea clearly.', phase: 'done', current: 'PX-FAI30', messages: rows(i => ({ who: i % 2 ? '合成输入' : '原创固定样例', text: '合成交互 ' + i + '：Please explain your idea and give one example. 本机固定原创响应，不是模型输出。' })), runs: rows(i => ({ id: 'PX-FAI' + i, scene: '英文邮件', status: '合成已完成', steps: [{ time: '2026-10-11 10:30', text: '合成准入检查与本机固定样例完成' }] })), accepted: rows(i => ({ id: 'PX-FADOPT' + i, run: 'PX-FAI' + i, text: '采纳原创合成建议 ' + i + '：先说明观点，再给出例子。' })) };
    next.voices = rows(i => ({ ...clone(SEED.voiceSamples[i % 2]), id: 'PX-FVOICE' + i, scene: '原创合成跟读 ' + i })); next.voice.phase = 'completed';
    next.k12 = { ...next.k12, consent: true, teacherVerified: true, permission: true, limit: 60, used: 55, assignment: '原创合成教材复习与客观题', completed: rows(i => ({ id: 'PX-FKR' + i, course: '原创隔离教材合成练习 ' + i, correct: i % 4 !== 0 })), events: rows(i => ({ time: '2026-10-11 10:30', text: '历史合成学习日 ' + i + ' · 当日预算独立核对，未采集真实未成年人资料' })) };
    return next;
  }
  window.PreviewWorkflowFixtures = Object.freeze({ roles: clone(roles), seed: clone(SEED), scenario: scenarioSeed });
})();
