<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError } from '../../api/client'
import { claimB12Reward, getB12RewardProbability, listB12RewardGrants, type B12RewardClaim, type B12RewardGrant, type B12RewardProbability } from '../../api/b12'
import { b12T } from '../../platform/b12-i18n'

type B12ViewStatus = 'idle' | 'loading' | 'success' | 'empty' | 'permission' | 'offline' | 'recovery' | 'error'

const chests = ref<B12RewardGrant[]>([])
const chestProbability = ref<B12RewardProbability | null>(null)
const lastChestResult = ref<B12RewardClaim | null>(null)
const status = ref<B12ViewStatus>('idle')
const actionKey = ref<string | null>(null)
const lastError = ref<string | null>(null)
const online = ref(typeof navigator === 'undefined' || navigator.onLine)

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function sourceOf(value: unknown): Record<string, unknown> { const root = isRecord(value) && isRecord(value.data) ? value.data : value; return isRecord(root) ? root : {} }
function text(value: unknown, fallback: string): string { return typeof value === 'string' && value.trim() ? value : fallback }
function number(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function errorStatus(error: unknown): B12ViewStatus { if (error instanceof ApiError) return error.status === 403 ? 'permission' : error.status === 409 ? 'recovery' : 'error'; return error instanceof TypeError ? 'offline' : 'error' }
function errorMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message ? error.message : fallback }

function parseGrants(value: unknown): B12RewardGrant[] {
  const root = sourceOf(value)
  const raw = Array.isArray(root.grants) ? root.grants : Array.isArray(root.items) ? root.items : []
  return raw.filter(isRecord).map((item) => {
    const statusValue: B12RewardGrant['status'] = (item.status ?? item.state) === 'CLAIMED' ? 'CLAIMED' : 'GRANTED'
    return { grantId: text(item.grantId, ''), rewardCode: text(item.rewardCode, 'LEARNING_REWARD'), status: statusValue, probabilityVersion: text(item.probabilityVersion, 'SERVER_RULE'), outcomeCode: typeof item.outcomeCode === 'string' ? item.outcomeCode : undefined, grantedAt: typeof item.grantedAt === 'string' ? item.grantedAt : undefined, claimedAt: typeof item.claimedAt === 'string' ? item.claimedAt : undefined }
  }).filter((item) => Boolean(item.grantId))
}

function parseProbability(value: unknown): B12RewardProbability | null {
  const root = sourceOf(value)
  const rawOutcomes = Array.isArray(root.outcomes) ? root.outcomes : Array.isArray(root.tiers) ? root.tiers : []
  if (!root.grantId || !rawOutcomes.length) return null
  return { grantId: text(root.grantId, ''), rewardCode: text(root.rewardCode, 'LEARNING_REWARD'), probabilityVersion: text(root.probabilityVersion, 'SERVER_RULE'), outcomes: rawOutcomes.filter(isRecord).map((item) => ({ outcomeCode: text(item.outcomeCode ?? item.tierCode, 'UNKNOWN'), probability: typeof item.probability === 'number' ? item.probability : number(item.basisPoints) / 10000 })).filter((item) => item.probability >= 0), totalProbability: number(root.totalProbability, 1), disclosedBeforeClaim: root.disclosedBeforeClaim !== false, probabilitySnapshotHash: typeof root.probabilitySnapshotHash === 'string' ? root.probabilitySnapshotHash : undefined }
}

function parseClaim(value: unknown): B12RewardClaim | null {
  const root = sourceOf(value)
  if (!root.grantId || (root.claimed !== true && root.state !== 'CLAIMED' && root.state !== 'ALREADY_CLAIMED')) return null
  return { grantId: text(root.grantId, ''), claimed: true, replayed: root.replayed === true || root.state === 'ALREADY_CLAIMED', outcomeCode: typeof root.outcomeCode === 'string' ? root.outcomeCode : undefined, probabilityVersion: typeof root.probabilityVersion === 'string' ? root.probabilityVersion : undefined, claimedAt: typeof root.claimedAt === 'string' ? root.claimedAt : undefined }
}

async function loadRewards(): Promise<void> {
  status.value = 'loading'; lastError.value = null; actionKey.value = 'rewards.load'
  try { chests.value = parseGrants(await listB12RewardGrants()); status.value = chests.value.length ? 'success' : 'empty'; const first = chests.value.find((item) => item.status === 'GRANTED'); if (first) await loadProbability(first.grantId) }
  catch (error) { status.value = errorStatus(error); lastError.value = errorMessage(error, '奖励读取失败；未使用本地奖励数据。') }
  finally { actionKey.value = null }
}

async function loadProbability(grantId: string): Promise<void> {
  actionKey.value = `probability.${grantId}`
  try { chestProbability.value = parseProbability(await getB12RewardProbability(grantId)); if (!chestProbability.value) throw new Error('服务端未返回概率快照。'); status.value = 'success'; lastError.value = null }
  catch (error) { status.value = errorStatus(error); lastError.value = errorMessage(error, '概率读取失败；未进行客户端抽取。') }
  finally { actionKey.value = null }
}

async function openChest(grantId: string): Promise<void> {
  actionKey.value = `claim.${grantId}`
  try { lastChestResult.value = parseClaim(await claimB12Reward(grantId)); if (!lastChestResult.value) throw new Error('服务端未返回奖励领取结果。'); chests.value = chests.value.map((item) => item.grantId === grantId ? { ...item, status: 'CLAIMED', outcomeCode: lastChestResult.value?.outcomeCode, claimedAt: lastChestResult.value?.claimedAt } : item); status.value = 'success'; lastError.value = null }
  catch (error) { status.value = errorStatus(error); lastError.value = errorMessage(error, '奖励领取失败；未在本地增加任何分数或奖励。') }
  finally { actionKey.value = null }
}

