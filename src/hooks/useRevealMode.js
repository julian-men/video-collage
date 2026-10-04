import { useEffect, useState } from 'react'

export const REVEAL_INTERVAL_OPTIONS = [1, 3, 5, 10]

function useRevealMode(totalCount) {
  const [enabled, setEnabled] = useState(false)
  const [intervalSeconds, setIntervalSeconds] = useState(3)
  const [revealedCount, setRevealedCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const visibleCount = enabled ? Math.min(revealedCount, totalCount) : totalCount
  const isComplete = visibleCount >= totalCount
  const isRunning = enabled && isPlaying && !isComplete

  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(
      () => setRevealedCount((count) => count + 1),
      intervalSeconds * 1000,
    )
    return () => clearInterval(timer)
  }, [isRunning, intervalSeconds])

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

  function reset() {
    setRevealedCount(0)
    setIsPlaying(false)
  }

  return {
    enabled,
    intervalSeconds,
    visibleCount,
    totalCount,
    isRunning,
    isComplete,
    setEnabled: setRevealEnabled,
    setIntervalSeconds,
    start,
    pause,
    reset,
    restoreInitial,
  }
}

export default useRevealMode
