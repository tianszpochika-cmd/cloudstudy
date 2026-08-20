export type B3Status = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'error'
export type SelfRating = 'NEEDS_PRACTICE' | 'BASIC' | 'FLUENT' | 'UNCERTAIN'

export interface GrammarPoint {
  grammarPointId: number
  code: string
  title: string
  ruleFormula: string
  meaningCn: string
  cefrLevel: string
  trapTags: string[]
  contentVersionId?: number
}

export interface SentenceNode { nodeId: string; role: string; text: string; startToken: number; endToken: number }
export interface SentenceEdge { fromNodeId: string; toNodeId: string; relation: string }
export interface SentenceSlice { sliceId: string; sliceCode: string; role: string; text: string; colorToken?: string; startToken: number; endToken: number }
export interface SentenceGraph {
  sentenceId: number
  text: string
  translation?: string
  nodes: SentenceNode[]
  edges: SentenceEdge[]
  contentVersionId?: number
  slices?: SentenceSlice[]
  blockOrder?: string[]
  imitationSlots?: Record<string, string>
}

export interface WritingPrompt { promptId: number; promptType: string; title: string; taskText: string; targetStructure: string[]; contentVersionId: number }
export interface WritingEvaluation { score: number; band: string; ruleVersion: string; aiScoringAvailable: false; matchedPointCodes: string[]; submissionId?: number; promptId?: number }
export interface OfflineChange { changeId: string; entityType: 'READING_PROGRESS' | 'MEDIA_PROGRESS' | 'RECORDING' | 'SETTINGS'; entityId: string; entityVersion: number; operation: 'UPSERT' | 'DELETE'; payloadHash: string; occurredAt: string; clientEventId: string }
export interface B3SyncResult { clientBatchId: string; acceptedChangeIds: string[]; conflicts: Array<{ conflictId: number; changeId: string; resolution: string }>; nextCursor: string; serverVersion: number }

export interface TimelineToken { tokenId: string; text: string; startMs: number; endMs: number; ipa?: string; stress?: string }
export interface SoundAnnotation { annotationId: string; ruleCode: string; startMs: number; endMs: number; label: string; ruleSetVersion: string }
export interface TimelineSegment {
  segmentId: string
  startMs: number
  endMs: number
  text: string
  translation?: string
  tokens: TimelineToken[]
  annotations: SoundAnnotation[]
}
export interface ListeningMaterial {
  materialId: number
  title: string
  durationMs: number
  segments: TimelineSegment[]
  rightsStatus: 'AUTHORIZED' | 'REVOKED'
  contentVersionId?: number
  mediaRef?: { assetId: string; variant: string; rightsStatus: 'AUTHORIZED' | 'REVOKED'; availability?: 'READY' | 'NOT_READY'; signedUrl?: string }
}
export interface DictationResult { score: number; correct: boolean; mismatchPositions: number[]; feedbackCodes: string[]; reviewSignal: string }

export interface ReadingBlock { blockId: string; blockIndex: number; text: string; translation?: string; tokens: TimelineToken[] }
export interface ReadingArticle {
  articleId: number
  title: string
  cefrLevel: string
  wordCount: number
  estimatedMinutes: number
  blocks: ReadingBlock[]
  rightsStatus: 'AUTHORIZED' | 'REVOKED'
  contentVersionId?: number
}
export interface ReadingQuestion { questionId: number; articleId: number; questionType: 'MAIN_IDEA' | 'DETAIL' | 'INFERENCE' | 'VOCABULARY'; stemText: string; options: Array<{ optionCode: string; label: string }>; contentVersionId: number }
export interface ReadingAttemptResult { attemptId: number; questionId: number; correct: boolean; score: number; feedbackCode: string; reviewSignal: string; ruleVersion: string }
export interface ReadingMiningResult { expressionId: number; articleId: number; blockId: string; status: string; reviewSignal: string; sourceVersion: number }
export interface SpeakingRecording { recordingId: string; status: string; sourceSegmentId: string; durationMs: number; storageMode: string; aiScoringAvailable: false; selfRating?: SelfRating }
export interface RoleplayTurn { turnIndex: number; speaker: string; text: string; choiceCodes: string[]; recordingRequired: boolean }
export interface RoleplaySession { roleplaySessionId: string; roleplayCode: string; scriptVersion: string; role: string; turnIndex: number; status: string; contentVersionId: number; turns: RoleplayTurn[] }
export interface RoleplayTurnResult { roleplaySessionId: string; turnIndex: number; nextTurnIndex: number; nextTurn: RoleplayTurn | null; status: string; recordingId?: string; feedbackCode: string; aiScoringAvailable: false }

export interface MouthProfile { profileVersion: string; fallback2d: string; jawOpen: number; tongueHeight: number; tongueBackness: number; lipRound: number; voicing: boolean }
export interface Phoneme { phonemeId: number; symbol: string; group: string; exampleWord: string; description: string; mouthProfile: MouthProfile }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function unwrap(value: unknown): unknown {
  return isRecord(value) && 'data' in value ? value.data : value
}

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
