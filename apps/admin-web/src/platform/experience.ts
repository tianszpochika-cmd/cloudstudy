import { ref } from "vue";
import { adminI18n } from "./v2-foundation";
import type { AdminIconName } from "../components/AdminIcon.vue";

const locale = ref(adminI18n.locale);
adminI18n.subscribe((state) => {
  locale.value = state.locale;
});
export function ui(key: string, values?: Record<string, unknown>): string {
  locale.value;
  return adminI18n.t(`admin.${key}`, values);
}
export const adminPages: Array<{
  key: string;
  path: string;
  group: string;
  icon: AdminIconName;
  permission: string;
  keywords: string;
}> = [
  {
    key: "dashboard",
    path: "/dashboard",
    group: "overview",
    icon: "home",
    permission: "admin.dashboard.read",
    keywords: "首页 总览 dashboard",
  },
  {
    key: "content",
    path: "/content",
    group: "content",
    icon: "content",
    permission: "admin.content.read",
    keywords: "双审 内容 发布 草稿 content review",
  },
  {
    key: "lexemes",
    path: "/lexemes",
    group: "content",
    icon: "book",
    permission: "admin.content.read",
    keywords: "单词 词汇 发音 lexemes vocabulary",
  },
  {
    key: "items",
    path: "/items",
    group: "content",
    icon: "audit",
    permission: "admin.content.read",
    keywords: "题目 例句 语法 练习 导入 questions items",
  },
  {
    key: "phonetics",
    path: "/phonetics",
    group: "content",
    icon: "audio",
    permission: "admin.content.read",
    keywords: "音标 音素 发音 phonetics",
  },
  {
    key: "learners",
    path: "/learners",
    group: "operations",
    icon: "people",
    permission: "admin.learner.read",
    keywords: "学员 用户 目标 计划 SRS learners",
  },
  {
    key: "support",
    path: "/support",
    group: "operations",
    icon: "support",
    permission: "admin.support.read",
    keywords: "工单 客服 support tickets",
  },
  {
    key: "commerce",
    path: "/commerce",
    group: "operations",
    icon: "wallet",
    permission: "admin.commerce.read",
    keywords: "订单 退款 财务 commerce refund",
  },
  {
    key: "governance",
    path: "/governance",
    group: "operations",
    icon: "flag",
    permission: "admin.moderation.read",
    keywords: "社群 治理 举报 governance",
  },
  {
    key: "audit",
    path: "/audit",
    group: "assurance",
    icon: "shield",
    permission: "admin.audit.read",
    keywords: "审计 合规 audit",
  },
  {
    key: "permissions",
    path: "/permissions",
    group: "assurance",
    icon: "settings",
    permission: "iam.policy.read",
    keywords: "策略版本 IAM 权限 policy permissions",
  },
  {
    key: "release",
    path: "/release",
    group: "assurance",
    icon: "release",
    permission: "admin.release.read",
    keywords: "发布 质量 release",
  },
  {
    key: "recovery",
    path: "/recovery",
    group: "assurance",
    icon: "help",
    permission: "admin.recovery.read",
    keywords: "恢复 补偿 recovery",
  },
];
