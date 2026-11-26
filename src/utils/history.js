// Undo history for the collage items. Each entry is a full snapshot of the
// items array; snapshots share unchanged item objects, so they're cheap.
export const HISTORY_LIMIT = 50
// Repeated changes with the same tag (one slider being dragged) inside this
// window become one undo step.
export const MERGE_MS = 800

export function emptyHistory() {
  return { past: [], future: [], lastTag: null, lastTime: 0 }
}

/** Records `items` (the state before a change) as an undo step. */
export function checkpoint(history, items, tag, now) {
  if (tag !== null && tag === history.lastTag && now - history.lastTime < MERGE_MS) {
    return { ...history, lastTime: now }
  }
  return {
    past: [...history.past, items].slice(-HISTORY_LIMIT),
    future: [],
    lastTag: tag,
    lastTime: now,
  }
}

export function undo(history, items) {
  if (history.past.length === 0) return null
  return {
    items: history.past.at(-1),
    history: {
      past: history.past.slice(0, -1),
      future: [items, ...history.future],
      lastTag: null,
      lastTime: 0,
    },
  }
}

export function redo(history, items) {
  if (history.future.length === 0) return null
  return {
    items: history.future[0],
    history: {
      past: [...history.past, items],
      future: history.future.slice(1),
      lastTag: null,
      lastTime: 0,
    },
  }
}

/** Ids of every item that undo or redo could bring back, plus the present. */
export function referencedIds(history, items) {
  const ids = new Set()
  for (const snapshot of [...history.past, items, ...history.future]) {
    for (const item of snapshot) ids.add(item.id)
  }
  return ids
}
