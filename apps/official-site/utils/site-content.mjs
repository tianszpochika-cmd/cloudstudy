export const siteNavigation = Object.freeze([
  { label: "首页", to: "/" },
  { label: "课程体系", to: "/courses" },
  { label: "价格方案", to: "/pricing" },
  { label: "下载体验", to: "/download" },
  { label: "服务公告", to: "/announcements" },
  { label: "关于我们", to: "/about" },
]);

export const footerNavigation = Object.freeze([
  {
    title: "了解语学星",
    links: [
      { label: "课程体系", to: "/courses" },
      { label: "价格方案", to: "/pricing" },
      { label: "下载体验", to: "/download" },
      { label: "服务公告", to: "/announcements" },
      { label: "关于我们", to: "/about" },
    ],
  },
  {
    title: "公开信息",
    links: [
      { label: "合规公示", to: "/compliance" },
      { label: "隐私与数据", to: "/privacy" },
      { label: "用户协议", to: "/terms" },
      { label: "未成年人保护声明", to: "/minors" },
      { label: "服务状态", to: "/status" },
    ],
  },
]);

export const publicCourses = Object.freeze([
  {
    id: "daily-words",
    eyebrow: "词汇 · 规律复习",
    title: "日常词汇",
    description: "用短时、可回放的练习建立高频词汇的长期记忆。",
    level: "入门—进阶",
    duration: "每天 10–15 分钟",
    tags: ["SRS 复习", "场景词卡"],
  },
  {
    id: "clear-grammar",
    eyebrow: "语法 · 结构理解",
    title: "清晰语法",
    description: "从句子结构到常见错误，按规则理解而不是机械背诵。",
    level: "入门—进阶",
    duration: "每周 3 次",
    tags: ["规则反馈", "错因复盘"],
  },
  {
    id: "listening-reading",
    eyebrow: "听读 · 真实语境",
    title: "听读精练",
    description: "在有字幕、可回放的真实语境中训练理解与表达。",
    level: "进阶",
    duration: "每次 20–30 分钟",
    tags: ["字幕辅助", "进度保存"],
  },
  {
    id: "speaking-writing",
    eyebrow: "表达 · 规则练习",
    title: "表达训练",
    description: "通过可保存的口语与写作练习，形成看得见的进步轨迹。",
    level: "进阶",
    duration: "每周 2 次",
    tags: ["录音自评", "结构化反馈"],
  },
]);

export const pricingPlans = Object.freeze([
  {
    id: "free",
    name: "基础体验",
    price: "¥0",
    unit: "长期可用",
    description: "先建立学习习惯，再决定是否升级。",
    features: ["公开课程预览", "基础学习任务", "进度与复习提醒"],
    featured: false,
    availability: "available",
  },
  {
    id: "growth",
    name: "成长方案",
    price: "¥39",
    unit: "每月起",
    description: "为持续学习者提供更完整的课程与复盘空间。",
    features: ["完整 Phase 1 学习闭环", "更多复习与报告", "多端同步与客服支持"],
    featured: true,
    availability: "available",
  },
  {
    id: "team",
    name: "团队与机构",
    price: "敬请期待",
    unit: "公开后发布",
    description: "面向后续机构能力的公开说明，不在当前阶段售卖。",
    features: [
      "机构能力规划中",
      "公开发布后再开放咨询",
      "不创建未授权组织主体",
    ],
    featured: false,
    availability: "coming-soon",
  },
]);

export const downloadChannels = Object.freeze([
  {
    id: "learner-web",
    name: "学习 Web",
    platform: "PC / 平板浏览器",
    description: "无需安装，使用浏览器进入学习工作区。",
    availability: "available",
    action: "打开学习 Web",
  },
  {
    id: "mobile-app",
    name: "移动 App",
    platform: "iOS / Android / iPad",
    description: "移动端安装包与商店入口将在发布准备完成后开放。",
    availability: "coming-soon",
    action: "暂未开放",
  },
  {
    id: "wechat-mini-program",
    name: "微信小程序",
    platform: "后续条件编译目标",
    description: "小程序只从 apps/mobile 输出，不维护独立业务版本。",
    availability: "coming-soon",
    action: "暂未开放",
  },
]);

export const complianceNotices = Object.freeze([
  {
    title: "主体与备案信息",
    status: "准备公示",
    description:
      "正式主体、备案与许可信息以依法完成审核后的公示版本为准；未完成前不虚构证照或备案编号。",
  },
  {
    title: "隐私与数据处理",
    status: "公开说明",
    description:
      "官网仅展示公开信息，不收集登录后学习数据，不在公开页面提交密码、Token、录音或支付凭证。",
  },
  {
    title: "成人阶段边界",
    status: "Phase 1",
    description:
      "当前产品面向成年用户与大学生；K12、儿童账号、监护绑定及未成年人支付能力在专项合规 Gate 前不会开放。",
  },
]);

export const publicRoutes = Object.freeze([
  "/",
  "/courses",
  "/world",
  "/method",
  "/start",
  "/help",
  "/about",
  "/announcements",
  "/compliance",
  "/privacy",
  "/terms",
  "/minors",
  "/status",
  "/courses/daily-words",
  "/courses/clear-grammar",
  "/courses/listening",
  "/courses/reading",
  "/courses/speaking",
  "/courses/writing",
]);

export function filterCourses(courses, filter = "all") {
  if (filter === "all") return courses;
  return courses.filter((course) => course.level.includes(filter));
}
