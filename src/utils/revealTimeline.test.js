import { describe, expect, it } from 'vitest'
import { autoBeatsPerReveal, itemsShownBefore, revealCountAt } from './revealTimeline.js'

describe('autoBeatsPerReveal', () => {
  it('picks the widest spacing that still shows every item', () => {
    // 120 BPM: 32 beats = 16 s, so 200 s fits 13 reveals; 64 beats fits only 7.
    expect(autoBeatsPerReveal({ duration: 200, anchor: 0, bpm: 120, total: 10 })).toBe(32)
  })

  it('accounts for the first beat', () => {
    // 120 BPM, anchor at 100 s: 100 s left fits 7 reveals at 32 beats, 13 at 16.
    expect(autoBeatsPerReveal({ duration: 200, anchor: 100, bpm: 120, total: 10 })).toBe(16)
  })

  it('falls back to one beat when the song is too short', () => {
    expect(autoBeatsPerReveal({ duration: 3, anchor: 0, bpm: 120, total: 10 })).toBe(1)
  })

  it('needs a known duration', () => {
    expect(autoBeatsPerReveal({ duration: 0, anchor: 0, bpm: 120, total: 3 })).toBe(1)
  })
})

describe('revealCountAt', () => {
  it('shows one item at the start of an interval reveal and adds one per interval', () => {
    const timeline = { kind: 'interval', intervalSeconds: 3 }
    expect(revealCountAt(timeline, 0, 5)).toBe(1)
    expect(revealCountAt(timeline, 2.99, 5)).toBe(1)
    expect(revealCountAt(timeline, 3, 5)).toBe(2)
    expect(revealCountAt(timeline, 100, 5)).toBe(5)
  })

  it('follows beats, with nothing before the anchor', () => {
    const timeline = { kind: 'beats', anchor: 1, bpm: 60, beatsPerReveal: 2 }
    expect(revealCountAt(timeline, 0.5, 3)).toBe(0)
    expect(revealCountAt(timeline, 1, 3)).toBe(1)
    expect(revealCountAt(timeline, 3, 3)).toBe(2)
    expect(revealCountAt(timeline, 60, 3)).toBe(3)
  })

  it('cycles through an empty step when repeating', () => {
    const timeline = { kind: 'beats', anchor: 0, bpm: 60, beatsPerReveal: 1, repeat: true }
    expect([0, 1, 2, 3, 4].map((t) => revealCountAt(timeline, t, 3))).toEqual([1, 2, 3, 0, 1])
  })
})

describe('itemsShownBefore', () => {
  it('does not count a reveal that lands exactly at the end', () => {
    const timeline = { anchor: 0, bpm: 60, beatsPerReveal: 1 }
    expect(itemsShownBefore(timeline, 3, 10)).toBe(3)
    expect(itemsShownBefore(timeline, 3.01, 10)).toBe(4)
  })
})
