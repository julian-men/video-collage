export const BEATS_PER_REVEAL_OPTIONS = [1, 2, 4]
export const MIN_BPM = 30
export const MAX_BPM = 300

const EPSILON = 1e-6

export function parseBpm(value) {
  const bpm = Number(value)
  return Number.isFinite(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM ? bpm : null
}

/**
 * Time (seconds) of the beat that reveals item 1. A positive offset moves
 * every reveal later. If the shifted beat lands before the start of the track,
 * the next beat on the same grid is used instead.
 */
export function revealAnchor(firstBeat, offsetMs, bpm) {
  const period = 60 / bpm
  const shifted = firstBeat + offsetMs / 1000
  if (shifted >= 0) return shifted
  return shifted + Math.ceil(-shifted / period - EPSILON) * period
}

// Number of reveal steps that have happened by `time`: 0 before the anchor
// beat, 1 on it, and one more every `beatsPerReveal` beats after it.
export function revealStepAt(time, anchor, bpm, beatsPerReveal) {
  if (time + EPSILON < anchor) return 0
  const stepSeconds = (beatsPerReveal * 60) / bpm
  return Math.floor((time - anchor) / stepSeconds + EPSILON) + 1
}

// Without repeat the count stops at `total`. With repeat each cycle is
// 1 → … → total → 0 (one empty step) → 1 …
export function visibleCountForStep(step, total, repeat) {
  if (step <= 0 || total === 0) return 0
  if (!repeat) return Math.min(step, total)
  const position = (step - 1) % (total + 1)
  return position === total ? 0 : position + 1
}
