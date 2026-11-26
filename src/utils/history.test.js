import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT,
  MERGE_MS,
  checkpoint,
  emptyHistory,
  redo,
  referencedIds,
  undo,
} from './history.js'

const a = [{ id: 'a' }]
const ab = [{ id: 'a' }, { id: 'b' }]

describe('history', () => {
  it('undoes and redoes a checkpoint', () => {
    const history = checkpoint(emptyHistory(), a, null, 0)
    const undone = undo(history, ab)
    expect(undone.items).toBe(a)
    const redone = redo(undone.history, undone.items)
    expect(redone.items).toBe(ab)
    expect(redone.history.past).toEqual([a])
  })

  it('returns null when there is nothing to undo or redo', () => {
    expect(undo(emptyHistory(), a)).toBeNull()
    expect(redo(emptyHistory(), a)).toBeNull()
  })

  it('merges checkpoints with the same tag inside the merge window', () => {
    let history = checkpoint(emptyHistory(), a, 'style:a:opacity', 0)
    history = checkpoint(history, ab, 'style:a:opacity', MERGE_MS - 1)
    expect(history.past).toEqual([a])
    history = checkpoint(history, ab, 'style:a:opacity', MERGE_MS * 3)
    expect(history.past).toHaveLength(2)
  })

  it('never merges untagged or differently tagged checkpoints', () => {
    let history = checkpoint(emptyHistory(), a, null, 0)
    history = checkpoint(history, a, null, 1)
    history = checkpoint(history, a, 'x', 2)
    history = checkpoint(history, a, 'y', 3)
    expect(history.past).toHaveLength(4)
  })

  it('keeps at most HISTORY_LIMIT entries, dropping the oldest', () => {
    let history = emptyHistory()
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
      history = checkpoint(history, [{ id: String(i) }], null, i)
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    expect(history.past[0][0].id).toBe('5')
  })

  it('clears redo after a new checkpoint', () => {
    const undone = undo(checkpoint(emptyHistory(), a, null, 0), ab)
    expect(undone.history.future).toHaveLength(1)
    expect(checkpoint(undone.history, a, null, 1).future).toHaveLength(0)
  })

  it('collects ids from the past, the future, and the present', () => {
    const history = { ...emptyHistory(), past: [[{ id: 'p' }]], future: [[{ id: 'f' }]] }
    expect(referencedIds(history, [{ id: 'n' }])).toEqual(new Set(['p', 'f', 'n']))
  })
})
