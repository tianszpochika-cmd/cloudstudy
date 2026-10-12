<script setup lang="ts">
import { computed, ref } from 'vue'
import { adminClient } from '../api/client'
import { catalogCopy, denialCopy, gapCopy, modeCopy, type ReleaseMode } from '../domain/content-release'
import { useAdminStore } from '../stores/admin'

const session = useAdminStore()
const mode = ref<ReleaseMode>('SIMPLE')
const copy = ref(modeCopy('SIMPLE'))
const title = ref('第一课')
const contentCode = ref('it6-lesson')
const notice = ref('默认是简审。双签要单独打开。')
const gaps = ref<string[]>([])
const canWrite = computed(() => session.can('content:write') || session.can('admin.content.write'))

function key(): string {
  return `it6-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function command(commandName: string, body: Record<string, unknown> = {}): Promise<void> {
  gaps.value = []
  try {
    const response = await adminClient.request<{ data?: Record<string, unknown> }>('/admin/content-commands', {
      method: 'POST',
      body: { command: commandName, contentCode: contentCode.value, ...body },
      headers: { 'Idempotency-Key': key() },
    })
    const data = response.data ?? {}
    if (typeof data.reviewMode === 'string') {
      mode.value = data.reviewMode === 'DUAL' ? 'DUAL' : 'SIMPLE'
      copy.value = typeof data.modeCopy === 'string' ? data.modeCopy : modeCopy(mode.value)
    }
    if (typeof data.catalogState === 'string') notice.value = catalogCopy(data.catalogState)
    else if (typeof data.title === 'string') notice.value = `已读回《${data.title}》，版本 ${String(data.versionNumber ?? '')}。`
    else notice.value = copy.value
  } catch (error) {
    const details = (error as { details?: { error?: { gaps?: Array<{ field?: string }>; message?: string } } }).details
    const listed = details?.error?.gaps ?? []
    gaps.value = listed.map((item) => gapCopy(item.field ?? ''))
    notice.value = gaps.value.length ? '送审缺项要一次列齐。' : (details?.error?.message ?? denialCopy())
  }
}
</script>

<template>
  <section class="release-panel" data-release-panel>
    <div class="release-panel__info">
      <h3 class="release-panel__title">发布信息</h3>
    <p data-release-mode>{{ copy }}</p>
    <p data-release-notice>{{ notice }}</p>
    <ul v-if="gaps.length" data-release-gaps>
      <li v-for="item in gaps" :key="item">{{ item }}</li>
    </ul>
    <label>内容编码 <input v-model="contentCode" data-release-code /></label>
    <label>标题 <input v-model="title" data-release-title /></label>
    </div>
    <div class="release-panel__ops">
      <h3 class="release-panel__title">发布操作</h3>
    <div class="release-actions">
      <div class="release-group"><span class="release-group__label">模式</span>
      <button type="button" :disabled="!canWrite" @click="command('RELEASE_MODE')">读取模式</button>
      <button type="button" :disabled="!canWrite" @click="command('RELEASE_MODE', { mode: mode === 'SIMPLE' ? 'DUAL' : 'SIMPLE' })">切换审核模式</button>
      </div>
      <div class="release-group"><span class="release-group__label">流程</span>
      <button type="button" :disabled="!canWrite" @click="command('RELEASE_CREATE', { title })">建草稿</button>
      <button type="button" :disabled="!canWrite" @click="command('RELEASE_SUBMIT')">送审</button>
      <button type="button" :disabled="mode !== 'DUAL'" @click="command('RELEASE_REVIEW_L1')">初审</button>
      <button type="button" :disabled="mode !== 'DUAL'" @click="command('RELEASE_REVIEW_L2')">终审</button>
      </div>
      <div class="release-group"><span class="release-group__label">发布</span>
      <button type="button" :disabled="!canWrite" @click="command('RELEASE_PUBLISH')">发布</button>
      <button type="button" :disabled="!canWrite" @click="command('RELEASE_SYNC')">同步目录</button>
      </div>
      <div class="release-group"><span class="release-group__label">下架</span>
      <button type="button" :disabled="!canWrite" @click="command('RELEASE_UNPUBLISH', { reason: '普通收回' })">普通下架</button>
      <button type="button" :disabled="!canWrite" @click="command('RELEASE_FORCE_OFFLINE', { reason: '停止分发' })">强制停止</button>
      </div>
    </div>
    <p v-if="mode === 'SIMPLE'" data-simple-review>简审没有第二审签名，也没有第二条审核记录。</p>
    <p data-release-denial>{{ denialCopy() }}</p>
    </div>
  </section>
</template>
