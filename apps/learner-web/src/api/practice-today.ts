import { apiClient } from './client'
import { createPracticeSession, submitPracticeAnswer } from './b10'
import type { B10Feedback } from '../domain/b10'
export interface PracticeTodayRef {
  contentCode: string
  contentVersionId: number
  questionItemId: string
}

export interface PracticeTodayTask {
  id: string
  title: string
  stem: string
  options: { key: string; text: string }[]
  kind: 'NEW' | 'REVIEW'
  stage: string
  dueAt: string | null
  practiceRef: PracticeTodayRef
  sessionId: string
  stateVersion: number
  contentVersionId: number
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function unwrap(value: unknown): unknown {
  return record(value) && 'data' in value ? (value as Record<string, unknown>).data : value
}

interface TodayItem {
  itemId: string
  stage: string
  dueAt: string | null
  practiceRef: PracticeTodayRef | null
}

function parseRef(value: unknown): PracticeTodayRef | null {
  const source = record(value) ? value : null
  if (!source) return null
  const contentCode = text(source.contentCode)
  const version = typeof source.contentVersionId === 'number' ? source.contentVersionId : null
  const questionItemId = text(source.questionItemId)
  if (!contentCode || version === null || !questionItemId) return null
  return { contentCode, contentVersionId: version, questionItemId }
}

function parseTodayItems(response: unknown): TodayItem[] {
  const source = record(unwrap(response)) ? (unwrap(response) as Record<string, unknown>) : {}
  const raw = Array.isArray(source.items) ? source.items : []
  return raw.flatMap((entry): TodayItem[] => {
    if (!record(entry)) return []
    const itemId = text(entry.itemId)
    if (!itemId) return []
    const stage = text(entry.stage) ?? ''
    return [{
      itemId,
      stage,
      dueAt: text(entry.dueAt),
      practiceRef: parseRef(entry.practiceRef),
    }]
  })
}

/**
 * Practice-ready today tasks. V2 today items carry answer-free practice refs;
 * one B10 session per (contentCode, version) group resolves real stems, so
 * titles are server facts, never invented. Items without a ref stay out
 * (honest absence, same as before). Sessions reuse the stable
 * contentCode+itemIds idempotency key inside createPracticeSession, so
 * re-reading today replays the session instead of spamming new ones.
 */
export async function readPracticeToday(): Promise<PracticeTodayTask[]> {
  const items = parseTodayItems(await apiClient.get<unknown>('/learning/today'))
  const refd = items.filter((item) => item.practiceRef !== null)
  const groups = new Map<string, { ref: PracticeTodayRef; itemIds: string[]; stages: Map<string, string> }>()
  for (const item of refd) {
    const ref = item.practiceRef as PracticeTodayRef
    const key = `${ref.contentCode}::${ref.contentVersionId}`
    let group = groups.get(key)
    if (!group) {
      group = { ref, itemIds: [], stages: new Map() }
      groups.set(key, group)
    }
    group.itemIds.push(ref.questionItemId)
    group.stages.set(ref.questionItemId, item.stage)
  }
  const tasks: PracticeTodayTask[] = []
  for (const group of groups.values()) {
    const session = await createPracticeSession('DAILY', group.itemIds.length, {
      contentCode: group.ref.contentCode,
      contentVersionId: group.ref.contentVersionId,
      itemIds: group.itemIds,
    })
    const byId = new Map(session.questions.map((q) => [q.id, q]))
    for (const itemId of group.itemIds) {
      const question = byId.get(itemId)
      if (!question || !question.prompt) continue
      const stage = group.stages.get(itemId) ?? ''
      tasks.push({
        id: itemId,
        title: question.prompt.length > 80 ? `${question.prompt.slice(0, 80)}…` : question.prompt,
        stem: question.prompt,
        options: question.options.map((o) => ({ key: o.key, text: o.text })),
        kind: stage === 'NEW' ? 'NEW' : 'REVIEW',
        stage,
        dueAt: items.find((i) => i.practiceRef?.questionItemId === itemId)?.dueAt ?? null,
        practiceRef: { ...group.ref, questionItemId: itemId },
        sessionId: session.sessionId,
        stateVersion: session.stateVersion,
        contentVersionId: group.ref.contentVersionId,
      })
    }
  }
  return tasks
}

export async function submitPracticeTodayTask(
  task: PracticeTodayTask,
  answerKey: string,
  stableKey: string,
): Promise<B10Feedback> {
  return submitPracticeAnswer(task.sessionId, {
    exerciseId: task.id,
    answer: { selectedOptionKey: answerKey },
    clientAnswerId: stableKey,
    contentVersionId: task.contentVersionId,
    stateVersion: task.stateVersion,
  }, stableKey)
}
