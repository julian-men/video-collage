import { useRef, useState } from 'react'
import { ExportError, exportCollageWebm } from '../utils/exportCollageWebm.js'

function useCollageExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState(null)
  // State updates are async, so a ref blocks a second click in the same tick.
  const busyRef = useRef(false)

  async function exportWebm(options) {
    if (busyRef.current) return
    busyRef.current = true
    setIsExporting(true)
    setError(null)
    try {
      await exportCollageWebm(options)
    } catch (caught) {
      setError(
        caught instanceof ExportError
          ? caught.message
          : 'Export failed. Please try again.',
      )
    } finally {
      busyRef.current = false
      setIsExporting(false)
    }
  }

  return { isExporting, error, exportWebm }
}

export default useCollageExport
