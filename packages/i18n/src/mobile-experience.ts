import type { MessagesByLocale } from './index'

const pageRows = [
  ['home', 'YOUR DAILY SPACE', '每天一点，\n离世界更近一点。', '从今天的小目标开始，让每一次练习都有收获。', '学习', 'A little every day.', 'Start small. Make every practice count.', 'Learn'],
  ['learn', 'MY LEARNING', '把好奇，变成你的能力。', '继续课程、巩固所学，找到适合自己的学习节奏。', '课程', 'Follow your curiosity.', 'Continue a course and revisit what you have learned.', 'Courses'],
  ['practice', 'PRACTICE STUDIO', '今天，想练点什么？', '听说读写，每一种进步都从一次练习开始。', '练习中心', 'What will you practise?', 'Make room for listening, speaking, reading and writing.', 'Practice studio'],
  ['b2-practice', 'PRACTICE STUDIO', '小小练习，大大进步。', '专注当前这一题，完成后查看反馈与复习建议。', '练习', 'One question at a time.', 'Focus, answer and discover your next step.', 'Practice'],
  ['b2-vocabulary', 'WORD GARDEN', '让每个单词，留下来。', '先回想，再揭晓。用适合你的节奏巩固记忆。', '单词复习', 'Make every word stay.', 'Recall, reveal and build a lasting memory.', 'Vocabulary'],
  ['b3-grammar', 'SENTENCE LAB', '读懂句子的秘密。', '拆解结构、调整语序，把语法变成表达的底气。', '语法结构', 'Find the shape of a sentence.', 'Explore structure and practise with confidence.', 'Grammar'],
  ['b3-writing', 'WRITING DESK', '把想法，写成文字。', '从一句话开始，在修改中找到更清晰的表达。', '写作练习', 'Give your ideas a voice.', 'Start with a sentence and refine your expression.', 'Writing'],
  ['b3-listening', 'LISTEN CLOSELY', '慢一点，听清每一句。', '分段聆听、循环回放，再写下听到的内容。', '听力听写', 'Listen a little closer.', 'Listen in segments, repeat and write what you hear.', 'Dictation'],
  ['b3-reading', 'READING NOOK', '在阅读里，遇见世界。', '读懂一段文字，收藏值得反复回味的表达。', '阅读练习', 'Find a world in a paragraph.', 'Read deeply and collect useful expressions.', 'Reading practice'],
  ['b3-speaking', 'SPEAK WITH CONFIDENCE', '开口，就是新的开始。', '学习发音、录下声音，在回听中找到自己的进步。', '发音练习', 'Begin with your own voice.', 'Explore sounds, record and listen back.', 'Pronunciation'],
  ['b11-listening', 'LISTENING ROOM', '听见更大的世界。', '逐句精听、循环片段，让耳朵慢慢熟悉语言。', '听力精练', 'Hear a wider world.', 'Listen closely, loop a segment and build familiarity.', 'Listening'],
  ['b11-reading', 'READING NOOK', '翻开属于你的新一页。', '选择适合的阅读难度，把好表达收入日常。', '分级阅读', 'Turn a new page.', 'Read at your level and discover useful expressions.', 'Reading'],
  ['b11-speaking', 'FIND YOUR VOICE', '让表达，更从容一点。', '听示范、练跟读、做自评，每次开口都是积累。', '口语跟读', 'Find your voice.', 'Listen, shadow and reflect on your own speaking.', 'Speaking'],
  ['world', 'YOUR GROWING WORLD', '每一步，都在闪闪发光。', '记录坚持，收获成长，也遇见一起努力的伙伴。', '成长', 'Watch your world grow.', 'Celebrate progress and learn alongside others.', 'Growth'],
  ['b4-games', 'PLAY & LEARN', '换个方式，练出好状态。', '在轻松的小挑战里，巩固单词与句子。', '学习游戏', 'Learn through a little play.', 'Strengthen words and sentences with small challenges.', 'Games'],
  ['b4-social', 'FOCUS TOGETHER', '一起专注，各自闪光。', '找一间自习室，给自己一段不被打扰的时光。', '自习室', 'Find your focus, together.', 'Join a study room and make time for yourself.', 'Study rooms'],
  ['b4-avatar', 'A LITTLE MORE YOU', '装扮独一无二的自己。', '选择喜欢的风格，让你的成长空间更有个性。', '我的形象', 'A little more you.', 'Choose a look for your personal learning world.', 'My avatar'],
  ['b4-offline', 'LEARNING TO GO', '把学习，带在身边。', '管理离线内容与待同步记录，联网后继续前进。', '离线学习', 'Take learning with you.', 'Manage downloads and sync your progress when online.', 'Offline'],
  ['b5-commerce', 'YOUR LEARNING ACCESS', '让学习，多一些可能。', '查看可用课程权益、订单与恢复进度。', '学习权益', 'More room to learn.', 'Review your learning access and orders.', 'Learning access'],
  ['b6-platform', 'MADE FOR YOUR DEVICE', '让学习，流畅又舒适。', '选择适合设备的画质，了解无障碍与兼容支持。', '画质与设备', 'Comfort on every device.', 'Adjust quality and explore accessibility support.', 'Device & quality'],
  ['profile', 'MY LITTLE UNIVERSE', '你好，持续成长的你。', '照顾好自己的学习节奏，也为每一步进步留个位置。', '我的', 'Hello, growing you.', 'Make room for your pace and your progress.', 'Me'],
  ['login', 'WELCOME BACK', '好久不见，\n今天也学一点。', '登录语学星，让今天的进步从这里开始。', '登录', 'Welcome back.\nYour journey continues.', 'Sign in and make space for a little progress.', 'Sign in'],
  ['register', 'A NEW CHAPTER', '新的世界，\n从第一句开始。', '创建你的账号，开启属于自己的语言学习旅程。', '注册', 'A new chapter\nstarts with a word.', 'Create an account and start your learning journey.', 'Create account'],
  ['reset-password', 'LET’S GET YOU BACK', '找回账号，\n接着向前走。', '输入账号获取重置指引，安全设置新的密码。', '找回密码', 'Let’s get you\nback on track.', 'Request reset instructions and set a new password.', 'Reset password'],
  ['forbidden', 'A MOMENT TO CHECK', '这里暂时还不能进入。', '请确认登录状态或学习权限，也可以联系帮助中心。', '访问权限', 'This space is not available yet.', 'Check your account or contact support for help.', 'Access'],
  ['onboarding', 'YOUR FIRST STEP', '找到属于你的学习节奏。', '确认基本信息，选择目标，准备开启第一天。', '学习起点', 'Find your own rhythm.', 'Confirm your details and choose a learning goal.', 'Getting started'],
  ['assessment', 'FIND YOUR START', '从了解自己开始。', '完成一组小测评，找到适合你的学习起点。', '水平测评', 'Find your starting point.', 'Take a short assessment to guide your learning.', 'Assessment'],
  ['today', 'ONE DAY AT A TIME', '今天，也向前一点点。', '按自己的节奏完成任务，让努力积累成习惯。', '今日任务', 'A little further today.', 'Complete today’s tasks at your own pace.', 'Today'],
  ['b10-report', 'LOOK HOW FAR YOU’VE COME', '看见进步，找到下一步。', '回顾学习记录，订正错题，让薄弱处慢慢变强。', '学习报告', 'See your progress.', 'Reflect, revisit mistakes and plan your next step.', 'Reports'],
  ['settings', 'MAKE YOURSELF COMFORTABLE', '舒服的节奏，才走得更远。', '调整学习目标、外观与动效，让这里更适合你。', '设置', 'Make yourself comfortable.', 'Adjust your goals, appearance and motion.', 'Settings'],
  ['support', 'WE’RE HERE TO HELP', '有疑问，我们一起解决。', '选择问题类型，查看与跟进你的帮助请求。', '帮助中心', 'We’re here to help.', 'Choose a category and follow your support requests.', 'Help'],
] as const

