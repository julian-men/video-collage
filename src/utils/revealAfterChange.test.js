import { describe, expect, it } from 'vitest'
import { revealCountAfterChange } from './revealAfterChange.js'

const list = (ids) => [...ids].map((id) => ({ id }))

describe('revealCountAfterChange', () => {
  it('shows a restored item that sits among the shown ones', () => {
    // 4 of [1,3,4,5,6] shown; undo brings back 2 → 1..5 shown.
    expect(revealCountAfterChange(list('13456'), list('123456'), 4)).toBe(5)
  })

  it('hides nothing new when an item is removed again', () => {
    // 5 of [1..6] shown; redo removes 2 → [1,3,4,5] still shown, 6 hidden.
    expect(revealCountAfterChange(list('123456'), list('13456'), 5)).toBe(4)
  })

  it('keeps the count when the same items are only rearranged', () => {
    expect(revealCountAfterChange(list('123'), list('321'), 1)).toBe(1)
  })

  it('shows nothing when nothing was shown', () => {
    expect(revealCountAfterChange(list('12'), list('123'), 0)).toBe(0)
  })
})
