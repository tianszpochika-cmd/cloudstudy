import type { MessagesByLocale } from './index'

/**
 * B4-09 UI message skeletons for French and German.
 *
 * Two key namespaces: `admin` (operations control plane) and `learner`
 * (learning clients). `zh-CN` is the complete source; `en-US` is complete for
 * the skeleton key set; `fr`/`de` are intentionally sparse — the runtime falls
 * back through `en-US` to `zh-CN` and never throws on a missing key (see
 * `packages/i18n/tests/starter-locales.test.mjs`). UI `locale` stays separate
 * from the content/learning language `contentLocale`.
 */
export const adminStarterMessages: MessagesByLocale = {
  'zh-CN': {
    admin: {
      common: {
        loading: '加载中',
        retry: '重试',
        save: '保存',
        cancel: '取消',
        query: '查询',
        refresh: '刷新',
        back: '返回',
      },
      language: {
        label: '界面语言',
        note: '仅切换界面语言，不影响内容语言。',
        zh: '中文',
        en: '英文',
        fr: '法文',
        de: '德文',
      },
    },
  },
  'en-US': {
    admin: {
      common: {
        loading: 'Loading',
        retry: 'Retry',
        save: 'Save',
        cancel: 'Cancel',
        query: 'Search',
        refresh: 'Refresh',
        back: 'Back',
      },
      language: {
        label: 'UI language',
        note: 'Switches the UI language only; the content language is unaffected.',
        zh: 'Chinese',
        en: 'English',
        fr: 'French',
        de: 'German',
      },
    },
  },
  fr: {
    admin: {
      common: {
        loading: 'Chargement',
        retry: 'Réessayer',
        save: 'Enregistrer',
        cancel: 'Annuler',
      },
      language: {
        label: "Langue de l'interface",
        note: "Change uniquement la langue de l'interface ; la langue du contenu est inchangée.",
        zh: 'Chinois',
        en: 'Anglais',
        fr: 'Français',
        de: 'Allemand',
      },
    },
  },
  de: {
    admin: {
      common: {
        loading: 'Wird geladen',
        retry: 'Wiederholen',
        save: 'Speichern',
        cancel: 'Abbrechen',
      },
      language: {
        label: 'Oberflächensprache',
        note: 'Wechselt nur die Oberflächensprache; die Inhaltssprache bleibt unverändert.',
        zh: 'Chinesisch',
        en: 'Englisch',
        fr: 'Französisch',
        de: 'Deutsch',
      },
    },
  },
}

export const learnerStarterMessages: MessagesByLocale = {
  'zh-CN': {
    learner: {
      common: {
        loading: '加载中',
        retry: '重试',
        continue: '继续',
        back: '返回',
      },
      plan: {
        today: '今日任务',
        start: '开始学习',
        empty: '今日暂无任务',
      },
      review: {
        due: '待复习',
        start: '开始复习',
      },
    },
  },
  'en-US': {
    learner: {
      common: {
        loading: 'Loading',
        retry: 'Retry',
        continue: 'Continue',
        back: 'Back',
      },
      plan: {
        today: "Today's tasks",
        start: 'Start learning',
        empty: 'No tasks today',
      },
      review: {
        due: 'Due for review',
        start: 'Start review',
      },
    },
  },
  fr: {
    learner: {
      common: {
        loading: 'Chargement',
        continue: 'Continuer',
      },
      plan: {
        today: "Tâches du jour",
        start: "Commencer à apprendre",
      },
    },
  },
  de: {
    learner: {
      common: {
        loading: 'Wird geladen',
        continue: 'Fortsetzen',
      },
      plan: {
        today: 'Heutige Aufgaben',
        start: 'Lernen starten',
      },
    },
  },
}
