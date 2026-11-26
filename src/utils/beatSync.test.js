import { describe, expect, it } from 'vitest'
import { parseBpm, revealAnchor, revealStepAt, visibleCountForStep } from './beatSync.js'

describe('parseBpm', () => {
  it('accepts values in range and rejects the rest', () => {
    expect(parseBpm('120')).toBe(120)
    expect(parseBpm('29')).toBeNull()
    expect(parseBpm('301')).toBeNull()
    expect(parseBpm('abc')).toBeNull()
  })
})

describe('revealAnchor', () => {
  it('shifts the first beat by the offset', () => {
    expect(revealAnchor(1, 250, 120)).toBeCloseTo(1.25)
  })

  it('moves to the next beat when the offset lands before the track starts', () => {
    // 120 BPM = 0.5 s beats; 0.1 s - 0.3 s = -0.2 s, so the next beat is 0.3 s.
    expect(revealAnchor(0.1, -300, 120)).toBeCloseTo(0.3)
  })
})

describe('revealStepAt', () => {
  it('counts reveal steps from the anchor', () => {
    expect(revealStepAt(0.99, 1, 60, 2)).toBe(0)
    expect(revealStepAt(1, 1, 60, 2)).toBe(1)
    expect(revealStepAt(2.99, 1, 60, 2)).toBe(1)
    expect(revealStepAt(3, 1, 60, 2)).toBe(2)
  })
})

describe('visibleCountForStep', () => {
  it('stops at the total without repeat', () => {
    expect(visibleCountForStep(0, 3, false)).toBe(0)
    expect(visibleCountForStep(5, 3, false)).toBe(3)
  })

  it('cycles with an empty step when repeating', () => {
    expect([1, 2, 3, 4, 5].map((step) => visibleCountForStep(step, 3, true))).toEqual([1, 2, 3, 0, 1])
  })
})
