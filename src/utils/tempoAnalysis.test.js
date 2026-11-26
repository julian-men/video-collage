import { describe, expect, it } from 'vitest'
import { analyzeTempo } from './tempoAnalysis.js'

// A click every beat, starting at `firstBeat` seconds.
function clickTrack(bpm, seconds, sampleRate, firstBeat = 0) {
  const samples = new Float32Array(seconds * sampleRate)
  const period = (60 / bpm) * sampleRate
  for (let beat = firstBeat * sampleRate; beat < samples.length; beat += period) {
    for (let i = 0; i < 0.02 * sampleRate; i += 1) {
      const index = Math.round(beat) + i
      if (index >= samples.length) break
      samples[index] = Math.sin((2 * Math.PI * 1000 * i) / sampleRate) * Math.exp(-i / 100)
    }
  }
  return samples
}

describe('analyzeTempo', () => {
  it.each([90, 120, 150])('finds %i BPM in a click track', (bpm) => {
    const result = analyzeTempo([clickTrack(bpm, 20, 22050)], 22050)
    expect(result.ok).toBe(true)
    expect(result.bpm).toBeGreaterThan(bpm - 1)
    expect(result.bpm).toBeLessThan(bpm + 1)
  })

  it('finds the first beat', () => {
    const result = analyzeTempo([clickTrack(120, 20, 22050, 0.25)], 22050)
    expect(result.firstBeat % 0.5).toBeCloseTo(0.25, 1)
  })

  it('reports silence as a failure instead of a tempo', () => {
    expect(analyzeTempo([new Float32Array(22050 * 10)], 22050).ok).toBe(false)
  })
})
