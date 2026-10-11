/**
 * Placement reports carry either a 0..1 ratio (legacy sessions) or a 0..100 score
 * (P1 placement, as the web shows it). Render both as a whole 0..100 score.
 */
export function placementScorePercent(score: number | null | undefined): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return null
  return Math.round(score <= 1 ? score * 100 : Math.min(score, 100))
}