function percent(probability: number, total: number): string { return `${((probability / (total > 0 ? total : 1)) * 100).toFixed(2)}%` }

onMounted(() => { void loadRewards() })
</script>

<template>
  <section class="b12-card b12-rewards" aria-labelledby="b12-rewards-title">
    <div class="b12-heading"><div><p class="b12-kicker">REWARD GRANT</p><h2 id="b12-rewards-title">{{ b12T('rewards.title') }}</h2></div><span class="b12-state">{{ actionKey === 'rewards.load' ? b12T('status.loading') : chests.length || b12T('status.empty') }}</span></div>
    <p class="b12-muted">{{ b12T('rewards.freeNotice') }}</p>
    <div v-if="actionKey === 'rewards.load'" class="b12-inline-state" role="status">{{ b12T('status.loading') }}</div>
    <div v-else-if="chests.length" class="b12-chest-list">
      <article v-for="chest in chests" :key="chest.grantId" class="b12-chest">
        <div><strong>{{ chest.rewardCode }}</strong><small>{{ chest.status === 'CLAIMED' ? b12T('rewards.opened') : b12T('rewards.granted') }} · {{ chest.probabilityVersion }}</small></div>
        <span class="b12-chest__kind">FREE</span>
        <div class="b12-actions"><button class="button button--secondary" type="button" :disabled="Boolean(actionKey) || !online" @click="loadProbability(chest.grantId)">{{ actionKey === `probability.${chest.grantId}` ? b12T('status.loading') : b12T('rewards.probability') }}</button><button class="button button--primary" type="button" :disabled="chest.status !== 'GRANTED' || Boolean(actionKey) || !online" @click="openChest(chest.grantId)">{{ actionKey === `claim.${chest.grantId}` ? b12T('rewards.opening') : chest.status === 'CLAIMED' ? b12T('rewards.opened') : b12T('rewards.open') }}</button></div>
      </article>
    </div>
    <p v-else class="b12-inline-state">{{ b12T('rewards.empty') }}</p>
    <div v-if="chestProbability" class="b12-probability" role="status"><strong>{{ b12T('rewards.probability') }} · {{ chestProbability.probabilityVersion }}</strong><span v-for="outcome in chestProbability.outcomes" :key="outcome.outcomeCode">{{ b12T('rewards.tier') }} {{ outcome.outcomeCode }}：{{ percent(outcome.probability, chestProbability.totalProbability) }}</span><small>{{ chestProbability.disclosedBeforeClaim ? '服务端已在领取前披露规则' : '服务端规则未披露' }} · {{ chestProbability.probabilitySnapshotHash ?? '服务端快照' }}</small></div>
    <div v-if="lastChestResult" class="b12-result" role="status"><strong>{{ b12T('rewards.confirmed') }}</strong><span>{{ lastChestResult.outcomeCode ?? '结果未返回' }} · {{ lastChestResult.replayed ? '幂等重放' : '首次返回' }}</span><small>{{ b12T('rewards.audit') }}：{{ lastChestResult.grantId }} · {{ b12T('rewards.rule') }}：{{ lastChestResult.probabilityVersion ?? '未返回' }}</small></div>
    <p v-if="status === 'permission'" class="b12-inline-state">{{ b12T('status.permission') }}</p><p v-else-if="status === 'offline'" class="b12-inline-state">{{ b12T('status.offline') }}</p><p v-else-if="status === 'recovery'" class="b12-inline-state">{{ b12T('status.recovery') }}</p><p v-else-if="lastError" class="b12-inline-state">{{ lastError }}</p>
  </section>
</template>

<style scoped>
.b12-card{display:grid;gap:16px;padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.b12-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.b12-kicker{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.b12-heading h2{margin:8px 0 0;font-size:22px}.b12-state,.b12-muted,.b12-chest small,.b12-probability small{color:var(--yx-color-text-secondary);font-size:13px;line-height:1.6}.b12-muted{margin:0}.b12-inline-state{margin:0;padding:16px;border:1px dashed var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-secondary);line-height:1.6}.b12-chest-list{display:grid;gap:10px}.b12-chest{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px;border:1px solid var(--yx-color-border);border-radius:12px}.b12-chest>div:first-child{display:grid;gap:4px}.b12-chest__kind{padding:5px 8px;border-radius:8px;color:var(--yx-color-success);background:color-mix(in srgb,var(--yx-color-success) 12%,transparent);font-size:12px;font-weight:700}.b12-actions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}.b12-actions .button{min-height:40px}.b12-probability,.b12-result{display:grid;gap:6px;padding:14px;border-radius:12px;background:var(--yx-color-brand-primary-soft)}.b12-probability span,.b12-result span,.b12-result small{color:var(--yx-color-text-secondary);font-size:13px}.b12-result{color:var(--yx-color-success);background:color-mix(in srgb,var(--yx-color-success) 10%,transparent)}.b12-result strong{color:var(--yx-color-success)}button:disabled{cursor:not-allowed;opacity:.55}@media(max-width:640px){.b12-card{padding:18px}.b12-chest{grid-template-columns:1fr}.b12-chest__kind{justify-self:start}.b12-actions{grid-column:auto;display:grid}.b12-actions .button{width:100%}}
</style>
