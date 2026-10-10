import { useEffect, useState } from 'react'

export const REVEAL_INTERVAL_OPTIONS = [1, 3, 5, 10]

// `suspended` stops the interval timer while another clock (music sync)
// drives the reveal.
function useRevealMode(totalCount, { suspended = false } = {}) {
  const [enabled, setEnabled] = useState(false)
  const [intervalSeconds, setIntervalSeconds] = useState(3)
  const [revealedCount, setRevealedCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [repeat, setRepeat] = useState(false)
  // Bumped on manual reveals so the running timer restarts its full interval.
  const [timerKey, setTimerKey] = useState(0)

  const visibleCount = enabled ? Math.min(revealedCount, totalCount) : totalCount
  const isComplete = visibleCount >= totalCount
  const isRunning =
    !suspended &&
    enabled &&
    isPlaying &&
    totalCount > 0 &&
    (repeat || !isComplete)
  // Only repeat mode needs the total inside the timer; without it, uploads
  // must not restart the countdown.
  const repeatTotal = repeat ? totalCount : null

  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(
      () =>
        setRevealedCount((count) =>
          repeatTotal !== null && count >= repeatTotal ? 0 : count + 1,
        ),
      intervalSeconds * 1000,
    )
    return () => clearInterval(timer)
  }, [isRunning, intervalSeconds, timerKey, repeatTotal])

  // The initial reveal-mode state: first video visible, timer paused.
  function restoreInitial() {
    setRevealedCount(1)
    setIsPlaying(false)
  }

  function setRevealEnabled(next) {
    setEnabled(next)
    restoreInitial()
  }

  function start() {
    if (visibleCount === 0) setRevealedCount(1)
    setIsPlaying(true)
  }

  function pause() {
    setIsPlaying(false)
  }

  function toggle() {
    if (isRunning) pause()
    else start()
  }

  function revealNext() {
    if (!enabled || totalCount === 0) return
    if (isComplete && !repeat) return
    setRevealedCount((count) => {
      const shown = Math.min(count, totalCount)
      if (shown < totalCount) return shown + 1
      return repeat ? 1 : shown
    })
    setTimerKey((key) => key + 1)
  }

  // A finished sequence keeps isPlaying set, so turning repeat on would
  // otherwise restart it; treat it as stopped instead. Turning repeat off in
  // the empty gap between cycles ends playback rather than starting a new one.
  function setRepeatEnabled(next) {
    if (next && isComplete) setIsPlaying(false)
    if (!next && isRunning && visibleCount === 0) setIsPlaying(false)
    setRepeat(next)
  }

  function reset() {
    setRevealedCount(0)
    setIsPlaying(false)
  }

  // Videos are revealed in list order, so removing a revealed one must shrink
  // the count; otherwise the next hidden video would appear in its place.
  function handleRemoved(index) {
    if (totalCount <= 1) {
      restoreInitial()
      return
    }
    if (enabled && index < visibleCount) setRevealedCount(visibleCount - 1)
  }

  return {
    enabled,
    repeat,
    intervalSeconds,
    visibleCount,
    totalCount,
    isRunning,
    isComplete,
    setEnabled: setRevealEnabled,
    setRepeat: setRepeatEnabled,
    setIntervalSeconds,
    start,
    pause,
    toggle,
    revealNext,
    reset,
    restoreInitial,
    handleRemoved,
  }
}

export default useRevealMode
