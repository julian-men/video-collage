import { useEffect, useRef, useState } from 'react'
import {
  checkpoint,
  emptyHistory,
  redo as redoStep,
  referencedIds,
  undo as undoStep,
} from '../utils/history.js'
import { probeMedia, validateMediaFile } from '../utils/mediaFiles.js'

const MIN_ITEM_WIDTH = 240
const MAX_ITEM_WIDTH = 480
const DEFAULT_ASPECT_RATIO = 16 / 9
const EMPTY = { items: [], history: emptyHistory() }

// Positions are stored as 0–1 fractions of the free space in the workspace, so
// an item stays fully visible no matter how large the workspace is.
function randomLayout() {
  return {
    width: MIN_ITEM_WIDTH + Math.random() * (MAX_ITEM_WIDTH - MIN_ITEM_WIDTH),
    x: Math.random(),
    y: Math.random(),
  }
}

function topZIndex(items) {
  return items.reduce((max, item) => Math.max(max, item.zIndex), 0)
}

function patchItem(items, id, patch) {
  return items.some((item) => item.id === id)
    ? items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    : items
}

/**
 * The collage items, their object URLs and source files, and undo history.
 * Every change that rearranges or removes items is an undo step; facts the
 * browser reports later (aspect ratio, load failure) are patched into the
 * whole history so undo never brings back stale ones.
 */
function useMediaItems({ onLoadFailed }) {
  const [state, setState] = useState(EMPTY)
  const { items, history } = state
  // id → { url, blob }. Kept while any history entry still refers to the id.
  const assets = useRef(new Map())
  // Cancel functions for in-flight load checks, keyed by item id.
  const probes = useRef(new Map())
  const onLoadFailedRef = useRef(onLoadFailed)
  // Items as they were when the current drag or resize began; recorded as an
  // undo step on the gesture's first change, so a plain click adds none.
  const gestureStart = useRef(null)

  useEffect(() => {
    onLoadFailedRef.current = onLoadFailed
  })

  useEffect(() => {
    const live = referencedIds(history, items)
    for (const [id, asset] of assets.current) {
      if (live.has(id)) continue
      URL.revokeObjectURL(asset.url)
      assets.current.delete(id)
      probes.current.get(id)?.()
      probes.current.delete(id)
    }
  }, [items, history])

  useEffect(() => {
    const currentAssets = assets.current
    const currentProbes = probes.current
    return () => {
      currentProbes.forEach((cancel) => cancel())
      currentProbes.clear()
      currentAssets.forEach((asset) => URL.revokeObjectURL(asset.url))
      currentAssets.clear()
    }
  }, [])

  // `tag` groups repeated changes into one undo step (see MERGE_MS).
  function commit(change, tag = null) {
    const now = performance.now()
    setState((current) => {
      const next = change(current.items)
      if (next === current.items) return current
      return { items: next, history: checkpoint(current.history, current.items, tag, now) }
    })
  }

  function update(change) {
    setState((current) => {
      const next = change(current.items)
      return next === current.items ? current : { ...current, items: next }
    })
  }

  function patchEverywhere(id, patch) {
    setState((current) => ({
      items: patchItem(current.items, id, patch),
      history: {
        ...current.history,
        past: current.history.past.map((snapshot) => patchItem(snapshot, id, patch)),
        future: current.history.future.map((snapshot) => patchItem(snapshot, id, patch)),
      },
    }))
  }

  function updateFromGesture(id, patch) {
    const before = gestureStart.current
    gestureStart.current = null
    const now = performance.now()
    setState((current) => {
      const next = patchItem(current.items, id, patch)
      if (next === current.items) return current
      return {
        items: next,
        history: before ? checkpoint(current.history, before, null, now) : current.history,
      }
    })
  }

  function markFailed(id, message) {
    patchEverywhere(id, { loadError: message })
  }

  // Checks every new item in a detached element, so files hidden by reveal
  // mode are verified too.
  function startProbe(item) {
    const probe = probeMedia(item.url, item.type)
    probes.current.set(item.id, probe.cancel)
    probe.promise.then((result) => {
      if (!probes.current.has(item.id)) return
      probes.current.delete(item.id)
      if (result.ok === false) {
        markFailed(item.id, result.message)
        onLoadFailedRef.current?.(item, result.message)
      }
    })
  }

  function register(id, blob) {
    const url = URL.createObjectURL(blob)
    assets.current.set(id, { url, blob })
    return url
  }

  /** Adds valid files as new items. Returns `"name (reason)"` for the rest. */
  function add(files) {
    const added = []
    const rejected = []
    for (const file of files) {
      const result = validateMediaFile(file)
      if (!result.type) {
        rejected.push(`${file.name} (${result.reason})`)
        continue
      }
      const id = crypto.randomUUID()
      added.push({
        id,
        name: file.name,
        url: register(id, file),
        type: result.type,
        aspectRatio: DEFAULT_ASPECT_RATIO,
        ...randomLayout(),
      })
    }
    if (added.length > 0) {
      commit((current) => {
        const top = topZIndex(current)
        return [...current, ...added.map((item, index) => ({ ...item, zIndex: top + index + 1 }))]
      })
      added.forEach(startProbe)
    }
    return rejected
  }

  /** Replaces everything with restored items; `blobs` maps id → Blob. */
  function replaceAll(restored, blobs) {
    const next = restored
      .filter((item) => blobs.has(item.id))
      .map((item) => ({ ...item, url: register(item.id, blobs.get(item.id)) }))
    setState({ items: next, history: emptyHistory() })
    next.forEach(startProbe)
  }

  function clear() {
    probes.current.forEach((cancel) => cancel())
    probes.current.clear()
    setState(EMPTY)
  }

  /** Removes an item and returns the index it had, or -1. */
  function remove(id) {
    const index = items.findIndex((item) => item.id === id)
    if (index !== -1) commit((current) => current.filter((item) => item.id !== id))
    return index
  }

  function bringToFront(id) {
    update((current) => {
      const top = topZIndex(current)
      const target = current.find((item) => item.id === id)
      if (!target || target.zIndex === top) return current
      return patchItem(current, id, { zIndex: top + 1 })
    })
  }

  function undo() {
    setState((current) => {
      const step = undoStep(current.history, current.items)
      return step ? { items: step.items, history: step.history } : current
    })
  }

  function redo() {
    setState((current) => {
      const step = redoStep(current.history, current.items)
      return step ? { items: step.items, history: step.history } : current
    })
  }

  return {
    items,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    add,
    replaceAll,
    clear,
    remove,
    markFailed,
    bringToFront,
    setAspectRatio: (id, aspectRatio) => patchEverywhere(id, { aspectRatio }),
    // Called when a drag or resize starts, so the whole gesture is one step.
    beginGesture: () => {
      gestureStart.current = items
    },
    move: (id, x, y) => updateFromGesture(id, { x, y }),
    resize: (id, width, x, y) => updateFromGesture(id, { width, x, y }),
    randomize: () =>
      commit((current) => current.map((item) => ({ ...item, ...randomLayout() }))),
    undo,
    redo,
    blobFor: (id) => assets.current.get(id)?.blob ?? null,
  }
}

export default useMediaItems
