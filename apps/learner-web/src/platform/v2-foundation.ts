import { createI18n } from '@englishflow/i18n'
import { createVueWebI18nAdapter } from '@englishflow/i18n/adapters'
import { createThemeController } from '@englishflow/design-tokens'
import { createVueWebThemeAdapter } from '@englishflow/design-tokens/adapters'

const browserStorage = typeof localStorage === 'undefined' ? undefined : localStorage
const root = typeof document === 'undefined' ? undefined : document.documentElement

export const learnerI18n = createI18n({
  locale: 'zh-CN',
  contentLocale: 'en-US',
  messages: {
    'zh-CN': {
      common: { loading: '加载中', retry: '重试', state: { loading: '正在加载', empty: '暂无可用数据', error: '暂时无法完成', permission: '当前没有访问权限', recovery: '正在恢复安全快照', offline: '当前处于离线状态', success: '已完成', partial: '部分内容可用' } },
      auth: {
        login: { title: '登录学习空间', description: '登录将跳转到受控的身份服务入口，不在学习端保存长期凭证。', start: '通过身份服务登录', restore: '恢复已有会话', pending: '身份服务尚未获批，当前只提供可替换的登录入口。', noSuccess: '没有收到有效回调，因此未伪造登录成功。', failed: '登录暂时未完成，请重试或返回官网。', adultRequired: '继续学习前需要完成成人用户 Gate。' },
        callback: { title: '正在恢复学习会话', restoring: '正在校验回调并恢复安全会话…', failed: '认证回调未完成，当前仍未登录。', returning: '会话已建立，正在返回原页面…' },
        session: { restoring: '正在恢复会话…', restored: '会话已恢复', expired: '会话已失效，请重新登录。', logout: '正在撤销会话…', logoutFailed: '撤销服务暂时不可用，已清除本地会话，请重新登录。' },
        forbidden: { title: '暂时没有访问权限', description: '服务端权限策略拒绝了当前资源；客户端不会通过角色或租户字段绕过限制。', retry: '重新读取权限', login: '返回登录', empty: '服务端尚未返回可展示的权限快照。' },
        adult: { title: '成人用户 Gate', description: 'Phase 1 仅面向成年用户与大学生。确认后由服务端记录同意事实，客户端不会自行修改权限。', birthYear: '出生年份', confirm: '确认并继续', rejected: '服务端没有接受成人 Gate，请联系支持或稍后重试。' },
        error: { network: '身份服务暂时不可用，请稍后重试。', generic: '认证状态暂时无法确定。' },
      },
      learning: {
        preferences: { uiLocale: '界面', contentLocale: '内容', theme: '主题', zh: '中文', en: 'English', system: '跟随系统', light: '亮色', dark: '暗色', 'high-contrast': '高对比' },
        state: { loading: '正在读取学习数据…', retry: '重新读取', offline: '网络暂时不可用，已保留最近一次安全快照。', error: '学习服务暂时不可用。', forbidden: '当前账号没有访问这项学习数据的权限。', contentUnavailable: '学习内容已下线或当前版本不可用。', empty: '暂时没有可用的学习内容。', cached: '当前显示的是本地安全快照。' },
        onboarding: { eyebrow: 'FIRST DAY · {{step}}/2', title: '先定一个适合你的学习起点。', description: '只收集完成学习闭环所需的信息；偏好之后可以在设置中修改。', adultTitle: '成人学习确认', welcome: '欢迎来到语学星', adultDescription: 'Phase 1 面向 18 岁以上成人与大学生。', birthYear: '出生年份', ageConfirm: '我确认自己已满 18 周岁', privacy: '我同意隐私说明', terms: '我同意学习服务条款', planTitle: '学习计划', goalTitle: '你想先解决什么？', focusTitle: '可选重点（最多 3 个）', quotaTitle: '每天愿意投入多久？', previous: '上一步', continue: '继续设置目标', save: '保存并开始测评', loading: '正在准备目标选项…', empty: '服务端暂时没有返回可用的目标选项。', forbidden: '当前账号没有权限读取目标配置。' },
        assessment: { eyebrow: 'RULE-BASED PLACEMENT', title: '用 10 道题找到今天的起点。', description: '结果只解释当前学习起点；测评可以中断并从安全断点继续。', loading: '正在准备测评…', empty: '当前没有可用的测评内容。', start: '开始测评', submit: '提交答案', submitting: '正在记录…', complete: '测评完成', score: '{{level}} · {{score}} 分', vocabulary: '估算词汇量', listening: '听力表现', today: '查看今日任务', fastTrack: '已有成绩？快速定级', zero: '零基础 A1', cet4: '四级 B1', cet6: '六级 B2', postgrad: '考研 B2+', continue: '继续上次测评' },
        home: { eyebrow: 'ADAPTIVE HOME', title: '今天，从一个清晰的小任务开始。', description: '首页会组合 learner-service 的学习投影与 content-service 的已发布内容。', streak: '连续学习', coins: '星星', today: '今日任务', continue: '继续学习', openToday: '查看今日任务', content: '推荐内容', emptyTasks: '今日暂时没有任务。', emptyDescription: '完成目标和测评后，服务端会生成下一步学习流。' },
        today: { eyebrow: "TODAY'S LOOP", title: '今天完成一个小闭环。', description: '新内容、复习和错题会按服务端任务投影排列。', progress: '今日进度', target: '今日目标', minutes: '已完成 {{minutes}} 分钟', tasks: '今日任务', complete: '完成', completed: '已完成', pending: '待同步', continue: '继续学习', noTasks: '今天没有待办任务。', noTasksDescription: '可以先回到首页，等待下一次任务投影。' },
      content: { published: '已发布', withdrawn: '内容已下线', unavailable: '内容暂不可用', locale: '内容语言：{{locale}}' },
      navigation: { home: '学习', today: '今日任务', assessment: '测评', onboarding: '新手引导' },
      error: { retry: '重试', goHome: '返回学习首页', goLogin: '返回登录' },
      },
    },
    'en-US': {
      common: { loading: 'Loading', retry: 'Retry', state: { loading: 'Loading', empty: 'Nothing is available', error: 'Unable to complete right now', permission: 'Access is not allowed', recovery: 'Recovering the safe snapshot', offline: 'You are offline', success: 'Completed', partial: 'Partially available' } },
      auth: {
        login: { title: 'Sign in to learning space', description: 'Sign-in opens a controlled identity seam; long-lived credentials are not stored in the learner app.', start: 'Continue with identity provider', restore: 'Restore existing session', pending: 'The identity provider is not approved yet; this is a replaceable login seam.', noSuccess: 'No valid callback was received, so no login success was fabricated.', failed: 'Sign-in did not complete. Try again or return to the official site.', adultRequired: 'Complete the adult-user gate before continuing.' },
        callback: { title: 'Restoring learning session', restoring: 'Validating callback and restoring a secure session…', failed: 'The authentication callback did not complete; you are still signed out.', returning: 'Session established. Returning to the original page…' },
        session: { restoring: 'Restoring session…', restored: 'Session restored', expired: 'Your session expired. Please sign in again.', logout: 'Revoking session…', logoutFailed: 'Revocation is unavailable; local session was cleared. Please sign in again.' },
        forbidden: { title: 'Access is not allowed', description: 'The server-side policy denied this resource; client role or tenant fields cannot bypass it.', retry: 'Reload permissions', login: 'Return to sign in', empty: 'The server has not returned a displayable permission snapshot.' },
        adult: { title: 'Adult-user gate', description: 'Phase 1 is for adults and university students. The server records consent; the client cannot grant access locally.', birthYear: 'Birth year', confirm: 'Confirm and continue', rejected: 'The server did not accept the adult-user gate. Try again later.' },
        error: { network: 'The identity service is temporarily unavailable.', generic: 'Authentication status could not be determined.' },
      },
      learning: {
        preferences: { uiLocale: 'UI', contentLocale: 'Content', theme: 'Theme', zh: '中文', en: 'English', system: 'System', light: 'Light', dark: 'Dark', 'high-contrast': 'High contrast' },
        state: { loading: 'Loading learning data…', retry: 'Reload', offline: 'The network is unavailable. Your last safe snapshot is still available.', error: 'The learning service is temporarily unavailable.', forbidden: 'This account is not allowed to read this learning data.', contentUnavailable: 'The learning content was withdrawn or this version is unavailable.', empty: 'There is no learning content available yet.', cached: 'Showing the local safe snapshot.' },
        onboarding: { eyebrow: 'FIRST DAY · {{step}}/2', title: 'Choose a learning start that fits you.', description: 'We only collect what the learning loop needs. Preferences can be changed later.', adultTitle: 'Adult learner confirmation', welcome: 'Welcome to Yuxuexing', adultDescription: 'Phase 1 is for adults and university students aged 18+.', birthYear: 'Birth year', ageConfirm: 'I confirm that I am at least 18', privacy: 'I agree to the privacy notice', terms: 'I agree to the learning terms', planTitle: 'Learning plan', goalTitle: 'What do you want to solve first?', focusTitle: 'Optional focus (up to 3)', quotaTitle: 'How much time can you invest daily?', previous: 'Back', continue: 'Set learning goal', save: 'Save and start placement', loading: 'Loading goal options…', empty: 'The service has not returned any goal options.', forbidden: 'This account cannot read goal configuration.' },
        assessment: { eyebrow: 'RULE-BASED PLACEMENT', title: 'Find today’s starting point in 10 questions.', description: 'The result explains your current starting point. You can pause and resume from a safe checkpoint.', loading: 'Preparing placement…', empty: 'No placement content is available right now.', start: 'Start placement', submit: 'Submit answer', submitting: 'Saving…', complete: 'Placement complete', score: '{{level}} · {{score}} points', vocabulary: 'Estimated vocabulary', listening: 'Listening', today: 'View today’s tasks', fastTrack: 'Have prior results? Fast-track', zero: 'Beginner A1', cet4: 'CET-4 B1', cet6: 'CET-6 B2', postgrad: 'Postgraduate B2+', continue: 'Resume placement' },
        home: { eyebrow: 'ADAPTIVE HOME', title: 'Start today with one clear, small task.', description: 'The home feed composes learner-service projections with published content from content-service.', streak: 'Learning streak', coins: 'Stars', today: 'Today’s tasks', continue: 'Continue learning', openToday: 'View today’s tasks', content: 'Recommended content', emptyTasks: 'There are no tasks today yet.', emptyDescription: 'Complete your goal and placement so the service can build the next learning stream.' },
        today: { eyebrow: "TODAY'S LOOP", title: 'Complete one small learning loop today.', description: 'New learning, review, and mistake repair are ordered by the server task projection.', progress: 'Today’s progress', target: 'Daily target', minutes: '{{minutes}} minutes completed', tasks: 'Today’s tasks', complete: 'Complete', completed: 'Completed', pending: 'Pending sync', continue: 'Continue learning', noTasks: 'There are no tasks due today.', noTasksDescription: 'Return to Home and wait for the next task projection.' },
        content: { published: 'Published', withdrawn: 'Content withdrawn', unavailable: 'Content unavailable', locale: 'Content language: {{locale}}' },
        navigation: { home: 'Learn', today: 'Today', assessment: 'Placement', onboarding: 'Onboarding' },
        error: { retry: 'Retry', goHome: 'Back to Home', goLogin: 'Back to sign in' },
      },
    },
  },
})
export const learnerI18nAdapter = createVueWebI18nAdapter(learnerI18n, { localeStorage: browserStorage })
export const learnerThemeController = createThemeController({ storage: browserStorage })
export const learnerThemeAdapter = createVueWebThemeAdapter(learnerThemeController, root)
