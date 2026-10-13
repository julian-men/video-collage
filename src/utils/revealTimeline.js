import { revealStepAt, visibleCountForStep } from './beatSync.js'

const EPSILON = 1e-6

/**
 * Number of items visible `time` seconds after a reveal sequence starts.
 *
 * - `interval`: matches useRevealMode, where Start shows item 1 immediately
 *   and the timer adds one item every `intervalSeconds`. Never repeats.
 * - `beats`: matches useMusicSync, where nothing shows before the anchor beat
 *   and one item appears every `beatsPerReveal` beats from it. With `repeat`
 *   the cycle is 1 → … → total → 0 → 1 …, as in the live reveal.
 */
export function revealCountAt(timeline, time, total) {
  if (total <= 0) return 0
  if (timeline.kind === 'beats') {
    const step = revealStepAt(time, timeline.anchor, timeline.bpm, timeline.beatsPerReveal)
    return visibleCountForStep(step, total, timeline.repeat === true)
  }
  return Math.min(total, 1 + Math.floor(time / timeline.intervalSeconds + EPSILON))
}

/**
 * How many different items a beat timeline shows at least once before
 * `duration` seconds. A reveal step landing exactly at the end isn't seen.
 */
export function itemsShownBefore(timeline, duration, total) {
  if (total <= 0 || !(duration > timeline.anchor)) return 0
  const stepSeconds = (timeline.beatsPerReveal * 60) / timeline.bpm
  const steps = Math.ceil((duration - timeline.anchor) / stepSeconds - EPSILON)
  return Math.min(total, Math.max(0, steps))
}
