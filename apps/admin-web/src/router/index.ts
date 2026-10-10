import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { pinia, useAdminStore } from "../stores/admin";
import { safeAdminReturnTo } from "../auth/gateway-auth";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    permission?: string;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "admin-login",
    component: () => import("../views/AdminLoginView.vue"),
  },
  {
    path: "/forbidden",
    name: "admin-forbidden",
    component: () => import("../views/AdminForbiddenView.vue"),
    meta: { requiresAuth: true },
  },
  { path: "/", redirect: "/dashboard" },
  { path: "/risk", redirect: "/governance" },
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
  {
    path: "/dashboard",
    name: "admin-dashboard",
    component: () => import("../views/AdminDashboardView.vue"),
    meta: { requiresAuth: true, permission: "admin.dashboard.read" },
  },
  {
    path: "/content",
    name: "admin-content",
    component: () => import("../views/AdminContentView.vue"),
    meta: { requiresAuth: true, permission: "admin.content.read" },
  },
  {
    path: "/lexemes",
    name: "admin-lexemes",
    component: () => import("../views/AdminLexemeView.vue"),
    meta: { requiresAuth: true, permission: "admin.content.read" },
  },
  {
    path: "/items",
    name: "admin-items",
    component: () => import("../views/AdminItemView.vue"),
    meta: { requiresAuth: true, permission: "admin.content.read" },
  },
  {
    path: "/learners",
    name: "admin-learners",
    component: () => import("../views/AdminLearnerView.vue"),
    meta: { requiresAuth: true, permission: "admin.learner.read" },
  },
  {
    path: "/phonetics",
    name: "admin-phonetics",
    component: () => import("../views/AdminPhoneticsView.vue"),
    meta: { requiresAuth: true, permission: "admin.content.read" },
  },
  {
    path: "/commerce",
    name: "admin-commerce",
    component: () => import("../views/AdminCommerceView.vue"),
    meta: { requiresAuth: true, permission: "admin.commerce.read" },
  },
  {
    path: "/audit",
    name: "admin-audit",
    component: () => import("../views/AdminAuditView.vue"),
    meta: { requiresAuth: true, permission: "admin.audit.read" },
  },
  {
    path: "/permissions",
    name: "admin-permissions-read",
    component: () => import("../views/AdminPermissionsView.vue"),
    meta: { requiresAuth: true, permission: "iam.policy.read" },
  },
  {
    path: "/release",
    name: "admin-release",
    component: () => import("../views/AdminB6ReleaseView.vue"),
    meta: { requiresAuth: true, permission: "admin.release.read" },
  },
  {
    path: "/governance",
    name: "admin-b12-governance",
    component: () => import("../views/AdminB12GovernanceView.vue"),
    meta: { requiresAuth: true, permission: "admin.moderation.read" },
  },
  {
    path: "/support",
    name: "admin-support",
    component: () => import("../views/AdminSupportView.vue"),
    meta: { requiresAuth: true, permission: "admin.support.read" },
  },
  {
    path: "/recovery",
    name: "admin-recovery",
    component: () => import("../views/AdminRecoveryView.vue"),
    meta: { requiresAuth: true, permission: "admin.recovery.read" },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
});
router.beforeEach(async (to) => {
  const session = useAdminStore(pinia);
  await session.restore();
  if (to.name === "admin-login" && session.isAuthenticated)
    return session.consumeReturnTo();
  if (to.meta.requiresAuth && !session.isAuthenticated) {
    const returnTo = safeAdminReturnTo(to.fullPath);
    session.setReturnTo(returnTo);
    return {
      name: "admin-login",
      query: {
        redirect: returnTo,
        reason: session.lastError === "SESSION_EXPIRED" ? "expired" : undefined,
      },
    };
  }
  if (to.meta.permission && !session.can(to.meta.permission)) {
    const returnTo = safeAdminReturnTo(to.fullPath);
    session.markForbidden({
      path: returnTo,
      permission: to.meta.permission,
      reason: "permission_not_granted",
    });
    return { name: "admin-forbidden", query: { from: returnTo } };
  }
  return true;
});
