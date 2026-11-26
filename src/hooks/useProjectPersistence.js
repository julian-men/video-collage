import { useEffect, useRef, useState } from 'react'
import { fromRecord } from '../utils/projectRecord.js'
import { loadProject, saveProject } from '../utils/projectStore.js'

const SAVE_DELAY_MS = 500

/**
 * Restores the saved project once on load, then saves `record` (from
 * toRecord) shortly after it changes. Nothing is saved until the restore has
 * finished, so an empty first render never overwrites the saved project.
 */
function useProjectPersistence({ record, onRestore, onError }) {
  const [isRestored, setIsRestored] = useState(false)
  const callbacks = useRef({ onRestore, onError })

  useEffect(() => {
    callbacks.current = { onRestore, onError }
  })

  useEffect(() => {
    let cancelled = false
    loadProject()
      .then(async (saved) => {
        if (cancelled || !saved) return
        const project = fromRecord(saved.meta, saved.files)
        if (project) await callbacks.current.onRestore(project)
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onError('restore')
      })
      .finally(() => {
        if (!cancelled) setIsRestored(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isRestored) return
    const timer = setTimeout(() => {
      saveProject(record.meta, record.files).catch(() => callbacks.current.onError('save'))
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [record, isRestored])

  return { isRestored }
}

export default useProjectPersistence
