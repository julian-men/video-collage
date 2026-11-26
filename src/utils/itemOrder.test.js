import { describe, expect, it } from 'vitest'
import { moveItem } from './itemOrder.js'

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const ids = (list) => list.map((item) => item.id).join('')

describe('moveItem', () => {
  it('moves an item earlier or later', () => {
    expect(ids(moveItem(items, 'b', -1))).toBe('bac')
    expect(ids(moveItem(items, 'b', 1))).toBe('acb')
  })

  it('returns the same array at either end or for an unknown id', () => {
    expect(moveItem(items, 'a', -1)).toBe(items)
    expect(moveItem(items, 'c', 1)).toBe(items)
    expect(moveItem(items, 'x', 1)).toBe(items)
  })
})
