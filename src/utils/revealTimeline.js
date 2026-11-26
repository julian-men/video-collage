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

// Widest spacing first, so Auto spreads the items across as much of the song
// as it can.
const AUTO_BEAT_CANDIDATES = [64, 32, 16, 8, 4, 2, 1]

/**
 * Beats per reveal for "Auto": the widest spacing that still shows every item
 * at least once before `duration` seconds, or 1 when even that can't.
 */
export function autoBeatsPerReveal({ duration, anchor, bpm, total }) {
  if (!(duration > 0)) return 1
  return (
    AUTO_BEAT_CANDIDATES.find(
      (beatsPerReveal) =>
        itemsShownBefore({ anchor, bpm, beatsPerReveal }, duration, total) >= total,
    ) ?? 1
  )
}