function pages(english: boolean) {
  return Object.fromEntries(pageRows.map(([key, kicker, title, description, short, enTitle, enDescription, enShort]) =>
    [key, { kicker, title: english ? enTitle : title, description: english ? enDescription : description, short: english ? enShort : short }]))
}
export const mobileExperienceMessages: MessagesByLocale = {
  'zh-CN': { mobile: { brand: '语学星', morePractice: '更多练习与学习报告', resetSent: '如果账号存在，重置指引已发出，请查看你的邮箱。', resetComplete: '密码已重置。请返回登录，使用新密码继续学习。', back: '返回', settings: '设置', authTag: '为热爱学习的你', practiceHeading: '找到今天的练习灵感', practiceNote: '听 · 说 · 读 · 写', account: '账号登录', register: '创建账号', forgot: '忘记密码？', toLogin: '已有账号？去登录', show: '显示', hide: '隐藏', adultNote: '目前面向 18 岁及以上成人与大学生', profileLinks: '学习与服务', availability: { PUBLISHED: '可以学习', UNPUBLISHED: '暂未开放', RIGHTS_PENDING: '等待授权', RIGHTS_EXPIRED: '授权已到期', NOT_READY: '准备中' }, pages: pages(false) } },
  'en-US': { mobile: { brand: 'EnglishFlow', morePractice: 'More practice & reports', resetSent: 'If the account exists, reset instructions have been sent. Please check your email.', resetComplete: 'Password reset. Return to sign in with your new password.', back: 'Back', settings: 'Settings', authTag: 'For the curious learner', practiceHeading: 'Find your practice', practiceNote: 'Listen · Speak · Read · Write', account: 'Sign in', register: 'Create account', forgot: 'Forgot password?', toLogin: 'Already a member? Sign in', show: 'Show', hide: 'Hide', adultNote: 'For adult learners aged 18 and over', profileLinks: 'Learning & services', availability: { PUBLISHED: 'Available', UNPUBLISHED: 'Not available', RIGHTS_PENDING: 'Pending access', RIGHTS_EXPIRED: 'Access expired', NOT_READY: 'Preparing' }, pages: pages(true) } },
}
