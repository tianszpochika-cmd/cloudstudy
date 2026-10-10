<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { loginReturn, permissionPage } from '../domain/content-release'
import type { B8PolicyRule } from '@englishflow/contracts'
import AdminPageIntro from '../components/AdminPageIntro.vue'
import { adminI18n } from '../platform/v2-foundation'
import { b8PolicyT } from '../platform/b8-policy-i18n'
import { useB8PolicyStore } from '../stores/b8-policy'
import { useAdminStore } from '../stores/admin'
import { adminPages } from '../platform/experience'

const permissionCopy = permissionPage()
const store = useB8PolicyStore()
const session = useAdminStore()
const router = useRouter()

function backToAllowed(): void {
  const allowed = adminPages.filter((page) => session.can(page.permission)).map((page) => page.path)
  void router.push(loginReturn('', allowed))
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? b8PolicyT('unknownDate')
    : new Intl.DateTimeFormat(adminI18n.locale, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date)
}

function conditionText(rule: B8PolicyRule): string {
  const conditions = rule.conditions
  const parts: string[] = []
  if (conditions.phases?.length) parts.push(`${b8PolicyT('phase')} ${conditions.phases.join(', ')}`)
  if (conditions.requiresAdultEligibility) parts.push(`${b8PolicyT('adult')} 18+`)
  if (conditions.requiredConsentPurposes?.length) parts.push(conditions.requiredConsentPurposes.join(', '))
  if (conditions.minimumDeviceTrust) parts.push(`${b8PolicyT('deviceTrust')} ${conditions.minimumDeviceTrust}`)
  if (conditions.contentRights?.length) parts.push(`${b8PolicyT('rights')} ${conditions.contentRights.join(', ')}`)
  if (conditions.ownerMatchRequired) parts.push(b8PolicyT('ownerMatch'))
  if (conditions.tenantMatchRequired) parts.push(b8PolicyT('tenantMatch'))
  return parts.join(' · ') || '—'
}

onMounted(() => { void store.load() })
watch(() => session.isAuthenticated, (authenticated) => {
  if (!authenticated) void router.replace({ name: 'admin-login', query: { redirect: '/permissions', reason: 'expired' } })
})
</script>

<template>
  <div class="view-stack policy-page">
    <p data-permission-readonly>{{ permissionCopy.copy }}</p>
    <button type="button" data-permission-return @click="backToAllowed">回到有权页面</button>
    <AdminPageIntro>
      <el-button :loading="store.viewState === 'loading'" @click="store.load">
        {{ b8PolicyT('refresh') }}
      </el-button>
    </AdminPageIntro>

    <el-alert
      v-if="store.viewState === 'permission'"
      :title="store.lastError ?? b8PolicyT('permission')"
      type="warning" :closable="false" show-icon
    />
    <el-alert
      v-else-if="store.viewState === 'error'"
      :title="store.lastError ?? b8PolicyT('error')"
      type="error" :closable="false" show-icon
    />
    <el-card v-else-if="store.viewState === 'idle' || store.viewState === 'loading'" shadow="never">
      <el-skeleton :rows="4" animated />
    </el-card>
    <el-card v-else-if="store.viewState === 'empty'" shadow="never">
      <el-empty :description="b8PolicyT('empty')" />
    </el-card>
    <template v-else-if="store.viewState === 'ready'">
      <p class="policy-note">{{ b8PolicyT('note') }}</p>
      <el-card
        v-for="policy in store.items" :key="policy.policyVersionId"
        shadow="never" class="policy-card"
      >
        <div class="policy-heading">
          <div class="policy-title">
            <strong>{{ policy.document.name }}</strong>
            <span>{{ b8PolicyT('version') }} {{ policy.version }}</span>
          </div>
          <el-tag :type="policy.status === 'ACTIVE' ? 'success' : policy.status === 'REVOKED' ? 'danger' : 'info'">
            {{ b8PolicyT(`status.${policy.status}`) }}
          </el-tag>
        </div>
        <div class="policy-facts">
          <span>{{ b8PolicyT('updated') }} {{ formatTime(policy.updatedAt) }}</span>
          <span>{{ b8PolicyT('bindings') }} {{ policy.document.roleBindings.length }}</span>
          <span>{{ b8PolicyT('rules') }} {{ policy.document.rules.length }}</span>
          <span>{{ b8PolicyT('review') }} {{ b8PolicyT(policy.separationOfDuties.satisfied ? 'approved' : 'pending') }}</span>
        </div>
        <el-collapse class="policy-details">
          <el-collapse-item :name="policy.policyVersionId" :title="b8PolicyT('details')">
            <section class="policy-detail-section">
              <h3>{{ b8PolicyT('bindings') }}</h3>
              <p v-if="!policy.document.roleBindings.length">{{ b8PolicyT('noBindings') }}</p>
              <div v-for="binding in policy.document.roleBindings" :key="binding.roleCode" class="policy-detail-row">
                <strong>{{ b8PolicyT('role') }} {{ binding.roleCode }}</strong>
                <span>{{ b8PolicyT('permissions') }}: {{ binding.permissions.join(', ') }}</span>
              </div>
            </section>
            <section class="policy-detail-section">
              <h3>{{ b8PolicyT('rules') }}</h3>
              <p v-if="!policy.document.rules.length">{{ b8PolicyT('noRules') }}</p>
              <div v-for="(rule, index) in policy.document.rules" :key="index" class="policy-detail-row">
                <strong>{{ index + 1 }} · {{ b8PolicyT(rule.effect === 'ALLOW' ? 'allow' : 'deny') }}</strong>
                <span>{{ b8PolicyT('permissions') }}: {{ rule.requiredPermissions.join(', ') }}</span>
                <span>{{ b8PolicyT('action') }}: {{ rule.actions.join(', ') }}</span>
                <span>{{ b8PolicyT('resource') }}: {{ rule.resourceTypes.join(', ') }}</span>
                <span>{{ b8PolicyT('conditions') }}: {{ conditionText(rule) }}</span>
              </div>
            </section>
          </el-collapse-item>
        </el-collapse>
      </el-card>
      <el-alert v-if="store.moreError" :title="store.moreError" type="warning" :closable="false" show-icon />
      <div v-if="store.nextCursor" class="policy-load-more">
        <el-button :loading="store.loadingMore" @click="store.loadMore">{{ b8PolicyT('loadMore') }}</el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.policy-page { max-width: 1100px; min-width: 0; }
.policy-note { margin: 0; color: var(--admin-muted); font-size: 13px; }
.policy-card { min-width: 0; overflow: hidden; }
.policy-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.policy-title { display: grid; gap: 4px; min-width: 0; }
.policy-title strong { font-size: 16px; overflow-wrap: anywhere; }
.policy-title span, .policy-facts { color: var(--admin-muted); font-size: 13px; }
.policy-facts { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 14px 0 0; }
.policy-details { margin-top: 14px; }
.policy-detail-section { margin-bottom: 20px; min-width: 0; }
.policy-detail-section h3 { font-size: 14px; margin: 0 0 8px; }
.policy-detail-row { display: grid; gap: 5px; padding: 10px 0; border-top: 1px solid var(--admin-line); font-size: 13px; overflow-wrap: anywhere; }
.policy-load-more { display: flex; justify-content: center; }
.policy-page :deep(.mobile-table-hint) { display: none; }
@media (max-width: 600px) { .policy-heading { align-items: flex-start; } }
</style>
