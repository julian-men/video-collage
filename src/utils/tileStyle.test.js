import { describe, expect, it } from 'vitest'
import { DEFAULT_TILE_STYLE, MAX_RADIUS, normalizeStyle, radiusPx } from './tileStyle.js'

describe('normalizeStyle', () => {
  it('fills in defaults', () => {
    expect(normalizeStyle()).toEqual(DEFAULT_TILE_STYLE)
    expect(normalizeStyle({ rotation: 10 })).toEqual({ ...DEFAULT_TILE_STYLE, rotation: 10 })
  })

  it('clamps out-of-range values', () => {
    expect(normalizeStyle({ rotation: 400, radius: 2, opacity: 0, shadow: 1 })).toEqual({
      rotation: 180,
      radius: MAX_RADIUS,
      opacity: 0.1,
      shadow: true,
    })
    expect(normalizeStyle({ rotation: -400, radius: -1, opacity: 5 })).toMatchObject({
      rotation: -180,
      radius: 0,
      opacity: 1,
    })
  })

  it('replaces non-numbers with defaults', () => {
    expect(normalizeStyle({ rotation: 'x', opacity: null })).toEqual(DEFAULT_TILE_STYLE)
  })
})

describe('radiusPx', () => {
  it('scales with the shorter side', () => {
    expect(radiusPx({ radius: 0.25 }, 400, 200)).toBe(50)
    expect(radiusPx({ radius: 0 }, 400, 200)).toBe(0)
  })
})
