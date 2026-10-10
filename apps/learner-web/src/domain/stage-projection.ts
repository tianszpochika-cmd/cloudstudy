export const STAGE_PROJECTION = 'IT4-STAGE-1'

export function acceptStage(currentStage: string, currentVersion: number, incomingStage: string, incomingVersion: number): string {
  if (!incomingStage || incomingVersion < currentVersion) return currentStage
  return incomingStage
}

export function sameStageReadback(
  left: { stage: string; projectionVersion: string },
  right: { stage: string; projectionVersion: string },
): boolean {
  return left.stage === right.stage && left.projectionVersion === right.projectionVersion
}

export function reconciled(sourceAttemptIds: string[], mistakeRows: number, attemptRows: number): boolean {
  const ids = sourceAttemptIds.filter((id) => id.trim())
  const unique = new Set(ids).size === ids.length
  return unique || mistakeRows === attemptRows
}
