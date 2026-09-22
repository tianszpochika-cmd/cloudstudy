<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { B10AnswerInput, B10Exercise } from '../../domain/b10'

const props = withDefaults(defineProps<{ exercise: B10Exercise; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ answer: [value: B10AnswerInput] }>()
const selected = ref<string | null>(null)
const textValue = ref('')
const blankValue = ref('')
const ordered = ref<string[]>([])
const pairLeft = ref<string | null>(null)
const pairs = ref<Array<{ leftId: string; rightId: string }>>([])

const isTextAnswer = computed(() => ['FILL_BLANK', 'SPELL_INPUT', 'ERROR_CORRECTION', 'TRANSLATION_INPUT'].includes(props.exercise.questionType))
const tokens = computed(() => ordered.value.map((id) => props.exercise.tokens.find((token) => token.tokenId === id)).filter((token): token is NonNullable<typeof token> => Boolean(token)))
function choose(key: string): void { selected.value = key; emit('answer', { selectedOptionKeys: [key] }) }
function submitText(): void {
  if (props.exercise.questionType === 'FILL_BLANK') emit('answer', { blanks: [{ blankId: props.exercise.blankIds[0] ?? 'blank-1', text: blankValue.value }] })
  else emit('answer', { text: textValue.value })
}
function toggleToken(tokenId: string): void {
  if (props.disabled) return
  ordered.value = ordered.value.includes(tokenId) ? ordered.value.filter((id) => id !== tokenId) : [...ordered.value, tokenId]
  emit('answer', { orderedTokenIds: ordered.value })
}
function moveToken(index: number, offset: number): void {
  const target = index + offset
  if (target < 0 || target >= ordered.value.length) return
  const next = [...ordered.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  ordered.value = next
  emit('answer', { orderedTokenIds: next })
}
function choosePair(leftId: string, rightId: string): void {
  if (props.disabled) return
  pairs.value = [...pairs.value.filter((pair) => pair.leftId !== leftId && pair.rightId !== rightId), { leftId, rightId }]
  emit('answer', { pairs: pairs.value })
}
watch(() => props.exercise.exerciseId, () => { selected.value = null; textValue.value = ''; blankValue.value = ''; ordered.value = []; pairs.value = []; pairLeft.value = null })
</script>

<template>
  <view class="b10-exercise-card">
    <text class="b10-exercise-card__prompt">{{ exercise.prompt }}</text>
    <text v-if="exercise.sourceText" class="b10-exercise-card__source">{{ exercise.sourceText }}</text>

    <view v-if="exercise.questionType === 'CHOICE' || exercise.questionType === 'LISTEN_CHOICE' || exercise.questionType === 'CORRECTION'" class="b10-options">
      <button tabindex="0" role="button" v-for="option in exercise.options" :key="option.key" class="b10-option" :class="{ 'b10-option--selected': selected === option.key }" type="button" :disabled="disabled" :aria-pressed="selected === option.key" @click="choose(option.key)">{{ option.key }} · {{ option.text }}</button>
    </view>

    <view v-else-if="exercise.questionType === 'DRAG_SORTER' || exercise.questionType === 'CONNECT_LINE'" class="b10-sorter">
      <text class="b10-sorter__hint">点选积木加入顺序；上下按钮兼容键盘/无拖拽设备。</text>
      <view class="b10-sorter__tokens"><button tabindex="0" role="button" v-for="token in exercise.tokens" :key="token.tokenId" class="b10-token" :class="{ 'b10-token--selected': ordered.includes(token.tokenId) }" type="button" :disabled="disabled" :aria-pressed="ordered.includes(token.tokenId)" @click="toggleToken(token.tokenId)">{{ token.text }}</button></view>
      <view v-for="(token, index) in tokens" :key="`ordered-${token.tokenId}`" class="b10-ordered-row"><text>{{ index + 1 }}. {{ token.text }}</text><view><button tabindex="0" role="button" class="b10-move" type="button" :disabled="disabled || index === 0" aria-label="上移" @click="moveToken(index, -1)">↑</button><button tabindex="0" role="button" class="b10-move" type="button" :disabled="disabled || index === tokens.length - 1" aria-label="下移" @click="moveToken(index, 1)">↓</button></view></view>
    </view>

    <view v-else-if="isTextAnswer" class="b10-text-answer">
      <input v-if="exercise.questionType === 'FILL_BLANK'" v-model="blankValue" class="b10-input" :disabled="disabled" confirm-type="done" placeholder="填写空格" @confirm="submitText" />
      <textarea v-else v-model="textValue" class="b10-textarea" :disabled="disabled" maxlength="12000" placeholder="输入答案；提交后由服务端规则判定。" />
      <button tabindex="0" role="button" class="b10-submit" type="button" :disabled="disabled || (exercise.questionType === 'FILL_BLANK' ? !blankValue.trim() : !textValue.trim())" @click="submitText">提交答案</button>
    </view>

    <view v-if="exercise.questionType === 'CONNECT_LINE' && exercise.options.length" class="b10-pairs">
      <text class="b10-sorter__hint">配对题使用可访问的选择器，不依赖手势拖拽。</text>
      <picker :range="exercise.options.map((option) => option.text)" @change="pairLeft = exercise.options[Number($event.detail.value)]?.key ?? null"><view class="b10-pair-picker">{{ pairLeft ?? '选择左侧项' }}</view></picker>
      <picker :range="exercise.options.map((option) => option.text)" @change="pairLeft && choosePair(pairLeft, exercise.options[Number($event.detail.value)]?.key ?? '')"><view class="b10-pair-picker">选择右侧项</view></picker>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-exercise-card{display:grid;gap:20rpx;padding:26rpx;border:1rpx solid var(--yx-border);border-radius:20rpx;background:var(--yx-surface-card)}.b10-exercise-card__prompt{font-size:34rpx;font-weight:750;line-height:1.45}.b10-exercise-card__source{padding:18rpx;border-radius:14rpx;color:var(--yx-brand);background:var(--yx-brand-soft);font-size:28rpx;line-height:1.6}.b10-options,.b10-sorter,.b10-text-answer,.b10-pairs{display:grid;gap:12rpx}.b10-option,.b10-token,.b10-submit{min-height:84rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);text-align:left;font-size:25rpx}.b10-option--selected,.b10-token--selected{border-color:var(--yx-brand);color:var(--yx-brand);background:var(--yx-brand-soft)}.b10-token{min-height:70rpx;text-align:center}.b10-sorter__hint{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.5}.b10-sorter__tokens{display:flex;flex-wrap:wrap;gap:10rpx}.b10-ordered-row{display:flex;align-items:center;justify-content:space-between;gap:12rpx;padding:14rpx;border-radius:12rpx;background:var(--yx-surface-soft);font-size:24rpx}.b10-move{min-width:62rpx;min-height:58rpx;margin-left:8rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:26rpx}.b10-input,.b10-textarea{width:100%;box-sizing:border-box;padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card);font-size:26rpx;line-height:1.6}.b10-input{height:78rpx}.b10-textarea{min-height:220rpx}.b10-submit{border:0;color:var(--yx-on-brand);background:var(--yx-action);text-align:center;font-weight:700}.b10-pair-picker{min-height:70rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);line-height:70rpx}
</style>
