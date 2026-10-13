import { useEffect, useRef, useState } from 'react'
import { ExportError, exportCollageVideo } from '../utils/exportCollageVideo.js'

function useCollageExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState(null)
  // `{ elapsed, duration }` in seconds once recording starts, else null.
  const [progress, setProgress] = useState(null)
  const [wasCancelled, setWasCancelled] = useState(false)
  // State updates are async, so a ref blocks a second click in the same tick.
  const busyRef = useRef(false)
  const controllerRef = useRef(null)

  // Unmounting cancels a running export, which releases its recorder, audio,
  // streams, and timers.
  useEffect(
    () => () => {
      controllerRef.current?.abort()
      controllerRef.current = null
    },
    [],
  )

  async function exportVideo(options) {
    if (busyRef.current) return
    busyRef.current = true
    const controller = new AbortController()
    controllerRef.current = controller
    setIsExporting(true)
    setError(null)
    setProgress(null)
    setWasCancelled(false)
    try {
      await exportCollageVideo({
        ...options,
        signal: controller.signal,
        onProgress: (next) => {
          if (!controller.signal.aborted) setProgress(next)
        },
      })
    } catch (caught) {
      if (controller.signal.aborted) {
        setWasCancelled(true)
        return
      }
      setError(
        caught instanceof ExportError
          ? caught.message
          : 'Export failed. Please try again.',
      )
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      busyRef.current = false
      setIsExporting(false)
      setProgress(null)
    }
  }

  function cancel() {
    if (!controllerRef.current) return
    controllerRef.current.abort()
    setWasCancelled(true)
  }

  function clearError() {
    setError(null)
    setWasCancelled(false)
  }

  return { isExporting, error, progress, wasCancelled, exportVideo, cancel, clearError }
}

export default useCollageExport
