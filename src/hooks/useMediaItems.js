import { useEffect, useRef, useState } from 'react'
import {
  checkpoint,
  emptyHistory,
  redo as redoStep,
  referencedIds,
  undo as undoStep,
} from '../utils/history.js'
import { moveItem } from '../utils/itemOrder.js'
import { probeMedia, validateMediaFile } from '../utils/mediaFiles.js'
import { DEFAULT_TILE_STYLE, normalizeStyle } from '../utils/tileStyle.js'

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
  // id → object URL. Kept while any history entry still refers to the id.
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
    for (const [id, url] of assets.current) {
      if (live.has(id)) continue
      URL.revokeObjectURL(url)
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
      currentAssets.forEach((url) => URL.revokeObjectURL(url))
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
    setState((current) => {
      // Skip unchanged facts; tiles report them again every time they remount.
      const present = current.items.find((item) => item.id === id)
      if (present && Object.keys(patch).every((key) => present[key] === patch[key])) {
        return current
      }
      return {
      items: patchItem(current.items, id, patch),
      history: {
        ...current.history,
        past: current.history.past.map((snapshot) => patchItem(snapshot, id, patch)),
        future: current.history.future.map((snapshot) => patchItem(snapshot, id, patch)),
      },
      }
    })
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
    assets.current.set(id, url)
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
        // The source file, kept for autosave.
        blob: file,
        type: result.type,
        aspectRatio: DEFAULT_ASPECT_RATIO,
        style: DEFAULT_TILE_STYLE,
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

  /** Replaces everything with restored items, each carrying its `blob`. */
  function replaceAll(restored) {
    const next = restored.map((item) => ({ ...item, url: register(item.id, item.blob) }))
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

  // Slider drags on the same property of the same tile merge into one step.
  function setStyle(id, patch) {
    const tag = `style:${id}:${Object.keys(patch).join(',')}`
    commit((current) => {
      const item = current.find((candidate) => candidate.id === id)
      if (!item) return current
      const style = normalizeStyle({ ...item.style, ...patch })
      const unchanged = Object.keys(style).every((key) => style[key] === item.style?.[key])
      return unchanged ? current : patchItem(current, id, { style })
    }, tag)
  }

  // Both return `{ before, after }` item lists, or null when there was
  // nothing to do, so the caller can keep reveal mode in step.
  function applyStep(step) {
    if (!step) return null
    setState({ items: step.items, history: step.history })
    return { before: items, after: step.items }
  }

  const undo = () => applyStep(undoStep(history, items))
  const redo = () => applyStep(redoStep(history, items))

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
    setStyle,
    resetStyle: (id) => commit((current) => patchItem(current, id, { style: DEFAULT_TILE_STYLE })),
    reorder: (id, delta) => commit((current) => moveItem(current, id, delta), `reorder:${id}`),
    undo,
    redo,
  }
}

export default useMediaItems
