import { useCallback, useEffect, useState } from 'react'

function usePresentationMode(targetRef) {
  const [isPresenting, setIsPresenting] = useState(false)

  const enter = useCallback(async () => {
    setIsPresenting(true)
    const element = targetRef.current
    if (!element || !document.fullscreenEnabled || !element.requestFullscreen) {
      return
    }
    try {
      await element.requestFullscreen()
    } catch {
      // Fullscreen was refused; presentation mode still uses the full viewport.
    }
  }, [targetRef])

  const exit = useCallback(() => {
    setIsPresenting(false)
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // The browser handles Escape itself while fullscreen and only reports the
  // change through this event, so leaving fullscreen must end presentation.
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) setIsPresenting(false)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Covers the fallback case where fullscreen is unavailable.
  useEffect(() => {
    if (!isPresenting) return
    function handleKeyDown(event) {
      if (event.key === 'Escape') exit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPresenting, exit])

  return { isPresenting, enter, exit }
}

export default usePresentationMode
