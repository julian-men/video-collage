import { useEffect, useRef, useState } from 'react'
import { fromRecord } from '../utils/projectRecord.js'
import { loadProject, saveProject } from '../utils/projectStore.js'

const SAVE_DELAY_MS = 500

/**
 * Restores the saved project once on load, then saves `record` (from
 * toRecord) shortly after it changes, and right away when the page is
 * closed. Nothing is saved until the restore has finished, so an empty first
 * render never overwrites the saved project. If the restore fails, nothing is
 * saved until the user changes something, so a passing read error can't wipe
 * the saved project on its own. `onError` gets 'unavailable', 'restore', or
 * 'save'.
 */
function useProjectPersistence({ record, onRestore, onError }) {
  const [isRestored, setIsRestored] = useState(false)
  const callbacks = useRef({ onRestore, onError })
  const latestRecord = useRef(record)
  // The record shown when a restore failed; it isn't saved.
  const unsavedRecord = useRef(null)
  const pendingSave = useRef(null)

  useEffect(() => {
    callbacks.current = { onRestore, onError }
    latestRecord.current = record
  })

  useEffect(() => {
    if (typeof indexedDB === 'undefined') {
      callbacks.current.onError('unavailable')
      return
    }
    let cancelled = false
    loadProject()
      .then(async (saved) => {
        if (cancelled || !saved) return
        const project = fromRecord(saved.meta, saved.files)
        if (project) await callbacks.current.onRestore(project)
      })
      .catch(() => {
        if (cancelled) return
        unsavedRecord.current = latestRecord.current
        callbacks.current.onError('restore')
      })
      .finally(() => {
        if (!cancelled) setIsRestored(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isRestored || record === unsavedRecord.current) return
    unsavedRecord.current = null
    const save = () => {
      pendingSave.current = null
      saveProject(record.meta, record.files).catch(() => callbacks.current.onError('save'))
    }
    pendingSave.current = save
    const timer = setTimeout(save, SAVE_DELAY_MS)
    return () => {
      clearTimeout(timer)
      if (pendingSave.current === save) pendingSave.current = null
    }
  }, [record, isRestored])

  // Best effort: the browser may not finish a save started while closing.
  useEffect(() => {
    const flush = () => pendingSave.current?.()
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  return { isRestored }
}

export default useProjectPersistence
