export type B3Status = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'error'
export type B3PerformanceLevel = 'Ultra' | 'High' | 'Medium' | 'Performance'
export type SelfRating = 'NEEDS_PRACTICE' | 'BASIC' | 'FLUENT' | 'UNCERTAIN'

export interface GrammarPoint { grammarPointId: number; code: string; title: string; ruleFormula: string; meaningCn: string; cefrLevel: string; trapTags: string[]; contentVersionId: number }
export interface GrammarExercise { exerciseId: number; grammarPointId: number; type: 'FILL_BLANK' | 'CHOICE' | 'SENTENCE_BUILD' | 'PARAPHRASE' | 'CORRECTION'; promptText: string; options?: Array<{ optionCode: string; label: string }>; contentVersionId: number; ruleVersion: string }
export interface GrammarMastery { grammarPointId: number; dimensions: Record<string, number>; overall: number; level: 'REVIEW' | 'DEVELOPING' | 'MASTERED'; ruleVersion: string }
export interface SyntaxNode { nodeId: string; role: string; text: string; startToken: number; endToken: number }
export interface SyntaxEdge { fromNodeId: string; toNodeId: string; relation: string }
export interface SentenceSlice { sliceId: string; sliceCode: string; role: string; text: string; colorToken?: string; startToken: number; endToken: number }
export interface SentenceGraph {
  sentenceId: number
  text: string
  translation?: string
  contentVersionId?: number
  nodes: SyntaxNode[]
  edges: SyntaxEdge[]
  slices?: SentenceSlice[]
  blockOrder?: string[]
  imitationSlots?: Record<string, string>
  tokens?: TimelineToken[]
  audioTracks?: Array<{ trackCode: string; speed: number; durationMs: number }>
}
export interface WritingPrompt { promptId: number; promptType: string; title: string; taskText: string; targetStructure: string[]; contentVersionId: number }
export interface WritingTemplate { templateId: number; templateType: 'ESSAY' | 'LETTER'; title: string; structure: Array<{ slotCode: string; label: string; required: boolean }>; contentVersionId: number }
export interface WritingMaterial { materialId: number; topicCode: string; title: string; bodyText: string; contentVersionId: number }
export interface ProofreadingIssue { issueId: number; promptId: number; errorType: string; wrongText: string; wrongTextHash: string; explanation: string; contentVersionId: number }
export interface WritingEvaluation { submissionId: number; promptId: number; score: number; band: string; ruleVersion: string; aiScoringAvailable: false; matchedPointCodes: string[]; reviewState: string; rubricResults?: Array<{ code: string; score: number; feedbackCode: string }> }
export interface WritingHistoryItem extends WritingEvaluation { submittedAt?: string; promptTitle?: string }
export interface TimelineToken { tokenId: string; text: string; startMs: number; endMs: number; ipa?: string; stress?: string }
export interface SoundAnnotation { annotationId: string; ruleCode: string; startMs: number; endMs: number; label: string; ruleSetVersion: string }
export interface TimelineSegment { segmentId: string; startMs: number; endMs: number; text: string; translation?: string; tokens: TimelineToken[]; annotations: SoundAnnotation[] }
export interface ListeningMaterial { materialId: number; title: string; cefrLevel?: string; durationMs: number; contentVersionId: number; rightsStatus: 'AUTHORIZED' | 'REVOKED'; segments: TimelineSegment[]; mediaRef?: { assetId: string; variant: string; rightsStatus: 'AUTHORIZED' | 'REVOKED'; availability?: 'READY' | 'NOT_READY'; signedUrl?: string } }
export interface LanguageClip { clipId: number; materialId: number; title: string; startMs: number; endMs: number; mediaRef: { assetId: string; variant: string; rightsStatus: 'AUTHORIZED' | 'REVOKED' } }
export interface OfflinePackage { packageId: number; packageCode: string; contentVersionId: number; manifestHash: string; totalBytes: number; expiresAt: string; status: string; items: Array<{ assetId: string; kind: string; size: number; sha256: string; status: string }> }
export interface DictationResult { sessionId: string; segmentId: string; score: number; correct: boolean; mismatchPositions: number[]; feedbackCodes: string[]; reviewSignal: string }
export interface ReadingBlock { blockId: string; blockIndex: number; text: string; translation?: string; tokens: TimelineToken[] }
export interface ReadingArticle { articleId: number; title: string; cefrLevel: string; wordCount: number; estimatedMinutes: number; rightsStatus: 'AUTHORIZED' | 'REVOKED'; contentVersionId: number; blocks: ReadingBlock[] }
export interface DictionaryEntry { tokenId: string; lemma: string; partOfSpeech?: string; meaningCn: string; exampleText?: string; contentVersionId: number }
export interface ReadingQuestion { questionId: number; articleId: number; questionType: 'MAIN_IDEA' | 'DETAIL' | 'INFERENCE' | 'VOCABULARY'; stemText: string; options: Array<{ optionCode: string; label: string }>; contentVersionId: number }
export interface ReadingAttemptResult { attemptId: number; questionId: number; correct: boolean; score: number; feedbackCode: string; reviewSignal: string; ruleVersion: string }
export interface ReadingMiningResult { expressionId: number; articleId: number; blockId: string; status: string; reviewSignal: string; sourceVersion: number }
export interface MouthProfile { profileVersion: string; fallback2d: string; jawOpen: number; tongueHeight: number; tongueBackness: number; lipRound: number; voicing: boolean }
export interface Phoneme { phonemeId: number; symbol: string; group: string; exampleWord: string; description: string; contentVersionId: number; mouthProfile: MouthProfile }
export interface SpeakingRecording { recordingId: string; status: string; sourceSegmentId: string; durationMs: number; storageMode: string; aiScoringAvailable: false; selfRating?: SelfRating }
export interface MinimalPair { pairId: number; leftPhonemeId: number; rightPhonemeId: number; leftWord: string; rightWord: string }
export interface ShadowingSession { shadowingSessionId: string; sourceSegmentId: string; targetGapMs: number; attemptCount: number; positionMs: number; status: string; aiScoringAvailable: false }
export interface RoleplayTurn { turnIndex: number; speaker: string; text: string; choiceCodes: string[]; recordingRequired: boolean }
export interface RoleplaySession { roleplaySessionId: string; roleplayCode: string; scriptVersion: string; role: string; turnIndex: number; status: string; contentVersionId: number; turns: RoleplayTurn[] }
export interface RoleplayTurnResult { roleplaySessionId: string; turnIndex: number; nextTurnIndex: number; nextTurn: RoleplayTurn | null; status: string; recordingId?: string; feedbackCode: string; aiScoringAvailable: false }
export interface OfflineChange { changeId: string; entityType: string; entityId: string; entityVersion: number; operation: 'UPSERT' | 'DELETE'; payloadHash: string; occurredAt: string; clientEventId?: string }
export interface OfflineConflict { conflictId: number; changeId: string; entityType: string; entityId: string; resolution: 'SERVER_WINS' | 'LOCAL_RETRY' | 'MERGED'; serverVersion: number }
export interface B3SyncResult { clientBatchId: string; acceptedChangeIds: string[]; conflicts: OfflineConflict[]; nextCursor: string; serverVersion: number }

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
export function unwrap(value: unknown): unknown { return isRecord(value) && 'data' in value ? value.data : value }
export function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null }
export function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
