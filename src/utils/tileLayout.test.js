import { describe, expect, it } from 'vitest'
import { getTileRect } from './tileLayout.js'

describe('getTileRect', () => {
  it('places a tile within the free space', () => {
    const rect = getTileRect({ width: 200, aspectRatio: 2, x: 0.5, y: 1 }, { width: 1000, height: 600 })
    expect(rect).toMatchObject({ width: 200, left: 400, top: 500, maxLeft: 800, maxTop: 500 })
  })

  it('shrinks a tile that would not fit, keeping its aspect ratio', () => {
    const rect = getTileRect({ width: 800, aspectRatio: 1, x: 0, y: 0 }, { width: 1000, height: 300 })
    expect(rect.width).toBe(300)
    expect(rect.maxTop).toBe(0)
  })
})
